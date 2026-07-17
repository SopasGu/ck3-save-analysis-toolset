# CK3 Save Analysis Workflow

Reusable local tooling for Crusader Kings III save analysis lives in `scripts/`.

## Commands

List live CK3 saves by modified time:

```bash
scripts/ck3-save-ingest --list
```

Parse the freshest live save into a timestamped JSON artifact and manifest:

```bash
scripts/ck3-save-ingest
```

Parse a specific save:

```bash
scripts/ck3-save-ingest --source "$HOME/.local/share/Paradox Interactive/Crusader Kings III/save games/autosave.ck3"
```

Archive every currently discovered live save:

```bash
scripts/ck3-save-ingest --all
```

Generate a compact player/camp snapshot:

```bash
scripts/ck3-save-report snapshot state/rakaly-cli/output/ingest/<save>.manifest.json
```

Generate the adventurer contract and patron/contact sheet:

```bash
scripts/ck3-save-report patrons state/rakaly-cli/output/ingest/<save>.manifest.json
```

Compare two checkpoints:

```bash
scripts/ck3-save-report diff <old-save-or-manifest> <new-save-or-manifest>
```

Build a chronological campaign timeline from multiple parsed saves:

```bash
scripts/ck3-save-report timeline <save-or-manifest>...
```

Resolve character, title, province, culture, or faith IDs:

```bash
scripts/ck3-save-report resolve <save-or-manifest> character:37885 province:2041 title:18010 culture:131 faith:23
```

Build a regional political graph of people, places, and edges around the played character:

```bash
scripts/ck3-save-report graph <save-or-manifest>
```

Build an advisor brief with travel opportunities, available favors, pending cooldowns, contact standing, and nearby rulers:

```bash
scripts/ck3-save-report brief <save-or-manifest>
```

Build a strategic scout report for camp movement, POI/fame gates, ruler targets, hook guardrails, epidemic risk, and local-board contract choices:

```bash
scripts/ck3-save-report scout <save-or-manifest> [target...]
```

Render a narrative chronicle of the played character across multiple checkpoints:

```bash
scripts/ck3-save-report chronicle <save-or-manifest>...
```

Add `--json` to any report command for machine-readable output.

## Current Scope

The extractor resolves the played character and reports:

- player basics, resources, focus, perks, and useful counters
- camp government, purpose law, laws, strength, power, at-peace penalty, and succession
- entourage members employed by the played character
- current contracts owned by the played character
- Roads to Power landless-adventurer mechanics: camp purpose, camp followers, provisions note, influence value, and contact request rules
- patron/contact favor hooks and contact cooldowns from active relations
- contract/contact opinion traces from active opinions
- simple diffs across save checkpoints
- chronological campaign timelines across multiple checkpoints
- ID resolution for characters, titles, provinces, cultures, and faiths
- a regional political graph: the played character, their entourage, current contract employers, patron/contact relations, contract opinions, current locations, and the title holders / lieges who control those locations
- an advisor brief: travel opportunities ranked by proximity and contract status, available favors with expiration dates, pending contact cooldowns, net standing with each contact (sum of opinion values), and the rulers who hold the barony/county/kingdom of the player's current location
- a scout report: strategic recommendations for where to move camp or scout next, current POI/fame thresholds, disease/travel risk, ruler scouting, hook/contact-favor guardrails, and contract-board evaluation
- a narrative chronicle: prose paragraphs across multiple checkpoints with date, location, identity, camp state, contracts, patron signals, and a checkpoint-to-checkpoint delta summary

## Resolver Notes

Culture and faith names are read from the parsed save itself. Province labels are inferred from CK3 static landed-title files under the Steam game install, then enriched with the save's current title holders. Some travel-only or empty shell provinces may still resolve only as `province <id>`.

## Reliability Rules

- Treat the live CK3 save directory as source of truth.
- Prefer manifest paths produced by `scripts/ck3-save-ingest`.
- Do not trust stale generic parse files unless their source mtimes have just been verified.
- Completed contracts may disappear from `task_contracts.database`; reconstruct history by comparing autosaves and looking at counters, hooks, cooldowns, and opinion traces.
- Do not treat `contact_list_weak_hook` as an ordinary weak hook. For Roads to Power landless adventurers it is the "Excelled at Contract" contact favor used by `contact_list_request_interaction`.

