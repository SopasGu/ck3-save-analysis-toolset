---
pageType: advisor_model
status: maintained
advisorDomains:
  - characters
  - resources
  - traits
  - lifestyle
mechanicsConceptIds:
  - "mechanics_concept:characters"
  - "mechanics_concept:attributes"
  - "mechanics_concept:resources"
  - "mechanics_concept:traits"
  - "mechanics_concept:lifestyle"
graphIds:
  - "collection:g1b7e2934a2c7a89f"
  - "collection:g401e1b10d469561d"
  - "collection:g883bbfa76e3559f5"
  - "collection:ge3d412e2bdd88cd0"
  - "field:g9268f10c9d4f0fde"
  - "field:g026f14b3e3bd0eed"
  - "field:g3816e88418c607d5"
sourceIds:
  - "source:ck3-paradoxwikis-com:character"
  - "source:ck3-paradoxwikis-com:attributes"
  - "source:ck3-paradoxwikis-com:resources"
  - "source:ck3-paradoxwikis-com:traits"
  - "source:ck3-paradoxwikis-com:lifestyle"
---

# Characters And Player State

Use this model when the user asks "how am I doing?", "what should I do next?", "what is my ruler good at?", or anything that depends on the played character's personal state.

## Mechanics Context

CK3 character advice is centered on the ruler's skills, traits, resources, lifestyle, location, court/employer state, and status as landed or adventurer. Relevant mechanics sources are `source:ck3-paradoxwikis-com:character`, `source:ck3-paradoxwikis-com:attributes`, `source:ck3-paradoxwikis-com:resources`, `source:ck3-paradoxwikis-com:traits`, and `source:ck3-paradoxwikis-com:lifestyle`.

## Save Evidence To Inspect

- Played character identity from existing report logic: `getPlayedCharacterId(save)`.
- Character record collections: `collection:g1b7e2934a2c7a89f` and `collection:g401e1b10d469561d` for dead collections, plus the living character collection claim in `knowledge/claims/claims.json`.
- Skill array: `collection:g883bbfa76e3559f5`.
- Trait array: `collection:ge3d412e2bdd88cd0`.
- Gold field: `field:g9268f10c9d4f0fde`.
- Prestige and piety fields: `field:g026f14b3e3bd0eed` and `field:g3816e88418c607d5`.

## Advisor Inspection

1. Resolve the played character and summarize age, skills, traits, location, culture, faith, court/employer, government, resources, and primary title.
2. Compare the character's best skills and trait pressures against available actions, contracts, council work, schemes, wars, and travel choices.
3. Treat missing fields as evidence: absence of landed data, court data, contacts, or domain can be strategically meaningful.
4. If the question is strategic, produce "what matters now" before listing raw facts.

## Advice Pattern

Prefer advice shaped like:

- "Your strongest current lever is..."
- "The save evidence for that is..."
- "The CK3 mechanic that makes it matter is..."
- "The next thing I would inspect is..."

Do not answer from character mechanics alone. Current-save facts must be cited from ephemeral analysis output or exact graph/report paths.
