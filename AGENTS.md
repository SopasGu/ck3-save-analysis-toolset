# AGENTS.md - CK3 Save Analysis Toolset

This repository is a local Crusader Kings III save-analysis toolset. The current active project is the durable Rakaly save-schema evidence graph and LLM wiki work.

## Start Here

Before changing code, read:

1. `docs/ck3-evidence-graph-plan.md`
2. `README.md`
3. `docs/ck3-save-analysis.md`

`docs/ck3-evidence-graph-plan.md` is the authoritative implementation plan for the current work. If another project document conflicts with it, follow `docs/ck3-evidence-graph-plan.md` unless Cris explicitly says otherwise.

This project may be worked on from multiple coding harnesses, including Codex, OpenCode, and OpenClaw. Treat this file as the shared handoff for all of them.

## Current Goal

Build a reusable, versioned, evidence-backed map of the durable structure of CK3 saves parsed by Rakaly.

The durable graph/wiki should explain general CK3 save structure:

- collections and record populations
- record types and shape variants
- fields, types, optionality, and cardinality
- identity domains such as character, title, province, culture, and faith IDs
- reference patterns between record types
- version/DLC/mod applicability
- semantic claims backed by evidence
- reusable queries and screeners

The durable graph/wiki is not a dump of one campaign. Campaign-specific graphs, parsed saves, and private analysis artifacts belong under ignored `state/`.

## Important Boundary

Keep these private or ignored by default:

- raw `.ck3` saves
- full Rakaly JSON output
- generated manifests
- screenshots
- campaign-instance graphs
- private wiki builds under `state/`

Commit these:

- source code
- docs
- schemas
- durable knowledge artifacts under `knowledge/`
- redacted or synthetic fixtures under `fixtures/`
- small examples that do not leak private campaign state

The repo intentionally ignores `state/`, `*.ck3`, and `*.zip`.

## Implementation Rules

- Follow `docs/ck3-evidence-graph-plan.md` task order.
- Keep structural discovery independent of existing mechanic-specific extractors at first.
- Do not use `extractSnapshot`, `extractPoliticalGraph`, `extractBrief`, `extractScout`, or contact-favor logic to decide the initial schema graph.
- Preserve evidence paths for derived facts.
- Separate raw observations, durable schema graph facts, semantic claims, wiki synthesis, and report consumers.
- Prefer plain JSON plus Markdown as the canonical durable interchange until a real need justifies SQLite, DuckDB, RDF, Graphify, Obsidian-specific output, or another adapter.
- Make every recommendation or semantic claim auditable back to source evidence.
- Treat Roads to Power landless mechanics as first-class, but do not let the current Nino campaign define the general schema.

## Existing Commands

Useful checks:

```bash
npm run check
node --check scripts/ck3-save-report
node --check scripts/ck3-save-ingest
```

Useful existing workflows:

```bash
scripts/ck3-save-ingest --list
scripts/ck3-save-ingest --all
scripts/ck3-save-report snapshot state/rakaly-cli/output/ingest/<save>.manifest.json
scripts/ck3-save-report graph state/rakaly-cli/output/ingest/<save>.manifest.json --json
scripts/ck3-save-report scout state/rakaly-cli/output/ingest/<save>.manifest.json --json
```

Generated save artifacts live under `state/` and are normally ignored.

## Good Next Step

The next worker should start by implementing the first discovery-oriented slice from `docs/ck3-evidence-graph-plan.md`, not by expanding advisor reports.

A good first implementation target is a read-only structural inventory/discovery command that:

- accepts a save JSON or manifest
- reports top-level keys and collection sizes
- samples recurring object shapes
- identifies candidate record populations
- records source paths and source fingerprints
- emits machine-readable JSON
- does not depend on current CK3 gameplay-specific report extractors

Keep the first pass boring, deterministic, and evidence-heavy. Fancy advice can come after the schema layer is trustworthy.

## Git Notes

This repository should use the personal GitHub identity:

```text
SopasGu <262275194+SopasGu@users.noreply.github.com>
```

Before committing, check:

```bash
git config --local user.name
git config --local user.email
git status --short --branch
```

Do not rewrite public history unless Cris explicitly asks.
