import crypto from 'node:crypto';

export const CLAIM_LEDGER_VERSION = 1;

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
