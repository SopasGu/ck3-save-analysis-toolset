export const DEFAULT_SENTINEL_VALUES = ['0', '-1', '', 'none', 'null'];

export function discoverIdentityReferences(collectionCatalog, options = {}) {
  const collector = new IdentityReferenceCollector(collectionCatalog, options);
  return collector;
}

export class IdentityReferenceCollector {
  constructor(collectionCatalog, options = {}) {
    const {
      sentinelValues = DEFAULT_SENTINEL_VALUES,
      sampleLimit = 5,
      maxReferenceCandidates = 1000,
      maxTargetDomains = 50,
    } = options;
    this.sampleLimit = sampleLimit;
    this.maxReferenceCandidates = maxReferenceCandidates;
    this.maxTargetDomains = maxTargetDomains;
    this.sentinelValues = new Set(sentinelValues.map((v) => String(v)));
    this.identityDomains = buildIdentityDomains(collectionCatalog);
    this.mapDomains = this.identityDomains.filter((d) => d.collectionChildKeyKind === 'map');
    this.domainByCollectionPointer = new Map(
      this.mapDomains.map((d) => [d.collectionPointer, d]),
    );
    this.mapCollectionPatterns = this.mapDomains
      .map((d) => ({
        pointer: d.collectionPointer,
        segments: pointerSegments(d.collectionPointer),
      }))
      .sort((a, b) => b.segments.length - a.segments.length);
    this.sourceCollections = (collectionCatalog.candidateCollections ?? [])
      .slice()
      .sort((a, b) => pointerSegments(b.pointer).length - pointerSegments(a.pointer).length);
    this.sourceCollectionByRecordPrefix = new Map();
    for (const collection of this.sourceCollections) {
      const recordPrefix = collection.childKeyKind === 'map'
        ? `${collection.pointer}.<key>`
        : collection.pointer;
      this.sourceCollectionByRecordPrefix.set(recordPrefix, collection);
    }
    this.fieldStats = new Map();
    this.totalPrimitiveObservations = 0;
  }

  observe(obs) {
    this._maybeIndexIdentityKey(obs);
    if (!isPrimitive(obs.valueType)) return;
    this.totalPrimitiveObservations++;

    const normalizedPointer = this.normalizePointer(obs.pointer);
    const sourceCollection = this._sourceCollectionFor(normalizedPointer);
    if (!sourceCollection) return;

    const stat = getOrCreate(this.fieldStats, normalizedPointer, () => ({
      fieldPointer: normalizedPointer,
      sourceCollectionId: `collection:${sourceCollection.pointer}`,
      sourceCollectionPointer: sourceCollection.pointer,
      denominator: sourceCollection.recordCount ?? sourceCollection.populationCount ?? 0,
      observedCount: 0,
      nullCount: 0,
      sentinelCount: 0,
      values: new Map(),
      samples: [],
    }));

    stat.observedCount++;
    if (obs.valueType === 'null') {
      stat.nullCount++;
      return;
    }

    const valueKey = valueToKey(obs.value);
    if (this.sentinelValues.has(valueKey)) {
      stat.sentinelCount++;
      return;
    }

    const valueStat = getOrCreate(stat.values, valueKey, () => ({
      value: obs.value,
      valueType: obs.valueType,
      count: 0,
    }));
    valueStat.count++;
    if (stat.samples.length < this.sampleLimit && !stat.samples.includes(valueKey)) {
      stat.samples.push(valueKey);
    }
  }

  _maybeIndexIdentityKey(obs) {
    if (obs.parentPointer === null || obs.parentPointer === undefined) return;
    const parentPointer = this.normalizePointer(obs.parentPointer);
    const domain = this.domainByCollectionPointer.get(parentPointer);
    if (!domain) return;
    const rawKey = obs.key ?? obs.index;
    if (rawKey === null || rawKey === undefined) return;
    const key = String(rawKey);
    if (!domain.keys.has(key)) {
      if (domain.sampleKeys.length < this.sampleLimit) domain.sampleKeys.push(key);
      domain.keyTypes.add(classifyKey(key));
    }
    domain.keys.add(key);
  }

  _sourceCollectionFor(normalizedPointer) {
    const segments = pointerSegments(normalizedPointer);
    for (let len = segments.length - 1; len >= 0; len--) {
      const prefix = pointerFromSegments(segments.slice(0, len));
      const collection = this.sourceCollectionByRecordPrefix.get(prefix);
      if (collection) return collection;
    }
    return null;
  }

