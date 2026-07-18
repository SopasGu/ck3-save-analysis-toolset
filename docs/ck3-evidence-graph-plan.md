# CK3 Durable Save-Schema Graph Plan

Status: **locked implementation plan**

Audience: human maintainers and LLM workers implementing the project in separate sessions.

This document is the authoritative implementation plan for the first-principles Rakaly graph work. Read it completely before changing discovery, graph, wiki, or mechanics code. If another document conflicts with this plan, this plan controls unless the repository owner explicitly changes it.

Design reference: [Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

## 1. Objective

Build a reusable, versioned, evidence-backed map of the durable structure of Crusader Kings III saves parsed by Rakaly.

The durable product describes:

- where record populations appear in Rakaly JSON
- the recurring shapes and variants of those records
- field names, types, optionality, and cardinality
- identity domains such as character, title, province, culture, and faith IDs, but only after evidence supports those names
- references between record types
- known sentinel, null, and polymorphic behavior
- CK3 version, DLC, and mod applicability
- mechanics interpretations supported by publisher documentation, game files, or repeatable save evidence
- reusable queries that can be run against any compatible save

The durable product does **not** preserve the changing details of individual campaigns. Character names, record IDs, locations, resources, contracts, opinions, wars, and other instance values are ephemeral unless explicitly requested as a separate private analysis artifact.

The governing flow is:

```text
.ck3 save
  -> Rakaly JSON specimen
  -> generic structural discovery
  -> ephemeral per-save observations
  -> generalized durable save-schema graph
  -> semantic and mechanics annotations
  -> maintained Markdown wiki
  -> reusable analysis rules and queries
  -> ephemeral analysis of any future save
```

## 2. Locked Design Decisions

The following decisions are settled for the initial implementation.

### 2.1 The primary graph is a schema graph

The committed graph models collections, record types, shape variants, fields, identity domains, and reference patterns. It does not contain nodes for every character, title, or other record in a particular save.

Durable example:

```text
record_type:living_record
  -- has_field --> field:living_record.culture
field:living_record.culture
  -- references --> identity_domain:culture_id
identity_domain:culture_id
  -- keys_records_in --> collection:cultures
```

Ephemeral example, excluded from the durable graph:

```text
character:37885 -- culture_of --> culture:131
```

### 2.2 Per-save graphs are disposable runtime products

A particular save may be expanded into an instance graph to answer questions, compare checkpoints, or validate a schema rule. That graph belongs under ignored `state/` and must not be merged into the durable wiki by default.

### 2.3 Save specimens are evidence, not wiki subjects

Full Rakaly saves are used to discover and validate structural patterns. The wiki records the generalized pattern and aggregate observation, not every source record.

### 2.4 Structural discovery is independent of existing analysis

The initial discovery implementation must not use `extractSnapshot`, `extractPoliticalGraph`, `extractBrief`, `extractScout`, contact-favor rules, or other existing mechanic-specific extractors to decide what nodes and edges exist.

Existing reports become later comparison oracles. Agreement is supporting evidence; disagreement is something to investigate, not something the new graph must conceal.

### 2.5 Structural evidence and semantic meaning remain separate

A field value matching a record key produces a reference candidate. It does not immediately prove a CK3 relationship. Semantic names such as `culture_of`, `employs`, or `de_facto_liege` are versioned annotations supported by explicit evidence.

### 2.6 The wiki is a maintained knowledge product

Following the LLM Wiki pattern, the repository will contain:

1. source metadata for immutable or content-addressed evidence
2. a persistent, cross-linked Markdown wiki containing durable synthesis
3. an operating schema that tells any LLM how to ingest, query, update, and lint that wiki

The machine-readable schema graph underpins the wiki. The wiki does not replace the graph, and the graph does not replace the wiki.

### 2.7 Publisher documentation is a separate evidence family

Paradox documentation, patch notes, developer diaries, and installed game files may explain or constrain the meaning of save structures. They must be cited and version-scoped. They must never be represented as if their claims were directly observed in a save.

### 2.8 Storage stays tool-neutral initially

The canonical durable interchange is plain JSON plus Markdown. SQLite, DuckDB, RDF, Graphify, Obsidian, or a graph database may be added as derived adapters when a real query or visualization requirement justifies them.

## 3. Epistemic Layers

Every worker must identify the layer being changed.

### Layer A: Raw sources

Examples:

- `.ck3` files
- Rakaly JSON or compressed Rakaly JSON
- Paradox documentation
- patch notes and developer diaries
- installed CK3 definitions and localization
- human-authored corrections

Sources are immutable or content-addressed. Generated output must not silently modify them.

### Layer B: Structural observations

Facts directly computed from a source specimen:

- path `$.living.<key>` occurs
- its members have particular field/type combinations
- field `culture` often contains an integer
- those integers often match keys in another observed collection
- the field was present in a measured percentage of records

These observations are source-specific and may be stored under ignored state or as small aggregate provenance records.

### Layer C: Durable schema graph

Generalizations supported across observations:

- collection path patterns
- record types and shape variants
- field definitions and optionality
- identity domains
- candidate and confirmed references
- version/DLC/mod applicability

### Layer D: Semantic and mechanics claims

Interpretations such as:

- a particular record type represents a character
- a field represents that character's culture
- a relation slot represents the direction of a hook
- a value has a particular game-mechanics meaning

Each claim carries citations, scope, status, and contradictions.

### Layer E: Consumers

- reusable queries
- report adapters
- screeners
- wiki browsing
- LLM question answering
- ephemeral campaign analysis
- optional visualizations and storage adapters

Consumers read the earlier layers. They do not redefine them implicitly.

## 4. Durable and Ephemeral Repository Boundaries

Use this target layout unless a task below explicitly refines it:

```text
knowledge/
  sources/
    registry.json
  schema/
    schema-version.json
    graph.json
    graph.schema.json
  observations/
    index.json
  claims/
    claims.json
    claims.schema.json
  rules/
    semantic-rules.json
    query-rules.json
  wiki/
    AGENTS.md
    index.md
    log.md
    collections/
    record-types/
    fields/
    identity-domains/
    mechanics/
    queries/
    contradictions/

fixtures/
  discovery/
  schema/

scripts/
  ck3-save-discover
  ck3-save-schema
  ck3-save-wiki
  lib/
    json-structure-discovery.mjs
    ck3-schema-observations.mjs
    ck3-schema-graph.mjs
    ck3-semantic-rules.mjs

state/
  discovery/<source-fingerprint>/
  instance-graphs/<source-fingerprint>/
  wiki-build/
```

`knowledge/` and redacted or synthetic `fixtures/` are durable and committed. `state/` remains ignored and may contain private or large source-derived artifacts.

Do not add campaign-specific wiki directories by default.

## 5. Canonical Durable Graph Model

The first schema graph must support these node kinds:

- `collection`
- `record_type`
- `shape_variant`
- `field`
- `identity_domain`
- `mechanics_concept`
- `source_document`
- `query`

The first schema graph must support these edge kinds:

- `contains_record_type`
- `has_shape_variant`
- `has_field`
- `field_uses_identity_domain`
- `keys_records_in`
- `references_record_type`
- `nested_under`
- `variant_of`
- `supported_by`
- `contradicted_by`
- `documented_by`
- `enables_query`
- `applies_when`

Nodes and edges must have stable IDs that do not include instance record IDs.

Every durable graph item must support:

```json
{
  "id": "field:living-record.culture",
  "kind": "field",
  "label": "culture",
  "status": "observed",
  "scope": {
    "gameVersions": [],
    "dlc": [],
    "mods": []
  },
  "provenance": [],
  "notes": []
}
```

Exact properties may expand through versioned schema migrations. They may not silently change meaning.

## 6. Source and Claim Model

### 6.1 Source registry

Every save specimen or external document used to support durable knowledge receives a source entry.

Minimum save-source metadata:

- stable source ID
- source kind
- content hash
- byte size
- acquisition or generation method
- Rakaly version when known
- save date when available
- CK3 version when available
- DLC and mod configuration when available
- visibility and privacy classification
- whether the raw artifact is committed, external, or local-only

Minimum documentation-source metadata:

- stable source ID
- publisher and document type
- title and canonical URL
- publication date when available
- retrieval date
- content hash or snapshot hash when permitted
- game-version and DLC applicability
- supersedes/superseded-by links
- copyright or redistribution notes

### 6.2 Claim ledger

Mechanics and semantic interpretations live in a versioned claim ledger.

Each claim must include:

- stable claim ID
- concise proposition
- subject graph IDs
- scope
- supporting sources or graph observations
- contradicting sources or observations
- status
- last-reviewed date
- optional human decision

Allowed initial statuses:

- `proposed`
- `supported`
- `partially_supported`
- `contradicted`
- `insufficient_evidence`
- `context_dependent`
- `superseded`

## 7. Implementation Tasks

Tasks are dependency-ordered. A worker may complete one task at a time, but must leave the repository in a verifiable state and update the plan checklist in Section 9.

### Task 0: Establish governance and safety checks

**Goal:** Prevent future workers from mixing ephemeral campaign data into durable knowledge.

**Dependencies:** none.

**Work:**

1. Add or refine root agent instructions pointing to this plan.
2. Document the durable/ephemeral boundary in contributor-facing language.
3. Confirm `state/`, `.ck3`, unredacted JSON, generated instance graphs, and generated private wiki builds are ignored by default.
4. Add a durable-content lint script that can detect common leaks such as source artifact paths, unexpectedly large committed JSON, and known campaign-only identifiers in `knowledge/`.
5. Do not rewrite Git history or remove the currently committed specimen without explicit owner authorization.
6. Add commands for running durable-content lint locally and in CI.

**Outputs:**

- agent/contributor instructions
- updated ignore rules if necessary
- durable-content lint command
- initial CI or `npm` script entry

**Acceptance checks:**

- a deliberately planted instance-only fixture in `knowledge/` causes the lint to fail
- normal schema fixtures pass
- existing report code remains untouched

### Task 1: Register the bootstrap Rakaly specimen

**Goal:** Record the available save as a content-addressed schema specimen without treating its records as durable knowledge.

**Dependencies:** Task 0.

**Input:** `state/rakaly-cli/output/ingest/last_save_2026-07-16_221531.json.gz` or the equivalent locally available artifact.

**Known bootstrap measurements:**

- compressed size: 16,258,133 bytes
- expanded size: 119,529,840 bytes
- approximately 1,575,536 objects
- approximately 636,630 arrays
- approximately 4,923,705 primitive values
- observed maximum depth: 11

**Work:**

1. Compute a deterministic content hash over the compressed and, if practical, expanded content.
2. Record source metadata in `knowledge/sources/registry.json` without copying individual campaign facts.
3. Record that the specimen is currently present in public Git history and classify it accordingly.
4. Record the Rakaly generation command/version if it can be discovered; otherwise mark it unknown.
5. Ensure source registration can represent future local-only saves.

**Outputs:** source registry schema, registry entry, validation test.

**Acceptance checks:**

- the same content produces the same source ID
- a modified byte produces a different hash
- the registry contains no character names or per-record campaign details

### Task 2: Implement generic streaming-aware JSON traversal

**Goal:** Enumerate the full JSON structure deterministically without CK3-specific semantics.

**Dependencies:** Task 1.

**Work:**

1. Implement `scripts/lib/json-structure-discovery.mjs`.
2. Accept plain JSON and gzip-compressed JSON.
3. Traverse objects, arrays, and primitives while recording JSON Pointer or normalized JSONPath locations, parent type, key/index, value type, and depth.
4. Avoid retaining the entire expanded observation set in memory when aggregate processing is sufficient.
5. Define deterministic ordering for object keys and outputs.
6. Provide progress and memory diagnostics suitable for a roughly 120 MB expanded specimen.
7. Expose a CLI entrypoint through `scripts/ck3-save-discover`.

**Outputs:** traversal library, CLI, unit tests, performance notes.

**Acceptance checks:**

- correctly traverses synthetic object, array, null, scalar, and mixed-shape fixtures
- accepts the bootstrap gzip artifact
- repeated runs produce byte-equivalent aggregate output
- does not import `ck3-save-analysis.mjs`
- exits with a clear error on corrupt gzip or invalid JSON

### Task 3: Normalize paths and fingerprint shapes

**Goal:** Generalize millions of instance paths into durable path patterns and recurring object shapes.

**Dependencies:** Task 2.

**Work:**

1. Define path normalization rules, for example converting `$.living.37885` into a candidate pattern such as `$.living.<key>` without naming `<key>` semantically.
2. Distinguish object-map keys from stable field names using repeated-structure evidence.
3. Compute deterministic shape fingerprints from field names, field types, and nested container types.
4. Track field occurrence counts so optionality can be measured.
5. Detect polymorphic fields whose types vary across occurrences.
6. Preserve representative source paths privately for debugging while emitting only generalized examples into durable output.

**Outputs:** path-pattern catalog, shape catalog, shape-fingerprint tests.

**Acceptance checks:**

- records with identical structure share a shape ID
- optional-field variants remain related but distinct
- dynamic numeric/string map keys do not create thousands of durable field definitions
- fingerprints remain stable across input order

### Task 4: Discover candidate collections and record types

**Goal:** Promote recurring structures into neutral collection and record-type observations.

**Dependencies:** Task 3.

**Work:**

1. Detect map-backed and array-backed candidate collections.
2. Use generic evidence including population size, repeated member shapes, key regularity, and nested placement.
3. Associate each collection with one or more observed shape variants.
4. Record population counts as source observations, not durable schema constants.
5. Assign neutral stable IDs until semantic names are justified.
6. Produce a review report ranking the largest and most structurally coherent candidates.

**Outputs:** candidate collection catalog, candidate record-type catalog, review summary.

**Acceptance checks:**

- major populations such as the large top-level and nested databases are discoverable without a CK3 field allowlist
- array-backed records such as opinions and relations are not excluded
- population counts do not become fixed schema cardinalities
- uncertain candidates are marked rather than forced

### Task 5: Discover identity domains and reference candidates

**Goal:** Infer reusable cross-record connection patterns without prematurely naming game semantics.

**Dependencies:** Task 4.

**Work:**

1. Index keys for candidate collections as separate identity domains.
2. Profile primitive fields whose values match keys in one or more domains.
3. Measure coverage across all records of the same shape: resolved, null, sentinel, ambiguous, and unresolved counts.
4. Retain collisions when the same value exists in multiple domains.
5. Rank candidates using structural evidence such as shape-wide coverage, target consistency, reciprocal patterns, and cross-save stability.
6. Do not treat field-name similarity as proof; record it only as a weak signal if used.
7. Emit aggregate reference-pattern observations, never one durable edge per instance.

**Outputs:** identity-domain observations, reference-candidate catalog, ambiguity report.

**Acceptance checks:**

- the output can represent multiple targets for the same raw value
- sentinel and missing values are reported separately
- a reference pattern includes numerator/denominator evidence
- no candidate is promoted solely because current report code expects it

### Task 6: Build the first durable save-schema graph

**Goal:** Convert reviewed observations into the canonical committed graph of durable save structure.

**Dependencies:** Tasks 3-5.

**Work:**

1. Define `knowledge/schema/graph.schema.json`.
2. Define schema graph version `1` in `schema-version.json`.
3. Implement graph generation in `scripts/lib/ck3-schema-graph.mjs`.
4. Emit only generalized nodes and edges listed in Section 5.
5. Attach aggregate provenance pointing to registered sources and observation IDs.
6. Keep semantic labels neutral where evidence is not yet sufficient.
7. Sort nodes and edges deterministically for reviewable Git diffs.
8. Add validation that rejects instance record IDs in stable graph IDs.

**Outputs:** graph schema, graph generator, first `graph.json`, validator, tests.

**Acceptance checks:**

- `graph.json` validates against its schema
- graph IDs remain unchanged when instance values change but structure does not
- no individual character/entity node appears
- every graph item has provenance
- generation is deterministic

### Task 7: Validate and generalize across multiple saves

**Goal:** Distinguish durable save structure from snapshot-specific accidents.

**Dependencies:** Task 6 plus at least one additional Rakaly specimen.

**Work:**

1. Register a second nearby save from the same campaign.
2. Later register a save from another run, game version, DLC set, or mod configuration.
3. Compare path patterns, shapes, collections, field optionality, identity domains, and reference coverage.
4. Record structural additions, removals, and changed types.
5. Introduce explicit shape variants instead of widening types indiscriminately.
6. Add applicability metadata for version/DLC/mod-dependent structures.
7. Do not compare or retain individual characters as durable entities.

**Outputs:** schema-diff command, compatibility report, updated graph, applicability metadata.

**Acceptance checks:**

- the comparison reports schema changes rather than campaign changes
- a new character does not create a durable graph diff
- a new field or shape variant does create a reviewable schema diff
- conflicting observations remain visible

### Task 8: Create redacted and synthetic fixtures

**Goal:** Make future development possible without requiring the full campaign artifact.

**Dependencies:** Tasks 4-7.

**Work:**

1. Identify the smallest structural cases needed to exercise collection discovery, shape variants, identity collisions, sentinels, and reference candidates.
2. Create synthetic fixtures that use invented IDs and labels.
3. Where a real shape must be preserved, redact values and document the transformation.
4. Add fixture manifests describing which structural behavior each fixture tests.
5. Ensure fixtures cannot reconstruct real campaign entities.

**Outputs:** committed fixtures, fixture manifests, regression tests.

**Acceptance checks:**

- fixtures cover all discovery stages
- tests do not depend on the full save for normal execution
- durable-content lint passes
- no known campaign names or source record IDs remain

### Task 9: Add semantic claims without contaminating structural discovery

**Goal:** Name well-supported record types, fields, identity domains, and references using explicit versioned rules.

**Dependencies:** Tasks 6-8.

**Work:**

1. Define `knowledge/claims/claims.schema.json` and the initial claim ledger.
2. Implement semantic rules as mappings over durable graph patterns, not direct ad hoc reads of raw save paths.
3. Start with high-coverage, low-ambiguity relationships.
4. Record evidence, contradictions, scope, and validation status for every semantic name.
5. Compare selected results with existing extractor behavior only after independent derivation.
6. Document disagreements rather than forcing compatibility.

**Outputs:** claim schema, semantic rule schema, initial rules and claims, comparison report.

**Acceptance checks:**

- removing a semantic rule does not alter structural observations
- every semantic edge cites a claim and underlying graph evidence
- existing report behavior is not used as the sole support for a claim
- uncertainty remains machine-readable

### Task 10: Build the LLM Wiki kernel

**Goal:** Establish the persistent, compounding Markdown knowledge base described by the LLM Wiki pattern.

**Dependencies:** Task 6; may proceed in parallel with Task 9 once graph IDs stabilize.

**Work:**

1. Add `knowledge/wiki/AGENTS.md` as the operating schema for any LLM worker.
2. Define page types, naming, frontmatter, wikilinks, citations, and update rules.
3. Add `index.md` as the content-oriented catalog.
4. Add append-only `log.md` for ingests, schema updates, claim changes, queries filed back, and lint passes.
5. Define three mandatory operations:
   - **ingest:** integrate new structural evidence or documentation into existing pages
   - **query:** answer from the wiki and graph with citations; file durable new synthesis when useful
   - **lint:** find stale claims, contradictions, orphan pages, duplicate concepts, broken links, and missing coverage
6. Generate initial pages for collections, record types, fields, and identity domains from the schema graph.
7. Ensure pages describe generalized structure and never enumerate campaign records.

**Outputs:** wiki operating schema, index, log, page templates, initial generated/maintained pages, wiki lint.

**Acceptance checks:**

- a new LLM can find the authoritative workflow from `AGENTS.md`
- every page links to machine-readable graph IDs and provenance
- index and log update during a test ingest
- lint detects a broken link, orphan, and stale/superseded claim
- no campaign-character page is generated

### Task 11: Integrate Paradox and installed-game documentation

**Goal:** Enrich durable structural knowledge with versioned mechanics explanations without confusing documentation with save observations.

**Dependencies:** Tasks 9-10.

**Groundwork note:** A narrow MediaWiki source-adapter slice may precede Tasks 9-10 when it only registers documentation sources and seed topic metadata. It must not create accepted semantic claims or wiki pages before the claim ledger and wiki operating rules exist. For current work, assume all official CK3 DLC is active unless a later source explicitly scopes behavior otherwise.

**Work:**

1. Define source adapters for official documentation, patch notes, developer diaries, and installed game definitions/localization.
2. Register each source with canonical URL/path, hash, dates, game-version scope, DLC scope, and redistribution notes.
3. Store citations and compliant summaries; do not copy entire copyrighted documents unless permitted.
4. Extract proposed claims and link them to relevant graph IDs.
5. Compare new claims with existing save evidence and claims.
6. Record support, contradiction, supersession, or context dependence.
7. Update affected wiki pages, index, and ingest log.
8. Add lint checks for uncited mechanics claims and missing version scope.

**Outputs:** documentation adapters, registered sources, claims, updated wiki pages, lint rules.

**Acceptance checks:**

- a documentation claim can be traced to its source section
- documentation does not create instance graph facts
- newer patch documentation can supersede an older scoped claim without deleting history
- conflicting observed behavior is shown rather than overwritten

### Task 12: Implement ephemeral analysis for arbitrary saves

**Goal:** Prove the durable schema knowledge can analyze a new save without adding its entities to the wiki.

**Dependencies:** Tasks 6 and 9; stronger validation after Task 11.

**Work:**

1. Load an arbitrary compatible Rakaly JSON file.
2. Match its structures to durable graph record types and fields.
3. Instantiate an optional temporary instance graph under ignored state.
4. Apply semantic rules and report unsupported or version-mismatched structures.
5. Expose a query interface that returns results with source paths and rule provenance.
6. Ensure generated instance artifacts can be deleted and regenerated without changing durable knowledge.

**Outputs:** instance analyzer, ephemeral graph format, query command, compatibility report.

**Acceptance checks:**

- analyzing a new save does not modify `knowledge/` unless an explicit reviewed schema-ingest operation is requested
- results cite exact source paths and semantic rules
- unknown structures are reported rather than ignored
- deleting `state/instance-graphs/` does not lose durable knowledge

### Task 13: Refactor existing reports as consumers

**Goal:** Demonstrate that existing reports can consume reusable schema and semantic knowledge without defining it.

**Dependencies:** Task 12.

**Work:**

1. Select one narrow existing report or resolver as a pilot.
2. Reimplement its data access through durable graph IDs and semantic rules.
3. Compare output against the current implementation over known fixtures and private saves.
4. Explain every discrepancy.
5. Migrate additional reports incrementally only after the pilot is trustworthy.
6. Preserve current commands until replacements pass representative validation.

**Outputs:** pilot consumer, comparison tests, migration notes.

**Acceptance checks:**

- the pilot no longer embeds duplicate path semantics
- results remain source-traceable
- current reports are not broken during migration
- discrepancies are categorized as bug, unsupported structure, semantic disagreement, or expected output change

### Task 14: Add ongoing health and compatibility operations

**Goal:** Keep the graph and wiki correct as CK3, Rakaly, documentation, and analysis needs evolve.

**Dependencies:** Tasks 7, 10, and 11.

**Work:**

1. Add a repeatable schema-ingest workflow for new save specimens.
2. Add schema compatibility checks for new CK3/Rakaly versions.
3. Add periodic wiki lint and claim-review workflows.
4. Report orphan graph nodes, unused claims, uncited mechanics, broken wiki links, and stale applicability.
5. Define version bump and migration rules for graph and claim schemas.
6. Document recovery from a bad ingest using Git history and regenerated outputs.

**Outputs:** maintenance commands, CI checks, versioning policy, operator documentation.

**Acceptance checks:**

- a no-change specimen produces no durable diff
- a structural change produces a bounded review diff
- lint failures identify actionable files and graph IDs
- all generated durable files can be reproduced from registered evidence plus reviewed rules

## 8. Required Worker Protocol

Every LLM worker implementing a task must:

1. Read this plan and relevant agent instructions completely.
2. State the task number and epistemic layer being changed.
3. Inspect existing work before editing.
4. Avoid unrelated refactors.
5. Preserve user changes and private state.
6. Add or update tests proportional to the change.
7. Run syntax checks, targeted tests, graph/schema validation, and durable-content lint.
8. Report files changed, commands run, results, uncertainties, and the next unblocked task.
9. Update the checklist only when acceptance checks actually pass.
10. Never promote campaign-specific facts into durable knowledge merely because they are interesting or useful in one run.

When a task reveals that a locked design decision is wrong, the worker must stop and document the evidence and proposed plan amendment. It must not silently redesign the architecture.

## 9. Progress Checklist

- [x] Task 0: Establish governance and safety checks
- [x] Task 1: Register the bootstrap Rakaly specimen
- [x] Task 2: Implement generic streaming-aware JSON traversal
- [x] Task 3: Normalize paths and fingerprint shapes
- [x] Task 4: Discover candidate collections and record types
- [x] Task 5: Discover identity domains and reference candidates
- [x] Task 6: Build the first durable save-schema graph
- [x] Task 7: Validate and generalize across multiple saves
- [x] Task 8: Create redacted and synthetic fixtures
- [ ] Task 9: Add semantic claims
- [ ] Task 10: Build the LLM Wiki kernel
- [ ] Task 11: Integrate Paradox and installed-game documentation
- [ ] Task 12: Implement ephemeral analysis for arbitrary saves
- [ ] Task 13: Refactor existing reports as consumers
- [ ] Task 14: Add ongoing health and compatibility operations

## 10. Global Acceptance Criteria

The project reaches its initial target when:

- a real Rakaly save can be structurally discovered without mechanic-specific extractors
- the committed graph models record types and references rather than campaign entities
- a second save can validate or revise structural knowledge without adding character nodes
- every durable graph item has evidence and applicability metadata
- semantic mechanics claims remain distinguishable from observed structure
- Paradox documentation can be integrated with citations and version scope
- the Markdown wiki compounds durable knowledge through documented ingest/query/lint operations
- any supported future save can be analyzed into a disposable instance graph
- existing reports can begin migrating onto the reusable knowledge layer
- raw private artifacts and ephemeral campaign facts remain outside durable knowledge

## 11. Current Repository State

Audit date: 2026-07-17.

- Repository: `SopasGu/ck3-save-analysis-toolset`
- Remote `main` currently contains a compressed Rakaly artifact at `state/rakaly-cli/output/ingest/last_save_2026-07-16_221531.json.gz`.
- The artifact is already present in public Git history even though `state/` is ignored.
- It is suitable as the bootstrap structural specimen, but its individual campaign records are not durable knowledge.
- Do not add further full saves or rewrite history without explicit owner direction.
- Existing analysis and report code remains useful as a later validation oracle and consumer surface.

## 12. Immediate Next Task

Begin with **Task 0**, then **Task 1**. Do not begin ontology naming or mechanics extraction first.

The first implementation milestone ends after Task 6 and must demonstrate:

1. generic traversal of the bootstrap specimen
2. normalized path and shape discovery
3. candidate collections and identity domains
4. aggregate reference-pattern discovery
5. a deterministic durable graph containing no individual campaign entities

Only after that milestone is reviewed should workers begin semantic naming, wiki generation, or Paradox documentation ingestion.
