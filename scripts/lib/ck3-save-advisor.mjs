import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  extractBrief,
  extractPoliticalGraph,
  extractScout,
  extractSnapshot,
  readManifestOrJson,
} from './ck3-save-analysis.mjs';

export const DEFAULT_ADVISOR_DIR = 'knowledge/wiki/advisor';
export const DEFAULT_MECHANICS_DIR = 'knowledge/wiki/mechanics-content';
export const DEFAULT_GRAPH_PATH = 'knowledge/schema/graph.json';
export const DEFAULT_STATE_DIR = 'state/instance-graphs';

const ROUTES = [
  {
    id: 'adventurer-contracts',
    file: 'adventurer-contracts.md',
    domains: ['adventurer', 'contracts', 'contract', 'camp', 'travel', 'provisions', 'patron', 'favor', 'domicile'],
    reportViews: ['snapshot', 'brief', 'scout'],
  },
  {
    id: 'warfare',
    file: 'warfare.md',
    domains: ['war', 'warfare', 'army', 'armies', 'knight', 'knights', 'men-at-arms', 'fight', 'raid', 'alliance'],
    reportViews: ['snapshot', 'brief', 'scout', 'graph'],
  },
  {
    id: 'realm',
    file: 'realm.md',
    domains: ['realm', 'title', 'titles', 'county', 'counties', 'province', 'government', 'domain', 'vassal'],
    reportViews: ['snapshot', 'brief', 'graph'],
  },
  {
    id: 'culture-faith',
    file: 'culture-faith.md',
    domains: ['culture', 'faith', 'religion', 'tradition', 'traditions', 'tenet', 'tenets', 'doctrine'],
    reportViews: ['snapshot', 'brief'],
  },
  {
    id: 'relationships',
    file: 'relationships.md',
    domains: ['hook', 'hooks', 'scheme', 'schemes', 'secret', 'secrets', 'relation', 'relations', 'opinion'],
    reportViews: ['snapshot', 'brief', 'scout'],
  },
  {
    id: 'characters',
    file: 'characters.md',
    domains: ['character', 'ruler', 'player', 'skills', 'traits', 'lifestyle', 'resources', 'next', 'advice'],
    reportViews: ['snapshot', 'brief'],
  },
];

export function buildAdvisorPacket(input, options = {}) {
  const loaded = readManifestOrJson(input);
  const save = loaded.save;
  const snapshot = extractSnapshot(save);
  const brief = extractBrief(save, snapshot.player.id);
  const route = routeAdvisorQuestion(options.question ?? '', snapshot);
  const advisorModel = loadAdvisorModel(route, options.advisorDir ?? DEFAULT_ADVISOR_DIR);
  const mechanics = loadMechanicsForSources(advisorModel.sourceIds, options.mechanicsDir ?? DEFAULT_MECHANICS_DIR);
  const reports = buildReportViews(save, snapshot, brief, route);
  const graph = loadJson(options.graphPath ?? DEFAULT_GRAPH_PATH, { nodes: [] });
  const schemaCompatibility = summarizeSchemaCompatibility(save, graph);
  const currentSaveFacts = summarizeCurrentSaveFacts(snapshot, brief, reports);
  const evidence = buildEvidenceCitations({ input, loaded, snapshot, brief, route, advisorModel, reports });
  const packet = {
    schemaVersion: 1,
    kind: 'ck3_ephemeral_advisor_packet',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    question: options.question ?? '',
    input: {
      requestedPath: input,
      jsonPath: loaded.jsonPath,
      manifestPath: loaded.manifest ? input : null,
      saveDate: snapshot.date,
    },
    route: {
      advisorId: route.id,
      advisorPath: path.posix.join('knowledge/wiki/advisor', route.file),
      matchedTerms: route.matchedTerms,
      reportViews: route.reportViews,
    },
    advisorModel,
    mechanics,
    currentSaveFacts,
    evidence,
    schemaCompatibility,
    reports,
    answer: buildAnswerText({ route, snapshot, brief, mechanics, currentSaveFacts, evidence }),
    boundaries: [
      'This is an ephemeral advisor packet. It may cite durable graph/wiki knowledge, but current-save facts must remain under ignored state/.',
      'Existing report extractors are consumers here; they do not define the durable schema graph.',
      'Advice is a grounded starting point, not a full CK3 simulation.',
    ],
  };
  return packet;
}

