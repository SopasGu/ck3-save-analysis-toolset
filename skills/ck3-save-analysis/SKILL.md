---
name: "ck3-save-analysis"
description: "Restore broad CK3 save workflow with RtP mechanics"
---

# CK3 Save Analysis

Use this skill when Cris wants to inspect Crusader Kings III saves, compare autosaves, reconstruct campaign activity, understand contracts or contact favors, resolve character/title/location IDs, build a camp report, make a regional political graph, produce an advisor brief, render a narrative chronicle, or connect Steam screenshots to save-state evidence.

## Local Tooling

Run commands from `/home/cris/.openclaw/workspace`.

- `scripts/ck3-save-ingest --list`
  Lists discovered CK3 saves by modified time, size, and path.

- `scripts/ck3-save-ingest [--source PATH] [--out-dir DIR] [--pretty]`
  Parses the newest CK3 save by default, or a specified save, into timestamped Rakaly JSON plus a manifest under `state/rakaly-cli/output/ingest/`.

- `scripts/ck3-save-ingest --all [--out-dir DIR] [--pretty]`
  Parses every currently discovered live CK3 checkpoint. When `--all` is used, screenshot sync also runs.

- `scripts/ck3-save-ingest --list-screenshots | --screenshots-sync | --screenshots-only`
  Lists or archives CK3 Steam screenshots into `state/screenshots/` and updates `state/screenshots/index.json`.

- `scripts/ck3-save-report snapshot <save.json|manifest.json> [--json]`
  Prints a compact player/camp snapshot: resources, focus, perks, government, laws, camp state, succession, entourage, counters, contracts, and patron-signal counts.

- `scripts/ck3-save-report patrons <save.json|manifest.json> [--json]`
  Prints current contracts plus patron/contact evidence: contract locations, live hooks, contact cooldowns, contract-result opinions, and Roads to Power contact-favor interpretation.

- `scripts/ck3-save-report diff <old.json|old.manifest.json> <new.json|new.manifest.json> [--json]`
  Compares checkpoints: resource deltas, camp changes, perk changes, contract churn, and patron-signal changes.

- `scripts/ck3-save-report timeline <save-or-manifest>... [--json]`
  Sorts checkpoints by in-game date, deduplicates identical checkpoints, and prints a campaign timeline with adjacent changes.

- `scripts/ck3-save-report resolve <save.json|manifest.json> <id>... [--json]`
  Resolves character, title, province, culture, and faith IDs. Use prefixes such as `character:37885`, `province:2041`, `title:18010`, `culture:131`, or `faith:23` when ambiguity matters.

- `scripts/ck3-save-report graph <save.json|manifest.json> [--json]`
  Builds a regional political graph around the played character: people, places, and edges for location, employment, contracts, contact hooks/cooldowns, contract opinions, title holders, and lieges.

- `scripts/ck3-save-report brief <save.json|manifest.json> [--json]`
  Builds an advisor brief with travel opportunities ranked by proximity/status/tier, available favors, pending cooldowns, contact standing, contact-request options, and nearby rulers.

- `scripts/ck3-save-report scout <save.json|manifest.json> [target...] [--json]`
  Builds a strategic scout report for camp movement and next-play decisions: recommendations, POI/fame gates, region/route candidates, ruler scouting, hook guardrails, epidemic risk, and local-board contract choices. Targets can be names, raw IDs, or typed refs such as `province:2575`, `character:33596132`, or `title:12345`.

- `scripts/ck3-save-report screenshots <save.json|manifest.json> [--json]`
  Lists archived Steam screenshots associated with the save window. Reads `state/screenshots/index.json` and, when present, `state/screenshots/analysis.json` for in-game dates and one-line event summaries.

- `scripts/ck3-save-report chronicle <save-or-manifest>... [--json]`
  Renders prose paragraphs across sorted checkpoints with identity, location, camp state, contracts, patron signals, screenshots where relevant, and checkpoint-to-checkpoint deltas.

Shared extraction code lives in `scripts/lib/ck3-save-analysis.mjs`; screenshot helpers live in `scripts/lib/ck3-screenshots.mjs`.

## Source Of Truth Rules

- Treat the live CK3 save directory as source of truth.
- Re-ingest when Cris says a fresh save exists.
- Prefer manifest paths produced by `scripts/ck3-save-ingest`; they preserve source path, mtime, size, parsed save date, JSON path, and played character.
- Do not trust generic stale parse files such as `last_save.json` unless source mtimes were just checked.
- Keep save streams distinct: `last_save.ck3`, `autosave.ck3`, `autosave_1.ck3`, `autosave_2.ck3`, and `autosave_exit.ck3` may be different checkpoints.
- Prefer Rakaly JSON for durable extraction. Use melted text only for spot checks.
- Report uncertainty clearly, especially for completed contracts. CK3 often deletes completed contract objects while preserving counters, hooks, cooldowns, and opinions.
- Do not mix findings from old saves into the save/date Cris names unless he asks for comparison.

