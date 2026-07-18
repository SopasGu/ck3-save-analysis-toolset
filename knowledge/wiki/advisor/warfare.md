---
pageType: advisor_model
status: maintained
advisorDomains:
  - warfare
  - armies
  - knights
  - alliances
mechanicsConceptIds:
  - "mechanics_concept:warfare"
  - "mechanics_concept:army"
  - "mechanics_concept:knight"
  - "mechanics_concept:alliance"
  - "mechanics_concept:casus-belli"
graphIds:
  - "collection:g24d7ea65028c2ca9"
  - "identity_domain:g00367af9447cb1ac"
  - "collection:g35d3325a1d2d17d1"
  - "collection:g7107e3a0e1d83801"
sourceIds:
  - "source:ck3-paradoxwikis-com:warfare"
  - "source:ck3-paradoxwikis-com:army"
  - "source:ck3-paradoxwikis-com:knight"
  - "source:ck3-paradoxwikis-com:alliance"
  - "source:ck3-paradoxwikis-com:casus-belli"
---

# Warfare And Armies

Use this model for war readiness, raids or contracts with military risk, men-at-arms, knights, alliances, casus belli, and whether a fight is worth taking.

## Mechanics Context

Warfare advice needs both the current save's military state and CK3 mechanics context around armies, knights, alliances, and casus belli. Relevant sources are `source:ck3-paradoxwikis-com:warfare`, `source:ck3-paradoxwikis-com:army`, `source:ck3-paradoxwikis-com:knight`, `source:ck3-paradoxwikis-com:alliance`, and `source:ck3-paradoxwikis-com:casus-belli`.

## Save Evidence To Inspect

- Army regiment collection and regiment identity domain: `collection:g24d7ea65028c2ca9` and `identity_domain:g00367af9447cb1ac`.
- Active wars: `collection:g35d3325a1d2d17d1`.
- Battle results: `collection:g7107e3a0e1d83801`.

## Advisor Inspection

1. Identify whether the player is currently at war, likely to be pulled into war, or merely evaluating opportunity/risk.
2. Inspect armies, regiments, knights, allies, location, and nearby hostile or contract-relevant rulers.
3. For landless play, account for camp purpose, men-at-arms cap, available contact requests, and travel risk before recommending combat.
4. Explain confidence: structural evidence can reveal saved military state, but strategic evaluation may need game rules, terrain, commander quality, and enemy context.

## Advice Pattern

Give a fight/no-fight recommendation only after grounding the answer in current forces, allies/enemies, location, and the relevant mechanics. Otherwise say what needs to be inspected next.
