# CK3 Save Analysis Toolset

Local Crusader Kings III save-analysis helpers for parsed Rakaly JSON saves.

## What Is Included

- `scripts/ck3-save-ingest` parses live `.ck3` saves into JSON artifacts and manifests.
- `scripts/ck3-save-report` generates snapshot, patrons, diff, timeline, resolve, graph, brief, scout, screenshots, and chronicle reports.
- `scripts/lib/ck3-save-analysis.mjs` contains the shared CK3 extraction logic.
- `scripts/lib/ck3-screenshots.mjs` indexes Steam screenshots and associates them with save windows.
- `docs/ck3-save-analysis.md` documents usage and report scope.
- `docs/ck3-evidence-graph-plan.md` defines the first-principles plan for deriving an evidence graph from Rakaly JSON before adding CK3 mechanics.
- `skills/` contains OpenClaw skill notes for using the tooling in future sessions.

## Requirements

- Node.js 18 or newer.
- `rakaly` available to `scripts/ck3-rakaly`, or adjust that wrapper for your install.
- A local Crusader Kings III install and saves under the standard Paradox/Steam paths.

## Quick Start

```bash
npm run check
scripts/ck3-save-ingest --list
scripts/ck3-save-ingest --all
scripts/ck3-save-report snapshot state/rakaly-cli/output/ingest/<save>.manifest.json
scripts/ck3-save-report scout state/rakaly-cli/output/ingest/<save>.manifest.json
```

Generated save JSON, manifests, and screenshot archives live under `state/` and are ignored by Git.

## Notes

The reports are intentionally evidence-first and best-effort. CK3 deletes or compresses some historical state, so completed contract history and some relationship interpretations are inferred from counters, hooks, cooldowns, opinions, and adjacent saves.
