import fs from 'node:fs';
import path from 'node:path';

export const WIKI_KERNEL_VERSION = 1;

export const WIKI_PAGE_KINDS = {
  collection: 'collections',
  record_type: 'record-types',
  field: 'fields',
  identity_domain: 'identity-domains',
  mechanics_concept: 'mechanics',
};

const REQUIRED_SOURCE_FILES = [
  'knowledge/schema/graph.json',
  'knowledge/claims/claims.json',
];

export function generateWikiKernel({ graph, claims }, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const outDir = options.outDir ?? 'knowledge/wiki';
  const graphNodes = (graph.nodes ?? [])
    .filter((node) => Object.hasOwn(WIKI_PAGE_KINDS, node.kind))
    .sort(compareGraphItems);
  const graphNodeIds = new Set((graph.nodes ?? []).map((node) => node.id));
  const graphEdgeIds = new Set((graph.edges ?? []).map((edge) => edge.id));
  const claimsBySubject = indexClaimsBySubject(claims?.claims ?? []);
  const pageByGraphId = new Map(graphNodes.map((node) => [node.id, pagePathForNode(node)]));
  const linksByGraphId = relatedLinksByGraphId(graph, pageByGraphId);

  const files = new Map();
  files.set('AGENTS.md', renderWikiAgents());
  files.set('index.md', renderIndex({ graph, graphNodes, generatedAt, pageByGraphId }));
  files.set('log.md', renderLog({ graph, claims, generatedAt }));

  for (const node of graphNodes) {
    files.set(pagePathForNode(node), renderNodePage({
      node,
      graphNodeIds,
      graphEdgeIds,
      claims: claimsBySubject.get(node.id) ?? [],
      relatedLinks: linksByGraphId.get(node.id) ?? [],
      generatedAt,
    }));
  }

  return {
    wikiKernelVersion: WIKI_KERNEL_VERSION,
    outDir,
    generatedAt,
    files,
    summary: {
      pages: files.size,
      graphNodePages: graphNodes.length,
      pageKinds: countBy(graphNodes, (node) => node.kind),
    },
  };
}

