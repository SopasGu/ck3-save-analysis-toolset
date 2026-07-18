import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const SOURCE_ID_PREFIX = 'source:rakaly-specimen-';
export const SOURCE_ID_HASH_LEN = 16;

export const CLASSIFICATIONS = new Set([
  'public_git_history',
  'local_only',
  'external',
  'redistributed_with_permission',
]);

export function sha256OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export function sha256OfGzExpanded(gzPath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(gzPath);
    const gunzip = zlib.createGunzip();
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    stream.on('error', fail);
    gunzip.on('error', fail);
    gunzip.on('data', (chunk) => hash.update(chunk));
    gunzip.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(hash.digest('hex'));
    });
    stream.pipe(gunzip);
  });
}

export async function computeContentHashes(gzPath) {
  const compressedStat = fs.statSync(gzPath);
  if (!compressedStat.isFile()) {
    throw new Error(`Not a file: ${gzPath}`);
  }
  const compressedSha = await sha256OfFile(gzPath);
  const expandedSha = await sha256OfGzExpanded(gzPath);
  return {
    compressed: {
      path: gzPath,
      sha256: compressedSha,
      byteSize: compressedStat.size,
      compression: 'gzip',
    },
    expanded: {
      sha256: expandedSha,
    },
  };
}

export function deriveSourceId(expandedSha256) {
  if (typeof expandedSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(expandedSha256)) {
    throw new Error(`Invalid sha256: ${expandedSha256}`);
  }
  return SOURCE_ID_PREFIX + expandedSha256.slice(0, SOURCE_ID_HASH_LEN);
}

export async function inspectSource(gzPath) {
  const content = await computeContentHashes(gzPath);
  return {
    sourceId: deriveSourceId(content.expanded.sha256),
    kind: 'rakaly_save_specimen',
    content,
  };
}

export function loadRegistry(registryPath) {
  if (!fs.existsSync(registryPath)) {
    return { schemaVersion: 1, sources: [] };
  }
  const raw = fs.readFileSync(registryPath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Registry is not valid JSON: ${registryPath} (${err.message})`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Registry root must be an object: ${registryPath}`);
  }
  if (parsed.schemaVersion !== 1) {
    throw new Error(`Unsupported registry schemaVersion: ${parsed.schemaVersion} (expected 1)`);
  }
  if (!Array.isArray(parsed.sources)) {
    throw new Error(`Registry "sources" must be an array: ${registryPath}`);
  }
  for (const s of parsed.sources) {
    if (typeof s.sourceId !== 'string') {
      throw new Error(`Registry entry missing sourceId: ${registryPath}`);
    }
    if (!s.sourceId.startsWith('source:')) {
      throw new Error(`Registry entry has unexpected sourceId: ${s.sourceId}`);
    }
  }
  return parsed;
}

export function findSource(registry, sourceId) {
  return registry.sources.find((s) => s.sourceId === sourceId) || null;
}

export function addOrUpdateSource(registry, entry) {
  const idx = registry.sources.findIndex((s) => s.sourceId === entry.sourceId);
  if (idx >= 0) registry.sources[idx] = entry;
  else registry.sources.push(entry);
  registry.sources.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  return registry;
}

export function saveRegistry(registryPath, registry) {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
}

export function buildRegistryEntry(inspection, options = {}) {
  const classification = options.visibility?.classification ?? 'local_only';
  if (!CLASSIFICATIONS.has(classification)) {
    throw new Error(`Unknown classification: ${classification}`);
  }
  const entry = {
    sourceId: inspection.sourceId,
    kind: inspection.kind,
    label: options.label ?? 'Rakaly save specimen',
    acquiredAt: options.acquiredAt ?? null,
    content: {
      compressed: {
        sha256: inspection.content.compressed.sha256,
        byteSize: inspection.content.compressed.byteSize,
        compression: inspection.content.compressed.compression,
      },
      expanded: {
        sha256: inspection.content.expanded.sha256,
        byteSize: options.expandedByteSize ?? null,
      },
    },
    rakaly: options.rakaly ?? null,
    ck3: options.ck3 ?? null,
    saveGameDate: options.saveGameDate ?? null,
    dlc: options.dlc ?? [],
    mods: options.mods ?? [],
    visibility: {
      classification,
      rawArtifactCommitted: options.visibility?.rawArtifactCommitted ?? false,
      rationale:
        options.visibility?.rationale ??
        'Registered as a structural-discovery specimen. Per the evidence-graph plan, treat this source as evidence; do not promote its individual records into durable knowledge.',
    },
    structuralMeasurements: options.structuralMeasurements ?? null,
    notes: options.notes ?? [],
  };
  return entry;
}
