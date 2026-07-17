# CK3 Knowledge Graph / LLM Wiki Handoff

## Goal

Build a general CK3 knowledge layer from parsed save data.

The target is not a wiki for one character or one campaign. The target is a reusable model of how CK3 save components work and interact: characters, titles, courts, dynasties, faiths, cultures, hooks, claims, opinions, wars, contracts, schemes, locations, modifiers, memories, and Roads to Power adventurer systems.

The current Nino campaign is useful as a test corpus, but the system should be campaign-agnostic.

## Core Idea

Use Rakaly output as the local source substrate, then derive two higher-level products:

- A machine-readable graph / ontology of CK3 concepts and relationships.
- A human-readable LLM wiki that explains those concepts, save fields, mechanics, and useful queries.

The long-term value is that tactical "screeners" become queries over a known game model instead of one-off report logic.

Example:

- Instead of hardcoding "find useful patrons for Nino," define a general concept like "actionable relationship edge."
- Instead of hardcoding "where should this camp move," define general concepts like "nearby opportunity cluster," "unresolved point of interest," "ruler with useful resource profile," and "local contract-board quality."
- Instead of asking the LLM to infer everything from raw JSON every time, give it stable pages and graph facts about CK3 structures.

## Privacy / Repo Boundary

Do not commit raw `.ck3` saves.

Do not casually commit full Rakaly JSON output either. The parsed JSON is still basically the save content expanded into a readable form, so it can expose the full campaign state.

Recommended pattern:

- Keep `state/` ignored.
- Keep `*.ck3` ignored.
- Keep `*.zip` ignored.
- Commit tooling, schemas, docs, and small redacted fixtures only.
- Generate full wiki / graph artifacts locally from private saves.

The existing repo already ignores `state/`, `*.ck3`, and `*.zip`.

## Existing Tooling

Current repo:

```bash
/home/cris/.openclaw/workspace/repos/ck3-save-analysis-toolset
```

Useful commands:

```bash
npm run check
scripts/ck3-save-ingest --list
scripts/ck3-save-ingest --all
scripts/ck3-save-report snapshot state/rakaly-cli/output/ingest/<save>.manifest.json
scripts/ck3-save-report graph state/rakaly-cli/output/ingest/<save>.manifest.json --json
scripts/ck3-save-report brief state/rakaly-cli/output/ingest/<save>.manifest.json --json
scripts/ck3-save-report scout state/rakaly-cli/output/ingest/<save>.manifest.json --json
```

Key files:

- `scripts/ck3-save-ingest` parses live CK3 saves into ignored local artifacts.
- `scripts/ck3-save-report` exposes report commands.
- `scripts/lib/ck3-save-analysis.mjs` contains the current extractor logic.
- `docs/ck3-save-analysis.md` documents the existing report surface.
- `state/rakaly-cli/output/ingest/*.json` and `*.manifest.json` are local ignored artifacts.

## Conceptual Architecture

### 1. Rakaly Layer

Input:

- `.ck3` save files from the local CK3 save directory.
- Rakaly-melted JSON output under `state/`.

Responsibility:

- Preserve the save's raw structure as faithfully as possible.
- Do not mutate this layer into opinions or advice.
- Treat it as private local data.

### 2. Normalized Entity Layer

Create a normalized representation of CK3 objects discovered in the save.

Candidate entities:

- `character`
- `title`
- `province`
- `court`
- `dynasty`
- `house`
- `faith`
- `culture`
- `war`
- `scheme`
- `contract`
- `hook`
- `opinion`
- `modifier`
- `memory`
- `army`
- `activity`
- `domicile` / `camp`
- `point_of_interest`

Each entity should keep:

- stable ID
- source path(s) inside Rakaly JSON
- display name if resolvable
- important raw fields
- derived labels only when confidence is high
- unresolved/unknown fields preserved for later analysis

### 3. Relationship / Graph Layer

Build edges between normalized entities.

Candidate edge kinds:

- `parent_of`
- `spouse_of`
- `house_member`
- `dynasty_member`
- `holds_title`
- `de_jure_liege`
- `de_facto_liege`
- `located_at`
- `employs`
- `courtier_of`
- `vassal_of`
- `claimant_to`
- `at_war_with`
- `ally_of`
- `friend_of`
- `rival_of`
- `has_hook_on`
- `owes_contact_favor_to`
- `opinion_of`
- `scheme_target`
- `contract_employer`
- `contract_target`
- `contract_location`
- `modifier_on`
- `memory_about`
- `faith_of`
- `culture_of`

Each edge should keep:

- source entity
- target entity
- edge kind
- evidence path(s)
- confidence
- optional validity window or game date
- optional game-specific semantics

Example important semantic distinction:

- `contact_list_weak_hook` in Roads to Power landless-adventurer play is not just a generic weak hook. It is the "Excelled at Contract" contact favor used by Make a Request.

### 4. Game Model Wiki

Generate or maintain Markdown pages that explain general CK3 concepts.

This should be about the game system, not the current run.

Example pages:

- `Character`
- `Title`
- `Province`
- `Court`
- `Dynasty`
- `House`
- `Faith`
- `Culture`
- `Hook`
- `Claim`
- `Opinion`
- `Modifier`
- `Contract`
- `War`
- `Scheme`
- `Activity`
- `Landless Adventurer`
- `Camp`
- `Contact Favor`
- `Point of Interest`

Each page should ideally include:

