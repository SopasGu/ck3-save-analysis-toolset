import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_MAX_JSON_BYTES = 1024 * 1024;
export const DEFAULT_OVERSIZED_JSON_ALLOWLIST = [
  'knowledge/schema/graph.json',
];

export const SOURCE_PATH_PATTERNS = [
  {
    id: 'state-artifact-path',
    description: 'Reference to an ignored state/ artifact',
    regex:
      '(?:^|[^\\w.])state/(?:rakaly-cli/)?(?:output/ingest/|screenshots/|wiki-build/|instance-graphs/|discovery/)[\\w./_-]+',
  },
  {
    id: 'ck3-save-filename',
    description: 'Reference to a .ck3 save file',
    regex: '\\b[\\w./_-]+\\.ck3(?:\\.gz)?\\b',
  },
  {
    id: 'compressed-rakaly-filename',
    description: 'Reference to a compressed Rakaly JSON artifact',
    regex: '\\b[\\w./_-]+\\.json\\.gz\\b',
  },
  {
    id: 'zip-archive-filename',
    description: 'Reference to a .zip archive',
    regex: '\\b[\\w./_-]+\\.zip\\b',
  },
];

export function walkPaths(inputs) {
  const out = [];
  for (const input of inputs) {
    if (!fs.existsSync(input)) continue;
    const stat = fs.statSync(input);
    if (stat.isFile()) {
      out.push(input);
    } else if (stat.isDirectory()) {
      const entries = fs.readdirSync(input, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(input, entry.name);
        if (entry.isDirectory()) out.push(...walkPaths([full]));
        else if (entry.isFile()) out.push(full);
      }
    }
  }
  return out;
}

function findMatches(line, regex) {
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  const out = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    out.push(m[0]);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

export function lintFile(filePath, options = {}) {
  const maxJsonBytes = options.maxJsonBytes ?? DEFAULT_MAX_JSON_BYTES;
  const oversizedJsonAllowlist =
    options.oversizedJsonAllowlist ?? DEFAULT_OVERSIZED_JSON_ALLOWLIST;
  const identifiers = options.identifiers ?? [];
  const findings = [];

  const stat = fs.statSync(filePath);
  if (
    filePath.endsWith('.json') &&
    stat.size > maxJsonBytes &&
    !isAllowlisted(filePath, oversizedJsonAllowlist)
  ) {
    findings.push({
      file: filePath,
      detector: 'oversized_json',
      message: `JSON file is ${stat.size} bytes; threshold is ${maxJsonBytes}`,
    });
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    findings.push({
      file: filePath,
      detector: 'read_error',
      message: `Failed to read file: ${err.message}`,
    });
    return findings;
  }

  const lines = content.split('\n');

  for (const pattern of SOURCE_PATH_PATTERNS) {
    const re = new RegExp(pattern.regex, 'gi');
    for (let i = 0; i < lines.length; i++) {
      const matches = findMatches(lines[i], re);
      for (const match of matches) {
        findings.push({
          file: filePath,
          line: i + 1,
          detector: pattern.id,
          message: `${pattern.description}: "${match.trim()}"`,
        });
      }
    }
  }

  for (const id of identifiers) {
    const re = new RegExp(id.pattern, 'gi');
    for (let i = 0; i < lines.length; i++) {
      const matches = findMatches(lines[i], re);
      for (const match of matches) {
        findings.push({
          file: filePath,
          line: i + 1,
          detector: 'campaign_identifier',
          message: `${id.id}: ${id.description || ''} - "${match.trim()}"`,
        });
      }
    }
  }

  if (filePath.endsWith('.json') && /\bclaims\.json$/.test(filePath)) {
    findings.push(...lintClaimLedger(filePath, content, options));
  }

  return findings;
}

export function lintClaimLedger(filePath, content, options = {}) {
  const findings = [];
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    return findings;
  }
  const claims = Array.isArray(parsed?.claims) ? parsed.claims : [];
  const mechanicsKinds = new Set(['collection_name', 'identity_domain_name', 'field_name', 'record_type_name', 'mechanics_concept']);
  const statusesRequiringDocumentation = new Set(['supported', 'partially_supported']);

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    if (!claim || typeof claim !== 'object') continue;
    const status = claim.status;
    const kind = claim.semanticKind;
    const scope = claim.scope ?? {};
    const evidence = Array.isArray(claim.supportingEvidence) ? claim.supportingEvidence : [];
    const hasDocEvidence = evidence.some((e) => e && e.kind === 'documentation_source');
    const versions = Array.isArray(scope.gameVersions) ? scope.gameVersions : [];

    if (statusesRequiringDocumentation.has(status) && mechanicsKinds.has(kind) && !hasDocEvidence) {
      findings.push({
        file: filePath,
        detector: 'uncited_mechanics_claim',
        message: `claim[${i}] ${claim.claimId ?? ''} status=${status} semanticKind=${kind} is missing documentation_source evidence`,
      });
    }

    if ((status === 'proposed' || status === 'supported' || status === 'partially_supported')
        && versions.length === 0
        && kind !== undefined
        && mechanicsKinds.has(kind)) {
      findings.push({
        file: filePath,
        detector: 'missing_version_scope',
        message: `claim[${i}] ${claim.claimId ?? ''} status=${status} has empty scope.gameVersions`,
      });
    }
  }
  return findings;
}

function isAllowlisted(filePath, allowlist) {
  const normalized = filePath.replace(/\\/g, '/');
  return allowlist.some((allowed) => normalized.endsWith(allowed));
}

export function lintPaths(inputs, options = {}) {
  const files = walkPaths(inputs);
  const findings = [];
  for (const f of files) {
    findings.push(...lintFile(f, options));
  }
  return findings;
}
