export function diffSchemaGraphs(baseGraph, nextGraph, options = {}) {
  const {
    ignoreProvenance = true,
    ignoreSourceDocuments = true,
    maxItemsPerSection = 200,
  } = options;
  const baseNodeItems = ignoreSourceDocuments
    ? (baseGraph.nodes ?? []).filter((n) => n.kind !== 'source_document')
    : (baseGraph.nodes ?? []);
  const nextNodeItems = ignoreSourceDocuments
    ? (nextGraph.nodes ?? []).filter((n) => n.kind !== 'source_document')
    : (nextGraph.nodes ?? []);
  const baseNodes = indexById(baseNodeItems);
  const nextNodes = indexById(nextNodeItems);
  const baseEdges = indexById(baseGraph.edges ?? []);
  const nextEdges = indexById(nextGraph.edges ?? []);

  const allAddedNodes = added(baseNodes, nextNodes).map(compactNode);
  const allRemovedNodes = removed(baseNodes, nextNodes).map(compactNode);
  const allChangedNodes = changed(baseNodes, nextNodes, { ignoreProvenance }).map((c) => ({
    id: c.id,
    kind: c.next.kind,
    label: c.next.label,
    changes: c.changes,
  }));
  const allAddedEdges = added(baseEdges, nextEdges).map(compactEdge);
  const allRemovedEdges = removed(baseEdges, nextEdges).map(compactEdge);
  const allChangedEdges = changed(baseEdges, nextEdges, { ignoreProvenance }).map((c) => ({
    id: c.id,
    kind: c.next.kind,
    from: c.next.from,
    to: c.next.to,
    changes: c.changes,
  }));

  const structuralChanges = [
    ...allAddedNodes,
    ...allRemovedNodes,
    ...allChangedNodes,
    ...allAddedEdges,
    ...allRemovedEdges,
    ...allChangedEdges,
  ].length;
  const addedNodes = limit(allAddedNodes, maxItemsPerSection);
  const removedNodes = limit(allRemovedNodes, maxItemsPerSection);
  const changedNodes = limit(allChangedNodes, maxItemsPerSection);
  const addedEdges = limit(allAddedEdges, maxItemsPerSection);
  const removedEdges = limit(allRemovedEdges, maxItemsPerSection);
  const changedEdges = limit(allChangedEdges, maxItemsPerSection);

  return {
    schemaVersion: 1,
    summary: {
      baseNodes: baseGraph.nodes?.length ?? 0,
      nextNodes: nextGraph.nodes?.length ?? 0,
      baseEdges: baseGraph.edges?.length ?? 0,
      nextEdges: nextGraph.edges?.length ?? 0,
      addedNodes: allAddedNodes.length,
      removedNodes: allRemovedNodes.length,
      changedNodes: allChangedNodes.length,
      addedEdges: allAddedEdges.length,
      removedEdges: allRemovedEdges.length,
      changedEdges: allChangedEdges.length,
      structuralChanges,
      ignoredSourceDocuments: ignoreSourceDocuments,
      maxItemsPerSection,
      omitted: {
        addedNodes: Math.max(allAddedNodes.length - addedNodes.length, 0),
        removedNodes: Math.max(allRemovedNodes.length - removedNodes.length, 0),
        changedNodes: Math.max(allChangedNodes.length - changedNodes.length, 0),
        addedEdges: Math.max(allAddedEdges.length - addedEdges.length, 0),
        removedEdges: Math.max(allRemovedEdges.length - removedEdges.length, 0),
        changedEdges: Math.max(allChangedEdges.length - changedEdges.length, 0),
      },
      nodeKindChanges: countKinds([...allAddedNodes, ...allRemovedNodes, ...allChangedNodes]),
      edgeKindChanges: countKinds([...allAddedEdges, ...allRemovedEdges, ...allChangedEdges]),
    },
    addedNodes,
    removedNodes,
    changedNodes,
    addedEdges,
    removedEdges,
    changedEdges,
    compatibility: {
      schemaCompatible: allRemovedNodes.length === 0 && allRemovedEdges.length === 0,
      reviewRequired: structuralChanges > 0,
      notes: compatibilityNotes({
        addedNodes: allAddedNodes,
        removedNodes: allRemovedNodes,
        changedNodes: allChangedNodes,
        addedEdges: allAddedEdges,
        removedEdges: allRemovedEdges,
        changedEdges: allChangedEdges,
      }),
    },
  };
}

function limit(items, maxItems) {
  if (maxItems == null || maxItems < 0) return items;
  return items.slice(0, maxItems);
}

function indexById(items) {
  const index = new Map();
  for (const item of items) index.set(item.id, item);
  return index;
}

function added(base, next) {
  return Array.from(next.values()).filter((item) => !base.has(item.id)).sort(byId);
}

function removed(base, next) {
  return Array.from(base.values()).filter((item) => !next.has(item.id)).sort(byId);
}

function changed(base, next, options) {
  const out = [];
  for (const [id, baseItem] of base.entries()) {
    const nextItem = next.get(id);
    if (!nextItem) continue;
    const baseComparable = comparableItem(baseItem, options);
    const nextComparable = comparableItem(nextItem, options);
    if (JSON.stringify(baseComparable) === JSON.stringify(nextComparable)) continue;
    out.push({
      id,
      base: baseItem,
      next: nextItem,
      changes: diffObjects(baseComparable, nextComparable),
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function comparableItem(item, options) {
  const clone = sortObject(item);
  if (options.ignoreProvenance) {
    delete clone.provenance;
  }
  return clone;
}

function diffObjects(base, next, prefix = '') {
  const out = [];
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(next ?? {})]);
  for (const key of Array.from(keys).sort()) {
    const path = prefix ? `${prefix}.${key}` : key;
    const a = base?.[key];
    const b = next?.[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (isPlainObject(a) && isPlainObject(b)) {
      out.push(...diffObjects(a, b, path));
    } else {
      out.push({
        path,
        before: a ?? null,
        after: b ?? null,
      });
    }
  }
  return out;
}

function compactNode(node) {
  return {
    id: node.id,
    kind: node.kind,
    label: node.label,
    status: node.status,
  };
}

function compactEdge(edge) {
  return {
    id: edge.id,
    kind: edge.kind,
    from: edge.from,
    to: edge.to,
    status: edge.status,
  };
}

function countKinds(items) {
  const counts = {};
  for (const item of items) {
    counts[item.kind] = (counts[item.kind] ?? 0) + 1;
  }
  return sortObject(counts);
}

function compatibilityNotes(diff) {
  const notes = [];
  if (diff.removedNodes.length > 0 || diff.removedEdges.length > 0) {
    notes.push('Removals may indicate version/applicability differences or overfitting in the base graph.');
  }
  if (diff.addedNodes.some((n) => n.kind === 'field') || diff.changedNodes.some((n) => n.kind === 'field')) {
    notes.push('Field additions or changes should be reviewed as schema additions or shape variants, not campaign entities.');
  }
  if (diff.addedEdges.some((e) => e.kind === 'field_uses_identity_domain') || diff.changedEdges.some((e) => e.kind === 'field_uses_identity_domain')) {
    notes.push('Reference coverage changed; keep conflicting aggregate observations visible until more sources decide applicability.');
  }
  if (notes.length === 0) notes.push('No structural schema changes detected.');
  return notes;
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, sortObject(v)]),
  );
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function byId(a, b) {
  return a.id.localeCompare(b.id);
}
