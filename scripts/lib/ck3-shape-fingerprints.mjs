import crypto from 'node:crypto';

const DEFAULT_MAP_KEY_THRESHOLD = 50;
const DEFAULT_SAMPLE_LIMIT = 5;
const NUMERIC_KEY_RE = /^\d+$/;

export class ShapeCollector {
  constructor({
    mapKeyThreshold = DEFAULT_MAP_KEY_THRESHOLD,
    sampleLimit = DEFAULT_SAMPLE_LIMIT,
  } = {}) {
    this.mapKeyThreshold = mapKeyThreshold;
    this.sampleLimit = sampleLimit;
    this.totalObservations = 0;
    this.totalContainers = 0;
    this.totalPrimitives = 0;
    this.parents = new Map();
    this.rootObservation = null;
  }

  observe(obs) {
    this.totalObservations++;
    if (obs.parentPointer === null || obs.parentPointer === undefined) {
      this.rootObservation = obs;
      return;
    }
    if (obs.valueType === 'object' || obs.valueType === 'array') {
      this.totalContainers++;
    } else {
      this.totalPrimitives++;
    }
    const rawParentPointer = obs.parentPointer;
    let rawChildKey = this._extractChildKey(obs);
    let parentPointer = rawParentPointer;
    let immediateMapStats = null;
    let immediateMapRawChildKey = null;
    if (rawChildKey !== undefined) {
      const immediateStats = this.parents.get(rawParentPointer);
      if (immediateStats && immediateStats.isMap) {
        immediateMapStats = immediateStats;
        immediateMapRawChildKey = rawChildKey;
      } else {
        const mapAncestor = this._findMapAncestor(rawParentPointer);
        if (mapAncestor) {
          const ancestorStats = this.parents.get(mapAncestor);
          if (ancestorStats && ancestorStats.isMap) {
            const parentSegment = rawParentPointer.slice(mapAncestor.length);
            if (parentSegment.startsWith('.') || parentSegment.startsWith('[')) {
              let sepIdx = parentSegment.length;
              for (let i = 1; i < parentSegment.length; i++) {
                if (parentSegment[i] === '.' || parentSegment[i] === '[') {
                  sepIdx = i;
                  break;
                }
              }
              const rest = parentSegment.slice(sepIdx);
              parentPointer = mapAncestor + '.<key>' + rest;
            }
          }
        }
      }
    }
    if (immediateMapStats) {
      this._accumulateIntoPlaceholder(immediateMapStats, immediateMapRawChildKey, obs);
      if (obs.valueType === 'object' || obs.valueType === 'array') {
        const placeholderPath = immediateMapStats.parentPointer + '.<key>';
        if (!this.parents.has(placeholderPath)) {
          this.parents.set(placeholderPath, {
            parentPointer: placeholderPath,
            parentType: 'object',
            totalChildren: 0,
            recordCount: 0,
            keys: new Map(),
            isMap: false,
            uniqueChildrenCount: 0,
            allNumeric: true,
          });
        }
        this.parents.get(placeholderPath).recordCount++;
      }
      return;
    }
    if (!this.parents.has(parentPointer)) {
      this.parents.set(parentPointer, {
        parentPointer,
        parentType: obs.parentType,
        totalChildren: 0,
        recordCount: 0,
        keys: new Map(),
        isMap: false,
        uniqueChildrenCount: 0,
        allNumeric: true,
      });
    }
    const parentStats = this.parents.get(parentPointer);
    parentStats.totalChildren++;
    if (
      parentStats.parentType === 'array' ||
      obs.valueType === 'object' ||
      obs.valueType === 'array'
    ) {
      parentStats.recordCount++;
    }

    const childKey = rawChildKey;
    if (childKey === undefined) return;

    if (parentStats.isMap) {
      this._accumulateIntoPlaceholder(parentStats, childKey, obs);
      return;
    }

    if (!parentStats.keys.has(childKey)) {
      parentStats.uniqueChildrenCount++;
      if (!this._isNumeric(childKey)) {
        parentStats.allNumeric = false;
      }
      const canPromote = parentPointer !== '$' && parentStats.parentType !== 'array';
      const shouldPromote =
        canPromote &&
        parentStats.uniqueChildrenCount >= 2 &&
        parentStats.allNumeric;
      if (shouldPromote) {
        this._promoteToMap(parentStats);
        this._accumulateIntoPlaceholder(parentStats, childKey, obs);
        return;
      }
      parentStats.keys.set(childKey, {
        count: 0,
        valueTypes: new Set(),
        isPlaceholder: false,
      });
    }
    const keyStats = parentStats.keys.get(childKey);
    keyStats.count++;
    keyStats.valueTypes.add(this._valueTypeLabel(obs));
  }

