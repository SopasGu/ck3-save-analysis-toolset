# AGENTS.md - CK3 Save Analysis Toolset

Local Crusader Kings III save-analysis tooling. Current active project is the durable Rakaly save-schema evidence graph + LLM wiki defined in `docs/ck3-evidence-graph-plan.md`.

This file is shared handoff across Codex, OpenCode, and OpenClaw sessions.

## Start Here

Before changing code, read in this order:

1. `docs/ck3-evidence-graph-plan.md` - authoritative implementation plan. **Controls all schema/wiki/mechanics work.** If any other doc conflicts, this plan wins unless Cris says otherwise.
2. `README.md`
3. `docs/ck3-save-analysis.md` - existing report surface (snapshot, patrons, brief, scout, graph, chronicle, screenshots, resolve, diff, timeline)
4. `docs/ck3-knowledge-graph-handoff.md` - original motivation; superseded by the evidence-graph plan for sequencing, kept for concept context

OpenClaw skills live in `skills/ck3-save-analysis/` and `skills/ck3-save-analysis-screenshots/` (private, mode `0600`). Read them when operating the existing screenshot or report tooling.

## Current Goal

Build a reusable, versioned, evidence-backed schema graph of CK3 saves parsed by Rakaly, plus a maintained Markdown wiki. See `docs/ck3-evidence-graph-plan.md` §1-2 for the locked design. **Do not start by expanding the existing advisor reports** (snapshot, brief, scout, etc.) - they are later consumers, not the schema source.

## Important Boundary

Ignored by default (see `.gitignore`): `state/`, `*.ck3`, `*.zip`, `scripts/rakaly`, `scripts/rakaly-cli`, `node_modules/`. These contain raw saves, full Rakaly JSON, generated manifests, screenshots, and private rakaly binaries.

Durable / committed: source code, `docs/`, schemas, `knowledge/`, `fixtures/`, and small redacted or synthetic examples. `knowledge/sources/registry.json` is intentionally committed as the source registry. `fixtures/lint/` is intentionally committed to exercise the durable-content lint.

### Bootstrap artifact is already in public Git history

`state/rakaly-cli/output/ingest/last_save_2026-07-16_221531.json.gz` (~16 MB compressed, ~120 MB expanded) was committed before `state/` was ignored. It is the bootstrap structural specimen for the plan's Task 1 and is registered there. Do not "clean it up," rewrite history, or add additional full saves without explicit owner authorization. Treat it as evidence, not as durable knowledge; do not let its individual campaign records leak into `knowledge/`.

## Implementation Rules

Locked by the plan; key points an agent will otherwise miss:

- Follow `docs/ck3-evidence-graph-plan.md` task order. Start at **Task 0**, then **Task 1**. Do not skip to ontology naming or mechanics extraction.
- The initial structural discovery must **not** import or be biased by existing extractors in `scripts/lib/ck3-save-analysis.mjs`: `extractSnapshot`, `extractPoliticalGraph`, `extractBrief`, `extractScout`, `extractLandlessMechanics`, contact-favor logic, etc.
- Stable graph IDs must never contain instance record IDs (no `character:37885`, no `living.37885` in stable IDs).
- Every durable graph item carries `provenance` (source + observation IDs) and `scope` (gameVersions / DLC / mods).
- Roads to Power landless mechanics (camp purpose, contact favors, `contact_list_weak_hook`, `contact_list_request_interaction`) are first-class. Do not let the current Nino campaign define the general schema - it is a test corpus.
- Prefer plain JSON + Markdown. SQLite / DuckDB / RDF / Graphify / Obsidian are adapters, not yet justified.
- If a locked design decision looks wrong, stop and document the evidence. Do not silently redesign.

## Current Checkpoint

Tasks 0-8 in `docs/ck3-evidence-graph-plan.md` are complete. The next worker should start at **Task 9: Add semantic claims without contaminating structural discovery**.

Useful Task 9 inputs now available:

