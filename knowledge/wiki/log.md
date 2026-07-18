# CK3 Evidence Wiki Log

This append-only log records wiki ingests, schema updates, claim changes, query filings, and lint passes.

## 2026-07-18T05:45:00.000Z

- operation: ingest
- task: 11 (documentation integration)
- graph nodes: 1732 (was 1684; +48 mechanics_concept)
- graph edges: 2985 (unchanged)
- semantic claims: 58 (10 baseline + 48 documentation-anchored proposed)
- documentation sources registered: 49 (Main_Page/links + 48 topic pages; no `documentationMeta`, no patches/dev diaries/installed defs)
- mechanics_concept table: `knowledge/schema/mechanics-concepts.json` (48 concepts, 1 per registered topic)
- per-topic MediaWiki JSON: `knowledge/sources/ck3-wiki-pages/<slug>.json` (48 files, metadata + section anchors only, no lead excerpts)
- proposed claims: `knowledge/claims/proposed-documentation-claims.json` (48 entries, applied via `ck3-documentation-claims apply`)
- wiki pages: 1474 graph pages + 3 operating docs (AGENTS.md / index.md / log.md)
- inputs: `knowledge/schema/graph.json`, `knowledge/claims/claims.json`, `knowledge/sources/registry.json`, `knowledge/sources/ck3-wiki-pages/`, `knowledge/claims/proposed-documentation-claims.json`
- note: documentation claims cite registered per-topic source + section anchors. Per plan §2.7 documentation cannot create instance graph facts; mechanics_concept nodes only carry (topic, sourceId, sectionAnchor)-level pointers.

## 2026-07-18T04:45:00.000Z

- operation: ingest
- graph nodes: 1684
- graph edges: 2985
- semantic claims: 10
- generated wiki kernel version: 1
- inputs: `knowledge/schema/graph.json`, `knowledge/claims/claims.json`
- note: generated generalized structure pages only; no campaign-character pages.