- What the concept means in CK3.
- Where it appears in parsed save data.
- Important fields.
- Related concepts.
- Common pitfalls.
- Example queries / screeners enabled by this concept.
- Evidence examples from local saves, redacted or summarized if the page might be committed.

### 5. Campaign Instance Layer

Project a particular save onto the general model.

This layer can answer:

- Who is the player?
- What is the current camp state?
- Which local rulers matter?
- Which contracts are available?
- Which hooks or contact favors are actionable?
- What changed since the last save?

The current Nino campaign belongs here, not in the general game model.

### 6. Screener Layer

Screeners should become named graph/wiki queries.

Candidate screeners:

- `actionable_contact_favors`
- `nearby_contract_board_quality`
- `nearby_ruler_opportunities`
- `marriage_opportunities`
- `claimant_opportunities`
- `dangerous_neighbors`
- `useful_courtier_recruitment`
- `camp_member_risk`
- `high_value_travel_targets`
- `poi_progress_targets`
- `ruler_with_gold_or_tournament_value`
- `war_or_epidemic_travel_risk`
- `relationship_edges_worth_revisiting`

Each screener should specify:

- required entity/edge types
- ranking inputs
- output shape
- evidence fields
- known blind spots

## Why This Is Better Than Only Reports

The current reports are useful, but they are mostly task-specific:

- `snapshot`
- `patrons`
- `brief`
- `scout`
- `graph`
- `chronicle`

The proposed knowledge layer makes the report logic more composable.

Instead of each report learning CK3 from scratch, reports can consume the same normalized entity/relationship model.

That makes it easier to add new reports without re-parsing every mechanic ad hoc.

## Initial Implementation Plan

### Phase 1: Inventory the Save Structure

Write an exploration command that summarizes top-level and recurring Rakaly JSON structures.

Possible command:

```bash
scripts/ck3-save-report inventory <save-or-manifest> [--json]
```

Output:

- major top-level keys
- database-like collections
- collection sizes
- sample object paths
- likely entity types
- unknown/unclassified structures

This is the "map the save" step.

### Phase 2: Define a Minimal Ontology Schema

Add a schema for normalized nodes and edges.

Possible file:

```bash
scripts/lib/ck3-knowledge-schema.mjs
```

Initial JSON shape:

```json
{
  "schemaVersion": 1,
  "source": {
    "manifestPath": "...",
    "saveDate": "882.4.25"
  },
  "nodes": [
    {
      "id": "character:37885",
      "kind": "character",
      "label": "Nino",
      "sourcePaths": ["$.living.37885"],
      "attributes": {}
    }
  ],
  "edges": [
    {
      "id": "edge:...",
      "kind": "located_at",
      "from": "character:37885",
      "to": "province:2041",
      "sourcePaths": ["$.living.37885.location"],
      "confidence": 1
    }
  ]
}
```

### Phase 3: Extract Core Entities

Start with entities already used by current reports:

- played character
- entourage / camp followers
- contracts
- contract employers and targets
- current location
- contract locations
- title holders / lieges
- patron/contact relations
- hooks/contact favors
- opinion traces
- faith and culture IDs

Then expand into broader CK3 structures.

### Phase 4: Generate Concept Pages

Add a local wiki generator.

Possible command:

```bash
scripts/ck3-save-report wiki <save-or-manifest> --out state/wiki
```

For committed docs, keep pages generic and avoid dumping private campaign state.

For local use, pages under `state/wiki` can include private examples from the current save.

### Phase 5: Refactor Existing Reports onto the Knowledge Layer

Once the graph is stable, make reports consume it:

- `graph` becomes a view over the normalized edge list.
- `brief` becomes a set of named screeners.
- `scout` becomes ranked screeners plus narrative advice.
- `chronicle` becomes time-series graph deltas plus prose.

Do this incrementally. Do not break current reports while building the new layer.

## Important Design Rules

- Keep raw saves and parsed Rakaly output private by default.
- Preserve evidence paths for every derived fact.
- Prefer explicit unknowns over fake certainty.
- Separate general CK3 concepts from campaign-specific instances.
- Treat Roads to Power landless mechanics as first-class, not weird exceptions.
- Make screeners auditable: every recommendation should trace back to nodes, edges, fields, and save paths.
- Use small redacted fixtures for tests.
- Avoid overfitting to Nino's current campaign.

## Good First PR

A good first Codex task would be:

1. Add `docs/ck3-knowledge-graph-handoff.md`.
2. Add a read-only `inventory` command that inspects a manifest/Rakaly JSON and outputs:
   - save metadata
   - top-level keys
   - collection sizes
   - sample paths
   - guessed entity categories
3. Add JSON output for that command.
4. Add tests or at least `node --check` coverage for touched scripts.
5. Keep `state/` ignored and do not commit generated save artifacts.

This gives the next step useful traction without requiring a complete graph design up front.

## Open Questions

- Should the normalized graph be plain JSON, SQLite, DuckDB, RDF-ish triples, or a graph DB export?
- Should wiki pages be generated deterministically from schemas, LLM-assisted from graph facts, or a hybrid?
- How much of the CK3 game files should be parsed alongside saves for static definitions?
- Should there be a redaction pass for shareable examples?
- Should Graphify or another graph tool consume the normalized output, or should this repo stay tool-neutral?

## Current Recommendation

Start tool-neutral.

Build a clean normalized JSON graph first, with strong evidence paths and simple named screeners. Then decide whether Graphify, an LLM wiki flow, Obsidian, SQLite, or another interface is the best consumer.

The hard part is not the viewer. The hard part is making CK3's save structures legible, general, and auditable.