## Standard Workflow

1. Discover saves with `scripts/ck3-save-ingest --list`.
2. Ingest the target save, or use `--all` when reconstructing a timeline.
3. Run `snapshot` first to anchor date, played character, location, resources, camp state, and mechanics.
4. Run `patrons` for contract/contact details.
5. Run `brief` when Cris asks what to do next.
6. Run `scout` when Cris asks where to move camp, who to cultivate, whether a region is worthwhile, what to avoid, or how to exploit RtP mechanics strategically.
7. Run `graph` when relationships, title holders, locations, or regional politics matter.
8. Run `diff`, `timeline`, and `chronicle` for campaign reconstruction across checkpoints.
9. Run `screenshots` when screenshots may explain in-game events that saves only partially encode.
10. Use `resolve` whenever raw IDs appear in output or save data.

## Durable Field Map

Played character:
- Resolve via `played_character.character`, then look up the ID in `living`, `characters`, or `dead_unprunable`.

Character basics:
- `first_name`, `nick_name`, `birth`, `culture`, `faith`, `dynasty_house`
- `skill[]` order: diplomacy, martial, stewardship, intrigue, learning, prowess
- `court_data.employer`
- `alive_data.location.location`

Culture and faith:
- Culture names come from `culture_manager.cultures[<culture_id>].name`.
- Faith names/tags come from `religion.faiths[<faith_id>].tag`, with fallback to `faith_type`.

Titles and provinces:
- Save title records live under `landed_titles.landed_titles`.
- Useful fields: `key`, `title_name_data.name`, `holder`, `de_facto_liege`, `capital`, `landless`.
- Province labels are inferred from CK3 landed-title files under `~/.steam/debian-installation/steamapps/common/Crusader Kings III/game/common/landed_titles/`, then enriched with current save title holders.
- Treat unresolved labels honestly; some travel-only or empty shell provinces may only resolve as `province <id>`.

Adventurer/camp state:
- `alive_data.focus`
- `alive_data.perk`
- `alive_data.variables.data[]`
- `alive_data.variables.list[]`
- `alive_data.visited_points_of_interest`
- `landed_data.laws`
- `landed_data.current_strength`, `landed_data.strength`
- `landed_data.power`, `landed_data.max_power`
- `landed_data.balance`
- `landed_data.succession`
- `landed_data.government`
- `landed_data.at_peace_penalty`

Useful counters and variables include `laamp_total_noncrim_contracts_successfully_completed`, `justicar_contracts_succeeded_counter`, `travel_provinces_traversed`, and `poi_visited`. Many CK3 variable identities are fixed-point scaled; first-pass decode is `identity / 100000` when `identity` is a multiple of `100000`.

Entourage/camp followers:
- Find living characters where `court_data.employer == played_character.character`.
- Extract name, age, culture, faith, skills, employer, location, and succession rank if present.

Contracts:
- Primary source: `task_contracts.database`.
- Personal contract inventory heuristic: `contract.owner == played_character.character`.
- Useful fields: `name`, `type`, `status`, `tier`, `location`, `employer`, `target`, `acceptance_date`, `completion_date`, `variables.data[]`.
- Completed contracts may disappear; reconstruct history with adjacent autosaves, counters, opinions, hooks, and cooldowns.

## Roads To Power Landless Mechanics

The analysis must distinguish Roads to Power landless adventurer mechanics from vanilla landed-ruler assumptions.

- `landless_adventurer_government` is a playable unlanded adventurer government with a camp domicile.
- Camp purpose is read from `landed_data.laws`: Wanderers, Mercenaries, Scholars, Explorers, Brigands, and Legitimists.
- Camp purpose notes should cover contract weighting, travel/combat/learning/intrigue modifiers, and unlocked camp buildings/officers where known.
- Camp followers are living characters whose `court_data.employer` is the played character. Their opinion matters for camp temperament, so do not treat them as mere flavor.
- Provisions are camp travel fuel/resource semantics, not ordinary landed supply.
- Surface influence when present, but do not apply it to base Roads to Power contact requests unless the specific interaction supports it. Base `contact_list_request_interaction` does not spend influence.

## Contact Favor Semantics

Do not interpret `contact_list_weak_hook` as an ordinary weak hook in Roads to Power landless-adventurer analysis. It is the "Excelled at Contract" contact favor created by completing contracts and used by Make a Request.

Relation-slot rules:
- `active_hook_N` with `contact_list_weak_hook`: side `N` holds an available Make a Request contact favor on the other side.
- `cooldown_against_recipient_N` with `contact_list_request_interaction`: side `N` already made a request against the other side and is on cooldown.
- `laamp_used_contact_opinion` and `laamp_used_contact_opinion_special`: evidence that a contact request was spent, separate from normal contract standing.