export function writeAdvisorPacket(packet, options = {}) {
  const outDir = options.stateDir ?? DEFAULT_STATE_DIR;
  fs.mkdirSync(outDir, { recursive: true });
  const id = hashStableJson({
    question: packet.question,
    input: packet.input.jsonPath,
    saveDate: packet.input.saveDate,
    advisorId: packet.route.advisorId,
  }).slice(0, 16);
  const outPath = path.join(outDir, `advisor-${id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(packet, null, 2) + '\n');
  return outPath;
}

export function routeAdvisorQuestion(question, snapshot = null) {
  const q = String(question ?? '').toLowerCase();
  let best = null;
  for (const route of ROUTES) {
    const matchedTerms = route.domains.filter((term) => term.includes('-')
      ? q.includes(term)
      : new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(q));
    const score = matchedTerms.length;
    if (!best || score > best.score) best = { route, score, matchedTerms };
  }
  if ((!best || best.score === 0) && snapshot?.landlessMechanics?.isLandlessAdventurer) {
    const route = ROUTES.find((r) => r.id === 'adventurer-contracts');
    return { ...route, matchedTerms: ['landless_adventurer_government'] };
  }
  const selected = best?.score > 0 ? best : { route: ROUTES.find((r) => r.id === 'characters'), matchedTerms: ['default'] };
  return { ...selected.route, matchedTerms: selected.matchedTerms };
}

function buildReportViews(save, snapshot, brief, route) {
  const reports = {
    snapshot: summarizeSnapshotReport(snapshot),
    brief: summarizeBriefReport(brief),
  };
  if (route.reportViews.includes('scout')) {
    reports.scout = summarizeScoutReport(extractScout(save, snapshot.player.id));
  }
  if (route.reportViews.includes('graph')) {
    reports.graph = summarizeGraphReport(extractPoliticalGraph(save, snapshot.player.id));
  }
  return reports;
}

function summarizeSnapshotReport(snapshot) {
  return {
    report: 'snapshot',
    fields: {
      'snapshot.date': snapshot.date,
      'snapshot.player.id': snapshot.player.id,
      'snapshot.player.name': snapshot.player.name,
      'snapshot.player.locationLabel': snapshot.player.locationLabel,
      'snapshot.player.cultureName': snapshot.player.cultureName,
      'snapshot.player.faithName': snapshot.player.faithName,
      'snapshot.player.gold': snapshot.player.gold,
      'snapshot.player.prestige': snapshot.player.prestige,
      'snapshot.player.piety': snapshot.player.piety,
      'snapshot.camp.government': snapshot.camp.government,
      'snapshot.camp.purpose.id': snapshot.camp.purpose?.id ?? null,
      'snapshot.contracts.count': snapshot.contracts.length,
      'snapshot.patrons.contactFavors.count': snapshot.patrons.contactFavors.length,
    },
  };
}

function summarizeBriefReport(brief) {
  return {
    report: 'brief',
    fields: {
      'brief.location.label': brief.location?.label ?? null,
      'brief.travelOpportunities.count': brief.travelOpportunities.length,
      'brief.availableFavors.count': brief.availableFavors.length,
      'brief.pendingCooldowns.count': brief.pendingCooldowns.length,
      'brief.standingWith.count': brief.standingWith.length,
      'brief.nearbyRulers.count': brief.nearbyRulers.length,
    },
    topTravelOpportunities: brief.travelOpportunities.slice(0, 5),
    availableFavors: brief.availableFavors.slice(0, 5),
    pendingCooldowns: brief.pendingCooldowns.slice(0, 5),
  };
}

function summarizeScoutReport(scout) {
  return {
    report: 'scout',
    fields: {
      'scout.provinceScouts.count': scout.provinceScouts.length,
      'scout.rulerProfiles.count': scout.rulerProfiles.length,
      'scout.recommendations.count': scout.recommendations.length,
      'scout.currentState.resources.gold': scout.currentState.resources.gold,
      'scout.currentState.resources.prestige': scout.currentState.resources.prestige,
      'scout.currentState.resources.piety': scout.currentState.resources.piety,
    },
    mechanicsGuardrails: scout.mechanicsGuardrails,
    recommendations: scout.recommendations.slice(0, 5),
  };
}

function summarizeGraphReport(graph) {
  return {
    report: 'graph',
    fields: {
      'graph.nodes.count': graph.nodes?.length ?? 0,
      'graph.edges.count': graph.edges?.length ?? 0,
    },
  };
}

function summarizeCurrentSaveFacts(snapshot, brief, reports) {
  const facts = [
    {
      label: 'Played character',
      value: `${snapshot.player.name} (#${snapshot.player.id})`,
      reportField: 'snapshot.player.name',
      savePath: `$.living.${snapshot.player.id}`,
    },
    {
      label: 'Date',
      value: snapshot.date,
      reportField: 'snapshot.date',
      savePath: '$.date',
    },
    {
      label: 'Location',
      value: snapshot.player.locationLabel ?? brief.location?.label ?? null,
      reportField: 'snapshot.player.locationLabel',
      savePath: `$.living.${snapshot.player.id}.alive_data.location.location`,
    },
    {
      label: 'Resources',
      value: {
        gold: snapshot.player.gold,
        prestige: snapshot.player.prestige,
        piety: snapshot.player.piety,
        influence: snapshot.player.influence,
      },
      reportField: 'snapshot.player.{gold,prestige,piety,influence}',
      savePath: `$.living.${snapshot.player.id}.alive_data`,
    },
    {
      label: 'Government',
      value: snapshot.camp.government,
      reportField: 'snapshot.camp.government',
      savePath: `$.living.${snapshot.player.id}.landed_data.government`,
    },
    {
      label: 'Camp purpose',
      value: snapshot.camp.purpose?.label ?? null,
      reportField: 'snapshot.camp.purpose',
      savePath: `$.living.${snapshot.player.id}.landed_data.laws`,
    },
    {
      label: 'Contract opportunity count',
      value: brief.travelOpportunities.length,
      reportField: 'brief.travelOpportunities.count',
      savePath: '$.task_contracts.database',
    },
  ];
  if (reports.scout?.recommendations?.length) {
    facts.push({
      label: 'Top scout recommendation',
      value: reports.scout.recommendations[0],
      reportField: 'scout.recommendations[0]',
      savePath: 'derived from snapshot/contracts/province scouts',
    });
  }
  return facts;
}

