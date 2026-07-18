# CK3 Schema Graph Maintenance

This runbook keeps the durable CK3 schema graph, semantic claims, documentation-backed wiki, and report consumers healthy as CK3, Rakaly, and local analysis needs evolve.

## Routine Health

Run the full project gate before committing durable graph/wiki changes:

```bash
npm run check:all
```

Run the maintenance health report when reviewing schema, claim, wiki, source, or advisor changes:

```bash
npm run maintenance
node scripts/ck3-maintenance health --json --out state/maintenance/latest-health.json
```

The JSON report is safe to write under ignored `state/`. It checks:

- schema graph validation
- claim ledger validation against graph IDs
- wiki broken links, stale claims, orphan generated pages, and campaign-character leakage
- mechanics-content source citation coverage
- all-DLC/version applicability on claims and documentation sources
- fixture schema compatibility for no-change and structural-change specimens

## New Save Specimen Workflow

1. Ingest or point at a Rakaly JSON/JSON.GZ artifact under ignored `state/`.
2. Register the specimen only if it adds a meaningful CK3/Rakaly/version/applicability case.
3. Run discovery, shape, collection, identity/reference, schema, and schema-diff commands against the new specimen.
4. Commit only durable registry/graph/claim/wiki changes. Never commit raw saves, expanded Rakaly JSON, or per-campaign instance records.
5. Use `scripts/ck3-save-schema-diff` to compare the current graph against the regenerated graph.

Expected outcomes:

- a no-change specimen produces `summary.structuralChanges: 0`
- new generalized fields, collections, record types, or reference coverage produce bounded review diffs
- new campaign characters, titles, contracts, balances, or locations do not become durable graph nodes

## Versioning Policy

Keep schema and claim schema versions stable for additive changes that older tooling can ignore.

Bump the relevant schema version when:

- required fields are added or removed
- ID derivation changes
- existing node, edge, claim, or source semantics change
- migration code is required for older committed artifacts

Do not bump versions for:

- new observed graph nodes or edges
- new supported/proposed claims
- documentation source refreshes with the same artifact shape
- regenerated wiki pages from unchanged graph/claim schemas

When a bump is required, update:

- `knowledge/schema/schema-version.json`
- the relevant JSON schema under `knowledge/schema/` or `knowledge/claims/`
- tests that validate old and new behavior
- this runbook if operator steps change

## Bad Ingest Recovery

If a bad specimen, parser bug, or overbroad semantic rule pollutes durable output:

1. Stop adding new evidence.
2. Use `git status` and `git diff` to isolate durable files changed by the bad run.
3. Preserve ignored `state/` artifacts only if they help debug locally; do not commit them.
4. Use Git history to inspect the last known-good durable artifacts:

```bash
git show HEAD~1:knowledge/schema/graph.json > /tmp/previous-graph.json
```

5. Generate a schema diff from the suspected bad graph to the last known-good graph.
6. Categorize each discrepancy as parser bug, unsupported structure, semantic disagreement, expected output change, or private/campaign leakage.
7. Revert or regenerate only the affected durable artifacts.
8. Rerun:

```bash
npm run check:all
npm run maintenance
```

Only mark a recovery complete after the health report is `ok` and no raw/private artifacts are staged.
