import crypto from 'node:crypto';

export const CLAIM_LEDGER_VERSION = 1;
export const CLAIM_SEMANTIC_KINDS = [
  'collection_name',
  'identity_domain_name',
  'field_name',
  'record_type_name',
  'mechanics_concept',
];

export const CLAIM_STATUSES = new Set([
  'proposed',
  'supported',
  'partially_supported',
  'contradicted',
  'insufficient_evidence',
  'context_dependent',
  'superseded',
]);

const DEFAULT_SCOPE = {
  gameVersions: [],
  dlc: [],
  mods: [],
  allDlcActive: false,
};

export function generateSemanticClaims({ graph, rules, sourceRegistry }, options = {}) {
  const documentationSources = (sourceRegistry?.sources ?? [])
    .filter((source) => source.kind === 'documentation_mediawiki_page');
  const topicIndex = buildTopicIndex(documentationSources);
  const scope = options.scope ?? scopeFromSources(sourceRegistry);
  const claims = [];
  const semanticEdges = [];

  for (const rule of rules.rules ?? []) {
    const matches = (graph.nodes ?? []).filter((node) => nodeMatchesRule(node, rule));
    for (const node of matches) {
      const claim = buildClaim({ node, rule, topicIndex, scope });
      claims.push(claim);
      semanticEdges.push({
        id: semanticEdgeId(claim.claimId, node.id),
        kind: 'names_graph_item',
        claimId: claim.claimId,
        from: claim.claimId,
        to: node.id,
        status: claim.status,
      });
    }
  }

  claims.sort((a, b) => a.claimId.localeCompare(b.claimId));
  semanticEdges.sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion: CLAIM_LEDGER_VERSION,
    generatedAt: options.generatedAt ?? null,
    claims,
    semanticEdges,
  };
}

export function validateClaimLedger(ledger, graph = null) {
  const errors = [];
  if (!ledger || typeof ledger !== 'object') return ['claim ledger must be an object'];
  if (ledger.schemaVersion !== CLAIM_LEDGER_VERSION) {
    errors.push(`schemaVersion must be ${CLAIM_LEDGER_VERSION}`);
  }
  if (!Array.isArray(ledger.claims)) errors.push('claims must be an array');
  if (!Array.isArray(ledger.semanticEdges)) errors.push('semanticEdges must be an array');
  const graphIds = graph ? new Set((graph.nodes ?? []).map((n) => n.id)) : null;
  const claimIds = new Set();
  for (const claim of ledger.claims ?? []) {
    if (!claim.claimId) errors.push('claim missing claimId');
    if (claimIds.has(claim.claimId)) errors.push(`duplicate claimId: ${claim.claimId}`);
    claimIds.add(claim.claimId);
    if (!CLAIM_STATUSES.has(claim.status)) errors.push(`claim ${claim.claimId} has invalid status ${claim.status}`);
    if (claim.semanticKind !== undefined && !CLAIM_SEMANTIC_KINDS.includes(claim.semanticKind)) {
      errors.push(`claim ${claim.claimId} has unknown semanticKind ${claim.semanticKind}`);
    }
    if (!Array.isArray(claim.subjectGraphIds) || claim.subjectGraphIds.length === 0) {
      errors.push(`claim ${claim.claimId} must cite subjectGraphIds`);
    }
    for (const id of claim.subjectGraphIds ?? []) {
      if (graphIds && !graphIds.has(id)) errors.push(`claim ${claim.claimId} references missing graph id ${id}`);
    }
    if (!Array.isArray(claim.supportingEvidence) || claim.supportingEvidence.length === 0) {
      errors.push(`claim ${claim.claimId} must have supportingEvidence`);
    }
    if (!claim.uncertainty || !Array.isArray(claim.uncertainty.reasons)) {
      errors.push(`claim ${claim.claimId} must have machine-readable uncertainty`);
    }
    if (!Array.isArray(claim.contradictingEvidence)) {
      errors.push(`claim ${claim.claimId} must have contradictingEvidence array`);
    }
    if (claim.supersededBy !== undefined && !Array.isArray(claim.supersededBy)) {
      errors.push(`claim ${claim.claimId} supersededBy must be an array`);
    }
    if (claim.lastReviewed !== undefined && claim.lastReviewed !== null && typeof claim.lastReviewed !== 'string') {
      errors.push(`claim ${claim.claimId} lastReviewed must be a string or null`);
    }
  }
  for (const edge of ledger.semanticEdges ?? []) {
    if (!edge.claimId || !claimIds.has(edge.claimId)) errors.push(`semantic edge ${edge.id} must cite a claim`);
    if (graphIds && !graphIds.has(edge.to)) errors.push(`semantic edge ${edge.id} targets missing graph id ${edge.to}`);
  }
  return errors;
}