function buildEvidenceCitations({ input, loaded, snapshot, brief, route, advisorModel }) {
  return {
    advisorModel: {
      path: path.posix.join('knowledge/wiki/advisor', route.file),
      sourceIds: advisorModel.sourceIds,
      graphIds: advisorModel.graphIds,
    },
    currentSave: [
      { reportField: 'snapshot.player.id', savePath: `$.living.${snapshot.player.id}`, value: snapshot.player.id },
      { reportField: 'snapshot.player.gold', savePath: `$.living.${snapshot.player.id}.alive_data.gold.value`, value: snapshot.player.gold },
      { reportField: 'snapshot.player.prestige', savePath: `$.living.${snapshot.player.id}.alive_data.prestige.currency`, value: snapshot.player.prestige },
      { reportField: 'snapshot.camp.government', savePath: `$.living.${snapshot.player.id}.landed_data.government`, value: snapshot.camp.government },
      { reportField: 'brief.travelOpportunities.count', savePath: '$.task_contracts.database', value: brief.travelOpportunities.length },
    ],
    sourceInput: {
      requestedPath: input,
      jsonPath: loaded.jsonPath,
      manifestPath: loaded.manifest ? input : null,
    },
  };
}

function buildAnswerText({ route, snapshot, brief, mechanics, currentSaveFacts, evidence }) {
  const lines = [];
  lines.push(`Advisor route: ${route.id}.`);
  lines.push(`Current save: ${snapshot.player.name} on ${snapshot.date}, at ${snapshot.player.locationLabel ?? brief.location?.label ?? 'unknown location'}.`);
  if (route.id === 'adventurer-contracts') {
    lines.push(`Landless/adventurer status: ${snapshot.landlessMechanics?.isLandlessAdventurer ? 'active' : 'not active'}; contracts visible: ${brief.travelOpportunities.length}; available favors: ${brief.availableFavors.length}.`);
    const top = brief.travelOpportunities[0];
    if (top) lines.push(`First contract to inspect: ${top.name ?? top.id} (${top.status ?? 'unknown'}, ${top.locationLabel ?? 'unknown location'}).`);
  } else if (route.id === 'warfare') {
    lines.push(`Military context should inspect armies, knights, allies, and nearby rulers before making a fight/no-fight call.`);
  } else {
    lines.push(`Primary facts: ${currentSaveFacts.slice(0, 4).map((fact) => `${fact.label}=${formatFactValue(fact.value)}`).join('; ')}.`);
  }
  lines.push(`Mechanics citations: ${mechanics.map((m) => `${m.sourceId} (${m.path})`).join('; ') || 'none'}.`);
  lines.push(`Save evidence: ${evidence.currentSave.map((e) => `${e.reportField} -> ${e.savePath}`).join('; ')}.`);
  return lines.join('\n');
}