## Roads to Power Landless Notes

The analysis layer now distinguishes landless adventurer mechanics from vanilla landed-ruler assumptions.

- `landless_adventurer_government` is treated as a playable unlanded adventurer government with a camp domicile.
- Camp purpose is read from `landed_data.laws`, including Wanderers, Mercenaries, Scholars, Explorers, Brigands, and Legitimists. Reports include the purpose's contract weighting, modifiers, and building/officer unlock notes.
- Camp followers are counted from living characters whose `court_data.employer` is the played character. Their opinion matters for camp temperament, so follower extraction is not just entourage flavor.
- Provisions are described as camp travel fuel, not ordinary gold or supply.
- Influence is surfaced when present, but the base Roads to Power contact request interaction does not spend influence. Influence-like request scoring belongs to later/other mechanics and should not be mixed into contact favors unless the specific interaction supports it.

### Contact Favor Semantics

`scripts/ck3-save-report patrons` and `brief` now interpret contact favors from relation slots:

- `active_hook_N` with `contact_list_weak_hook` means side `N` holds an available "Excelled at Contract" favor on the other side.
- `cooldown_against_recipient_N` with `contact_list_request_interaction` means side `N` already used Make a Request on the other side and is on cooldown.
- `laamp_used_contact_opinion` and `laamp_used_contact_opinion_special` are treated as evidence that a contact request was spent, not normal contract standing.
- Opinion costs can infer the likely request family: provisions `-20`, knights `-30`, gold or men-at-arms `-40`, marriage or tournament `-50`, and new contract `-5`.

Known Make a Request options currently modeled:

- Provisions
- Gold
- Men-at-arms regiment
- Rent a knight
- Arrange a marriage
- New task contract
- Host a feast, requiring `inspiring_rule_perk`
- Host a tournament, requiring `stalwart_leader_perk` and Tours & Tournaments support

Availability is reported as "known rules" rather than absolute truth because some options depend on volatile UI/game-state checks, such as free men-at-arms slots, valid marriage candidates, recipient war state, available knights, existing contracts from that recipient, or DLC feature gates.

## Graph Notes

`graph` collects three node kinds and a fixed set of edge kinds. JSON output uses `person:<id>`, `place:<provinceId>`, and (implicitly) titles via the province summary.

Edge kinds:

- `located at` — person -> place (player, entourage, or contract VIP)
- `employs` — player -> entourage member
- `contract employer` — player -> contract giver (label: contract name and status)
- `contract at` — player -> place (contract location)
- `contract target` — player -> character (escort target, etc.)
- `patron contact` — player <-> patron/contact relation
- `hook available` — hook holder -> hook target, read from the relation slot (`active_hook_N` means side `N` holds the hook on the other side)
- `contact used` — actor -> target, read from the cooldown slot (`cooldown_against_recipient_N` means side `N` triggered the cooldown by acting against the other side)
- `succeeded contract opinion`, `failed contract opinion`, `used contact opinion` — modifier source -> target
- `title holder` — person -> place (holder of the barony/county/duchy/kingdom/empire governing that province)
- `liege` — person -> person. Note: `de_facto_liege` on landed titles is a *title ID*, so this edge resolves to the holder of that liege title and skips self-loops (where the same person holds both layers, e.g. county and kingdom).

## Scout Notes

`scout` is the strategic layer above `brief`. `brief` answers what is nearby now; `scout` answers where the camp should move or look next and why.

The report currently includes:

- recommendation-first output, with evidence under each recommendation
- current strategic state and the reminder that task contracts are a local board that camp movement can reroll
- POI/fame decision gates, including the 26-POI Seasoned Visitor threshold and the 42-POI advanced travel decision gate
- province scouting for current location, current contract sites, default strategic POI targets, and optional named/ID targets
- ruler scouting with wealth, income, war state, opinion scars, hooks, title tier, and strategic-use labels
- hook guardrails that keep ordinary hooks such as `house_head_hook` separate from RtP `contact_list_weak_hook` contact favors
- epidemic risk where the parsed save exposes province infections

Targets can be passed as raw IDs, names, or typed refs such as `province:2575`, `character:33596132`, or `title:12345`. Add `--json` for machine-readable output.

## Steam Screenshots as Analysis Evidence