  normalizePointer(pointer) {
    let segments = pointerSegments(pointer);
    let changed = true;
    while (changed) {
      changed = false;
      for (const { segments: collectionSegments } of this.mapCollectionPatterns) {
        if (
          segments.length > collectionSegments.length &&
          prefixMatches(segments, collectionSegments) &&
          segments[collectionSegments.length] !== '<key>'
        ) {
          segments = [
            ...segments.slice(0, collectionSegments.length),
            '<key>',
            ...segments.slice(collectionSegments.length + 1),
          ];
          changed = true;
        }
      }
    }
    return pointerFromSegments(segments);
  }

  result() {
    const publicDomains = this.identityDomains
      .map((d) => ({
        id: d.id,
        collectionId: d.collectionId,
        collectionPointer: d.collectionPointer,
        collectionChildKeyKind: d.collectionChildKeyKind,
        populationCount: d.populationCount,
        keyCount: d.keys.size,
        keyTypes: Array.from(d.keyTypes).sort(),
        sampleKeys: d.sampleKeys,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const referenceCandidates = [];
    const keyIndex = buildKeyIndex(this.identityDomains);
    for (const stat of this.fieldStats.values()) {
      const candidate = finalizeFieldCandidate(stat, keyIndex, {
        sampleLimit: this.sampleLimit,
        maxTargetDomains: this.maxTargetDomains,
      });
      if (candidate.targetDomainEvidence.length === 0) continue;
      referenceCandidates.push(candidate);
    }

    referenceCandidates.sort((a, b) => {
      if (b.resolvedCount !== a.resolvedCount) return b.resolvedCount - a.resolvedCount;
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      return a.fieldPointer.localeCompare(b.fieldPointer);
    });
    const totalReferenceCandidates = referenceCandidates.length;
    const boundedReferenceCandidates = referenceCandidates.slice(0, this.maxReferenceCandidates);
    const ambiguityReport = [];
    for (const candidate of boundedReferenceCandidates) {
      if (
        candidate.ambiguousValueCount > 0 ||
        candidate.targetDomainEvidence.length > 1 ||
        candidate.omittedTargetDomainCount > 0
      ) {
        ambiguityReport.push({
          fieldPointer: candidate.fieldPointer,
          targetDomainIds: candidate.targetDomainIds,
          ambiguousValueCount: candidate.ambiguousValueCount,
          ambiguousObservationCount: candidate.ambiguousObservationCount,
          omittedTargetDomainCount: candidate.omittedTargetDomainCount,
          sampleAmbiguousValues: candidate.sampleAmbiguousValues,
        });
      }
    }

    return {
      summary: {
        identityDomains: publicDomains.length,
        mapIdentityDomains: publicDomains.filter((d) => d.collectionChildKeyKind === 'map').length,
        referenceCandidates: boundedReferenceCandidates.length,
        totalReferenceCandidates,
        referenceCandidateLimit: this.maxReferenceCandidates,
        ambiguousReferenceCandidates: ambiguityReport.length,
        primitiveObservations: this.totalPrimitiveObservations,
      },
      identityDomains: publicDomains,
      referenceCandidates: boundedReferenceCandidates,
      ambiguityReport,
    };
  }
}

function buildIdentityDomains(collectionCatalog) {
  return (collectionCatalog.candidateCollections ?? [])
    .filter((collection) => collection.childKeyKind === 'map')
    .map((collection) => ({
      id: `identity_domain:${collection.pointer}.<key>`,
      collectionId: collection.id,
      collectionPointer: collection.pointer,
      collectionChildKeyKind: collection.childKeyKind,
      populationCount: collection.populationCount,
      keys: new Set(),
      keyTypes: new Set(),
      sampleKeys: [],
    }));
}

function finalizeFieldCandidate(stat, keyIndex, options) {
  const { sampleLimit, maxTargetDomains } = options;
  const targetDomainEvidenceById = new Map();
  let resolvedCount = 0;
  let ambiguousValueCount = 0;
  let ambiguousObservationCount = 0;
  let unresolvedCount = 0;
  let omittedTargetDomainCount = 0;
  let omittedTargetDomainObservationCount = 0;
  const sampleResolvedValues = [];
  const sampleUnresolvedValues = [];
  const sampleAmbiguousValues = [];

  for (const valueStat of stat.values.values()) {
    const key = valueToKey(valueStat.value);
    const matchingDomains = keyIndex.get(key) ?? [];
    if (matchingDomains.length === 0) {
      unresolvedCount += valueStat.count;
      pushSample(sampleUnresolvedValues, key, sampleLimit);
      continue;
    }
    resolvedCount += valueStat.count;
    pushSample(sampleResolvedValues, key, sampleLimit);
    if (matchingDomains.length > 1) {
      ambiguousValueCount++;
      ambiguousObservationCount += valueStat.count;
      pushSample(sampleAmbiguousValues, key, sampleLimit);
    }
    for (const domain of matchingDomains) {
      let evidence = targetDomainEvidenceById.get(domain.id);
      if (!evidence) {
        if (targetDomainEvidenceById.size >= maxTargetDomains) {
          omittedTargetDomainCount++;
          omittedTargetDomainObservationCount += valueStat.count;
          continue;
        }
        evidence = {
          targetDomainId: domain.id,
          resolvedCount: 0,
          distinctValueCount: 0,
          sampleValues: [],
        };
        targetDomainEvidenceById.set(domain.id, evidence);
      }
      evidence.resolvedCount += valueStat.count;
      evidence.distinctValueCount++;
      pushSample(evidence.sampleValues, key, sampleLimit);
    }
  }

  const denominator = stat.denominator || stat.observedCount;
  const missingCount = Math.max(denominator - stat.observedCount, 0);
  const numerator = resolvedCount;
  const scoredDenominator = Math.max(denominator - stat.nullCount - stat.sentinelCount, 0);
  const coverage = scoredDenominator > 0 ? numerator / scoredDenominator : 0;

  const targetDomainEvidence = Array.from(targetDomainEvidenceById.values()).sort((a, b) => {
    if (b.resolvedCount !== a.resolvedCount) return b.resolvedCount - a.resolvedCount;
    return a.targetDomainId.localeCompare(b.targetDomainId);
  });

  return {
    id: `reference_candidate:${stat.fieldPointer}`,
    fieldPointer: stat.fieldPointer,
    sourceCollectionId: stat.sourceCollectionId,
    sourceCollectionPointer: stat.sourceCollectionPointer,
    targetDomainIds: targetDomainEvidence.map((e) => e.targetDomainId),
    evidence: {
      numerator,
      denominator,
      coverage,
      observedCount: stat.observedCount,
      resolvedCount,
      unresolvedCount,
      nullCount: stat.nullCount,
      sentinelCount: stat.sentinelCount,
      missingCount,
    },
    resolvedCount,
    coverage,
    ambiguousValueCount,
    ambiguousObservationCount,
    omittedTargetDomainCount,
    omittedTargetDomainObservationCount,
    sampleResolvedValues,
    sampleUnresolvedValues,
    sampleAmbiguousValues,
    targetDomainEvidence,
    notes: [],
  };
}

function buildKeyIndex(domains) {
  const index = new Map();
  for (const domain of domains) {
    for (const key of domain.keys) {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(domain);
    }
  }
  for (const matches of index.values()) {
    matches.sort((a, b) => a.id.localeCompare(b.id));
  }
  return index;
}

function getOrCreate(map, key, create) {
  if (!map.has(key)) map.set(key, create());
  return map.get(key);
}

function isPrimitive(valueType) {
  return valueType === 'string' || valueType === 'number' || valueType === 'boolean' || valueType === 'null';
}

function valueToKey(value) {
  return String(value);
}

function classifyKey(key) {
  if (/^\d+$/.test(key)) return 'numeric_string';
  if (/^-?\d+(?:\.\d+)?$/.test(key)) return 'number_like_string';
  return 'string';
}

function pushSample(samples, value, sampleLimit) {
  if (samples.length < sampleLimit && !samples.includes(value)) samples.push(value);
}

export function pointerSegments(pointer) {
  if (pointer === '$') return [];
  if (!pointer.startsWith('$')) throw new Error(`Invalid pointer: ${pointer}`);
  const segments = [];
  let i = 1;
  while (i < pointer.length) {
    if (pointer[i] === '.') {
      i++;
      let j = i;
      while (j < pointer.length && pointer[j] !== '.' && pointer[j] !== '[') j++;
      segments.push(pointer.slice(i, j));
      i = j;
    } else if (pointer[i] === '[') {
      const end = pointer.indexOf(']', i);
      if (end === -1) throw new Error(`Invalid pointer segment: ${pointer}`);
      const inner = pointer.slice(i + 1, end);
      if (/^\d+$/.test(inner)) {
        segments.push(inner);
      } else if (inner.startsWith("'") && inner.endsWith("'")) {
        segments.push(inner.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
      } else {
        segments.push(inner);
      }
      i = end + 1;
    } else {
      throw new Error(`Invalid pointer segment at ${i}: ${pointer}`);
    }
  }
  return segments;
}

function pointerFromSegments(segments) {
  let pointer = '$';
  for (const segment of segments) {
    if (segment === '<key>') {
      pointer += '.<key>';
    } else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) {
      pointer += `.${segment}`;
    } else {
      pointer += `['${String(segment).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`;
    }
  }
  return pointer;
}

function prefixMatches(segments, prefix) {
  if (segments.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] === '<key>') continue;
    if (segments[i] !== prefix[i]) return false;
  }
  return true;
}
