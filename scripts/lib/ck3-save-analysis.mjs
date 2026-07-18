import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SKILL_NAMES = ['diplomacy', 'martial', 'stewardship', 'intrigue', 'learning', 'prowess'];
const CK3_GAME_DIR = path.join(process.env.HOME ?? '', '.steam/debian-installation/steamapps/common/Crusader Kings III/game');
const PATRON_MODIFIERS = new Set([
  'succeeded_task_contract_opinion',
  'critically_succeeded_task_contract_opinion',
  'failed_task_contract_opinion',
  'laamp_used_contact_opinion',
  'laamp_used_contact_opinion_special',
]);
const CONTACT_HOOK_TYPES = new Map([
  ['contact_list_weak_hook', {
    label: 'Excelled at Contract',
    source: 'task contract contact favor',
    durationDays: 1825,
    requestInteraction: 'contact_list_request_interaction',
  }],
]);
const CONTACT_REQUEST_OPTIONS = [
  {
    id: 'request_provisions',
    label: 'Provisions',
    opinionCost: -20,
    opinionModifier: 'laamp_used_contact_opinion_special',
    canCheck: ({ recipient }) => recipient.isLanded,
    blocker: 'recipient is not landed',
  },
  {
    id: 'request_gold',
    label: 'Gold',
    opinionCost: -40,
    opinionModifier: 'laamp_used_contact_opinion',
    canCheck: ({ recipient }) => recipient.gold === null || recipient.gold > 20,
    blocker: 'recipient has insufficient gold',
  },
  {
    id: 'request_maa',
    label: 'Men-at-arms regiment',
    opinionCost: -40,
    opinionModifier: 'laamp_used_contact_opinion',
    canCheck: ({ recipient }) => recipient.isLandedOrAdministrative,
    blocker: 'recipient is not landed or administrative',
    caveat: 'also requires the adventurer to have an open men-at-arms regiment slot',
  },
  {
    id: 'request_knights',
    label: 'Rent a knight',
    opinionCost: -30,
    opinionModifier: 'laamp_used_contact_opinion',
    canCheck: () => null,
    caveat: 'requires the recipient to have more than one unlanded knight available',
  },
  {
    id: 'request_marriage',
    label: 'Arrange a marriage',
    opinionCost: -50,
    opinionModifier: 'laamp_used_contact_opinion',
    canCheck: () => null,
    caveat: 'requires a valid marriage between the adventurer camp and recipient court',
  },
  {
    id: 'request_contract',
    label: 'New task contract',
    opinionCost: -5,
    opinionModifier: 'laamp_used_contact_opinion',
    canCheck: () => null,
    caveat: 'requires at least one valid task contract type from this recipient and no existing contract from them',
  },
  {
    id: 'request_feast',
    label: 'Host a feast with adventurer as honorary guest',
    opinionCost: -30,
    opinionModifier: 'laamp_used_contact_opinion',
    perk: 'inspiring_rule_perk',
    canCheck: ({ actor, recipient }) => actor.perks.includes('inspiring_rule_perk') && recipient.isLandedOrAdministrative && recipient.tierRank > 1,
    blocker: 'requires Inspiring Rule perk and a county-tier-or-higher landed/administrative recipient',
    caveat: 'also blocked by recipient war/availability and the adventurer feast request cooldown',
  },
  {
    id: 'request_tournament',
    label: 'Host a tournament',
    opinionCost: -50,
    opinionModifier: 'laamp_used_contact_opinion_special',
    perk: 'stalwart_leader_perk',
    canCheck: ({ actor, recipient }) => actor.perks.includes('stalwart_leader_perk') && recipient.isLanded && recipient.tierRank > 1,
    blocker: 'requires Stalwart Leader perk, Tours and Tournaments, and a county-tier-or-higher landed recipient',
    caveat: 'also blocked by recipient war/availability/conqueror state and the adventurer tournament request cooldown',
  },
];
const CAMP_PURPOSES = new Map([
  ['camp_purpose_wanderers', {
    label: 'Wanderers',
    contractWeights: ['equal chance to find task contracts of any type'],
    modifiers: [],
    unlocks: [],
    notes: ['Can change to another camp purpose without the normal hefty prestige cost.'],
  }],
  ['camp_purpose_mercenaries', {
    label: 'Swords-for-Hire',
    contractWeights: ['more mercenary contracts', 'more martial contracts', 'more prowess contracts'],
    modifiers: ['+1 men-at-arms cap', '+8 knight limit', '-50% embarkation cost'],
    unlocks: ['siege engineers baggage train', 'lockwagon proving grounds', 'palisade camp perimeter', 'ditch camp perimeter'],
    notes: ['Martial camp purpose.'],
  }],
  ['camp_purpose_scholars', {
    label: 'Scholars',
    contractWeights: ['more learning contracts', 'more stewardship contracts', 'slightly more diplomacy contracts'],
    modifiers: ['+20% monthly lifestyle XP'],
    unlocks: ['reference corpus', 'morticians tools', 'siege engineers', 'scribes', 'ascetics', 'nightly debates', 'martial study'],
    notes: [],
  }],
  ['camp_purpose_explorers', {
    label: 'Explorers',
    contractWeights: ['more transport contracts', 'more diplomacy contracts', 'more intrigue contracts', 'slightly more martial contracts'],
    modifiers: ['+25% character travel speed', 'reduced sea/coastal travel danger'],
    unlocks: ['reserve provisions', 'reserve water', 'climbing gear', 'local hangers-on', 'extra watch'],
    notes: [],
  }],
  ['camp_purpose_brigands', {
    label: 'Freebooters',
    contractWeights: ['more criminal contracts', 'more prowess contracts', 'more intrigue contracts'],
    modifiers: ['+3 knight limit', '-50% embarkation cost'],
    unlocks: ['subdued gear', 'morticians tools', 'ransom cages', 'negotiators', 'juicy rumors', 'lockwagon', 'stick game'],
    notes: ['Martial camp purpose.'],
  }],
  ['camp_purpose_legitimists', {
    label: 'Legitimists',
    contractWeights: ['equal chance to find task contracts of any type', 'unique legitimist support contracts'],
    modifiers: ['+1 men-at-arms cap', '+8 knight limit'],
    unlocks: ['future dreams', 'bodyguard drills', 'martial study', 'lockwagon', 'scribes', 'proof of claims', 'ransom cages'],
    notes: ['Requires a pressed claim on at least one kingdom-tier title.', 'Unlocks request legitimist support and claim wars.'],
  }],
]);
const DEFAULT_SCOUT_TARGETS = [
  { label: 'Rome / Papacy', provinceId: 2575, reason: 'nearby high-value POI and wealthy religious ruler surface' },
  { label: 'Constantinople', provinceId: 496, reason: 'capital, grand city, Hagia Sophia, and Byzantine contact surface' },
  { label: 'Halikarnassos / Ionia', provinceId: 747, reason: 'eastern POI route and Aegean ruler scouting surface' },
  { label: 'Alexandria', provinceId: 6053, reason: 'Lighthouse POI and Egypt route surface' },
  { label: 'Baghdad', provinceId: 4795, reason: 'House of Wisdom / grand city route surface' },
];
let staticTitleIndex = null;