function loadAdvisorModel(route, advisorDir) {
  const filePath = path.join(advisorDir, route.file);
  const content = fs.readFileSync(filePath, 'utf8');
  const meta = parseFrontmatter(content);
  return {
    id: route.id,
    path: filePath,
    title: titleFromMarkdown(content),
    advisorDomains: meta.advisorDomains ?? [],
    mechanicsConceptIds: meta.mechanicsConceptIds ?? [],
    graphIds: meta.graphIds ?? [],
    sourceIds: meta.sourceIds ?? [],
    inspectionHeadings: headings(content).filter((h) => /inspection|evidence|mechanics|advice/i.test(h.title)),
  };
}

function loadMechanicsForSources(sourceIds, mechanicsDir) {
  const pages = fs.existsSync(mechanicsDir)
    ? fs.readdirSync(mechanicsDir).filter((name) => name.endsWith('.md'))
    : [];
  const bySource = new Map();
  for (const name of pages) {
    const filePath = path.join(mechanicsDir, name);
    const content = fs.readFileSync(filePath, 'utf8');
    const meta = parseFrontmatter(content);
    if (meta.sourceId) bySource.set(meta.sourceId, { filePath, content, meta });
  }
  return sourceIds
    .map((sourceId) => {
      const page = bySource.get(sourceId);
      if (!page) return null;
      return {
        sourceId,
        path: toPosix(page.filePath),
        title: page.meta.title,
        oldidUrl: page.meta.sourceOldidUrl,
        notes: firstMechanicsNotes(page.content, 3),
      };
    })
    .filter(Boolean);
}

function summarizeSchemaCompatibility(save, graph) {
  const knownReportMetadata = new Set([
    'bookmark_date',
    'currently_played_characters',
    'date',
    'first_start',
    'ironman_manager',
    'next_player_event_id',
    'played_character',
    'playthrough_id',
    'playthrough_timer',
    'random_count',
    'random_seed',
    'ruler_designer_characters',
    'speed',
    'succession',
  ]);
  const knownTopLevel = new Set(
    (graph.nodes ?? [])
      .map((node) => node.properties?.pointer)
      .filter((p) => typeof p === 'string' && p.startsWith('$.'))
      .map((p) => p.slice(2).split(/[.\[]/)[0])
      .filter(Boolean),
  );
  const observedTopLevel = Object.keys(save).sort();
  const unknownTopLevelKeys = observedTopLevel.filter((key) => !knownTopLevel.has(key) && !knownReportMetadata.has(key));
  return {
    status: unknownTopLevelKeys.length ? 'review_needed' : 'no_unknown_top_level_keys',
    knownTopLevelCount: knownTopLevel.size,
    knownReportMetadataCount: observedTopLevel.filter((key) => knownReportMetadata.has(key)).length,
    observedTopLevelCount: observedTopLevel.length,
    unknownTopLevelKeys,
    note: 'Lightweight Task 12 compatibility surface. Full structural diff remains the schema-diff/discovery pipeline.',
  };
}

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) return {};
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) return {};
  const out = {};
  let currentKey = null;
  for (const line of content.slice(4, end).split('\n')) {
    const list = /^  - (.*)$/.exec(line);
    if (list && currentKey) {
      if (!Array.isArray(out[currentKey])) out[currentKey] = [];
      out[currentKey].push(parseScalar(list[1]));
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line);
    if (!kv) continue;
    currentKey = kv[1];
    out[currentKey] = kv[2] ? parseScalar(kv[2]) : [];
  }
  return out;
}

function parseScalar(value) {
  const trimmed = String(value).trim();
  if (/^".*"$/.test(trimmed)) return JSON.parse(trimmed);
  return trimmed;
}

function headings(content) {
  return String(content).split('\n')
    .map((line) => /^(#{1,6})\s+(.+)$/.exec(line))
    .filter(Boolean)
    .map((match) => ({ level: match[1].length, title: match[2].trim() }));
}

function titleFromMarkdown(content) {
  return headings(content).find((h) => h.level === 1)?.title ?? null;
}

function firstMechanicsNotes(content, limit) {
  const notes = [];
  let inNotes = false;
  for (const line of String(content).split('\n')) {
    if (/^## Mechanics Notes/.test(line)) {
      inNotes = true;
      continue;
    }
    if (inNotes && /^## /.test(line)) break;
    if (inNotes && line.startsWith('- ')) notes.push(line.slice(2));
    if (notes.length >= limit) break;
  }
  return notes;
}

function loadJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function formatFactValue(value) {
  if (value === null || value === undefined) return 'unknown';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function hashStableJson(value) {
  return crypto.createHash('sha256').update(JSON.stringify(sortObject(value))).digest('hex');
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortObject(v)]));
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
