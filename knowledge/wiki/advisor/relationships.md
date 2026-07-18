---
pageType: advisor_model
status: maintained
advisorDomains:
  - relations
  - hooks
  - schemes
  - secrets
mechanicsConceptIds:
  - "mechanics_concept:hooks"
  - "mechanics_concept:schemes"
  - "mechanics_concept:characters"
graphIds:
  - "collection:ge914585211dda114"
  - "collection:g992f20c0c9065612"
  - "collection:g0fc358f213fb4bb2"
  - "collection:g672018fd1f9cfd52"
  - "collection:g45854aeddf66e231"
sourceIds:
  - "source:ck3-paradoxwikis-com:hooks"
  - "source:ck3-paradoxwikis-com:schemes"
  - "source:ck3-paradoxwikis-com:character"
---

# Hooks, Schemes, Secrets, And Relations

Use this model for leverage, favors, plots, social risk, diplomacy, blackmail, opinion, patrons, and contact requests.

## Mechanics Context

CK3 social advice depends on both relation state and the mechanics of hooks, schemes, secrets, and opinion. Sources include `source:ck3-paradoxwikis-com:hooks`, `source:ck3-paradoxwikis-com:schemes`, and `source:ck3-paradoxwikis-com:character`.

## Save Evidence To Inspect

- Active relations: `collection:ge914585211dda114`.
- Active opinions: `collection:g992f20c0c9065612`.
- Character schemes and global active schemes: `collection:g0fc358f213fb4bb2` and `collection:g672018fd1f9cfd52`.
- Secrets: inspect the secrets collection claim and related graph nodes before naming specific semantics.

## Advisor Inspection

1. Identify relevant people first: contacts, employer, contract targets, patrons, liege, spouse/family, enemies, nearby rulers.
2. Inspect hooks/favors, cooldowns, opinions, schemes, and secrets only for those relevant people.
3. Preserve directionality. A hook held by the player is an opportunity; a hook held against the player is risk.
4. For Roads to Power play, combine contact favors with request options before recommending ordinary diplomacy.

## Advice Pattern

Social advice should separate "leverage you hold", "pressure against you", "people worth cultivating", and "relationships that block the plan."