- `knowledge/sources/registry.json` - registered bootstrap source metadata
- `knowledge/schema/graph.json` - first durable schema graph generated from the bootstrap source
- `knowledge/schema/graph.schema.json` - schema for durable graph artifacts
- `knowledge/schema/compatibility-report.json` - Task 7 compatibility report comparing the bootstrap graph against a second local-only Rakaly specimen
- `fixtures/schema/` - synthetic fixtures and manifests covering discovery stages without requiring full campaign artifacts
- `scripts/ck3-save-discover` - generic streaming JSON structure discovery
- `scripts/ck3-save-shape` - normalized path and shape catalog generation
- `scripts/ck3-save-collections` - candidate collection and record-type catalog generation
- `scripts/ck3-save-references` - identity-domain and aggregate reference-candidate catalog generation
- `scripts/ck3-save-schema` - durable schema graph generation and validation
- `scripts/ck3-save-schema-diff` - durable schema graph compatibility diff
- `scripts/lib/ck3-candidate-collections.mjs` - reusable Task 4 collection identification logic
- `scripts/lib/ck3-identity-references.mjs` - reusable Task 5 identity/reference discovery logic
- `scripts/lib/ck3-schema-graph.mjs` - reusable Task 6 graph generation and validation logic
- `scripts/lib/ck3-schema-diff.mjs` - reusable Task 7 graph compatibility diff logic
- `scripts/test-schema-fixtures` - Task 8 fixture regression runner
- `scripts/ck3-wiki-source` - Task 11 groundwork MediaWiki source adapter for CK3 Wiki documentation metadata
- `knowledge/sources/ck3-wiki-main-page-links.json` - registered CK3 Wiki `Main_Page/links` source summary and seed topic links

Before beginning Task 9, run `npm run check:all` and inspect the Task 9 plan section. Task 9 may name record types, fields, identity domains, and references only through explicit versioned claims backed by graph evidence; do not let semantic rules alter structural observations.

Documentation groundwork note: CK3 Wiki sources may be fetched through `scripts/ck3-wiki-source` with serial requests, local caching, meaningful User-Agent headers, and `Retry-After` handling. For this project, assume all official CK3 DLC is active unless a later source explicitly scopes behavior otherwise. Documentation metadata can support proposed claims, but it must not create accepted claims or wiki pages before Tasks 9-10 define those ledgers and rules.

## Commands

Run all syntax checks at once:

```bash
npm run check
```

Discover and parse saves:

```bash
scripts/ck3-save-ingest --list
scripts/ck3-save-ingest --all
scripts/ck3-save-ingest --source "$HOME/.local/share/Paradox Interactive/Crusader Kings III/save games/autosave.ck3"
scripts/ck3-save-ingest --screenshots-sync
```

Generate reports (add `--json` for machine-readable; `state/` paths assume default ingest layout):

```bash
scripts/ck3-save-report snapshot   state/rakaly-cli/output/ingest/<save>.manifest.json
scripts/ck3-save-report patrons    <manifest>
scripts/ck3-save-report graph      <manifest> --json
scripts/ck3-save-report brief      <manifest> --json
scripts/ck3-save-report scout      <manifest> [--json] [target...]
scripts/ck3-save-report resolve    <manifest> character:<id> province:<id> title:<id> culture:<id> faith:<id>
scripts/ck3-save-report diff       <old> <new>
scripts/ck3-save-report timeline   <save-or-manifest>...
scripts/ck3-save-report chronicle  <save-or-manifest>...
scripts/ck3-save-report screenshots <save-or-manifest>
```

Full report semantics: `docs/ck3-save-analysis.md`.

Rakaly wrapper lives at `scripts/ck3-rakaly` (ignored binary at `state/rakaly-cli/rakaly-0.8.17-x86_64-unknown-linux-musl/rakaly`).

## Required Worker Protocol

From plan §8, condensed:

1. State the task number and epistemic layer (A raw sources / B observations / C schema graph / D semantic claims / E consumers).
2. Inspect existing work before editing; avoid unrelated refactors.
3. Run `npm run check` plus targeted tests, graph/schema validation, and durable-content lint.
4. Report files changed, commands run, results, uncertainties, next unblocked task.
5. Update the plan's §9 checklist only when acceptance checks actually pass.

## Git

Use the personal GitHub identity for this repo:

```text
SopasGu <262275194+SopasGu@users.noreply.github.com>
```

Before committing:

```bash
git config --local user.name
git config --local user.email
git status --short --branch
```

Do not rewrite public history unless Cris explicitly asks.