  _findMapAncestor(pointer) {
    let current = pointer;
    while (current && current !== '$') {
      const stats = this.parents.get(current);
      if (stats && stats.isMap) return current;
      const parent = pointerParent(current);
      if (!parent || parent === current) return null;
      current = parent;
    }
    return null;
  }

  _extractChildKey(obs) {
    if (obs.key !== null && obs.key !== undefined) return String(obs.key);
    if (obs.index !== null && obs.index !== undefined) return String(obs.index);
    return undefined;
  }

  _isNumeric(s) {
    return NUMERIC_KEY_RE.test(s);
  }

  _valueTypeLabel(obs) {
    return obs.valueType;
  }

  _promoteToMap(parentStats) {
    const placeholder = {
      count: 0,
      valueTypes: new Set(),
      isPlaceholder: true,
      sampleRawKeys: [],
    };
    for (const [k, v] of parentStats.keys) {
      placeholder.count += v.count;
      for (const t of v.valueTypes) placeholder.valueTypes.add(t);
      if (placeholder.sampleRawKeys.length < this.sampleLimit) {
        placeholder.sampleRawKeys.push(k);
      }
    }
    parentStats.keys.clear();
    parentStats.keys.set('<key>', placeholder);
    parentStats.isMap = true;
    this._rekeyChildrenToPlaceholder(parentStats.parentPointer);
  }

  _rekeyChildrenToPlaceholder(parentPointer) {
    const prefixDot = parentPointer + '.';
    const prefixBracket = parentPointer + '[';
    const candidates = [];
    for (const pp of this.parents.keys()) {
      if (pp === parentPointer) continue;
      if (pp.startsWith(prefixDot) || pp.startsWith(prefixBracket)) {
        candidates.push(pp);
      }
    }
    let rekeyed = 0;
    for (const oldP of candidates) {
      const stats = this.parents.get(oldP);
      if (!stats) continue;
      this.parents.delete(oldP);
      const rest = oldP.slice(parentPointer.length);
      let normalizedChild;
      const hasMoreSeparators =
        rest.indexOf('.', 1) !== -1 || rest.indexOf('[', 1) !== -1;
      if (!hasMoreSeparators) {
        normalizedChild = parentPointer + '.<key>';
      } else if (rest.startsWith('.')) {
        let sepIdx = rest.length;
        for (let i = 1; i < rest.length; i++) {
          if (rest[i] === '.' || rest[i] === '[') {
            sepIdx = i;
            break;
          }
        }
        normalizedChild = parentPointer + '.<key>' + rest.slice(sepIdx);
      } else if (rest.startsWith('[')) {
        let sepIdx = rest.length;
        for (let i = 1; i < rest.length; i++) {
          if (rest[i] === '.' || rest[i] === '[') {
            sepIdx = i;
            break;
          }
        }
        normalizedChild = parentPointer + '.<key>' + rest.slice(sepIdx);
      } else {
        normalizedChild = parentPointer + '.<key>';
      }
      if (this.parents.has(normalizedChild)) {
        const existing = this.parents.get(normalizedChild);
        existing.totalChildren += stats.totalChildren;
        existing.recordCount += stats.recordCount;
        this._mergeKeyStats(existing, stats);
      } else {
        this.parents.set(normalizedChild, stats);
        stats.parentPointer = normalizedChild;
      }
      rekeyed++;
    }
  }

