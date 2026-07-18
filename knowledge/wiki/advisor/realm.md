---
pageType: advisor_model
status: maintained
advisorDomains:
  - realm
  - titles
  - provinces
  - government
mechanicsConceptIds:
  - "mechanics_concept:titles"
  - "mechanics_concept:county"
  - "mechanics_concept:barony"
  - "mechanics_concept:government"
  - "mechanics_concept:council"
graphIds:
  - "collection:g1eb542543e10c303"
  - "collection:gbf5a9cdb248cfd31"
  - "collection:g15c6a5e225cc8c66"
  - "collection:ga4a556ad6c1ce1ec"
  - "collection:g5f0fb76735814b13"
sourceIds:
  - "source:ck3-paradoxwikis-com:titles"
  - "source:ck3-paradoxwikis-com:county"
  - "source:ck3-paradoxwikis-com:barony"
  - "source:ck3-paradoxwikis-com:government"
  - "source:ck3-paradoxwikis-com:council"
---

# Realm, Titles, Provinces, And Governance

Use this model when the user asks about land, rulers, vassals, counties, development, succession, council tasks, contracts with rulers, or the political map.

## Mechanics Context

Title and province mechanics explain who controls land, who can be targeted, where travel matters, and what realm obligations or opportunities exist. Relevant sources are `source:ck3-paradoxwikis-com:titles`, `source:ck3-paradoxwikis-com:county`, `source:ck3-paradoxwikis-com:barony`, `source:ck3-paradoxwikis-com:government`, and `source:ck3-paradoxwikis-com:council`.

## Save Evidence To Inspect

- Landed title de jure relationships: `collection:g1eb542543e10c303`.
- Province records: `collection:gbf5a9cdb248cfd31`.
- Character council and council-task surfaces: `collection:g15c6a5e225cc8c66` and `collection:ga4a556ad6c1ce1ec`.
- Vassal contract database: `collection:g5f0fb76735814b13`.

## Advisor Inspection

1. Resolve the played character's current province, local title holders, liege chain, primary title, and government.
2. If landed, inspect domain, vassals, succession, council, and obligations.
3. If landless, inspect nearby landed rulers as patrons, contract sources, travel targets, or future claim targets.
4. Distinguish de jure structure from current control when advising on conquest, travel, contracts, or succession.

## Advice Pattern

Good realm advice should say which geography matters, which ruler relationship matters, and whether the evidence is about current control, de jure title structure, government, or council state.
