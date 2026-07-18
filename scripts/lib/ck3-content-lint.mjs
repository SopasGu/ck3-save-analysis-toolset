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
