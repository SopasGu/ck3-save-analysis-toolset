import fs from 'node:fs';
import path from 'node:path';
import { discoverStructure } from './json-structure-discovery.mjs';
import { ShapeCollector } from './ck3-shape-fingerprints.mjs';
import { identifyCandidateCollections } from './ck3-candidate-collections.mjs';
import { IdentityReferenceCollector } from './ck3-identity-references.mjs';
import { generateSchemaGraph, validateSchemaGraph } from './ck3-schema-graph.mjs';
import { diffSchemaGraphs } from './ck3-schema-diff.mjs';
import { validateClaimLedger } from './ck3-semantic-claims.mjs';
import { lintWikiKernel } from './ck3-wiki-kernel.mjs';

export const MAINTENANCE_VERSION = 1;

const DEFAULTS = {
  graphPath: 'knowledge/schema/graph.json',
  claimsPath: 'knowledge/claims/claims.json',
  sourceRegistryPath: 'knowledge/sources/registry.json',
  wikiDir: 'knowledge/wiki',
  mechanicsDir: 'knowledge/wiki/mechanics-content',
  noChangeFixture: 'fixtures/schema/synthetic-diff-base.json',
  structuralBaseFixture: 'fixtures/schema/synthetic-diff-base.json',
  structuralNextFixture: 'fixtures/schema/synthetic-diff-new-field.json',
  maxItemsPerSection: 25,
};

export async function buildMaintenanceReport(options = {}) {
  const config = { ...DEFAULTS, ...options };
  const graph = readJson(config.graphPath);
  const claims = readJson(config.claimsPath);
  const sourceRegistry = readJson(config.sourceRegistryPath);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const checks = [];

  const graphErrors = validateSchemaGraph(graph);
  checks.push(checkResult({
    id: 'graph.valid',
    title: 'Schema graph validates',
    status: graphErrors.length ? 'fail' : 'ok',
    findings: graphErrors.map((message) => finding('graph_validation', config.graphPath, message)),
  }));

  const claimErrors = validateClaimLedger(claims, graph);
  checks.push(checkResult({
    id: 'claims.valid',
    title: 'Claim ledger validates against graph',
    status: claimErrors.length ? 'fail' : 'ok',
    findings: claimErrors.map((message) => finding('claim_validation', config.claimsPath, message)),
  }));

  const wikiFindings = lintWikiKernel({ wikiDir: config.wikiDir, graph, claims });
  checks.push(checkResult({
    id: 'wiki.lint',
    title: 'Wiki lint has no broken links, stale claims, or orphan graph pages',
    status: wikiFindings.length ? 'fail' : 'ok',
    findings: wikiFindings,
  }));

  checks.push(checkResult(mechanicsCitationCheck({
    sourceRegistry,
    claims,
    wikiDir: config.wikiDir,
    mechanicsDir: config.mechanicsDir,
  })));

  checks.push(checkResult(scopeCheck({ claims, sourceRegistry, claimsPath: config.claimsPath, sourceRegistryPath: config.sourceRegistryPath })));

  const noChange = await schemaDiffForFixtures(config.noChangeFixture, config.noChangeFixture, config);
  checks.push(checkResult({
    id: 'schema.no_change_fixture',
    title: 'No-change specimen produces no durable diff',
    status: noChange.summary.structuralChanges === 0 ? 'ok' : 'fail',
    findings: noChange.summary.structuralChanges === 0
      ? []
      : [finding('schema_diff', config.noChangeFixture, `Expected no structural changes, saw ${noChange.summary.structuralChanges}`)],
    details: noChange.summary,
  }));

  const structural = await schemaDiffForFixtures(config.structuralBaseFixture, config.structuralNextFixture, config);
  const structuralOk = structural.summary.structuralChanges > 0 &&
    Object.values(structural.summary.omitted ?? {}).every((count) => count === 0);
  checks.push(checkResult({
    id: 'schema.structural_fixture',
    title: 'Structural specimen change produces bounded review diff',
    status: structuralOk ? 'ok' : 'fail',
    findings: structuralOk
      ? []
      : [finding('schema_diff', config.structuralNextFixture, `Expected bounded structural changes, saw ${structural.summary.structuralChanges} changes with omitted=${JSON.stringify(structural.summary.omitted)}`)],
    details: structural.summary,
  }));

  const failures = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;
  return {
    schemaVersion: MAINTENANCE_VERSION,
    kind: 'ck3_maintenance_report',
    generatedAt,
    status: failures ? 'fail' : warnings ? 'warn' : 'ok',
    summary: {
      checks: checks.length,
      failures,
      warnings,
      graphNodes: graph.nodes?.length ?? 0,
      graphEdges: graph.edges?.length ?? 0,
      claims: claims.claims?.length ?? 0,
      semanticEdges: claims.semanticEdges?.length ?? 0,
    },
    checks,
    operations: {
      noChangeSpecimen: config.noChangeFixture,
      structuralChangeSpecimen: {
        base: config.structuralBaseFixture,
        next: config.structuralNextFixture,
      },
      versioningPolicy: 'docs/ck3-maintenance.md#versioning-policy',
      recoveryRunbook: 'docs/ck3-maintenance.md#bad-ingest-recovery',
    },
  };
}

