---
name: "ck3-save-analysis-screenshots"
description: "Add Steam screenshot indexing with game-time grounding to ck3-save-analysis."
---

# Update Proposal: Steam Screenshot Evidence Layer (Game-Time Grounded)

## Purpose
Extend `ck3-save-analysis` so Steam screenshots from the local CK3 install become durable evidence grounded in in-game dates extracted from the screenshot UI, attached to specific saves by in-game windows, and surfaced inside reports with one-line event summaries that match against saves' patron/contract facts.

## Scope

### Discovery And Archival
- `scripts/ck3-save-ingest --list-screenshots` lists every CK3 screenshot found under the standard Steam userdata directory (`~/.steam/debian-installation/userdata/<uid>/760/remote/<appid>/screenshots/` or `~/.local/share/Steam/userdata/...`), where `<appid>` is the Crusader Kings III Steam id `1158310`.
- `scripts/ck3-save-ingest --screenshots-sync` copies every discovered screenshot into `state/screenshots/` and writes `state/screenshots/index.json`.
- When `--all` is given, screenshot sync runs automatically after save ingest. The post-exit wrapper `~/.local/bin/ck3-ingest-after` (already wired into CK3 Steam launch options) invokes `--all` and therefore rebuilds the screenshot index on every CK3 exit.

### Game-Time Analysis Layer
Each screenshot's in-game date is extracted from the bottom-right corner of the CK3 UI using the `minimax-websearch__understand_image` LLM tool. Output JSON schema (persisted in `state/screenshots/analysis.json`):

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "<ISO>",
  "model": "<tool model>",
  "entries": [
    {
      "archivePath": "/state/screenshots/<file>.jpg",
      "filename": "20260711221929_1.jpg",
      "inGameDate": "874.2.5",
      "player": "Nino of the Bastards of the Monolith",
      "location": "Cremona",
      "eventSummary": "Wrestling toss-up victory over Count Arnold of Pula.",
      "keywords": ["tournament", "wrestling", ...]
    }
  ]
}
```

- The LLM pass is manual/repeatable: pass a screenshot path to `minimax-websearch__understand_image` with a JSON-only prompt asking for `in_game_date`, `event_summary`, `player`, `location`. Append the result to `analysis.json`.
- A round of analysis has been completed for all 13 existing screenshots in Cris's campaign, covering 7 distinct in-game dates from 867.1.1 through 878.8.4.

### Save Association: Game-Time Windowed

Wall-clock window alone is brittle for landless-adventurer campaigns: the in-game calendar can race far ahead of wall-clock. A save at 22:24 PDT captures in-game 874.3.1; a screenshot at 22:46 PDT captures 875.10.15 — a 19-month in-game jump in 22 minutes of real time.

The new association rule:

- For each save with in-game date D, the previous save is the largest save across **all** `.ck3` sources with in-game date strictly less than D.
- Screenshot S with in-game date D_s is associated with save X iff `prevSave.D < D_s <= X.D` (treat `prevSave.D` as 0 when no prior save).
- This naturally handles the slot cycling: an autosave_2 capture with in-game date 877.10.1 inherits the post-tournament screenshots whose in-game dates sit between 874.3.13 (the prior save from `last_save.ck3`) and 877.10.1.
- If a screenshot has no in-game date (analysis not yet run), the report falls back to wall-clock window.

### Screenshots Report
`scripts/ck3-save-report screenshots <save-or-manifest>` shows, for the save's game-time window:

- Each screenshot's `inGameDate` and `eventSummary` from `analysis.json`.
- The wall-clock and the wall-clock association (for cross-checking).
- The game-time association: which save manifest S is being placed under (forward or backward of D_s).
- The archive path on disk for hand inspection.

--json output emits the merged entries plus the count.

### Documentation
A new "Game-time association (in-game date grounding)" section in `docs/ck3-save-analysis.md` documents the analysis.json schema, the window rule, the wall-clock fallback, and a worked example of matching a screenshot to a fact in the analysis output.

## Validation

- `node --check scripts/lib/ck3-screenshots.mjs`
- `node --check scripts/ck3-save-ingest`
- `node --check scripts/ck3-save-report`
- `scripts/ck3-save-ingest --list-screenshots`
- `scripts/ck3-save-ingest --screenshots-sync`
- `scripts/ck3-save-report screenshots state/rakaly-cli/output/ingest/autosave_2026-07-11_222755.manifest.json` → 3 entries from the tournament window, in-game dates 874.2.5, 874.2.17, 874.2.24.
- `scripts/ck3-save-report screenshots state/rakaly-cli/output/ingest/autosave_2_2026-07-11_230348.manifest.json` → 3 entries spanning 874.3.17 (tournament concluded) → 875.10.15 (language learned) → 875.12.3 (architecture failed).
- `scripts/ck3-save-report screenshots state/rakaly-cli/output/ingest/last_save_2026-07-11_231855.manifest.json` → 5 entries spanning 877.12.11 (Regale Court success) → 878.3.13 (hunt × 3).

## Proven-Out Fact Matches Against Existing Reports

| Screenshot in-game date | Event | Matches against save analysis |
|---|---|---|
| 867.1.1 | `contact_list_weak_hook` request to Bishop Fosco | `contact_list_weak_hook` = RtP "Excelled at Contract" favor, options Provisions / Gold / Men-at-arms — confirmed in patrons report |
| 874.2.5–24 | Wrestling tournament rounds | Drives the Benedictus `-50` `laamp_used_contact_opinion_special` traced to "Host a tournament" |
| 874.3.17 | Tournament conclusion +150 gold, +15 prestige, Accomplished Grappler | Matches the patrons report's special-cooldown-opinion cost for Benedictus |
| 875.10.15 | Scolaster learns High German via language scheme | Matches the diff showing Nino's heir list advancing and Scolaster gaining language skills |
| 875.12.3 | Architecture scheme fails in Cremona, opinion hits Benedictus | Confirms the surname-tied Benedictus `-50` opinion still active and visible in the patrons report |
| 877.12.11 | Regale Court success for Alberico | Matches the active `Regale Court [accepted]` contract for Alberico at Milano in the snapshot/patrons report |
| 878.3.13 ×3 | Hunt activity with seduction | Connects to the at-peace-penalty-30 warfighting pressure (hunts don't help at-peace penalty; only combat does) |

## Files Touched
- `scripts/lib/ck3-screenshots.mjs` — discovery, archival, plus `loadAnalysis`, `mergeAnalysis`, and `gameTimeAssociation` helpers.
- `scripts/ck3-save-ingest` — added `--list-screenshots`, `--screenshots-sync`, `--screenshots-only`, `--screenshots-dir`, `--index` flags. Auto-syncs when `--all` is set.
- `scripts/ck3-save-report` — added `screenshots <save-or-manifest>` subcommand and printer, plus the global-pre-save window rule.
- `docs/ck3-save-analysis.md` — new "Game-time association" section with schema, window rule, fallback notes, and a worked matching example.
- `state/screenshots/analysis.json` — persisted analysis for all 13 current screenshots.