export function buildSemanticComparisonReport({ ledger, graph, existingReportCompared = false }) {
  const byStatus = countBy(ledger.claims, (claim) => claim.status);
  const bySemanticKind = countBy(ledger.claims, (claim) => claim.semanticKind);
  return {
    schemaVersion: 1,
    summary: {
      claims: ledger.claims.length,
      semanticEdges: ledger.semanticEdges.length,
      byStatus,
      bySemanticKind,
      graphNodes: graph.nodes?.length ?? 0,
      graphEdges: graph.edges?.length ?? 0,
      existingReportCompared,
      existingReportUsedAsSoleSupport: false,
    },
    notes: [
      existingReportCompared
        ? 'Selected existing report behavior was compared after independent derivation.'
        : 'Existing report behavior was intentionally not used as support for this initial claim ledger.',
      'Semantic claims are generated from durable graph patterns and documentation source metadata only.',
      'Removing semantic rules does not alter structural graph artifacts.',
    ],
    unsupported: [],
    disagreements: [],
  };
}

export function buildProposedClaim({ entry, graph, sourceRegistry, generatedAt }) {
  if (!entry || typeof entry !== 'object') throw new Error('proposed claim entry is required');
  const subjectGraphIds = entry.subjectGraphIds ?? [];
  if (!Array.isArray(subjectGraphIds) || subjectGraphIds.length === 0) {
    throw new Error('proposed claim must include subjectGraphIds');
  }
  const required = ['sourceId', 'proposition', 'semanticName', 'semanticKind', 'confidence'];
  for (const field of required) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
      throw new Error(`proposed claim missing required field: ${field}`);
    }
  }
  if (!CLAIM_SEMANTIC_KINDS.includes(entry.semanticKind)) {
    throw new Error(`proposed claim semanticKind must be in ${CLAIM_SEMANTIC_KINDS.join(', ')}`);
  }
  if (entry.confidence < 0 || entry.confidence > 1) {
    throw new Error('proposed claim confidence must be within [0,1]');
  }
  const graphIds = graph ? new Set((graph.nodes ?? []).map((n) => n.id)) : null;
  for (const id of subjectGraphIds) {
    if (graphIds && !graphIds.has(id)) {
      throw new Error(`proposed claim references missing graph id: ${id}`);
    }
  }
  const sourceById = new Map((sourceRegistry?.sources ?? []).map((s) => [s.sourceId, s]));
  const source = sourceById.get(entry.sourceId);
  if (!source) {
    throw new Error(`proposed claim references unknown sourceId: ${entry.sourceId}`);
  }
  const supportingEvidence = [
    {
      kind: 'graph_node',
      id: subjectGraphIds[0],
      graphKind: graph?.nodes?.find?.((n) => n.id === subjectGraphIds[0])?.kind ?? null,
      pointer: graph?.nodes?.find?.((n) => n.id === subjectGraphIds[0])?.properties?.pointer ?? null,
    },
    {
      kind: 'documentation_source',
      id: source.sourceId,
      topic: source.topic ?? source.title ?? null,
      url: source.oldidUrl ?? source.canonicalUrl,
      ...(entry.section ? { section: entry.section } : {}),
    },
  ];
  const semanticName = entry.semanticName;
  const claimIdValue = proposedClaimId(semanticName, entry.sourceId, entry.section, subjectGraphIds[0]);
  const existingByName = new Set();
  const scope = entry.scope ?? {
    gameVersions: source.scope?.gameVersions ?? [],
    dlc: source.scope?.dlc ?? [],
    mods: source.scope?.mods ?? [],
    allDlcActive: Boolean(source.scope?.allDlcActive),
  };
  return {
    claimId: claimIdValue,
    proposition: entry.proposition,
    status: entry.status ?? 'proposed',
    subjectGraphIds,
    semanticName,
    semanticKind: entry.semanticKind,
    confidence: entry.confidence,
    scope,
    supportingEvidence,
    contradictingEvidence: entry.contradictingEvidence ?? [],
    rules: entry.rules ?? [`documentation.${semanticName}`],
    uncertainty: entry.uncertainty ?? {
      level: 'medium',
      reasons: ['Awaiting review against durable graph evidence.'],
    },
    supersededBy: [],
    lastReviewed: entry.lastReviewed ?? null,
    notes: entry.notes ?? [],
  };
}