export function readSaveJson(filePath) {
  const raw = filePath.endsWith('.gz')
    ? zlib.gunzipSync(fs.readFileSync(filePath)).toString('utf8')
    : fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

export function readManifestOrJson(filePath) {
  const data = readSaveJson(filePath);
  if (data?.jsonPath && !data.played_character) {
    const jsonPath = path.isAbsolute(data.jsonPath)
      ? data.jsonPath
      : path.resolve(path.dirname(filePath), data.jsonPath);
    return { save: readSaveJson(jsonPath), jsonPath, manifest: data };
  }
  return { save: data, jsonPath: filePath, manifest: null };
}

export function getPlayedCharacterId(save) {
  return save?.played_character?.character ?? save?.currently_played_characters?.[0]?.character ?? null;
}

export function getCharacter(save, id) {
  if (id === null || id === undefined) return null;
  const key = String(id);
  return save.living?.[key] ?? save.characters?.[key] ?? save.dead_unprunable?.[key] ?? null;
}

export function characterName(character, fallbackId = null) {
  if (!character) return fallbackId === null ? 'unknown' : `#${fallbackId}`;
  const bits = [character.first_name, character.nick_name].filter(Boolean);
  return bits.length ? bits.join(' ') : fallbackId === null ? 'unknown' : `#${fallbackId}`;
}

export function characterSummary(save, id, currentDate = save.date) {
  const character = getCharacter(save, id);
  if (!character) return { id, name: `#${id}`, missing: true };
  const alive = character.alive_data ?? {};
  const landed = character.landed_data ?? {};
  const court = character.court_data ?? {};
  const locationId = alive.location?.location ?? null;
  return {
    id,
    name: characterName(character, id),
    age: ageAt(currentDate, character.birth),
    birth: character.birth ?? null,
    culture: character.culture ?? null,
    cultureName: resolveCultureName(save, character.culture),
    faith: character.faith ?? null,
    faithName: resolveFaithName(save, character.faith),
    dynastyHouse: character.dynasty_house ?? null,
    skills: skillsObject(character.skill),
    employer: court.employer ?? null,
    location: locationId,
    locationLabel: resolveProvinceLabel(save, locationId),
    primaryTitle: summarizeTitle(save, landed.domain?.[0]),
    government: landed.government ?? null,
    domain: landed.domain ?? [],
  };
}

export function extractSnapshot(save) {
  const playerId = getPlayedCharacterId(save);
  const player = getCharacter(save, playerId);
  if (!player) {
    throw new Error(`Played character ${playerId ?? '(missing)'} was not found in living/characters/dead_unprunable`);
  }

  const alive = player.alive_data ?? {};
  const landed = player.landed_data ?? {};
  const variables = variableMap(alive.variables?.data);
  const succession = landed.succession ?? [];
  const entourage = extractEntourage(save, playerId, succession);

  return {
    date: save.date ?? null,
    player: {
      ...characterSummary(save, playerId),
      focus: alive.focus?.type ?? null,
      traits: player.trait ?? [],
      perks: alive.perk ?? [],
      health: alive.health ?? null,
      fertility: alive.fertility ?? null,
      gold: alive.gold?.value ?? null,
      prestige: alive.prestige?.currency ?? null,
      piety: alive.piety?.currency ?? null,
      influence: alive.influence?.currency ?? null,
      income: alive.income ?? null,
    },
    camp: {
      government: landed.government ?? null,
      laws: landed.laws ?? [],
      purpose: interpretCampPurpose(landed.laws ?? []),
      currentStrength: landed.current_strength ?? landed.strength ?? null,
      strength: landed.strength ?? null,
      power: landed.power ?? null,
      maxPower: landed.max_power ?? null,
      balance: landed.balance ?? null,
      atPeacePenalty: landed.at_peace_penalty ?? null,
      domain: landed.domain ?? [],
      domainTitles: (landed.domain ?? []).map((titleId) => summarizeTitle(save, titleId)),
      succession,
    },
    variables,
    counters: Object.fromEntries(
      Object.entries(variables)
        .filter(([name, value]) => /contract|justicar|laamp|travel|poi/i.test(name) && Object.hasOwn(value ?? {}, 'decoded'))
        .map(([name, value]) => [name, value.decoded])
    ),
    visitedPointsOfInterest: alive.visited_points_of_interest ?? [],
    entourage,
    contracts: extractContracts(save, playerId),
    patrons: extractPatronSignals(save, playerId),
    landlessMechanics: extractLandlessMechanics(save, playerId),
  };
}

export function extractEntourage(save, playerId, succession = []) {
  const successionRank = new Map(succession.map((id, index) => [id, index + 1]));
  return Object.entries(save.living ?? {})
    .filter(([, character]) => character?.court_data?.employer === playerId)
    .map(([idText]) => {
      const id = Number(idText);
      const summary = characterSummary(save, id);
      return {
        ...summary,
        successionRank: successionRank.get(id) ?? null,
        skillsTotal: Object.values(summary.skills ?? {}).reduce((sum, value) => sum + (value ?? 0), 0),
      };
    })
    .sort((a, b) => (a.successionRank ?? 999) - (b.successionRank ?? 999) || (b.skillsTotal ?? 0) - (a.skillsTotal ?? 0));
}

export function extractContracts(save, playerId) {
  const contracts = save.task_contracts?.database ?? {};
  return Object.entries(contracts)
    .filter(([, contract]) => contract?.owner === playerId)
    .map(([id, contract]) => ({
      id,
      name: contract.name ?? null,
      type: contract.type ?? null,
      status: contract.status ?? null,
      tier: contract.tier ?? null,
      location: contract.location ?? null,
      locationLabel: resolveProvinceLabel(save, contract.location),
      employer: normalizeInvalidId(contract.employer),
      employerCharacter: normalizeInvalidId(contract.employer) ? characterSummary(save, contract.employer) : null,
      acceptanceDate: contract.acceptance_date ?? null,
      completionDate: contract.completion_date ?? null,
      variables: variableMap(contract.variables?.data),
    }))
    .sort((a, b) => String(a.status).localeCompare(String(b.status)) || String(a.name).localeCompare(String(b.name)));
}

export function resolveCultureName(save, cultureId) {
  if (cultureId === null || cultureId === undefined) return null;
  return save.culture_manager?.cultures?.[String(cultureId)]?.name ?? null;
}

export function resolveFaithName(save, faithId) {
  if (faithId === null || faithId === undefined) return null;
  const faith = save.religion?.faiths?.[String(faithId)];
  return faith?.tag ?? faith?.faith_type ?? null;
}

export function resolveProvinceLabel(save, provinceId) {
  const summary = summarizeProvince(save, provinceId);
  if (!summary) return provinceId === null || provinceId === undefined ? null : `province ${provinceId}`;
  const parts = [];
  if (summary.barony?.name) parts.push(summary.barony.name);
  if (summary.county?.name && summary.county.name !== summary.barony?.name) parts.push(summary.county.name);
  if (summary.specialBuilding) parts.push(summary.specialBuilding);
  return parts.length ? `${parts.join(', ')} (#${provinceId})` : `province ${provinceId}`;
}

export function summarizeProvince(save, provinceId) {
  if (provinceId === null || provinceId === undefined) return null;
  const province = save.provinces?.[String(provinceId)] ?? null;
  const staticEntry = getStaticTitleIndex().provinceToTitles.get(Number(provinceId));
  if (!staticEntry && !province) return null;
  return {
    id: provinceId,
    barony: summarizeTitleByKey(save, staticEntry?.baronyKey),
    county: summarizeTitleByKey(save, staticEntry?.countyKey),
    duchy: summarizeTitleByKey(save, staticEntry?.duchyKey),
    kingdom: summarizeTitleByKey(save, staticEntry?.kingdomKey),
    empire: summarizeTitleByKey(save, staticEntry?.empireKey),
    pointsOfInterest: province?.points_of_interest ?? [],
    specialBuilding: province?.holding?.special_building_type ?? province?.holding?.special_building?.type ?? null,
    holdingType: province?.holding?.type ?? null,
  };
}

export function summarizeTitle(save, titleId) {
  if (titleId === null || titleId === undefined) return null;
  const title = save.landed_titles?.landed_titles?.[String(titleId)];
  if (!title) return { id: titleId, key: null, name: `#${titleId}`, missing: true };
  return summarizeTitleRecord(save, titleId, title);
}

export function summarizeTitleByKey(save, key) {
  if (!key) return null;
  const titleEntry = Object.entries(save.landed_titles?.landed_titles ?? {})
    .find(([, title]) => title?.key === key);
  if (!titleEntry) return { id: null, key, name: titleKeyToName(key), missing: true };
  return summarizeTitleRecord(save, Number(titleEntry[0]), titleEntry[1]);
}

function summarizeTitleRecord(save, id, title) {
  return {
    id,
    key: title.key ?? null,
    name: title.title_name_data?.name ?? titleKeyToName(title.key),
    adjective: title.title_name_data?.adj ?? null,
    holder: normalizeInvalidId(title.holder),
    holderName: normalizeInvalidId(title.holder) ? characterName(getCharacter(save, title.holder), title.holder) : null,
    deFactoLiege: normalizeInvalidId(title.de_facto_liege),
    capital: title.capital ?? null,
    landless: title.landless ?? false,
  };
}

export function extractPatronSignals(save, playerId) {
  const relations = save.relations?.active_relations ?? [];
  const relevantRelations = relations
    .filter((relation) => relation.first === playerId || relation.second === playerId)
    .map((relation) => {
      const otherId = relation.first === playerId ? relation.second : relation.first;
      const hooks = Object.entries(relation)
        .filter(([key]) => key.startsWith('active_hook_'))
        .map(([key, hook]) => ({ slot: key, type: hook?.type ?? null, expirationDate: hook?.expiration_date ?? null }));
      const cooldowns = Object.entries(relation)
        .filter(([key]) => key.startsWith('cooldown_against_recipient_'))
        .flatMap(([slot, cooldown]) => Object.entries(cooldown ?? {}).map(([interaction, until]) => ({ slot, interaction, until })));
      return {
        first: relation.first,
        second: relation.second,
        other: characterSummary(save, otherId),
        hooks,
        cooldowns,
      };
    })
    .filter((relation) => relation.hooks.length || relation.cooldowns.length);

  const activeOpinions = save.opinions?.active_opinions ?? [];
  const relevantOpinions = activeOpinions
    .filter((opinion) => opinion.owner === playerId || opinion.target === playerId)
    .map((opinion) => {
      const modifier = opinion.temporary_opinion?.modifier ?? null;
      return {
        owner: characterSummary(save, opinion.owner),
        target: characterSummary(save, opinion.target),
        modifier,
        startDate: opinion.temporary_opinion?.start_date ?? null,
        expirationDate: opinion.temporary_opinion?.expiration_date ?? null,
        value: opinion.temporary_opinion?.value ?? null,
        modify: opinion.temporary_opinion?.modify ?? null,
        scriptedRelations: Object.keys(opinion.scripted_relations ?? {}),
      };
    });

  return {
    relations: relevantRelations,
    contractOpinions: relevantOpinions.filter((opinion) => PATRON_MODIFIERS.has(opinion.modifier)),
    otherOpinions: relevantOpinions.filter((opinion) => !PATRON_MODIFIERS.has(opinion.modifier)),
    contactFavors: interpretContactFavors(save, playerId, relevantRelations, relevantOpinions),
  };
}

export function extractLandlessMechanics(save, playerId = null) {
  const resolvedPlayerId = playerId ?? getPlayedCharacterId(save);
  const player = getCharacter(save, resolvedPlayerId);
  if (!player) return null;
  const alive = player.alive_data ?? {};
  const landed = player.landed_data ?? {};
  const campPurpose = interpretCampPurpose(landed.laws ?? []);
  return {
    government: landed.government ?? null,
    isLandlessAdventurer: landed.government === 'landless_adventurer_government',
    campPurpose,
    provisions: {
      note: 'Camp provisions are stored on the camp domicile, not currently extracted from this save snapshot.',
      mechanics: [
        'provisions are food, water, and shelter for the moving camp',
        'moving consumes provisions based on MAA size, terrain, and officers',
        'low provisions trigger privation, opinion loss, desertion, starvation, or mutiny',
        'provisions can be refilled by stationary decisions, task contract rewards, or contact requests',
      ],
    },
    followers: {
      count: extractEntourage(save, resolvedPlayerId, landed.succession ?? []).length,
      mechanics: [
        'followers are unlanded adventurer courtiers',
        'followers can serve as officers, commanders, and knights',
        'followers can provide claims for the adventurer to press',
        'named follower opinion drives camp temperament',
      ],
    },
    influence: {
      value: alive.influence?.currency ?? null,
      note: 'Influence exists on the character, but the base Roads to Power landless contact request does not spend/request influence. TGP administrative request variants should be modeled separately.',
    },
    contactRequest: {
      interaction: 'contact_list_request_interaction',
      label: 'Make a Request',
      cooldown: '8 months against the recipient',
      autoAcceptWithUsableHook: true,
      hookTypes: Object.fromEntries(CONTACT_HOOK_TYPES),
      options: CONTACT_REQUEST_OPTIONS.map(({ canCheck, ...option }) => option),
    },
  };
}

function interpretCampPurpose(laws = []) {
  const id = laws.find((law) => CAMP_PURPOSES.has(law)) ?? null;
  if (!id) return null;
  return { id, ...CAMP_PURPOSES.get(id) };
}

function interpretContactFavors(save, playerId, relations, opinions) {
  const actor = contactActorContext(save, playerId);
  return relations
    .map((relation) => {
      const otherId = relation.other.id;
      const recipient = contactRecipientContext(save, otherId);
      const heldHooks = relation.hooks
        .filter((hook) => relationSlotHolderId(relation, hook.slot) === playerId)
        .filter((hook) => CONTACT_HOOK_TYPES.has(hook.type))
        .map((hook) => ({
          ...hook,
          mechanics: CONTACT_HOOK_TYPES.get(hook.type),
          daysUntilExpiry: daysUntil(save.date, hook.expirationDate),
        }));
      const spentCooldowns = relation.cooldowns
        .filter((cooldown) => relationSlotHolderId(relation, cooldown.slot) === playerId)
        .map((cooldown) => ({
          ...cooldown,
          daysUntilClear: daysUntil(save.date, cooldown.until),
        }));
      const requestOpinion = opinions
        .filter((opinion) => opinion.modifier === 'laamp_used_contact_opinion' || opinion.modifier === 'laamp_used_contact_opinion_special')
        .find((opinion) => opinion.owner.id === otherId && opinion.target.id === playerId);
      if (!heldHooks.length && !spentCooldowns.length && !requestOpinion) return null;
      return {
        target: relation.other,
        state: heldHooks.length ? 'available_hook' : spentCooldowns.length ? 'cooldown' : 'spent_or_recently_used',
        availableHooks: heldHooks,
        cooldowns: spentCooldowns,
        usedOpinion: requestOpinion ? {
          modifier: requestOpinion.modifier,
          value: requestOpinion.value,
          startDate: requestOpinion.startDate,
          expirationDate: requestOpinion.expirationDate,
          likelyRequests: inferRequestOptionsFromOpinion(requestOpinion),
        } : null,
        requestOptions: CONTACT_REQUEST_OPTIONS.map((option) => evaluateContactRequestOption(option, actor, recipient)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.target.name).localeCompare(String(b.target.name)));
}

function evaluateContactRequestOption(option, actor, recipient) {
  const result = option.canCheck({ actor, recipient });
  return {
    id: option.id,
    label: option.label,
    opinionCost: option.opinionCost,
    opinionModifier: option.opinionModifier,
    availableByKnownRules: result,
    blocker: result === false ? option.blocker : null,
    caveat: option.caveat ?? null,
    requiredPerk: option.perk ?? null,
  };
}

function inferRequestOptionsFromOpinion(opinion) {
  return CONTACT_REQUEST_OPTIONS
    .filter((option) => option.opinionModifier === opinion.modifier && option.opinionCost === opinion.value)
    .map((option) => ({ id: option.id, label: option.label }));
}

function contactActorContext(save, playerId) {
  const player = getCharacter(save, playerId);
  const alive = player?.alive_data ?? {};
  return {
    id: playerId,
    perks: alive.perk ?? [],
  };
}

function contactRecipientContext(save, characterId) {
  const character = getCharacter(save, characterId);
  const landed = character?.landed_data ?? {};
  const primaryTitle = summarizeTitle(save, landed.domain?.[0]);
  return {
    id: characterId,
    gold: character?.alive_data?.gold?.value ?? null,
    government: landed.government ?? null,
    primaryTitle,
    tierRank: titleTierRank(primaryTitle),
    isLanded: Boolean(primaryTitle && !primaryTitle.landless && !primaryTitle.missing),
    isLandedOrAdministrative: Boolean(primaryTitle && !primaryTitle.missing) || /administrative/.test(landed.government ?? ''),
  };
}

function relationSlotHolderId(relation, slot) {
  const side = slot.endsWith('_0') ? 'first' : 'second';
  return side === 'first' ? relation.first : relation.second;
}

function titleTierRank(title) {
  if (!title?.key) return 0;
  return { b: 1, c: 2, d: 3, k: 4, e: 5, x: 3 }[title.key[0]] ?? 0;
}

export function extractPoliticalGraph(save, playerId = null) {
  const resolvedPlayerId = playerId ?? getPlayedCharacterId(save);
  if (!resolvedPlayerId) throw new Error('No played character found in save');
  const player = getCharacter(save, resolvedPlayerId);
  if (!player) throw new Error(`Played character ${resolvedPlayerId} not found`);

  const alive = player.alive_data ?? {};
  const landed = player.landed_data ?? {};
  const playerLocationId = alive.location?.location ?? null;

  const people = new Map();
  const places = new Map();
  const edges = [];

  function ensurePerson(id) {
    if (id === null || id === undefined || normalizeInvalidId(id) === null) return null;
    const key = String(id);
    if (people.has(key)) return people.get(key);
    const summary = characterSummary(save, Number(id));
    const node = { id: Number(id), summary, roles: new Set() };
    people.set(key, node);
    return node;
  }

  function ensurePlace(provinceId) {
    if (provinceId === null || provinceId === undefined) return null;
    const key = String(provinceId);
    if (places.has(key)) return places.get(key);
    const summary = summarizeProvince(save, provinceId);
    const node = { id: Number(provinceId), summary, reasons: new Set() };
    places.set(key, node);
    return node;
  }

  function addEdge(fromKind, fromId, toKind, toId, kind, label = null) {
    if (fromId === null || fromId === undefined || toId === null || toId === undefined) return;
    edges.push({
      from: `${fromKind}:${fromId}`,
      to: `${toKind}:${toId}`,
      kind,
      label,
    });
  }

  const playerNode = ensurePerson(resolvedPlayerId);
  playerNode.roles.add('player');

  if (playerLocationId !== null) {
    const place = ensurePlace(playerLocationId);
    if (place) place.reasons.add('player location');
    addEdge('person', resolvedPlayerId, 'place', playerLocationId, 'located at');
  }

  for (const titleId of landed.domain ?? []) {
    const title = summarizeTitle(save, titleId);
    if (!title || title.missing) continue;
    if (title.capital !== null && title.capital !== undefined) {
      const place = ensurePlace(title.capital);
      if (place) place.reasons.add('player title capital');
    }
    if (title.holder !== null && title.holder !== undefined) {
      const holder = ensurePerson(title.holder);
      if (holder) holder.roles.add('player title holder');
    }
    if (title.deFactoLiege !== null && title.deFactoLiege !== undefined) {
      const liegeTitle = summarizeTitle(save, title.deFactoLiege);
      const liegeHolder = liegeTitle && !liegeTitle.missing ? liegeTitle.holder : null;
      if (liegeHolder !== null && liegeHolder !== undefined && liegeHolder !== title.holder) {
        const liege = ensurePerson(liegeHolder);
        if (liege) liege.roles.add('player title liege');
        const liegeLabel = liegeTitle?.name ? `${title.name} → ${liegeTitle.name}` : `${title.name} → #${title.deFactoLiege}`;
        addEdge('person', title.holder ?? resolvedPlayerId, 'person', liegeHolder, 'liege', liegeLabel);
      }
    }
  }

  const entourage = extractEntourage(save, resolvedPlayerId, landed.succession ?? []);
  for (const member of entourage) {
    const node = ensurePerson(member.id);
    if (node) {
      node.roles.add('entourage');
      if (member.successionRank) node.roles.add(`entourage heir #${member.successionRank}`);
    }
    if (member.location !== null && member.location !== undefined) {
      const place = ensurePlace(member.location);
      if (place) place.reasons.add('entourage location');
      addEdge('person', member.id, 'place', member.location, 'located at');
    }
    const rankLabel = member.successionRank ? `heir #${member.successionRank}` : 'camp follower';
    addEdge('person', resolvedPlayerId, 'person', member.id, 'employs', rankLabel);
  }

  const contracts = extractContracts(save, resolvedPlayerId);
  for (const contract of contracts) {
    if (contract.employer !== null && contract.employer !== undefined) {
      const node = ensurePerson(contract.employer);
      if (node) node.roles.add('contract employer');
      addEdge('person', resolvedPlayerId, 'person', contract.employer, 'contract employer', `${contract.name} [${contract.status ?? '?'}]`);
    }
    if (contract.location !== null && contract.location !== undefined) {
      const place = ensurePlace(contract.location);
      if (place) place.reasons.add('contract location');
      addEdge('person', resolvedPlayerId, 'place', contract.location, 'contract at', contract.name);
    }
    if (contract.target !== null && contract.target !== undefined) {
      const node = ensurePerson(contract.target);
      if (node) node.roles.add('contract target');
      addEdge('person', resolvedPlayerId, 'person', contract.target, 'contract target', contract.name);
    }
  }

  for (const relation of save.relations?.active_relations ?? []) {
    if (relation.first !== resolvedPlayerId && relation.second !== resolvedPlayerId) continue;
    const otherId = relation.first === resolvedPlayerId ? relation.second : relation.first;
    const other = ensurePerson(otherId);
    if (other) other.roles.add('patron contact');
    addEdge('person', resolvedPlayerId, 'person', otherId, 'patron contact');

    for (const [slot, hook] of Object.entries(relation)) {
      if (!slot.startsWith('active_hook_')) continue;
      const side = slot.endsWith('_0') ? 'first' : 'second';
      const holderId = side === 'first' ? relation.first : relation.second;
      const targetId = side === 'first' ? relation.second : relation.first;
      const holderNode = ensurePerson(holderId);
      if (holderNode) holderNode.roles.add('contact hook holder');
      addEdge('person', holderId, 'person', targetId, 'hook available', `${hook?.type ?? 'hook'} expires ${hook?.expiration_date ?? '?'}`);
    }
    for (const [slot, cooldown] of Object.entries(relation)) {
      if (!slot.startsWith('cooldown_against_recipient_')) continue;
      const side = slot.endsWith('_0') ? 'first' : 'second';
      const actorId = side === 'first' ? relation.first : relation.second;
      const targetId = side === 'first' ? relation.second : relation.first;
      const actorNode = ensurePerson(actorId);
      if (actorNode) actorNode.roles.add('contact user');
      for (const [interaction, until] of Object.entries(cooldown ?? {})) {
        addEdge('person', actorId, 'person', targetId, 'contact used', `${interaction} until ${until}`);
      }
    }
  }

  const patronData = extractPatronSignals(save, resolvedPlayerId);
  for (const opinion of patronData.contractOpinions) {
    const owner = ensurePerson(opinion.owner.id);
    const target = ensurePerson(opinion.target.id);
    if (owner) owner.roles.add('contract opinion owner');
    if (target) target.roles.add('contract opinion target');
    let kind;
    switch (opinion.modifier) {
      case 'succeeded_task_contract_opinion':
      case 'critically_succeeded_task_contract_opinion':
        kind = 'succeeded contract opinion';
        break;
      case 'failed_task_contract_opinion':
        kind = 'failed contract opinion';
        break;
      case 'laamp_used_contact_opinion':
        kind = 'used contact opinion';
        break;
      default:
        kind = opinion.modifier ?? 'contract opinion';
    }
    addEdge('person', opinion.owner.id, 'person', opinion.target.id, kind, `value ${opinion.value ?? '?'}`);
  }

  function ensurePlaceControl(provinceId) {
    const place = places.get(String(provinceId));
    if (!place || !place.summary) return;
    const layers = ['barony', 'county', 'duchy', 'kingdom', 'empire'];
    for (const layer of layers) {
      const title = place.summary[layer];
      if (!title) continue;
      if (title.holder !== null && title.holder !== undefined) {
        const holder = ensurePerson(title.holder);
        if (holder) holder.roles.add(`${layer} holder`);
        addEdge('person', title.holder, 'place', provinceId, 'title holder', `${layer} ${title.name}`);
      }
      if (title.deFactoLiege !== null && title.deFactoLiege !== undefined) {
        const liegeTitle = summarizeTitle(save, title.deFactoLiege);
        const liegeHolder = liegeTitle && !liegeTitle.missing ? liegeTitle.holder : null;
        if (liegeHolder !== null && liegeHolder !== undefined && liegeHolder !== title.holder) {
          const liege = ensurePerson(liegeHolder);
          if (liege) liege.roles.add(`${layer} liege`);
          const liegeLabel = liegeTitle?.name ? `${layer} ${title.name} → ${liegeTitle.name}` : `${layer} ${title.name} → #${title.deFactoLiege}`;
          addEdge('person', title.holder, 'person', liegeHolder, 'liege', liegeLabel);
        }
      }
    }
  }
  for (const place of places.values()) ensurePlaceControl(place.id);

  for (const titleId of landed.domain ?? []) {
    const title = summarizeTitle(save, titleId);
    if (!title || title.missing) continue;
    if (title.capital !== null && title.capital !== undefined) {
      ensurePlaceControl(title.capital);
    }
  }

  return {
    date: save.date ?? null,
    player: resolvedPlayerId,
    people: [...people.values()]
      .sort((a, b) => a.id - b.id)
      .map((p) => ({
        id: p.id,
        name: p.summary.name,
        culture: p.summary.cultureName,
        faith: p.summary.faithName,
        location: p.summary.locationLabel,
        primaryTitle: p.summary.primaryTitle?.name ?? null,
        government: p.summary.government,
        roles: [...p.roles].sort(),
      })),
    places: [...places.values()]
      .sort((a, b) => a.id - b.id)
      .map((pl) => ({
        id: pl.id,
        label: resolveProvinceLabel(save, pl.id),
        reasons: [...pl.reasons].sort(),
      })),
    edges,
  };
}

export function extractBrief(save, playerId = null) {
  const resolvedPlayerId = playerId ?? getPlayedCharacterId(save);
  if (!resolvedPlayerId) throw new Error('No played character found in save');
  const player = getCharacter(save, resolvedPlayerId);
  if (!player) throw new Error(`Played character ${resolvedPlayerId} not found`);

  const alive = player.alive_data ?? {};
  const playerLocationId = alive.location?.location ?? null;
  const playerProvince = playerLocationId !== null && playerLocationId !== undefined
    ? summarizeProvince(save, playerLocationId)
    : null;

  const contracts = extractContracts(save, resolvedPlayerId);
  const travelOpportunities = contracts.map((contract) => {
    const contractProvince = contract.location !== null && contract.location !== undefined
      ? summarizeProvince(save, contract.location)
      : null;
    const proximity = playerProvince && contractProvince ? proximityTo(playerProvince, contractProvince) : null;
    return {
      id: contract.id,
      name: contract.name,
      status: contract.status,
      tier: contract.tier,
      type: contract.type,
      location: contract.location,
      locationLabel: contract.locationLabel,
      employer: contract.employer,
      employerName: contract.employerCharacter?.name ?? null,
      proximity,
    };
  }).sort((a, b) => {
    const statusOrder = { available: 0, accepted: 1, in_progress: 2, completed: 3, failed: 4, expired: 5 };
    const aOrder = statusOrder[a.status] ?? 99;
    const bOrder = statusOrder[b.status] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aRank = proximityRank(a.proximity);
    const bRank = proximityRank(b.proximity);
    if (aRank !== bRank) return aRank - bRank;
    return (b.tier ?? 0) - (a.tier ?? 0);
  });

  const availableFavors = [];
  const pendingCooldowns = [];
  for (const relation of save.relations?.active_relations ?? []) {
    if (relation.first !== resolvedPlayerId && relation.second !== resolvedPlayerId) continue;
    for (const [slot, hook] of Object.entries(relation)) {
      if (!slot.startsWith('active_hook_')) continue;
      const side = slot.endsWith('_0') ? 'first' : 'second';
      const holderId = side === 'first' ? relation.first : relation.second;
      if (holderId !== resolvedPlayerId) continue;
      const targetId = side === 'first' ? relation.second : relation.first;
      availableFavors.push({
        targetId,
        targetName: characterName(getCharacter(save, targetId), targetId),
        hookType: hook?.type ?? null,
        expires: hook?.expiration_date ?? null,
        daysUntilExpiry: daysUntil(save.date, hook?.expiration_date),
      });
    }
    for (const [slot, cooldown] of Object.entries(relation)) {
      if (!slot.startsWith('cooldown_against_recipient_')) continue;
      const side = slot.endsWith('_0') ? 'first' : 'second';
      const actorId = side === 'first' ? relation.first : relation.second;
      if (actorId !== resolvedPlayerId) continue;
      const targetId = side === 'first' ? relation.second : relation.first;
      for (const [interaction, until] of Object.entries(cooldown ?? {})) {
        pendingCooldowns.push({
          targetId,
          targetName: characterName(getCharacter(save, targetId), targetId),
          interaction,
          until,
          daysUntilClear: daysUntil(save.date, until),
        });
      }
    }
  }
  availableFavors.sort((a, b) => (a.daysUntilExpiry ?? Infinity) - (b.daysUntilExpiry ?? Infinity));
  pendingCooldowns.sort((a, b) => (a.daysUntilClear ?? Infinity) - (b.daysUntilClear ?? Infinity));

  const patronData = extractPatronSignals(save, resolvedPlayerId);
  const contacts = new Map();
  for (const relation of patronData.relations) {
    const otherId = relation.other.id;
    if (!contacts.has(otherId)) {
      contacts.set(otherId, {
        id: otherId,
        name: relation.other.name,
        culture: relation.other.cultureName,
        faith: relation.other.faithName,
        location: relation.other.locationLabel,
        primaryTitle: relation.other.primaryTitle?.name ?? null,
        netValue: 0,
        opinions: [],
      });
    }
  }
  for (const opinion of patronData.contractOpinions) {
    const otherId = opinion.owner.id === resolvedPlayerId ? opinion.target.id : opinion.owner.id;
    if (otherId === resolvedPlayerId) continue;
    if (!contacts.has(otherId)) {
      const summary = opinion.owner.id === resolvedPlayerId ? opinion.target : opinion.owner;
      contacts.set(otherId, {
        id: otherId,
        name: summary.name,
        culture: summary.cultureName,
        faith: summary.faithName,
        location: summary.locationLabel,
        primaryTitle: summary.primaryTitle?.name ?? null,
        netValue: 0,
        opinions: [],
      });
    }
    const entry = contacts.get(otherId);
    entry.opinions.push({
      modifier: opinion.modifier,
      value: opinion.value,
      direction: opinion.owner.id === resolvedPlayerId ? 'to_them' : 'from_them',
      expires: opinion.expirationDate,
    });
    entry.netValue += opinion.value ?? 0;
  }
  const standingWith = [...contacts.values()].sort((a, b) => b.netValue - a.netValue);

  const nearbyRulersMap = new Map();
  if (playerProvince) {
    const layers = ['barony', 'county', 'kingdom'];
    for (const layer of layers) {
      const title = playerProvince[layer];
      if (!title) continue;
      const id = title.holder;
      if (id === null || id === undefined) continue;
      if (!nearbyRulersMap.has(id)) {
        const holder = characterSummary(save, id);
        nearbyRulersMap.set(id, {
          holderId: id,
          holderName: holder.name,
          isPlayer: id === resolvedPlayerId,
          titles: [],
        });
      }
      nearbyRulersMap.get(id).titles.push({ layer, title: title.name, titleKey: title.key });
    }
  }
  const nearbyRulers = [...nearbyRulersMap.values()];

  return {
    date: save.date ?? null,
    player: resolvedPlayerId,
    location: playerLocationId !== null && playerLocationId !== undefined
      ? {
          id: playerLocationId,
          label: resolveProvinceLabel(save, playerLocationId),
        }
      : null,
    travelOpportunities,
    availableFavors,
    pendingCooldowns,
    contactFavors: patronData.contactFavors,
    landlessMechanics: extractLandlessMechanics(save, resolvedPlayerId),
    standingWith,
    nearbyRulers,
  };
}

export function extractScout(save, playerId = null, options = {}) {
  const resolvedPlayerId = playerId ?? getPlayedCharacterId(save);
  if (!resolvedPlayerId) throw new Error('No played character found in save');
  const snapshot = extractSnapshot(save);
  const brief = extractBrief(save, resolvedPlayerId);
  const playerProvinceId = snapshot.player.location ?? null;
  const targetRefs = resolveScoutTargets(save, resolvedPlayerId, options.targets ?? []);
  const targetProvinceIds = new Set([
    playerProvinceId,
    ...snapshot.contracts.map((contract) => contract.location),
    ...DEFAULT_SCOUT_TARGETS.map((target) => target.provinceId),
    ...targetRefs.filter((target) => target.kind === 'province').map((target) => target.provinceId),
  ].filter((id) => id !== null && id !== undefined));

  const provinceScouts = [...targetProvinceIds]
    .map((provinceId) => extractProvinceScout(save, provinceId, resolvedPlayerId))
    .filter(Boolean);
  const rulerIds = new Set([
    ...snapshot.contracts.map((contract) => contract.employer),
    ...brief.nearbyRulers.map((ruler) => ruler.holderId),
    ...provinceScouts.flatMap((province) => province.rulers.map((ruler) => ruler.id)),
    ...targetRefs.filter((target) => target.kind === 'character').map((target) => target.characterId),
  ].filter((id) => id !== null && id !== undefined && id !== resolvedPlayerId));
  const rulerProfiles = [...rulerIds]
    .map((id) => extractRulerProfile(save, id, resolvedPlayerId))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));
  const poiGates = extractPoiDecisionGates(save, resolvedPlayerId);
  const hookGuardrails = extractHookGuardrails(save, resolvedPlayerId);
  const recommendations = buildScoutRecommendations({
    snapshot,
    provinceScouts,
    rulerProfiles,
    poiGates,
    hookGuardrails,
  });

  return {
    date: save.date ?? null,
    player: snapshot.player,
    currentState: {
      location: snapshot.player.locationLabel,
      government: snapshot.camp.government,
      campPurpose: snapshot.camp.purpose,
      focus: snapshot.player.focus,
      perks: snapshot.player.perks,
      resources: {
        gold: snapshot.player.gold,
        prestige: snapshot.player.prestige,
        piety: snapshot.player.piety,
        influence: snapshot.player.influence,
      },
      counters: snapshot.counters,
      currentContractsAreLocalBoard: true,
      campRelocationNote: 'Current task contracts are a local board; moving camp can reroll the opportunity surface and should be treated as strategy, not only travel.',
    },
    mechanicsGuardrails: [
      snapshot.landlessMechanics?.isLandlessAdventurer
        ? 'Roads to Power landless adventurer mechanics are active.'
        : 'Roads to Power landless-adventurer assumptions are not active for this played character.',
      'Only explicitly mapped contact-favor hooks, currently contact_list_weak_hook, count as RtP Make a Request favors.',
      'Ordinary hooks such as house_head_hook, claim hooks, and blackmail hooks stay ordinary unless local game files prove a mapping.',
      'Active temporary opinion modifiers are partial evidence, not full UI opinion totals.',
    ],
    poiGates,
    hookGuardrails,
    contracts: snapshot.contracts.map((contract) => ({
      id: contract.id,
      name: contract.name,
      status: contract.status,
      type: contract.type,
      tier: contract.tier,
      location: contract.location,
      locationLabel: contract.locationLabel,
      employer: contract.employer,
      employerName: contract.employerCharacter?.name ?? null,
    })),
    provinceScouts,
    rulerProfiles,
    recommendations,
    caveats: [
      'Scout uses serialized save state plus known local mechanics; some live UI checks are not fully serialized.',
      'Secrets are only advisory when the save exposes a clear player-known linkage; raw secret existence alone is not treated as actionable.',
      'Disease and war state are best-effort interpretations of save databases.',
    ],
  };
}

export function extractRulerProfile(save, characterId, playerId = null) {
  const id = Number(characterId);
  const character = getCharacter(save, id);
  if (!character) return null;
  const summary = characterSummary(save, id);
  const alive = character.alive_data ?? {};
  const landed = character.landed_data ?? {};
  const player = playerId ?? getPlayedCharacterId(save);
  const opinions = extractOpinionLinks(save, id, player);
  const hooks = extractHookLinks(save, id, player);
  const warState = extractWarState(save, id);
  const resourceScore = Math.max(0, Number(alive.gold?.value ?? 0)) / 100
    + Math.max(0, Number(alive.income ?? 0))
    + Math.max(0, Number(alive.prestige?.currency ?? 0)) / 1000;
  const scarPenalty = opinions.some((opinion) => (opinion.value ?? 0) <= -40) ? 2 : 0;
  const warPenalty = warState.atWar ? 2 : 0;
  const titleRank = titleTierRank(summary.primaryTitle);
  const score = Number((resourceScore + titleRank - scarPenalty - warPenalty).toFixed(3));
  return {
    id,
    name: summary.name,
    age: summary.age,
    culture: summary.cultureName,
    faith: summary.faithName,
    location: summary.locationLabel,
    locationProvince: summary.location,
    primaryTitle: summary.primaryTitle,
    government: summary.government,
    domainSize: landed.domain?.length ?? 0,
    gold: alive.gold?.value ?? null,
    income: alive.income ?? null,
    prestige: alive.prestige?.currency ?? null,
    piety: alive.piety?.currency ?? null,
    influence: alive.influence?.currency ?? null,
    traits: character.traits ?? character.trait ?? [],
    perks: alive.perk ?? [],
    warState,
    opinionsWithPlayer: opinions,
    hooksWithPlayer: hooks,
    strategicUse: classifyStrategicUse({
      summary,
      gold: alive.gold?.value ?? null,
      income: alive.income ?? null,
      prestige: alive.prestige?.currency ?? null,
      titleRank,
      warState,
      opinions,
      hooks,
    }),
    score,
  };
}

export function extractProvinceScout(save, provinceId, playerId = null) {
  if (provinceId === null || provinceId === undefined) return null;
  const summary = summarizeProvince(save, provinceId);
  if (!summary) return null;
  const player = playerId ?? getPlayedCharacterId(save);
  const rulerIds = [...new Set(['barony', 'county', 'duchy', 'kingdom', 'empire']
    .map((layer) => summary[layer]?.holder)
    .filter((id) => id !== null && id !== undefined && id !== player))];
  const rulers = rulerIds
    .map((id) => extractRulerProfile(save, id, player))
    .filter(Boolean)
    .map((ruler) => ({
      id: ruler.id,
      name: ruler.name,
      primaryTitle: ruler.primaryTitle?.name ?? null,
      government: ruler.government,
      gold: ruler.gold,
      income: ruler.income,
      prestige: ruler.prestige,
      warState: ruler.warState,
      strategicUse: ruler.strategicUse,
      score: ruler.score,
    }));
  const epidemics = extractEpidemicScout(save, [provinceId]);
  const poiValue = (summary.pointsOfInterest?.length ?? 0) + (summary.specialBuilding ? 1 : 0);
  const rulerValue = rulers.reduce((max, ruler) => Math.max(max, ruler.score ?? 0), 0);
  const diseasePenalty = epidemics.some((entry) => entry.status === 'infected') ? 5 : 0;
  return {
    provinceId: Number(provinceId),
    label: resolveProvinceLabel(save, provinceId),
    summary,
    pointsOfInterest: summary.pointsOfInterest ?? [],
    specialBuilding: summary.specialBuilding,
    rulers,
    epidemics,
    clearOfActiveEpidemic: !epidemics.some((entry) => entry.status === 'infected'),
    score: Number((poiValue * 3 + rulerValue - diseasePenalty).toFixed(3)),
    reasons: scoutProvinceReasons(summary, rulers, epidemics),
  };
}

export function extractEpidemicScout(save, provinceIdsOrRegion) {
  const provinceIds = new Set((Array.isArray(provinceIdsOrRegion) ? provinceIdsOrRegion : [provinceIdsOrRegion])
    .filter((id) => id !== null && id !== undefined)
    .map((id) => String(id)));
  const results = [];
  for (const [id, epidemic] of Object.entries(save.epidemics?.database ?? {})) {
    if (!epidemic || epidemic === 'none' || !epidemic.infections) continue;
    for (const provinceId of provinceIds) {
      const infection = epidemic.infections[provinceId];
      if (!infection) continue;
      results.push({
        epidemicId: id,
        provinceId: Number(provinceId),
        type: epidemic.type ?? null,
        name: epidemic.name ?? epidemic.type ?? `epidemic ${id}`,
        intensity: epidemic.intensity ?? null,
        status: classifyInfectionStatus(save.date, infection),
        startDate: infection.start_date ?? null,
        maxInfectionDate: infection.max_infection_date ?? null,
        recoveryStartDate: infection.recovery_start_date ?? null,
        endDate: infection.end_date ?? null,
        infectionRate: infection.infection_rate ?? null,
      });
    }
  }
  return results;
}

export function extractPoiDecisionGates(save, playerId = null) {
  const resolvedPlayerId = playerId ?? getPlayedCharacterId(save);
  const player = getCharacter(save, resolvedPlayerId);
  const snapshot = extractSnapshot(save);
  const poiCount = snapshot.counters.poi_visited ?? snapshot.visitedPointsOfInterest.length ?? 0;
  const travelCount = snapshot.counters.travel_provinces_traversed ?? null;
  const prestige = snapshot.player.prestige;
  const gold = snapshot.player.gold;
  const advancedCriteria = [
    { id: 'poi_42', label: '42 POIs visited', met: poiCount >= 42, value: poiCount },
    { id: 'prestige_level_4', label: 'prestige level 4', met: null, value: null, note: 'Prestige level is not yet resolved from save state.' },
    { id: 'traveler_track_60', label: 'traveler travel-track XP >= 60', met: null, value: null, note: 'Traveler track XP is not yet resolved from trait data.' },
  ];
  const advancedMet = advancedCriteria.filter((item) => item.met === true).length;
  return {
    poiVisited: poiCount,
    visitedPointsOfInterest: player?.alive_data?.visited_points_of_interest ?? [],
    travelProvincesTraversed: travelCount,
    prestige,
    gold,
    seasonedVisitor: {
      requiredPoi: 26,
      met: poiCount >= 26,
      missingPoi: Math.max(0, 26 - poiCount),
    },
    travelsDecisionAdvancedGate: {
      requiredPoi: 42,
      requiredTwoOfThree: true,
      criteria: advancedCriteria,
      knownCriteriaMet: advancedMet,
      metByKnownCriteria: advancedMet >= 2,
      missingPoi: Math.max(0, 42 - poiCount),
      cost: { prestige: 1500, gold: 500 },
      canAffordKnownCost: typeof prestige === 'number' && typeof gold === 'number'
        ? prestige >= 1500 && gold >= 500
        : null,
      rewardScalingNote: 'Rewards scale every 12 POIs up to 60.',
    },
  };
}

export function classifyHookMechanic(hookType) {
  if (CONTACT_HOOK_TYPES.has(hookType)) {
    return {
      hookType,
      category: 'rtp_contact_favor',
      isContactFavor: true,
      label: CONTACT_HOOK_TYPES.get(hookType).label,
    };
  }
  return {
    hookType,
    category: 'ordinary_hook',
    isContactFavor: false,
    label: hookType ?? 'hook',
  };
}

export function classifyStrategicUse(profile) {
  const uses = [];
  const gold = profile.gold ?? 0;
  const income = profile.income ?? 0;
  const titleRank = profile.titleRank ?? 0;
  const negativeOpinion = profile.opinions?.some((opinion) => (opinion.value ?? 0) <= -40);
  if (profile.warState?.atWar) uses.push('avoid/low leverage: at war');
  if (negativeOpinion) uses.push('avoid/low leverage: opinion scar');
  if (titleRank >= 2 && gold >= 100 && !profile.warState?.atWar && !negativeOpinion) uses.push('sponsor/patron candidate');
  if (titleRank >= 2 && !profile.warState?.atWar && !negativeOpinion) uses.push('tournament host candidate');
  if (titleRank >= 2) uses.push('contract employer candidate');
  if (gold >= 250 || income >= 10) uses.push('high-cash ruler');
  if (!uses.length) uses.push('POI-only ruler');
  return uses;
}

function resolveScoutTargets(save, playerId, targets) {
  return (targets ?? []).flatMap((rawTarget) => {
    const raw = String(rawTarget ?? '').trim();
    if (!raw) return [];
    const [kind, value] = raw.includes(':') ? raw.split(':', 2) : [null, raw];
    const numeric = Number(value);
    if ((kind === 'character' || kind === 'char') && Number.isFinite(numeric)) {
      return [{ kind: 'character', input: raw, characterId: numeric }];
    }
    if (kind === 'province' && Number.isFinite(numeric)) {
      return [{ kind: 'province', input: raw, provinceId: numeric }];
    }
    if (kind === 'title' && Number.isFinite(numeric)) {
      const title = summarizeTitle(save, numeric);
      return title?.capital ? [{ kind: 'province', input: raw, provinceId: title.capital, title }] : [];
    }
    if (!kind && Number.isFinite(numeric)) {
      if (getCharacter(save, numeric)) return [{ kind: 'character', input: raw, characterId: numeric }];
      if (save.provinces?.[String(numeric)] || summarizeProvince(save, numeric)) return [{ kind: 'province', input: raw, provinceId: numeric }];
      const title = summarizeTitle(save, numeric);
      if (title?.capital) return [{ kind: 'province', input: raw, provinceId: title.capital, title }];
    }
    const lower = raw.toLowerCase();
    const matches = [];
    for (const [idText, character] of Object.entries(save.living ?? {})) {
      if (characterName(character, Number(idText)).toLowerCase().includes(lower)) {
        matches.push({ kind: 'character', input: raw, characterId: Number(idText) });
      }
      if (matches.length >= 5) break;
    }
    for (const [idText, title] of Object.entries(save.landed_titles?.landed_titles ?? {})) {
      const titleName = title.title_name_data?.name ?? titleKeyToName(title.key);
      if (String(titleName ?? '').toLowerCase().includes(lower) || String(title.key ?? '').toLowerCase().includes(lower)) {
        const summary = summarizeTitle(save, Number(idText));
        if (summary?.capital) matches.push({ kind: 'province', input: raw, provinceId: summary.capital, title: summary });
      }
      if (matches.length >= 10) break;
    }
    return dedupeScoutTargets(matches);
  });
}

function dedupeScoutTargets(targets) {
  const seen = new Set();
  const out = [];
  for (const target of targets) {
    const key = `${target.kind}:${target.characterId ?? target.provinceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(target);
  }
  return out;
}

function extractHookGuardrails(save, playerId) {
  const rows = [];
  for (const relation of save.relations?.active_relations ?? []) {
    if (relation.first !== playerId && relation.second !== playerId) continue;
    const otherId = relation.first === playerId ? relation.second : relation.first;
    for (const [slot, hook] of Object.entries(relation)) {
      if (!slot.startsWith('active_hook_')) continue;
      const holderId = relationSlotHolderId(relation, slot);
      const targetId = holderId === relation.first ? relation.second : relation.first;
      const mechanic = classifyHookMechanic(hook?.type ?? null);
      rows.push({
        other: characterSummary(save, otherId),
        holder: characterSummary(save, holderId),
        target: characterSummary(save, targetId),
        slot,
        hookType: hook?.type ?? null,
        expirationDate: hook?.expiration_date ?? null,
        mechanic,
      });
    }
  }
  return rows;
}

function extractOpinionLinks(save, characterId, playerId) {
  if (!playerId) return [];
  return (save.opinions?.active_opinions ?? [])
    .filter((opinion) => (
      (opinion.owner === characterId && opinion.target === playerId)
      || (opinion.owner === playerId && opinion.target === characterId)
    ))
    .map((opinion) => ({
      direction: opinion.owner === characterId ? 'toward_player' : 'from_player',
      owner: opinion.owner,
      target: opinion.target,
      modifier: opinion.temporary_opinion?.modifier ?? null,
      value: opinion.temporary_opinion?.value ?? null,
      startDate: opinion.temporary_opinion?.start_date ?? null,
      expirationDate: opinion.temporary_opinion?.expiration_date ?? null,
      scriptedRelations: Object.keys(opinion.scripted_relations ?? {}),
    }))
    .filter((opinion) => opinion.modifier || opinion.scriptedRelations.length);
}

function extractHookLinks(save, characterId, playerId) {
  if (!playerId) return [];
  return (save.relations?.active_relations ?? [])
    .filter((relation) => (
      (relation.first === characterId && relation.second === playerId)
      || (relation.first === playerId && relation.second === characterId)
    ))
    .flatMap((relation) => Object.entries(relation)
      .filter(([slot]) => slot.startsWith('active_hook_'))
      .map(([slot, hook]) => {
        const holderId = relationSlotHolderId(relation, slot);
        const targetId = holderId === relation.first ? relation.second : relation.first;
        return {
          holderId,
          targetId,
          heldByPlayer: holderId === playerId,
          heldByThem: holderId === characterId,
          hookType: hook?.type ?? null,
          expirationDate: hook?.expiration_date ?? null,
          mechanic: classifyHookMechanic(hook?.type ?? null),
        };
      }));
}

function extractWarState(save, characterId) {
  const wars = save.wars?.active_wars ?? save.wars?.database ?? save.wars ?? {};
  const matches = [];
  for (const [warId, war] of Object.entries(wars)) {
    if (!war || war === 'none') continue;
    const participants = [
      ...(war.attacker?.participants ?? []).map((p) => ({ side: 'attacker', character: p.character })),
      ...(war.defender?.participants ?? []).map((p) => ({ side: 'defender', character: p.character })),
    ];
    if (war.attacker) participants.push({ side: 'attacker', character: war.attacker.character ?? war.attacker });
    if (war.defender) participants.push({ side: 'defender', character: war.defender.character ?? war.defender });
    const match = participants.find((participant) => participant.character === characterId);
    if (!match) continue;
    matches.push({
      warId,
      side: match.side,
      startDate: war.start_date ?? null,
      type: war.casus_belli?.type ?? null,
      targetTitles: war.targeted_titles ?? [],
    });
  }
  return { atWar: matches.length > 0, wars: matches };
}

function classifyInfectionStatus(currentDate, infection) {
  if (infection.end_date && compareCk3Dates(currentDate, infection.end_date) > 0) return 'ended';
  if (infection.recovery_start_date && compareCk3Dates(currentDate, infection.recovery_start_date) >= 0) return 'recovering';
  if (infection.start_date && compareCk3Dates(currentDate, infection.start_date) >= 0) return 'infected';
  return 'scheduled';
}

function scoutProvinceReasons(summary, rulers, epidemics) {
  const reasons = [];
  if (summary.pointsOfInterest?.length) reasons.push(`POI: ${summary.pointsOfInterest.join(', ')}`);
  if (summary.specialBuilding) reasons.push(`special building: ${summary.specialBuilding}`);
  if (summary.kingdom?.name) reasons.push(`kingdom: ${summary.kingdom.name}`);
  const bestRuler = rulers.slice().sort((a, b) => b.score - a.score)[0];
  if (bestRuler) reasons.push(`best ruler surface: ${bestRuler.name} (${bestRuler.strategicUse.join(', ')})`);
  if (epidemics.some((entry) => entry.status === 'infected')) reasons.push('active epidemic risk');
  else reasons.push('no active epidemic found in this province');
  return reasons;
}

function buildScoutRecommendations({ snapshot, provinceScouts, rulerProfiles, poiGates, hookGuardrails }) {
  const recommendations = [];
  const ordinaryHooks = hookGuardrails.filter((hook) => !hook.mechanic.isContactFavor);
  const contactHooks = hookGuardrails.filter((hook) => hook.mechanic.isContactFavor);
  const bestPoi = provinceScouts
    .filter((province) => province.pointsOfInterest.length || province.specialBuilding)
    .filter((province) => province.clearOfActiveEpidemic)
    .sort((a, b) => b.score - a.score)[0];
  const bestLocalContract = snapshot.contracts
    .map((contract) => {
      const employer = rulerProfiles.find((ruler) => ruler.id === contract.employer);
      const proximity = contract.location ? proximityTo(summarizeProvinceFromSnapshot(snapshot), summarizeProvinceForContract(provinceScouts, contract.location)) : null;
      const score = (contract.tier ?? 0) + (employer?.score ?? 0) - (employer?.opinionsWithPlayer?.some((opinion) => (opinion.value ?? 0) <= -40) ? 3 : 0);
      return { contract, employer, proximity, score };
    })
    .sort((a, b) => b.score - a.score)[0];
  if (ordinaryHooks.length && !contactHooks.length) {
    recommendations.push({
      priority: 1,
      title: 'Do not treat the live ordinary hook as an RtP contact favor',
      evidence: ordinaryHooks.map((hook) => `${hook.hookType} held by ${hook.holder.name} on ${hook.target.name}`),
      mechanic: 'hook guardrail',
    });
  }
  if (bestPoi) {
    const missing42 = poiGates.travelsDecisionAdvancedGate.missingPoi;
    recommendations.push({
      priority: 2,
      title: `Scout or relocate toward ${bestPoi.label}`,
      evidence: bestPoi.reasons,
      mechanic: missing42 > 0
        ? `POI/fame route: ${poiGates.poiVisited}/42 known POIs, ${missing42} more to the advanced POI threshold`
        : 'POI/fame route: 42+ POI threshold already met by known counter',
    });
  }
  if (bestLocalContract) {
    recommendations.push({
      priority: 3,
      title: `Best local board play: ${bestLocalContract.contract.name} for ${bestLocalContract.contract.employerCharacter?.name ?? bestLocalContract.contract.employer ?? 'unknown'}`,
      evidence: [
        `${bestLocalContract.contract.locationLabel ?? `province ${bestLocalContract.contract.location ?? '?'}`}`,
        ...(bestLocalContract.employer?.strategicUse ?? []),
        ...(bestLocalContract.employer?.opinionsWithPlayer ?? []).map((opinion) => `${opinion.modifier} ${opinion.value}`),
      ],
      mechanic: 'local contract board; moving camp can reroll this surface',
    });
  }
  return recommendations.sort((a, b) => a.priority - b.priority);
}

function summarizeProvinceFromSnapshot(snapshot) {
  return snapshot.player.location === null || snapshot.player.location === undefined ? null : {
    id: snapshot.player.location,
    label: snapshot.player.locationLabel,
  };
}

function summarizeProvinceForContract(provinceScouts, provinceId) {
  return provinceScouts.find((province) => province.provinceId === provinceId)?.summary ?? null;
}

function proximityTo(a, b) {
  if (!a || !b) return null;
  for (const layer of ['barony', 'county', 'duchy', 'kingdom']) {
    if (a[layer]?.id !== null && a[layer]?.id !== undefined && a[layer]?.id === b[layer]?.id) return layer;
  }
  return 'far';
}

function proximityRank(proximity) {
  if (!proximity) return 99;
  return { barony: 0, county: 1, duchy: 2, kingdom: 3, far: 4 }[proximity] ?? 99;
}

function daysUntil(currentDate, targetDate) {
  if (typeof currentDate !== 'string' || typeof targetDate !== 'string') return null;
  const currentYear = Number(currentDate.split('.')[0]);
  const targetYear = Number(targetDate.split('.')[0]);
  if (!Number.isFinite(currentYear) || !Number.isFinite(targetYear)) return null;
  return (targetYear - currentYear) * 360;
}

export function buildChronicle(inputs, options = {}) {
  const checkpoints = inputs
    .map((input) => {
      const { save, jsonPath, manifest } = readManifestOrJson(input);
      return {
        input,
        jsonPath,
        manifest,
        snapshot: extractSnapshot(save),
      };
    })
    .sort((a, b) => compareCk3Dates(a.snapshot.date, b.snapshot.date) || String(a.jsonPath).localeCompare(String(b.jsonPath)));

  const deduped = [];
  const seen = new Set();
  for (const checkpoint of checkpoints) {
    const key = `${checkpoint.snapshot.date}:${checkpoint.snapshot.player.id}:${checkpoint.snapshot.player.gold}:${checkpoint.snapshot.camp.power}:${checkpoint.snapshot.camp.strength}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(checkpoint);
  }

  const paragraphs = [];
  paragraphs.push(`Chronicle of ${deduped[0]?.snapshot.player.name ?? 'unknown'} from ${deduped[0]?.snapshot.date ?? '?'} to ${deduped[deduped.length - 1]?.snapshot.date ?? '?'}.`);

  for (const [index, checkpoint] of deduped.entries()) {
    const snap = checkpoint.snapshot;
    const previous = index > 0 ? deduped[index - 1].snapshot : null;
    paragraphs.push(renderCheckpoint(snap, previous, options));
  }

  return {
    from: deduped[0]?.snapshot.date ?? null,
    to: deduped[deduped.length - 1]?.snapshot.date ?? null,
    player: deduped[0]?.snapshot.player.id ?? null,
    checkpoints: deduped.length,
    paragraphs,
  };
}

function renderCheckpoint(snap, previous, options = {}) {
  const player = snap.player;
  const location = player.locationLabel ?? `province ${player.location ?? '?'}`;
  const identity = [player.cultureName, player.faithName].filter(Boolean).join(', ') || 'unknown lineage';
  const resources = `${fmt(player.gold)} gold, ${fmt(player.prestige)} prestige, ${fmt(player.piety)} piety, ${fmt(player.influence)} influence`;
  const camp = `camp strength ${fmt(snap.camp.strength)}, power ${fmt(snap.camp.power)}, at-peace penalty ${fmt(snap.camp.atPeacePenalty)}`;
  const perks = player.perks.length ? `, perks ${player.perks.join(', ')}` : '';
  const focus = player.focus ? `, focus ${player.focus}` : '';
  const government = snap.camp.government ? `, government ${snap.camp.government}` : '';
  const primary = player.primaryTitle ? `, holding ${player.primaryTitle.name ?? player.primaryTitle.key}` : '';

  let paragraph = `On ${snap.date}, ${player.name} was at ${location} (${identity}${primary}${government}${focus}${perks}) with ${resources}; ${camp}.`;

  const contracts = snap.contracts.length
    ? ` Contracts in hand: ${snap.contracts.map((c) => `${c.name} [${c.status ?? '?'}] for ${c.employerCharacter?.name ?? c.employer ?? '?'} at ${c.locationLabel ?? c.location ?? '?'}`).join('; ')}.`
    : ' No active contracts.';
  paragraph += contracts;

  const signals = [];
  for (const relation of snap.patrons.relations) {
    for (const hook of relation.hooks) signals.push(`hook ${hook.type ?? '?'} over ${relation.other.name} until ${hook.expirationDate}`);
    for (const cooldown of relation.cooldowns) signals.push(`cooldown ${cooldown.interaction} against ${relation.other.name} until ${cooldown.until}`);
  }
  for (const opinion of snap.patrons.contractOpinions) {
    signals.push(`${opinion.modifier} ${opinion.value ?? '?'} from ${opinion.owner.name} to ${opinion.target.name}`);
  }
  if (signals.length) paragraph += ` Patron signals: ${signals.join('; ')}.`;

  if (previous) {
    const diff = diffSnapshots(previous, snap);
    const changes = [];
    const goldDelta = diff.resources.gold.delta;
    const prestigeDelta = diff.resources.prestige.delta;
    const pietyDelta = diff.resources.piety.delta;
    const strengthDelta = diff.camp.strength.delta;
    const powerDelta = diff.camp.power.delta;
    if (typeof goldDelta === 'number' && goldDelta !== 0) changes.push(`gold ${signed(goldDelta)}`);
    if (typeof prestigeDelta === 'number' && prestigeDelta !== 0) changes.push(`prestige ${signed(prestigeDelta)}`);
    if (typeof pietyDelta === 'number' && pietyDelta !== 0) changes.push(`piety ${signed(pietyDelta)}`);
    if (typeof strengthDelta === 'number' && strengthDelta !== 0) changes.push(`strength ${signed(strengthDelta)}`);
    if (typeof powerDelta === 'number' && powerDelta !== 0) changes.push(`power ${signed(powerDelta)}`);
    if (diff.perks.added.length) changes.push(`new perks: ${diff.perks.added.join(', ')}`);
    if (diff.contracts.added.length) changes.push(`contracts added: ${diff.contracts.added.map((c) => c.name).join(', ')}`);
    if (diff.contracts.removed.length) changes.push(`contracts dropped: ${diff.contracts.removed.map((c) => c.name).join(', ')}`);
    if (diff.contracts.statusChanged.length) changes.push(`contract status: ${diff.contracts.statusChanged.map((c) => `${c.from.name} ${c.from.status} -> ${c.to.status}`).join(', ')}`);
    if (diff.patronSignals.added.length) changes.push(`new patron signals: ${diff.patronSignals.added.join(', ')}`);
    if (diff.patronSignals.removed.length) changes.push(`cleared patron signals: ${diff.patronSignals.removed.join(', ')}`);
    if (changes.length) paragraph += ` Since ${previous.date}: ${changes.join('; ')}.`;
  }

  return paragraph;
}

function signed(value) {
  if (typeof value !== 'number') return '?';
  return value > 0 ? `+${fmt(value)}` : fmt(value);
}

function fmt(value) {
  return typeof value === 'number' ? Number(value.toFixed(3)).toString() : String(value ?? '?');
}

function compareCk3Dates(a, b) {
  const aParts = parseCk3Date(a);
  const bParts = parseCk3Date(b);
  for (let index = 0; index < 3; index += 1) {
    if (aParts[index] !== bParts[index]) return aParts[index] - bParts[index];
  }
  return 0;
}

function parseCk3Date(date) {
  if (typeof date !== 'string') return [0, 0, 0];
  const [year, month, day] = date.split('.').map((part) => Number(part));
  return [year || 0, month || 0, day || 0];
}

export function diffSnapshots(oldSnapshot, newSnapshot) {
  const oldContracts = new Map(oldSnapshot.contracts.map((contract) => [contractKey(contract), contract]));
  const newContracts = new Map(newSnapshot.contracts.map((contract) => [contractKey(contract), contract]));
  const oldPatronKeys = new Set(oldSnapshot.patrons.relations.flatMap(patronRelationKeys));
  const newPatronKeys = new Set(newSnapshot.patrons.relations.flatMap(patronRelationKeys));

  return {
    from: oldSnapshot.date,
    to: newSnapshot.date,
    resources: {
      gold: delta(oldSnapshot.player.gold, newSnapshot.player.gold),
      prestige: delta(oldSnapshot.player.prestige, newSnapshot.player.prestige),
      piety: delta(oldSnapshot.player.piety, newSnapshot.player.piety),
      influence: delta(oldSnapshot.player.influence, newSnapshot.player.influence),
    },
    camp: {
      strength: delta(oldSnapshot.camp.strength, newSnapshot.camp.strength),
      power: delta(oldSnapshot.camp.power, newSnapshot.camp.power),
      atPeacePenalty: delta(oldSnapshot.camp.atPeacePenalty, newSnapshot.camp.atPeacePenalty),
      lawsAdded: arrayDiff(newSnapshot.camp.laws, oldSnapshot.camp.laws),
      lawsRemoved: arrayDiff(oldSnapshot.camp.laws, newSnapshot.camp.laws),
    },
    perks: {
      added: arrayDiff(newSnapshot.player.perks, oldSnapshot.player.perks),
      removed: arrayDiff(oldSnapshot.player.perks, newSnapshot.player.perks),
    },
    succession: {
      old: oldSnapshot.camp.succession,
      new: newSnapshot.camp.succession,
      changed: JSON.stringify(oldSnapshot.camp.succession) !== JSON.stringify(newSnapshot.camp.succession),
    },
    contracts: {
      added: [...newContracts.values()].filter((contract) => !oldContracts.has(contractKey(contract))),
      removed: [...oldContracts.values()].filter((contract) => !newContracts.has(contractKey(contract))),
      statusChanged: [...newContracts.entries()]
        .filter(([key, contract]) => oldContracts.has(key) && oldContracts.get(key).status !== contract.status)
        .map(([key, contract]) => ({ from: oldContracts.get(key), to: contract })),
    },
    patronSignals: {
      added: [...newPatronKeys].filter((key) => !oldPatronKeys.has(key)),
      removed: [...oldPatronKeys].filter((key) => !newPatronKeys.has(key)),
    },
  };
}

function skillsObject(skillArray) {
  if (!Array.isArray(skillArray)) return {};
  return Object.fromEntries(SKILL_NAMES.map((name, index) => [name, skillArray[index] ?? null]));
}

function variableMap(data = []) {
  if (!Array.isArray(data)) return {};
  return Object.fromEntries(
    data
      .filter((entry) => entry?.flag)
      .map((entry) => [entry.flag, decodeVariableData(entry.data)])
  );
}

function decodeVariableData(data) {
  if (!data || Array.isArray(data)) return { raw: data ?? null };
  if (typeof data.identity !== 'number') return { raw: data };
  const decoded = Math.abs(data.identity) >= 100000 && data.identity % 100000 === 0
    ? data.identity / 100000
    : data.identity;
  return { type: data.type ?? null, raw: data.identity, decoded };
}

function normalizeInvalidId(id) {
  return id === 4294967295 || id === undefined || id === null ? null : id;
}

function titleKeyToName(key) {
  if (!key) return null;
  return key
    .replace(/^[ekdcbx]_[a-z]+_/, '')
    .replace(/^[ekdcbx]_/, '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getStaticTitleIndex() {
  if (staticTitleIndex) return staticTitleIndex;

  const provinceToTitles = new Map();
  const titlesDir = path.join(CK3_GAME_DIR, 'common/landed_titles');
  if (!fs.existsSync(titlesDir)) {
    staticTitleIndex = { provinceToTitles };
    return staticTitleIndex;
  }

  for (const fileName of fs.readdirSync(titlesDir).filter((name) => name.endsWith('.txt')).sort()) {
    const filePath = path.join(titlesDir, fileName);
    indexLandedTitleFile(fs.readFileSync(filePath, 'utf8'), provinceToTitles);
  }

  staticTitleIndex = { provinceToTitles };
  return staticTitleIndex;
}

function indexLandedTitleFile(text, provinceToTitles) {
  const stack = [];
  let depth = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;

    const titleMatch = line.match(/^([ekdcbx]_[A-Za-z0-9_]+)\s*=\s*\{/);
    if (titleMatch) {
      stack.push({ key: titleMatch[1], depth });
    }

    const provinceMatch = line.match(/^province\s*=\s*(\d+)/);
    if (provinceMatch) {
      const titles = Object.fromEntries(
        ['e', 'k', 'd', 'c', 'b']
          .map((prefix) => [rankName(prefix), [...stack].reverse().find((item) => item.key.startsWith(`${prefix}_`))?.key])
          .filter(([, key]) => Boolean(key))
      );
      provinceToTitles.set(Number(provinceMatch[1]), titles);
    }

    depth += countChar(line, '{') - countChar(line, '}');
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
  }
}

function rankName(prefix) {
  return {
    e: 'empireKey',
    k: 'kingdomKey',
    d: 'duchyKey',
    c: 'countyKey',
    b: 'baronyKey',
  }[prefix];
}

function countChar(value, char) {
  return [...value].filter((current) => current === char).length;
}

function ageAt(date, birth) {
  const currentYear = parseYear(date);
  const birthYear = parseYear(birth);
  return currentYear === null || birthYear === null ? null : currentYear - birthYear;
}

function parseYear(date) {
  if (typeof date !== 'string') return null;
  const year = Number(date.split('.')[0]);
  return Number.isFinite(year) ? year : null;
}

function delta(from, to) {
  if (typeof from !== 'number' || typeof to !== 'number') return { from, to, delta: null };
  return { from, to, delta: Number((to - from).toFixed(3)) };
}

function arrayDiff(a = [], b = []) {
  const bSet = new Set(b);
  return [...new Set(a)].filter((value) => !bSet.has(value));
}

function contractKey(contract) {
  return `${contract.id}:${contract.name}:${contract.type}`;
}

function patronRelationKeys(relation) {
  const other = relation.other?.id ?? 'unknown';
  return [
    ...relation.hooks.map((hook) => `${other}:hook:${hook.slot}:${hook.type}:${hook.expirationDate}`),
    ...relation.cooldowns.map((cooldown) => `${other}:cooldown:${cooldown.interaction}:${cooldown.until}`),
  ];
}