  _mergeKeyStats(into, from) {
    if (from.isMap) {
      if (!into.isMap) {
        into.isMap = true;
        const placeholder = {
          count: 0,
          valueTypes: new Set(),
          isPlaceholder: true,
          sampleRawKeys: [],
        };
        into.keys.set('<key>', placeholder);
      }
      const intoPlaceholder = into.keys.get('<key>');
      const fromPlaceholder = from.keys.get('<key>');
      if (fromPlaceholder) {
        intoPlaceholder.count += fromPlaceholder.count;
        for (const t of fromPlaceholder.valueTypes) intoPlaceholder.valueTypes.add(t);
        for (const s of fromPlaceholder.sampleRawKeys) {
          if (!intoPlaceholder.sampleRawKeys.includes(s) && intoPlaceholder.sampleRawKeys.length < this.sampleLimit) {
            intoPlaceholder.sampleRawKeys.push(s);
          }
        }
      }
    } else {
      for (const [k, v] of from.keys) {
        if (!into.keys.has(k)) {
          into.keys.set(k, { count: 0, valueTypes: new Set(), isPlaceholder: false });
          into.uniqueChildrenCount++;
        }
        const intoStats = into.keys.get(k);
        intoStats.count += v.count;
        for (const t of v.valueTypes) intoStats.valueTypes.add(t);
      }
    }
  }

  _accumulateIntoPlaceholder(parentStats, childKey, obs) {
    const placeholder = parentStats.keys.get('<key>');
    if (!placeholder.sampleRawKeys.includes(childKey) && placeholder.sampleRawKeys.length < this.sampleLimit) {
      placeholder.sampleRawKeys.push(childKey);
    }
    parentStats.uniqueChildrenCount++;
    placeholder.count++;
    placeholder.valueTypes.add(this._valueTypeLabel(obs));
  }

  result() {
    if (this.rootObservation && !this.parents.has('$')) {
      this.parents.set('$', {
        parentPointer: '$',
        parentType: this.rootObservation.valueType,
        totalChildren: 0,
        keys: new Map(),
        isMap: false,
        uniqueChildrenCount: 0,
        allNumeric: true,
      });
    }
    return finalizeShapeCatalog({
      parents: this.parents,
      rootObservation: this.rootObservation,
      totalObservations: this.totalObservations,
      totalContainers: this.totalContainers,
      totalPrimitives: this.totalPrimitives,
      mapKeyThreshold: this.mapKeyThreshold,
    });
  }
}

