import crypto from 'node:crypto';

export const SCHEMA_GRAPH_VERSION = 1;

export const NODE_KINDS = [
  'collection',
  'record_type',
  'shape_variant',
  'field',
  'identity_domain',
  'mechanics_concept',
  'source_document',
  'query',
];

export const EDGE_KINDS = [
  'contains_record_type',
  'has_shape_variant',
  'has_field',
  'field_uses_identity_domain',
  'keys_records_in',
  'references_record_type',
  'nested_under',
  'variant_of',
  'supported_by',
  'contradicted_by',
  'documented_by',
  'enables_query',
  'applies_when',
];

const DEFAULT_SCOPE = {
  gameVersions: [],
  dlc: [],
  mods: [],
};

const INSTANCE_ID_RE = /(?:^|[:.\[\]'/-])\d{4,}(?:$|[:.\[\]'/-])/;

export function generateSchemaGraph(inputs, options = {}) {
  const {
    sourceRegistry,
    shapeCatalog,
    collectionCatalog,
    referenceCatalog,
    mechanicsCatalog,
  } = inputs;
  const source = selectSource(sourceRegistry, options.sourceId ?? referenceCatalog?.source?.sourceId);
  const sourceId = source?.sourceId ?? options.sourceId ?? null;
  const generatedAt = options.generatedAt ?? null;
  const maxReferenceCandidates = options.maxReferenceCandidates ?? 250;
  const maxTargetDomainsPerCandidate = options.maxTargetDomainsPerCandidate ?? 3;

  const builder = new GraphBuilder({ sourceId });
  if (source) {
    builder.node({
      id: source.sourceId,
      kind: 'source_document',
      label: source.label ?? source.sourceId,
      properties: {
        sourceKind: source.kind,
        ck3Version: source.ck3?.version ?? null,
        saveGameDate: source.saveGameDate ?? null,
        visibilityClassification: source.visibility?.classification ?? null,
      },
      provenance: provenance(sourceId, `source:${source.sourceId}`),
    });
  }

  const patternsByPointer = new Map();
  for (const pattern of shapeCatalog?.pathPatterns ?? []) {
    patternsByPointer.set(pattern.pointer, pattern);
  }

  const collectionsByPointer = new Map();
  const recordTypesById = new Map();
  for (const rt of collectionCatalog?.candidateRecordTypes ?? []) {
    recordTypesById.set(rt.id, rt);
  }

  for (const collection of collectionCatalog?.candidateCollections ?? []) {
    const collectionId = graphId('collection', collection.pointer);
    collectionsByPointer.set(collection.pointer, { collection, graphId: collectionId });
    builder.node({
      id: collectionId,
      kind: 'collection',
      label: lastPathLabel(collection.pointer),
      properties: {
        pointer: collection.pointer,
        childKeyKind: collection.childKeyKind,
        populationCount: collection.populationCount,
        recordCount: collection.recordCount,
        coherenceScore: collection.coherenceScore,
        uncertain: collection.uncertain,
      },
      provenance: provenance(sourceId, `collection:${collection.pointer}`),
      notes: collection.notes ?? [],
    });

    for (const rtId of collection.recordTypeIds ?? []) {
      const rt = recordTypesById.get(rtId);
      if (!rt) continue;
      const recordTypeId = graphId('record_type', rt.shapeFingerprint);
      const shapeId = graphId('shape_variant', rt.shapeFingerprint);
      builder.node({
        id: recordTypeId,
        kind: 'record_type',
        label: `record ${shortFingerprint(rt.shapeFingerprint)}`,
        properties: {
          shapeFingerprint: rt.shapeFingerprint,
          occurrenceCount: rt.occurrenceCount,
          collectionCount: rt.collectionCount,
          uncertain: rt.uncertain,
        },
        provenance: provenance(sourceId, `record_type:${rt.shapeFingerprint}`),
      });
      builder.edge({
        kind: 'contains_record_type',
        from: collectionId,
        to: recordTypeId,
        properties: { sourcePointer: collection.pointer },
        provenance: provenance(sourceId, `collection_record_type:${collection.pointer}:${rt.shapeFingerprint}`),
      });
      builder.node({
        id: shapeId,
        kind: 'shape_variant',
        label: shortFingerprint(rt.shapeFingerprint),
        properties: {
          shapeFingerprint: rt.shapeFingerprint,
          fieldCount: rt.fieldCount,
        },
        provenance: provenance(sourceId, `shape:${rt.shapeFingerprint}`),
      });
      builder.edge({
        kind: 'has_shape_variant',
        from: recordTypeId,
        to: shapeId,
        provenance: provenance(sourceId, `record_type_shape:${rt.shapeFingerprint}`),
      });

      const recordPointer = collection.childKeyKind === 'map'
        ? `${collection.pointer}.<key>`
        : collection.pointer;
      const pattern = patternsByPointer.get(recordPointer);
      for (const field of pattern?.fields ?? []) {
        const fieldPointer = appendFieldPointer(recordPointer, field.key);
        const fieldId = graphId('field', fieldPointer);
        builder.node({
          id: fieldId,
          kind: 'field',
          label: String(field.key),
          properties: {
            pointer: fieldPointer,
            parentPointer: recordPointer,
            valueTypes: field.valueTypes ?? [],
            count: field.count,
            isRequired: field.isRequired,
            valueTypeFingerprint: field.valueTypeFingerprint ?? null,
          },
          provenance: provenance(sourceId, `field:${fieldPointer}`),
        });
        builder.edge({
          kind: 'has_field',
          from: shapeId,
          to: fieldId,
          properties: {
            isRequired: field.isRequired,
            count: field.count,
          },
          provenance: provenance(sourceId, `shape_field:${rt.shapeFingerprint}:${fieldPointer}`),
        });
      }
    }
  }

  for (const domain of referenceCatalog?.identityDomains ?? []) {
    const domainId = graphId('identity_domain', domain.id);
    builder.node({
      id: domainId,
      kind: 'identity_domain',
      label: lastPathLabel(domain.collectionPointer),
      properties: {
        domainObservationId: domain.id,
        collectionPointer: domain.collectionPointer,
        keyCount: domain.keyCount,
        keyTypes: domain.keyTypes ?? [],
        populationCount: domain.populationCount,
      },
      provenance: provenance(sourceId, domain.id),
    });
    const collectionInfo = collectionsByPointer.get(domain.collectionPointer);
    if (collectionInfo) {
      builder.edge({
        kind: 'keys_records_in',
        from: domainId,
        to: collectionInfo.graphId,
        provenance: provenance(sourceId, `domain_collection:${domain.id}`),
      });
    }
  }

  const domainByObservationId = new Map(
    (referenceCatalog?.identityDomains ?? []).map((d) => [d.id, d]),
  );
  for (const candidate of (referenceCatalog?.referenceCandidates ?? []).slice(0, maxReferenceCandidates)) {
    const fieldId = graphId('field', candidate.fieldPointer);
    builder.node({
      id: fieldId,
      kind: 'field',
      label: lastPathLabel(candidate.fieldPointer),
      properties: {
        pointer: candidate.fieldPointer,
        sourceCollectionPointer: candidate.sourceCollectionPointer ?? null,
        aggregateReferenceCandidate: true,
      },
      provenance: provenance(sourceId, candidate.id),
    });
    for (const evidence of (candidate.targetDomainEvidence ?? []).slice(0, maxTargetDomainsPerCandidate)) {
      const domain = domainByObservationId.get(evidence.targetDomainId);
      const domainId = graphId('identity_domain', evidence.targetDomainId);
      builder.edge({
        kind: 'field_uses_identity_domain',
        from: fieldId,
        to: domainId,
        properties: {
          numerator: evidence.resolvedCount,
          denominator: candidate.evidence?.denominator ?? null,
          coverage: candidate.evidence?.coverage ?? null,
          distinctValueCount: evidence.distinctValueCount,
          ambiguousValueCount: candidate.ambiguousValueCount,
          unresolvedCount: candidate.evidence?.unresolvedCount ?? null,
          nullCount: candidate.evidence?.nullCount ?? null,
          sentinelCount: candidate.evidence?.sentinelCount ?? null,
          missingCount: candidate.evidence?.missingCount ?? null,
        },
        provenance: provenance(sourceId, `${candidate.id}:${evidence.targetDomainId}`),
      });
      const targetCollection = domain ? collectionsByPointer.get(domain.collectionPointer) : null;
      const targetRecordTypeIds = targetCollection?.collection.recordTypeIds ?? [];
      for (const rtId of targetRecordTypeIds) {
        const rt = recordTypesById.get(rtId);
        if (!rt) continue;
        builder.edge({
          kind: 'references_record_type',
          from: fieldId,
          to: graphId('record_type', rt.shapeFingerprint),
          properties: {
            viaIdentityDomain: domainId,
            numerator: evidence.resolvedCount,
            denominator: candidate.evidence?.denominator ?? null,
          },
          provenance: provenance(sourceId, `${candidate.id}:${rtId}`),
        });
      }
    }
  }

  for (const { collection, graphId: collectionId } of collectionsByPointer.values()) {
    const parent = nearestParentCollection(collection.pointer, collectionsByPointer);
    if (!parent) continue;
    builder.edge({
      kind: 'nested_under',
      from: collectionId,
      to: parent.graphId,
      provenance: provenance(sourceId, `nested_collection:${collection.pointer}:${parent.collection.pointer}`),
    });
  }

  appendMechanicsConceptNodes(builder, mechanicsCatalog);

  const graph = {
    schemaVersion: SCHEMA_GRAPH_VERSION,
    generatedAt,
    sourceIds: sourceId ? [sourceId] : [],
    summary: {},
    nodes: builder.sortedNodes(),
    edges: builder.sortedEdges(),
  };
  graph.summary = {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    nodeKinds: countBy(graph.nodes, (n) => n.kind),
    edgeKinds: countBy(graph.edges, (e) => e.kind),
  };

  return graph;
}