export function writeWikiKernel(kernel, options = {}) {
  const outDir = options.outDir ?? kernel.outDir ?? 'knowledge/wiki';
  fs.mkdirSync(outDir, { recursive: true });
  for (const [relativePath, content] of kernel.files.entries()) {
    const target = path.join(outDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return {
    outDir,
    filesWritten: kernel.files.size,
    summary: kernel.summary,
  };
}

export function lintWikiKernel({ wikiDir, graph, claims }) {
  const findings = [];
  const graphNodeIds = new Set((graph.nodes ?? []).map((node) => node.id));
  const claimsById = new Map((claims.claims ?? []).map((claim) => [claim.claimId, claim]));
  const markdownFiles = walkMarkdown(wikiDir);
  const pageRefs = new Map();
  const linkedTargets = new Set(['AGENTS.md', 'index.md', 'log.md']);

  for (const file of markdownFiles) {
    const rel = toPosix(path.relative(wikiDir, file));
    const content = fs.readFileSync(file, 'utf8');
    const meta = parseFrontmatter(content);
    pageRefs.set(rel, { file, rel, content, meta });
  }

  for (const { rel, content } of pageRefs.values()) {
    for (const link of wikilinks(content)) {
      const target = normalizeWikiLink(link);
      if (!target) continue;
      const targetFile = target.endsWith('.md') ? target : `${target}.md`;
      if (!pageRefs.has(targetFile)) {
        findings.push({
          detector: 'broken_link',
          file: rel,
          message: `Broken wikilink [[${link}]]`,
        });
      } else {
        linkedTargets.add(targetFile);
      }
    }
  }

  for (const { rel, meta } of pageRefs.values()) {
    if (meta.pageType !== 'graph_node') continue;
    if (!meta.graphId) {
      findings.push({ detector: 'missing_graph_id', file: rel, message: 'Graph node page lacks graphId frontmatter' });
      continue;
    }
    if (!graphNodeIds.has(meta.graphId)) {
      findings.push({ detector: 'unknown_graph_id', file: rel, message: `Unknown graphId ${meta.graphId}` });
    }
    if (!Array.isArray(meta.provenanceSourceIds) || meta.provenanceSourceIds.length === 0) {
      findings.push({ detector: 'missing_provenance', file: rel, message: 'Graph node page lacks provenanceSourceIds' });
    }
    if (!linkedTargets.has(rel)) {
      findings.push({ detector: 'orphan_page', file: rel, message: 'Graph node page is not linked from any other wiki page' });
    }
    if (meta.graphKind === 'mechanics_concept') {
      if (!Array.isArray(meta.claimIds) || meta.claimIds.length === 0) {
        findings.push({ detector: 'mechanics_missing_claim', file: rel, message: 'Mechanics page must list at least one claimId' });
      }
      if (!Array.isArray(meta.provenanceSourceIds) || meta.provenanceSourceIds.length === 0) {
        findings.push({ detector: 'mechanics_missing_source', file: rel, message: 'Mechanics page must list at least one sourceId' });
      }
    }
    for (const claimId of meta.claimIds ?? []) {
      const claim = claimsById.get(claimId);
      if (!claim) {
        findings.push({ detector: 'missing_claim', file: rel, message: `Claim ${claimId} is not in claims ledger` });
      } else if (claim.status === 'superseded' || claim.status === 'rejected' || (claim.supersededBy ?? []).length > 0) {
        findings.push({ detector: 'stale_claim', file: rel, message: `Claim ${claimId} is ${claim.status}` });
      }
    }
  }

  for (const { rel, meta } of pageRefs.values()) {
    if (meta.pageType === 'campaign_character' || meta.graphKind === 'campaign_character') {
      findings.push({ detector: 'campaign_character_page', file: rel, message: 'Wiki must not generate campaign-character pages' });
    }
  }

  return findings.sort((a, b) => `${a.file}:${a.detector}`.localeCompare(`${b.file}:${b.detector}`));
}

export function validateWikiKernel({ wikiDir, graph, claims }) {
  return lintWikiKernel({ wikiDir, graph, claims });
}

export function pagePathForNode(node) {
  return `pages/${WIKI_PAGE_KINDS[node.kind]}/${slugGraphId(node.id)}.md`;
}

function renderWikiAgents() {
  return `# CK3 Evidence Wiki Operating Schema

This directory is the durable Markdown wiki for the CK3 evidence graph project. It is a consumer layer over machine-readable source, schema, and claim ledgers; it must not replace them.

## Authoritative Inputs

- \`../schema/graph.json\` is the durable structural graph.
- \`../claims/claims.json\` is the semantic claim ledger.
- \`../sources/registry.json\` is the source registry.
- Raw saves, expanded Rakaly JSON, cache files, and generated private artifacts stay under ignored \`state/\`.

## Page Types

- \`index.md\` - human-oriented catalog for the wiki.
- \`log.md\` - append-only history of wiki ingests, schema updates, claim changes, query filings, and lint passes.
- \`pages/collections/*.md\` - generalized collection pages.
- \`pages/record-types/*.md\` - generalized record-type pages.
- \`pages/fields/*.md\` - generalized field pages.
- \`pages/identity-domains/*.md\` - generalized identity-domain pages.

## Frontmatter Rules

Graph node pages must include \`pageType: graph_node\`, \`graphId\`, \`graphKind\`, \`status\`, \`generatedFrom\`, \`claimIds\`, and \`provenanceSourceIds\`. Keep graph IDs as exact machine-readable strings. Use wikilinks for related wiki pages and inline backticks for graph IDs, pointers, claim IDs, and source IDs.

## Mandatory Operations

### ingest

Integrate new structural evidence or documentation by regenerating the machine-readable graph or claim ledger first, then regenerate or update wiki pages from those ledgers. Add a dated entry to \`log.md\` that names the input ledgers and summarizes the page/count changes.

### query

Answer from wiki pages only when the answer cites graph IDs, claim IDs, or source IDs. If a useful synthesis emerges, file it as a durable wiki page or claim update instead of leaving it only in chat.

### lint

Run \`npm run wiki:lint\` before handoff. Lint must catch broken wikilinks, orphan graph pages, stale or superseded claim references, missing graph IDs, missing provenance, and any campaign-character page.

## Boundaries

Pages describe generalized save structure. They must not enumerate campaign characters, save-record IDs, raw save paths, raw Rakaly JSON paths, or private instance data. Semantic claims remain marked as claims and never become structural observations.
`;
}

function renderIndex({ graph, graphNodes, generatedAt, pageByGraphId }) {
  const byKind = groupBy(graphNodes, (node) => node.kind);
  const lines = [
    '---',
    'pageType: index',
    `wikiKernelVersion: ${WIKI_KERNEL_VERSION}`,
    `generatedAt: ${JSON.stringify(generatedAt)}`,
    'generatedFrom:',
    ...REQUIRED_SOURCE_FILES.map((file) => `  - ${JSON.stringify(file)}`),
    '---',
    '',
    '# CK3 Evidence Wiki',
    '',
    'This wiki summarizes generalized CK3 save structure from the durable schema graph and semantic claim ledger. It intentionally excludes campaign-character pages and raw save artifacts.',
    '',
    '## Summary',
    '',
    `- Graph nodes: ${graph.nodes?.length ?? 0}`,
    `- Graph edges: ${graph.edges?.length ?? 0}`,
    `- Wiki graph pages: ${graphNodes.length}`,
  ];

  for (const [kind, directory] of Object.entries(WIKI_PAGE_KINDS)) {
    const nodes = byKind.get(kind) ?? [];
    lines.push('', `## ${title(kind)}`, '');
    if (kind === 'mechanics_concept') {
      const grouped = groupBy(nodes, (node) => node.properties?.topicGroup ?? 'unassigned');
      for (const [topicGroup, group] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        lines.push(`- ${title(topicGroup)} (${group.length}):`);
        for (const node of group.slice(0, 40)) {
          lines.push(`    - [[${trimMd(pageByGraphId.get(node.id))}|${escapePipe(node.label ?? node.id)}]] - \`${node.id}\``);
        }
        if (group.length > 40) lines.push(`    - ...and ${group.length - 40} more`);
      }
    } else if (nodes.length === 0) {
      lines.push('- None yet.');
    } else {
      for (const node of nodes) {
        lines.push(`- [[${trimMd(pageByGraphId.get(node.id))}|${escapePipe(node.label ?? node.id)}]] - \`${node.id}\``);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

function renderLog({ graph, claims, generatedAt }) {
  return `# CK3 Evidence Wiki Log

This append-only log records wiki ingests, schema updates, claim changes, query filings, and lint passes.

## ${generatedAt}

- operation: ingest
- graph nodes: ${graph.nodes?.length ?? 0}
- graph edges: ${graph.edges?.length ?? 0}
- semantic claims: ${claims.claims?.length ?? 0}
- generated wiki kernel version: ${WIKI_KERNEL_VERSION}
- inputs: \`knowledge/schema/graph.json\`, \`knowledge/claims/claims.json\`
- note: generated generalized structure pages only; no campaign-character pages.
`;
}

function renderNodePage({ node, claims, relatedLinks, generatedAt }) {
  const props = node.properties ?? {};
  const sourceIds = unique((node.provenance ?? []).map((p) => p.sourceId).filter(Boolean));
  const claimIds = claims.map((claim) => claim.claimId).sort();
  const pointer = props.pointer ?? props.collectionPointer ?? props.parentPointer ?? null;
  const lines = [
    '---',
    'pageType: graph_node',
    `wikiKernelVersion: ${WIKI_KERNEL_VERSION}`,
    `generatedAt: ${JSON.stringify(generatedAt)}`,
    `graphId: ${JSON.stringify(node.id)}`,
    `graphKind: ${JSON.stringify(node.kind)}`,
    `status: ${JSON.stringify(node.status ?? 'observed')}`,
    'generatedFrom:',
    ...REQUIRED_SOURCE_FILES.map((file) => `  - ${JSON.stringify(file)}`),
    'claimIds:',
    ...(claimIds.length ? claimIds.map((id) => `  - ${JSON.stringify(id)}`) : ['  []']),
    'provenanceSourceIds:',
    ...(sourceIds.length ? sourceIds.map((id) => `  - ${JSON.stringify(id)}`) : ['  []']),
    '---',
    '',
    `# ${node.label ?? node.id}`,
    '',
    `Graph ID: \`${node.id}\``,
    '',
    `Kind: \`${node.kind}\``,
    '',
  ];
  if (pointer) lines.push(`Pointer: \`${pointer}\``, '');
  if (node.kind === 'mechanics_concept') {
    if (props.topicGroup) lines.push(`Topic group: \`${props.topicGroup}\``, '');
    if (props.topic) lines.push(`Topic: \`${props.topic}\``, '');
    if (props.oldidUrl) lines.push(`Citation: ${props.oldidUrl}`, '');
    if (props.sectionAnchorCount !== undefined && props.sectionAnchorCount !== null) {
      lines.push(`Anchored section count: \`${props.sectionAnchorCount}\``, '');
    }
  }
  lines.push('## Evidence', '');
  for (const sourceId of sourceIds) {
    lines.push(`- Source: \`${sourceId}\``);
  }
  for (const prov of node.provenance ?? []) {
    lines.push(`- Observation: \`${prov.observationId}\` (${prov.layer ?? 'unknown'})`);
  }
  if (sourceIds.length === 0 && (node.provenance ?? []).length === 0) {
    lines.push('- No provenance recorded.');
  }

  lines.push('', '## Properties', '');
  for (const [key, value] of Object.entries(props).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`- ${key}: \`${formatValue(value)}\``);
  }
  if (Object.keys(props).length === 0) lines.push('- No properties recorded.');

  lines.push('', '## Claims', '');
  if (claims.length === 0) {
    lines.push(node.kind === 'mechanics_concept'
      ? '- No semantic claims currently cite this mechanics concept. Add a proposed claim via `scripts/ck3-documentation-claims`.'
      : '- No semantic claims currently cite this graph node.');
  } else {
    for (const claim of claims) {
      lines.push(`- \`${claim.claimId}\` (${claim.status}, confidence ${claim.confidence}): ${claim.proposition}`);
    }
  }

  lines.push('', '## Related Pages', '');
  if (relatedLinks.length === 0) {
    lines.push('- No related wiki pages are linked yet.');
  } else {
    for (const link of relatedLinks.slice(0, 40)) {
      lines.push(`- [[${trimMd(link.path)}|${escapePipe(link.label)}]] - ${link.edgeKind}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function relatedLinksByGraphId(graph, pageByGraphId) {
  const out = new Map();
  for (const edge of graph.edges ?? []) {
    if (pageByGraphId.has(edge.from) && pageByGraphId.has(edge.to)) {
      pushRelated(out, edge.from, { path: pageByGraphId.get(edge.to), label: edge.to, edgeKind: `${edge.kind} ->` });
      pushRelated(out, edge.to, { path: pageByGraphId.get(edge.from), label: edge.from, edgeKind: `<- ${edge.kind}` });
    }
  }
  for (const [key, links] of out.entries()) {
    const seen = new Set();
    out.set(key, links.filter((link) => {
      const sig = `${link.path}:${link.edgeKind}`;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    }).sort((a, b) => `${a.edgeKind}:${a.path}`.localeCompare(`${b.edgeKind}:${b.path}`)));
  }
  return out;
}

function pushRelated(map, graphId, link) {
  if (!map.has(graphId)) map.set(graphId, []);
  map.get(graphId).push(link);
}

function indexClaimsBySubject(claims) {
  const out = new Map();
  for (const claim of claims) {
    for (const id of claim.subjectGraphIds ?? []) {
      if (!out.has(id)) out.set(id, []);
      out.get(id).push(claim);
    }
  }
  return out;
}

function wikilinks(content) {
  const out = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(content)) !== null) out.push(m[1]);
  return out;
}

function normalizeWikiLink(link) {
  return link.split('|')[0].split('#')[0].trim();
}

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) return {};
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) return {};
  const lines = content.slice(4, end).split('\n');
  const out = {};
  let current = null;
  for (const line of lines) {
    const arrayMatch = /^  - (.*)$/.exec(line);
    if (arrayMatch && current) {
      if (!Array.isArray(out[current])) out[current] = [];
      out[current].push(parseScalar(arrayMatch[1]));
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line);
    if (!kv) continue;
    current = kv[1];
    const raw = kv[2] ?? '';
    if (raw === '') out[current] = [];
    else if (raw === '[]') out[current] = [];
    else out[current] = parseScalar(raw);
  }
  return out;
}

function parseScalar(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function walkMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out.sort();
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function groupBy(items, keyFn) {
  const out = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(item);
  }
  return out;
}

function unique(values) {
  return [...new Set(values)];
}

function compareGraphItems(a, b) {
  return `${a.kind}:${a.label}:${a.id}`.localeCompare(`${b.kind}:${b.label}:${b.id}`);
}

function slugGraphId(id) {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function trimMd(filePath) {
  return filePath.replace(/\.md$/i, '');
}

function title(kind) {
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapePipe(value) {
  return String(value).replace(/\|/g, '/');
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function toPosix(value) {
  return value.replace(/\\/g, '/');
}