export function finalizeShapeCatalog({
  parents,
  rootObservation,
  totalObservations,
  totalContainers,
  totalPrimitives,
  mapKeyThreshold,
}) {
  const byPointer = new Map();

  for (const [parentPointer, stats] of parents) {
    let effectiveRecordCount = stats.recordCount;
    let effectiveTotalChildren = stats.totalChildren;
    if (parentPointer.endsWith('.<key>')) {
      const parentStats = parents.get(pointerParent(parentPointer));
      if (parentStats && parentStats.isMap) {
        const placeholder = parentStats.keys.get('<key>');
        if (placeholder) {
          effectiveRecordCount = placeholder.count;
        }
      }
    } else if (stats.isMap) {
      const placeholder = stats.keys.get('<key>');
      if (placeholder) {
        effectiveTotalChildren = placeholder.count;
        effectiveRecordCount = placeholder.count;
      }
    }
    byPointer.set(parentPointer, {
      id: `path:${parentPointer}`,
      pointer: parentPointer,
      parentPointer: pointerParent(parentPointer),
      parentType: stats.parentType,
      childKeyKind:
        parentPointer === '$'
          ? 'root'
          : stats.parentType === 'array'
            ? 'array'
            : stats.isMap
              ? 'map'
              : 'field',
      totalChildren: effectiveTotalChildren,
      recordCount: effectiveRecordCount,
      uniqueChildren: stats.uniqueChildrenCount,
      mapKeyThreshold: stats.isMap ? mapKeyThreshold : null,
      fields: [],
      shapeFingerprint: null,
      effectiveRecordCount,
    });
  }

  const depthOf = (pointer) => (pointer.match(/[.[]/g) || []).length + 1;
  const sorted = Array.from(byPointer.values()).sort(
    (a, b) => depthOf(b.pointer) - depthOf(a.pointer),
  );

  for (const pattern of sorted) {
    const stats = parents.get(pattern.pointer);
    const fieldList = [];
    const fieldKeys = Array.from(stats.keys.keys()).sort();
    for (const key of fieldKeys) {
      const keyStats = stats.keys.get(key);
      const childPointer = appendKeyToPointer(pattern.pointer, key, stats.parentType === 'array');
      const childPattern = byPointer.get(childPointer);
      const valueTypes = Array.from(keyStats.valueTypes).sort();
      let valueTypeFingerprint;
      if (childPattern && childPattern.shapeFingerprint) {
        valueTypeFingerprint = childPattern.shapeFingerprint;
      } else if (valueTypes.length === 1) {
        valueTypeFingerprint = `type:${valueTypes[0]}`;
      } else {
        valueTypeFingerprint = `union:${valueTypes.join('|')}`;
      }
      const referenceCount =
        stats.parentType === 'object' && (pattern.effectiveRecordCount ?? stats.recordCount) === 0
          ? stats.totalChildren
          : Math.max(pattern.effectiveRecordCount ?? stats.recordCount, 1);
      const field = {
        name: key,
        occurrenceCount: keyStats.count,
        isRequired: keyStats.count === referenceCount,
        valueTypes,
        valueTypeFingerprint,
        isPolymorphic: valueTypes.length > 1,
      };
      if (keyStats.isPlaceholder && keyStats.sampleRawKeys && keyStats.sampleRawKeys.length > 0) {
        field.sampleRawKeys = [...keyStats.sampleRawKeys];
      }
      fieldList.push(field);
    }
    pattern.fields = fieldList;
    pattern.shapeFingerprint = computeShapeFingerprint(fieldList, stats.parentType === 'array');
  }

  const pathPatterns = Array.from(byPointer.values()).sort((a, b) => {
    const da = depthOf(a.pointer);
    const db = depthOf(b.pointer);
    if (da !== db) return da - db;
    return a.pointer < b.pointer ? -1 : a.pointer > b.pointer ? 1 : 0;
  });

  const polymorphicFieldCount = pathPatterns.reduce(
    (acc, p) => acc + p.fields.filter((f) => f.isPolymorphic).length,
    0,
  );
  const optionalFieldCount = pathPatterns.reduce(
    (acc, p) => acc + p.fields.filter((f) => !f.isRequired).length,
    0,
  );
  const mapKeyPatternCount = pathPatterns.filter((p) => p.childKeyKind === 'map').length;

  return {
    summary: {
      totalObservations,
      totalContainers,
      totalPrimitives,
      uniqueParentPaths: parents.size,
      pathPatterns: pathPatterns.length,
      mapKeyPatternCount,
      polymorphicFieldCount,
      optionalFieldCount,
      mapKeyThreshold,
    },
    root: rootShape(rootObservation),
    pathPatterns,
  };
}

function rootShape(rootObservation) {
  if (!rootObservation) return null;
  return {
    pointer: rootObservation.pointer,
    valueType: rootObservation.valueType,
    depth: rootObservation.depth,
  };
}

function pointerParent(pointer) {
  if (pointer === '$' || !pointer) return null;
  if (pointer === '$.<key>' || pointer === '$<key>') {
    if (pointer.startsWith('$.<key>')) return '$';
    return null;
  }
  const lastDot = pointer.lastIndexOf('.');
  const lastBracket = pointer.lastIndexOf('[');
  if (lastDot === -1 && lastBracket === -1) return '$';
  if (lastBracket > lastDot) {
    const closeBracket = pointer.indexOf(']', lastBracket);
    if (closeBracket === -1) return '$';
    return pointer.slice(0, lastBracket);
  }
  return pointer.slice(0, lastDot);
}

function appendKeyToPointer(pointer, key, isArrayParent) {
  if (key === '<key>') {
    return pointer === '$' ? '$.<key>' : `${pointer}.<key>`;
  }
  if (pointer === '$') {
    return isArrayParent ? `$[${key}]` : `$.${key}`;
  }
  if (isArrayParent) {
    return `${pointer}[${key}]`;
  }
  if (SAFE_KEY_RE.test(key)) {
    return `${pointer}.${key}`;
  }
  const escaped = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `${pointer}['${escaped}']`;
}

const SAFE_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function computeShapeFingerprint(fieldList, isArray) {
  const fieldDescriptor = fieldList.map((f) => ({
    n: f.name,
    v: f.valueTypeFingerprint,
    r: f.isRequired ? 1 : 0,
    p: f.isPolymorphic ? 1 : 0,
  }));
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify({ kind: isArray ? 'array' : 'object', fields: fieldDescriptor }));
  return `sha256:${hash.digest('hex').slice(0, 16)}`;
}
