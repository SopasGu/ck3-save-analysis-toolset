# CK3 Evidence Wiki Operating Schema

This directory is the durable Markdown wiki for the CK3 evidence graph project. It is a consumer layer over machine-readable source, schema, and claim ledgers; it must not replace them.

## Authoritative Inputs

- `../schema/graph.json` is the durable structural graph.
- `../claims/claims.json` is the semantic claim ledger.
- `../sources/registry.json` is the source registry.
- Raw saves, expanded Rakaly JSON, cache files, and generated private artifacts stay under ignored `state/`.

## Page Types

- `index.md` - human-oriented catalog for the wiki.
- `log.md` - append-only history of wiki ingests, schema updates, claim changes, query filings, and lint passes.
- `pages/collections/*.md` - generalized collection pages.
- `pages/record-types/*.md` - generalized record-type pages.
- `pages/fields/*.md` - generalized field pages.
- `pages/identity-domains/*.md` - generalized identity-domain pages.

## Frontmatter Rules

Graph node pages must include `pageType: graph_node`, `graphId`, `graphKind`, `status`, `generatedFrom`, `claimIds`, and `provenanceSourceIds`. Keep graph IDs as exact machine-readable strings. Use wikilinks for related wiki pages and inline backticks for graph IDs, pointers, claim IDs, and source IDs.

## Mandatory Operations

### ingest

Integrate new structural evidence or documentation by regenerating the machine-readable graph or claim ledger first, then regenerate or update wiki pages from those ledgers. Add a dated entry to `log.md` that names the input ledgers and summarizes the page/count changes.

### query

Answer from wiki pages only when the answer cites graph IDs, claim IDs, or source IDs. If a useful synthesis emerges, file it as a durable wiki page or claim update instead of leaving it only in chat.

### lint

Run `npm run wiki:lint` before handoff. Lint must catch broken wikilinks, orphan graph pages, stale or superseded claim references, missing graph IDs, missing provenance, and any campaign-character page.

## Boundaries

Pages describe generalized save structure. They must not enumerate campaign characters, save-record IDs, raw save paths, raw Rakaly JSON paths, or private instance data. Semantic claims remain marked as claims and never become structural observations.