export function mergeProposedClaims(ledger, proposedClaims, options = {}) {
  const errors = [];
  if (!ledger || typeof ledger !== 'object') errors.push('ledger must be an object');
  if (!Array.isArray(proposedClaims)) errors.push('proposed claims must be an array');
  if (errors.length > 0) throw new Error(errors.join('; '));
  const claims = (ledger.claims ?? []).slice();
  const semanticEdges = (ledger.semanticEdges ?? []).slice();
  const existingByClaimId = new Set(claims.map((c) => c.claimId));
  const added = [];
  const skipped = [];
  for (const claim of proposedClaims) {
    if (existingByClaimId.has(claim.claimId)) {
      if (options.overwrite) {
        const idx = claims.findIndex((c) => c.claimId === claim.claimId);
        if (idx >= 0) claims[idx] = { ...claim };
        added.push(claim.claimId);
      } else {
        skipped.push(claim.claimId);
      }
      continue;
    }
    claims.push(claim);
    for (const subjectId of claim.subjectGraphIds ?? []) {
      semanticEdges.push({
        id: semanticEdgeId(claim.claimId, subjectId),
        kind: 'names_graph_item',
        claimId: claim.claimId,
        from: claim.claimId,
        to: subjectId,
        status: claim.status,
      });
    }
    added.push(claim.claimId);
  }
  claims.sort((a, b) => a.claimId.localeCompare(b.claimId));
  semanticEdges.sort((a, b) => a.id.localeCompare(b.id));
  return {
    schemaVersion: ledger.schemaVersion ?? CLAIM_LEDGER_VERSION,
    generatedAt: options.generatedAt ?? ledger.generatedAt ?? null,
    claims,
    semanticEdges,
    proposedAdded: added,
    proposedSkipped: skipped,
  };
}

export function promoteClaim(ledger, claimIdValue, newStatus, options = {}) {
  const errors = [];
  if (!ledger || typeof ledger !== 'object') errors.push('ledger must be an object');
  if (!CLAIM_STATUSES.has(newStatus)) {
    errors.push(`unknown claim status: ${newStatus}`);
  }
  if (errors.length > 0) throw new Error(errors.join('; '));
  const claims = (ledger.claims ?? []).slice();
  const idx = claims.findIndex((c) => c.claimId === claimIdValue);
  if (idx === -1) throw new Error(`claim not found: ${claimIdValue}`);
  const old = claims[idx];
  const replaced = newStatus === 'rejected'
    ? {
        ...old,
        status: 'superseded',
        supersededBy: options.supersededBy ?? [],
        lastReviewed: options.lastReviewed ?? new Date().toISOString(),
        notes: [...(old.notes ?? []), ...(options.reviewNote ? [`Promote: review note - ${options.reviewNote}`] : [])],
      }
    : {
        ...old,
        status: newStatus,
        supersededBy: options.supersededBy ?? old.supersededBy ?? [],
        lastReviewed: options.lastReviewed ?? new Date().toISOString(),
        notes: [...(old.notes ?? []), ...(options.reviewNote ? [`Promote: review note - ${options.reviewNote}`] : [])],
      };
  claims[idx] = replaced;
  const semanticEdges = (ledger.semanticEdges ?? []).map((edge) =>
    edge.claimId === claimIdValue ? { ...edge, status: newStatus } : edge,
  );
  return {
    schemaVersion: ledger.schemaVersion ?? CLAIM_LEDGER_VERSION,
    generatedAt: ledger.generatedAt ?? null,
    claims,
    semanticEdges,
    previousStatus: old.status,
  };
}

export function augmentClaimsWithPerTopicSources(ledger, sourceRegistry, options = {}) {
  if (!ledger || typeof ledger !== 'object') throw new Error('ledger must be an object');
  if (!sourceRegistry || typeof sourceRegistry !== 'object') throw new Error('sourceRegistry must be an object');
  const docsByTopic = new Map();
  for (const source of sourceRegistry.sources ?? []) {
    if (source.kind === 'documentation_mediawiki_page' && source.topic) {
      docsByTopic.set(source.topic, source);
    }
  }
  const claims = (ledger.claims ?? []).map((claim) => augmentClaimEvidence(claim, docsByTopic, options));
  const augmented = claims.filter((c) => c._augmented).length;
  for (const c of claims) delete c._augmented;
  return {
    schemaVersion: ledger.schemaVersion ?? CLAIM_LEDGER_VERSION,
    generatedAt: ledger.generatedAt ?? null,
    claims,
    semanticEdges: ledger.semanticEdges ?? [],
    augmented,
  };
}

