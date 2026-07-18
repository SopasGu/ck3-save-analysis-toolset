---
pageType: advisor_model
status: maintained
advisorDomains:
  - adventurer
  - contracts
  - travel
  - domicile
mechanicsConceptIds:
  - "mechanics_concept:adventurer"
  - "mechanics_concept:travel"
  - "mechanics_concept:domicile"
  - "mechanics_concept:resources"
graphIds:
  - "collection:gf5d515bd13c321ba"
  - "identity_domain:gcbc3edffb75941b8"
  - "collection:g93d886ec2615642c"
  - "collection:g392d548ae4f1bfb4"
  - "collection:g67c3d1c1e6512def"
sourceIds:
  - "source:ck3-paradoxwikis-com:adventurer"
  - "source:ck3-paradoxwikis-com:travel"
  - "source:ck3-paradoxwikis-com:domicile"
  - "source:ck3-paradoxwikis-com:resources"
---

# Adventurer Camp And Contracts

Use this model for Roads to Power landless play, task contracts, contact favors, camp movement, points of interest, provisions, and domicile/camp upgrades.

## Mechanics Context

The project already has high-value local mechanics for landless play in `scripts/lib/ck3-save-analysis.mjs`: camp purposes, task contract scouting, contact favors, request options, cooldowns, and nearby-ruler context. Those rules should become consumers of the durable graph, not the source of graph truth.

Mechanics sources include `source:ck3-paradoxwikis-com:adventurer`, `source:ck3-paradoxwikis-com:travel`, `source:ck3-paradoxwikis-com:domicile`, and `source:ck3-paradoxwikis-com:resources`.

## Save Evidence To Inspect

- Task contract database: `collection:gf5d515bd13c321ba`.
- Task contract identity domain: `identity_domain:gcbc3edffb75941b8`.
- Playable contacts: `collection:g93d886ec2615642c`.
- Domicile database: `collection:g392d548ae4f1bfb4`.
- Province points of interest: `collection:g67c3d1c1e6512def`.

## Advisor Inspection

1. Run or reproduce the `brief` and `scout` report views for the current save.
2. Rank contracts by availability, distance from current location, likely skill fit, and reward/strategic value.
3. Inspect contact favors and cooldowns before recommending travel, because a strong contact request can dominate ordinary contract value.
4. If the player is trying to become a great explorer, inspect points of interest and travel routes before local optimization.

## Advice Pattern

Explain the camp plan as a route: where to go, what contract/contact to prioritize, what resource bottleneck to watch, and what should be rechecked after moving.