The toolchain can harvest CK3 screenshots from the local Steam install and tie them to saved-checkpoints.

### What it does

- `scripts/ck3-save-ingest --list-screenshots` lists every CK3 Steam screenshot discovered under `~/.steam/debian-installation/userdata/<uid>/760/remote/1158310/screenshots/` (or the equivalent `~/.local/share/Steam/userdata/...`).
- `scripts/ck3-save-ingest --screenshots-sync` archives every screenshot into `state/screenshots/` and writes `state/screenshots/index.json`. Each entry holds the original Steam path, wall-clock mtime, size, and the **closest prior save** as the association. The association uses a window: screenshots with `prev_ms < takenAtMs <= here_ms` for the same `.ck3` source file are attributed to `here`, so each save's session window inherits only the screenshots taken during play since the previous save.
- When invoked with `--all`, `--screenshots-sync` runs automatically after save ingest.

### Replay-aware report

`scripts/ck3-save-report screenshots <save-or-manifest>` lists screenshots tied to a save:

- For `autosave_2026-07-11_222755.manifest.json` (in-game 874.3.1), this returns the three tournament screenshots from Feb 874 (Wrestling: Toss-up outcomes during Nino's tournament run).
- For `autosave_2026-07-11_230344.manifest.json` (in-game 877.12.1), this returns the three post-tournament screenshots from the next session.

This makes screenshots a natural evidence layer inside `chronicle`/`brief`/`patrons` reports: a follow-up patch can interleave image-text descriptions alongside numerical deltas.

### When a save has no screenshots

The report prints `(none for this save)` and points to `--list-screenshots` / `--screenshots-sync`. This usually means the user took no screenshots during the play session that produced this save, or the screenshot sync has not been re-run since new screenshots were taken.

### Game-time association (in-game date grounding)

Wall-clock association alone is brittle for landless-adventurer campaigns because the in-game calendar can race far ahead of wall-clock — a save at 22:24 PDT can capture in-game date 874.3.1 while a screenshot taken at 22:46 PDT can show 875.10.15 (a 19-month in-game jump in 22 minutes of real time).

To make screenshots a useful evidence layer, the toolchain can extract in-game dates from the screenshot text:

- Each screenshot is analyzed with `minimax-websearch__understand_image` (via an LLM pass), which extracts `in_game_date`, `event_summary`, `player`, and `location` from the bottom-right corner of the CK3 UI.
- The output is persisted to `state/screenshots/analysis.json` with this schema:

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "<ISO timestamp>",
  "model": "<tool model id>",
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

- The `screenshots` report reads both `state/screenshots/index.json` (file discovery) and `state/screenshots/analysis.json` (game-time metadata) and shows in-game dates plus a one-line event summary per screenshot.
- Reports are filtered to a save's window as `[prevSaveDate, hereDate]` where `prevSaveDate` is the largest save in-game date strictly before this save's date across **all** sources (not just the same `.ck3` source file). This means a slot 2 autosave naturally inherits screenshots that happened between any earlier save and itself.
- If game-time data is missing for a screenshot, the report falls back to wall-clock window association.

### Re-running analysis

The LLM pass is currently manual. To refresh or extend:

1. Pick a screenshot file under `state/screenshots/`.
2. Call `minimax-websearch__understand_image` with a prompt asking for JSON-only output containing `in_game_date`, `event_summary`, `player`, `location`.
3. Append the result to `state/screenshots/analysis.json`, keeping the schema above.
4. Re-run the `screenshots` report — the new in-game date and event summary appear in the output.

### Example: matching a screenshot to a fact

For Nino's `867.1.1` pre-campaign screenshot, the `understand_image` pass identified `contact_list_weak_hook` use against Bishop Fosco of Vaticano for provisions/gold/men-at-arms. This matches the `patrons` report's existing classification of `contact_list_weak_hook` as the RtP "Excelled at Contract" favor and the documented option list (`Provisions`, `Gold`, `Men-at-arms regiment`).

For Nino's `874.2.5` through `874.3.17` screenshots, the analysis traces the Benedictus-hosted tournament from wrestling round 1 to the final loss and the +150 gold / +15 prestige / Accomplished Grappler trait award at tournament conclusion. This matches the `patrons` interpretation's `Host a tournament` special opinion (-50) for Benedictus.