function augmentClaimEvidence(claim, docsByTopic, options) {
  const supportedTopicsByRule = buildTopicMapFromClaim(claim);
  const newEvidence = [];
  let augmented = false;
  for (const topic of supportedTopicsByRule) {
    const doc = docsByTopic.get(topic);
    if (!doc) continue;
    if ((claim.supportingEvidence ?? []).some((e) => e.kind === 'documentation_source' && e.id === doc.sourceId && (e.sectionAnchors !== undefined))) {
      continue;
    }
    const sectionAnchors = (doc.extracted?.sectionAnchors ?? []).map((a) => a.line);
    const entry = {
      kind: 'documentation_source',
      id: doc.sourceId,
      topic: doc.topic,
      url: doc.oldidUrl ?? doc.canonicalUrl,
    };
    if (sectionAnchors.length > 0) entry.sectionAnchors = sectionAnchors;
    if (options.sectionFirstOnly && sectionAnchors[0]) entry.section = sectionAnchors[0];
    newEvidence.push(entry);
    augmented = true;
  }
  if (!augmented) return { ...claim };
  return {
    ...claim,
    supportingEvidence: [...(claim.supportingEvidence ?? []), ...newEvidence],
    _augmented: true,
  };
}

function buildTopicMapFromClaim(claim) {
  const topics = new Set();
  for (const ev of claim.supportingEvidence ?? []) {
    if (ev.kind === 'documentation_source' && ev.topic) {
      topics.add(ev.topic);
    }
  }
  return topics;
}

function buildClaim({ node, rule, topicIndex, scope }) {
  const docEvidence = documentationEvidence(rule.claim.docTopic, topicIndex);
  const supportingEvidence = [
    {
      kind: 'graph_node',
      id: node.id,
      graphKind: node.kind,
      pointer: node.properties?.pointer ?? node.properties?.collectionPointer ?? null,
    },
    ...docEvidence,
  ];
  const semanticName = rule.claim.semanticName;
  return {
    claimId: claimId(semanticName, node.id),
    proposition: rule.claim.proposition,
    status: rule.claim.status,
    subjectGraphIds: [node.id],
    semanticName,
    semanticKind: rule.claim.semanticKind,
    confidence: rule.claim.confidence,
    scope,
    supportingEvidence,
    contradictingEvidence: [],
    rules: [rule.ruleId],
    uncertainty: rule.claim.uncertainty,
    supersededBy: [],
    lastReviewed: null,
    notes: rule.claim.notes ?? [],
  };
}

function nodeMatchesRule(node, rule) {
  if (node.kind !== rule.match.nodeKind) return false;
  return getProperty(node, rule.match.property) === rule.match.equals;
}

function getProperty(node, prop) {
  if (prop in node) return node[prop];
  return node.properties?.[prop];
}

function buildTopicIndex(sources) {
  const index = new Map();
  for (const source of sources) {
    const groups = source.extracted?.topicGroups ?? {};
    for (const titles of Object.values(groups)) {
      for (const title of titles) {
        if (!index.has(title)) index.set(title, []);
        index.get(title).push(source);
      }
    }
  }
  return index;
}

function documentationEvidence(topic, topicIndex) {
  if (!topic) return [];
  return (topicIndex.get(topic) ?? []).map((source) => ({
    kind: 'documentation_source',
    id: source.sourceId,
    topic,
    url: source.oldidUrl ?? source.canonicalUrl,
  }));
}

function scopeFromSources(sourceRegistry) {
  const doc = (sourceRegistry?.sources ?? []).find((s) => s.scope?.allDlcActive);
  if (doc?.scope) return doc.scope;
  return DEFAULT_SCOPE;
}

function claimId(semanticName, graphId) {
  return `claim:${semanticName}:${hash(graphId)}`;
}

function proposedClaimId(semanticName, sourceId, section, subjectGraphId) {
  return `claim:${semanticName}:${hash(`${sourceId}|${section ?? ''}|${subjectGraphId}`)}`;
}

function semanticEdgeId(claimIdValue, graphId) {
  return `semantic_edge:${hash(`${claimIdValue}:${graphId}`)}`;
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