export function validateSchemaGraph(graph) {
  const errors = [];
  if (!graph || typeof graph !== 'object') {
    return ['graph must be an object'];
  }
  if (graph.schemaVersion !== SCHEMA_GRAPH_VERSION) {
    errors.push(`schemaVersion must be ${SCHEMA_GRAPH_VERSION}`);
  }
  if (!Array.isArray(graph.nodes)) errors.push('nodes must be an array');
  if (!Array.isArray(graph.edges)) errors.push('edges must be an array');
  const nodeIds = new Set();
  for (const node of graph.nodes ?? []) {
    validateItem(node, 'node', errors);
    if (!NODE_KINDS.includes(node.kind)) errors.push(`unknown node kind: ${node.kind}`);
    if (nodeIds.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
  }
  const edgeIds = new Set();
  for (const edge of graph.edges ?? []) {
    validateItem(edge, 'edge', errors);
    if (!EDGE_KINDS.includes(edge.kind)) errors.push(`unknown edge kind: ${edge.kind}`);
    if (!edge.from || !nodeIds.has(edge.from)) errors.push(`edge ${edge.id} has missing from node ${edge.from}`);
    if (!edge.to || !nodeIds.has(edge.to)) errors.push(`edge ${edge.id} has missing to node ${edge.to}`);
    if (edgeIds.has(edge.id)) errors.push(`duplicate edge id: ${edge.id}`);
    edgeIds.add(edge.id);
  }
  return errors;
}

function validateItem(item, type, errors) {
  if (!item || typeof item !== 'object') {
    errors.push(`${type} must be an object`);
    return;
  }
  if (!item.id || typeof item.id !== 'string') errors.push(`${type} is missing string id`);
  if (item.id && INSTANCE_ID_RE.test(item.id)) errors.push(`${type} id may contain an instance record id: ${item.id}`);
  if (!item.kind || typeof item.kind !== 'string') errors.push(`${type} ${item.id} is missing kind`);
  if (!item.status || typeof item.status !== 'string') errors.push(`${type} ${item.id} is missing status`);
  if (!item.scope || !Array.isArray(item.scope.gameVersions) || !Array.isArray(item.scope.dlc) || !Array.isArray(item.scope.mods)) {
    errors.push(`${type} ${item.id} is missing scope`);
  }
  if (!Array.isArray(item.provenance) || item.provenance.length === 0) {
    errors.push(`${type} ${item.id} must have provenance`);
  }
  if (!Array.isArray(item.notes)) errors.push(`${type} ${item.id} must have notes`);
}

class GraphBuilder {
  constructor({ sourceId }) {
    this.sourceId = sourceId;
    this.nodes = new Map();
    this.edges = new Map();
  }

  node(input) {
    const node = {
      id: input.id,
      kind: input.kind,
      label: input.label,
      status: input.status ?? 'observed',
      scope: input.scope ?? DEFAULT_SCOPE,
      provenance: input.provenance,
      notes: input.notes ?? [],
      properties: sortObject(input.properties ?? {}),
    };
    const existing = this.nodes.get(node.id);
    if (existing) {
      existing.provenance = mergeProvenance(existing.provenance, node.provenance);
      return existing;
    }
    this.nodes.set(node.id, node);
    return node;
  }

  edge(input) {
    const edgeIdentity = [
      input.kind,
      input.from,
      input.to,
      input.properties?.viaIdentityDomain ?? '',
    ].join(':');
    const id = graphId('edge', edgeIdentity);
    const edge = {
      id,
      kind: input.kind,
      from: input.from,
      to: input.to,
      status: input.status ?? 'observed',
      scope: input.scope ?? DEFAULT_SCOPE,
      provenance: input.provenance,
      notes: input.notes ?? [],
      properties: sortObject(input.properties ?? {}),
    };
    const existing = this.edges.get(edge.id);
    if (existing) {
      existing.provenance = mergeProvenance(existing.provenance, edge.provenance);
      return existing;
    }
    this.edges.set(edge.id, edge);
    return edge;
  }

  sortedNodes() {
    return Array.from(this.nodes.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  sortedEdges() {
    return Array.from(this.edges.values()).sort((a, b) => a.id.localeCompare(b.id));
  }
}

function selectSource(sourceRegistry, sourceId) {
  const sources = sourceRegistry?.sources ?? [];
  if (sourceId) return sources.find((s) => s.sourceId === sourceId) ?? null;
  return sources[0] ?? null;
}

function provenance(sourceId, observationId) {
  return [{
    sourceId,
    observationId,
    layer: 'schema_observation',
  }];
}

function graphId(kind, value) {
  return `${kind}:${hash(value)}`;
}

function appendMechanicsConceptNodes(builder, mechanicsCatalog) {
  if (!mechanicsCatalog) return;
  const concepts = Array.isArray(mechanicsCatalog.concepts) ? mechanicsCatalog.concepts : [];
  if (concepts.length === 0) return;
  const seenIds = new Set();
  for (const concept of concepts) {
    if (!concept || !concept.id) continue;
    const nodeId = `mechanics_concept:${concept.id}`;
    if (seenIds.has(nodeId)) continue;
    seenIds.add(nodeId);
    const properties = sortObject({
      topic: concept.topic ?? concept.label ?? concept.id,
      topicGroup: concept.topicGroup ?? null,
      canonicalUrl: concept.canonicalUrl ?? null,
      oldidUrl: concept.oldidUrl ?? null,
      sectionAnchorCount: concept.properties?.sectionAnchorCount ?? 0,
      ...(concept.properties ?? {}),
    });
    builder.node({
      id: nodeId,
      kind: 'mechanics_concept',
      label: concept.label ?? concept.id,
      status: concept.status ?? 'observed',
      scope: concept.scope ?? { gameVersions: [], dlc: [], mods: [], allDlcActive: false },
      provenance: [{
        sourceId: concept.sourceId ?? null,
        observationId: `mechanics_concept:${concept.id}`,
        layer: 'mechanics_annotation',
      }],
      notes: concept.notes ?? [],
      properties,
    });
  }
}

export function appendMechanicsConceptsToGraph(graph, mechanicsCatalog) {
  if (!graph || typeof graph !== 'object') throw new Error('graph must be an object');
  const existing = new Set((graph.nodes ?? []).map((n) => n.id));
  const builder = new GraphBuilder({ sourceId: null });
  // Re-seed existing nodes/edges to keep them in the result.
  for (const node of graph.nodes ?? []) builder.nodes.set(node.id, node);
  for (const edge of graph.edges ?? []) builder.edges.set(edge.id, edge);
  appendMechanicsConceptNodes(builder, mechanicsCatalog);
  const nodes = builder.sortedNodes();
  const edges = builder.sortedEdges();
  return {
    schemaVersion: graph.schemaVersion ?? SCHEMA_GRAPH_VERSION,
    generatedAt: graph.generatedAt ?? null,
    sourceIds: graph.sourceIds ?? [],
    summary: {
      nodes: nodes.length,
      edges: edges.length,
      nodeKinds: countBy(nodes, (n) => n.kind),
      edgeKinds: countBy(edges, (e) => e.kind),
    },
    nodes,
    edges,
  };
}

function hash(value) {
  return `g${crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16)}`;
}

function shortFingerprint(fingerprint) {
  return String(fingerprint ?? 'unknown').slice(0, 12);
}

function lastPathLabel(pointer) {
  const match = String(pointer).match(/(?:\.|\[')([^.'\]]+)(?:'\])?$/);
  return match ? match[1] : String(pointer);
}

function appendFieldPointer(parentPointer, key) {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(key))) return `${parentPointer}.${key}`;
  return `${parentPointer}['${String(key).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`;
}

function nearestParentCollection(pointer, collectionsByPointer) {
  let best = null;
  for (const candidate of collectionsByPointer.values()) {
    if (candidate.collection.pointer === pointer) continue;
    if (!pointer.startsWith(candidate.collection.pointer + '.')) continue;
    if (!best || candidate.collection.pointer.length > best.collection.pointer.length) {
      best = candidate;
    }
  }
  return best;
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return sortObject(out);
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, sortObject(v)]),
  );
}

function mergeProvenance(a, b) {
  const seen = new Set();
  const out = [];
  for (const p of [...(a ?? []), ...(b ?? [])]) {
    const key = JSON.stringify(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
