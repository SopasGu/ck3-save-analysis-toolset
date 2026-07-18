export const DEFAULT_MIN_POPULATION = 5;
export const DEFAULT_COHERENCE_HIGH = 0.7;
export const DEFAULT_COHERENCE_VERY_HIGH = 0.9;

export function identifyCandidateCollections(pathPatterns, options = {}) {
  const {
    minPopulation = DEFAULT_MIN_POPULATION,
    coherenceHigh = DEFAULT_COHERENCE_VERY_HIGH,
    coherenceMid = DEFAULT_COHERENCE_HIGH,
  } = options;

  const collections = [];
  const recordTypes = new Map();
  const patternsByPointer = new Map();
  for (const pattern of pathPatterns) {
    patternsByPointer.set(pattern.pointer, pattern);
  }

  for (const pattern of pathPatterns) {
    if (pattern.pointer === '$') continue;

    if (pattern.childKeyKind === 'map') {
      const population = pattern.totalChildren ?? 0;
      const recordCount = pattern.recordCount ?? population;
      const coherence = computeMapCoherence(pattern);
      const placeholderPattern = patternsByPointer.get(pattern.pointer + '.<key>');
      const fingerprint = placeholderPattern?.shapeFingerprint ?? pattern.shapeFingerprint;

      if (population >= minPopulation) {
        const collection = {
          id: `collection:${pattern.pointer}`,
          pointer: pattern.pointer,
          childKeyKind: 'map',
          populationCount: population,
          recordCount,
          shapeFingerprint: fingerprint,
          recordTypeIds: [],
          coherenceScore: coherence,
          uncertain: population < 50 || coherence < coherenceMid,
          notes: [],
        };
        if (placeholderPattern) {
          collection.recordTypeIds.push(`record_type:${fingerprint}`);
        } else {
          collection.uncertain = true;
          collection.notes.push('no <key> placeholder pattern observed');
        }
        collections.push(collection);

        if (fingerprint && !recordTypes.has(fingerprint)) {
          recordTypes.set(fingerprint, {
            id: `record_type:${fingerprint}`,
            shapeFingerprint: fingerprint,
            sourcePath: pattern.pointer + '.<key>',
            fieldCount: placeholderPattern?.fields.length ?? 0,
            occurrenceCount: recordCount,
            collectionIds: [],
            uncertain: collection.uncertain,
          });
        }
      }
    }

    if (pattern.childKeyKind === 'array') {
      const population = pattern.totalChildren ?? 0;
      if (population >= minPopulation) {
        const fingerprint = pattern.shapeFingerprint;
        const collection = {
          id: `collection:${pattern.pointer}`,
          pointer: pattern.pointer,
          childKeyKind: 'array',
          populationCount: population,
          recordCount: population,
          shapeFingerprint: fingerprint,
          recordTypeIds: fingerprint ? [`record_type:${fingerprint}`] : [],
          coherenceScore: 1.0,
          uncertain: false,
          notes: [],
        };
        collections.push(collection);

        if (fingerprint && !recordTypes.has(fingerprint)) {
          recordTypes.set(fingerprint, {
            id: `record_type:${fingerprint}`,
            shapeFingerprint: fingerprint,
            sourcePath: pattern.pointer,
            fieldCount: pattern.fields.length,
            occurrenceCount: population,
            collectionIds: [],
            uncertain: false,
          });
        }
      }
    }
  }

  for (const collection of collections) {
    for (const rtId of collection.recordTypeIds) {
      const fp = rtId.replace(/^record_type:/, '');
      const rt = recordTypes.get(fp);
      if (rt && !rt.collectionIds.includes(collection.id)) {
        rt.collectionIds.push(collection.id);
      }
    }
  }

  const recordTypeList = Array.from(recordTypes.values()).map((rt) => ({
    id: rt.id,
    shapeFingerprint: rt.shapeFingerprint,
    sourcePath: rt.sourcePath,
    fieldCount: rt.fieldCount,
    occurrenceCount: rt.occurrenceCount,
    collectionIds: rt.collectionIds,
    collectionCount: rt.collectionIds.length,
    uncertain: rt.uncertain,
  }));

  const reviewRanking = collections
    .slice()
    .sort((a, b) => {
      if (b.populationCount !== a.populationCount) return b.populationCount - a.populationCount;
      return b.coherenceScore - a.coherenceScore;
    })
    .map((c) => ({
      collectionId: c.id,
      pointer: c.pointer,
      childKeyKind: c.childKeyKind,
      populationCount: c.populationCount,
      coherenceScore: c.coherenceScore,
      uncertain: c.uncertain,
    }));

  const largestCollection = collections
    .slice()
    .sort((a, b) => b.populationCount - a.populationCount)[0] ?? null;

  return {
    summary: {
      totalPathPatterns: pathPatterns.length,
      candidateCollections: collections.length,
      candidateRecordTypes: recordTypes.size,
      uncertainCollectionCount: collections.filter((c) => c.uncertain).length,
      mapCollectionCount: collections.filter((c) => c.childKeyKind === 'map').length,
      arrayCollectionCount: collections.filter((c) => c.childKeyKind === 'array').length,
      largestCollectionPointer: largestCollection?.pointer ?? null,
      largestCollectionPopulation: largestCollection?.populationCount ?? 0,
    },
    candidateCollections: collections,
    candidateRecordTypes: recordTypeList,
    reviewRanking,
  };
}

function computeMapCoherence(pattern) {
  const fields = pattern.fields ?? [];
  if (fields.length === 0) return 1.0;
  const required = fields.filter((f) => f.isRequired).length;
  return required / fields.length;
}