Known Make a Request options:
- Provisions: special used-contact opinion, usually `-20`.
- Gold: used-contact opinion, usually `-40`, requires recipient gold.
- Men-at-arms regiment: used-contact opinion, usually `-40`, requires an open adventurer MAA slot and valid recipient regiment.
- Rent a knight: used-contact opinion, usually `-30`, requires recipient to have spare unlanded knights.
- Arrange a marriage: used-contact opinion, usually `-50`, requires a valid cross-court marriage.
- New task contract: used-contact opinion, usually `-5`, requires a valid contract type and no conflicting existing contract from that recipient.
- Host a feast: used-contact opinion, usually `-30`, requires `inspiring_rule_perk` and a valid recipient.
- Host a tournament: special used-contact opinion, usually `-50`, requires `stalwart_leader_perk` and Tours & Tournaments support.

Availability is guidance, not absolute truth, because some options depend on volatile UI/game-state checks such as free men-at-arms slots, valid marriage candidates, recipient war state, available knights, existing contracts from that recipient, or DLC feature gates.

Keep ordinary hooks separate. `house_head_hook`, claim hooks, blackmail hooks, and ordinary weak hooks are not RtP contact favors unless local game files prove a specific mapping.

## Graph And Brief Rules

Graph edge kinds:
- `located at`: person -> place
- `employs`: player -> entourage member
- `contract employer`: player -> contract giver
- `contract at`: player -> contract location
- `contract target`: player -> target character
- `patron contact`: player <-> patron/contact relation
- `hook available`: hook holder -> hook target, from `active_hook_N`
- `contact used`: actor -> target, from `cooldown_against_recipient_N`
- `succeeded contract opinion`, `failed contract opinion`, `used contact opinion`: modifier source -> target
- `title holder`: person -> place for title layers governing that province
- `liege`: person -> person; `de_facto_liege` on landed titles is a title ID, so resolve through the liege title's holder and skip self-loops.

Advisor brief proximity ranking:
- Check shared title layer in order: barony, county, duchy, kingdom, then far.
- Rank by contract status first, then proximity, then tier descending.
- Include available favors, pending cooldowns, contact standing, contact request options, and nearby rulers.

Scout rules:
- Treat `brief` as the local tactical layer and `scout` as the strategic movement layer.
- Lead with recommendations, then evidence.
- Keep current contracts framed as a local board that camp relocation can reroll.
- Rank regions/routes by POIs, special buildings, ruler surface, disease status, and current campaign gates.
- Rank rulers by wealth/income, title tier, war state, opinion scars, ordinary hooks, and contact-favor mechanics.
- Keep ordinary hooks such as `house_head_hook`, claim hooks, and blackmail hooks separate from RtP contact favors unless local game files prove otherwise.
- Report disease and war state as best-effort save interpretations, not perfect live-UI truth.

## Screenshots

There is also a separate `ck3-save-analysis-screenshots` skill for the screenshot evidence layer. For normal CK3 analysis, still use the implemented commands:

- `scripts/ck3-save-ingest --list-screenshots`
- `scripts/ck3-save-ingest --screenshots-sync`
- `scripts/ck3-save-report screenshots <save-or-manifest> [--json]`

`state/screenshots/analysis.json` can hold LLM-extracted in-game dates, event summaries, player, location, and keywords. The screenshots report uses game-time windows when this data exists and falls back to wall-clock association otherwise.

## Known Proven Cases

Nino 871.11.10:
- Nino is `landless_adventurer_government` with `camp_purpose_explorers`.
- Gregorios has an available `contact_list_weak_hook` favor expiring 873.11.28.
- Martino has a spent Make a Request cooldown until 872.5.18.
- Martino's `laamp_used_contact_opinion -40` likely means Gold or Men-at-arms, not generic negative standing.
- The graph emitted 18 people, 6 places, and 54 edges.
- The brief found 4 travel opportunities, 1 available favor, 1 pending cooldown, and nearby holders for Turin/Italy.

Screenshot layer:
- Existing analysis covers 13 screenshots from Cris's campaign.
- The 867.1.1 pre-campaign screenshot confirms contact-favor use against Bishop Fosco.
- 874.2.5 through 874.3.17 screenshots trace a Benedictus-hosted tournament and match the `Host a tournament` contact cost.

## Not Yet Implemented

Useful future work:
- build a mechanics registry from installed CK3 files
- add artifact/inventory extraction
- add army/men-at-arms extraction
- add graph diffs across checkpoints
- automate save watching during live play

## Validation

When changing CK3 tooling, run the relevant syntax checks:

```bash
node --check scripts/lib/ck3-save-analysis.mjs
node --check scripts/lib/ck3-screenshots.mjs
node --check scripts/ck3-save-ingest
node --check scripts/ck3-save-report
```

Then run at least one representative report against a known manifest before trusting the output.