export async function schemaDiffForFixtures(basePath, nextPath, options = {}) {
  const maxItemsPerSection = options.maxItemsPerSection ?? DEFAULTS.maxItemsPerSection;
  const [baseGraph, nextGraph] = await Promise.all([
    graphForFixture(basePath),
    graphForFixture(nextPath),
  ]);
  return diffSchemaGraphs(baseGraph, nextGraph, { maxItemsPerSection });
}

async function graphForFixture(filePath) {
  const shapeCollector = new ShapeCollector();
  await discoverStructure({ source: filePath, collector: shapeCollector });
  const shapeCatalog = {
    schemaVersion: 1,
    source: { sourceId: 'source:maintenance-fixture' },
    ...shapeCollector.result(),
  };
  const collectionCatalog = {
    schemaVersion: 1,
    source: { sourceId: 'source:maintenance-fixture' },
    ...identifyCandidateCollections(shapeCatalog.pathPatterns, { minPopulation: 2 }),
  };
  const referenceCollector = new IdentityReferenceCollector(collectionCatalog);
  await discoverStructure({ source: filePath, collector: referenceCollector });
  const referenceCatalog = {
    schemaVersion: 1,
    source: { sourceId: 'source:maintenance-fixture' },
    ...referenceCollector.result(),
  };
  return generateSchemaGraph({
    sourceRegistry: {
      schemaVersion: 1,
      sources: [{
        sourceId: 'source:maintenance-fixture',
        kind: 'synthetic_fixture',
        label: 'Maintenance fixture',
        visibility: { classification: 'synthetic' },
      }],
    },
    shapeCatalog,
    collectionCatalog,
    referenceCatalog,
  }, { sourceId: 'source:maintenance-fixture' });
}

function mechanicsCitationCheck({ sourceRegistry, claims, wikiDir, mechanicsDir }) {
  const sourceIds = new Set((sourceRegistry.sources ?? []).map((source) => source.sourceId));
  const citedSourceIds = new Set();
  for (const claim of claims.claims ?? []) {
    for (const evidence of claim.supportingEvidence ?? []) {
      if (evidence.kind === 'documentation_source' && evidence.id) citedSourceIds.add(evidence.id);
    }
  }
  for (const file of walkMarkdown(path.join(wikiDir, 'advisor'))) {
    const meta = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    for (const sourceId of meta.sourceIds ?? []) citedSourceIds.add(sourceId);
  }

  const findings = [];
  for (const file of walkMarkdown(mechanicsDir)) {
    const meta = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    if (!meta.sourceId) continue;
    if (!sourceIds.has(meta.sourceId)) {
      findings.push(finding('uncataloged_mechanics_source', file, `Mechanics page cites sourceId not present in registry: ${meta.sourceId}`));
    } else if (!citedSourceIds.has(meta.sourceId)) {
      findings.push(finding('uncited_mechanics_source', file, `Mechanics source is not cited by claims or advisor models: ${meta.sourceId}`));
    }
  }
  return {
    id: 'mechanics.citations',
    title: 'Mechanics pages cite registered sources used by claims or advisor models',
    status: findings.length ? 'fail' : 'ok',
    findings,
  };
}

function scopeCheck({ claims, sourceRegistry, claimsPath, sourceRegistryPath }) {
  const findings = [];
  for (const claim of claims.claims ?? []) {
    if (!claim.scope?.allDlcActive || !Array.isArray(claim.scope?.gameVersions) || claim.scope.gameVersions.length === 0) {
      findings.push(finding('stale_applicability', claimsPath, `Claim ${claim.claimId} lacks explicit all-DLC/version scope`));
    }
  }
  for (const source of sourceRegistry.sources ?? []) {
    if (source.kind !== 'documentation_mediawiki_page') continue;
    if (!source.scope?.allDlcActive || !Array.isArray(source.scope?.gameVersions) || source.scope.gameVersions.length === 0) {
      findings.push(finding('stale_applicability', sourceRegistryPath, `Documentation source ${source.sourceId} lacks all-DLC/version scope`));
    }
  }
  return {
    id: 'applicability.scope',
    title: 'Claims and documentation sources carry all-DLC/version applicability',
    status: findings.length ? 'fail' : 'ok',
    findings,
  };
}

function checkResult(check) {
  return {
    id: check.id,
    title: check.title,
    status: check.status,
    findings: (check.findings ?? []).map(normalizeFinding),
    ...(check.details ? { details: check.details } : {}),
  };
}

function finding(detector, file, message) {
  return { detector, file: toPosix(file), message };
}

function normalizeFinding(item) {
  return {
    detector: item.detector ?? 'unknown',
    file: toPosix(item.file ?? ''),
    message: item.message ?? String(item),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walkMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walkMarkdown(full));
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) return {};
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) return {};
  const out = {};
  let currentKey = null;
  for (const line of content.slice(4, end).split('\n')) {
    const list = /^  - (.*)$/.exec(line);
    if (list && currentKey) {
      if (!Array.isArray(out[currentKey])) out[currentKey] = [];
      out[currentKey].push(parseScalar(list[1]));
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line);
    if (!kv) continue;
    currentKey = kv[1];
    out[currentKey] = kv[2] ? parseScalar(kv[2]) : [];
  }
  return out;
}

function parseScalar(value) {
  const trimmed = String(value).trim();
  if (/^".*"$/.test(trimmed)) return JSON.parse(trimmed);
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed;
}

function toPosix(filePath) {
  return String(filePath).split(path.sep).join('/');
}
