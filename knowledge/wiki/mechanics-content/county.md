---
pageType: mechanics_content
title: "County"
topicGroup: "realm"
sourceId: "source:ck3-paradoxwikis-com:county"
sourceRevisionId: 34989
sourceOldidUrl: "https://ck3.paradoxwikis.com/County?oldid=34989"
license: "CC BY-SA 3.0"
generatedAt: "2026-07-18T07:02:11.038Z"
contentHash: "4b7be14f2160a86b6ed496a1a1b4b8c632718957b8fc981733e6c4fbe2d29c55"
---

# County

## Source And Attribution

- Source: `source:ck3-paradoxwikis-com:county`
- Revision: <https://ck3.paradoxwikis.com/County?oldid=34989>
- License: Creative Commons Attribution-ShareAlike 3.0 (`https://creativecommons.org/licenses/by-sa/3.0/`)
- Scope: official CK3 Wiki mechanics documentation; all DLC is assumed active for this project unless a cited source says otherwise.
- Content basis: bounded section notes derived from revision-pinned wiki text. This page is not a full copy of the source article.

## Advisor Use

Use this page when a question needs CK3 mechanics context for County. Combine these mechanics notes with current-save evidence paths and advisor models before giving player advice.

## Mechanics Notes

### Overview

- A Count is a character who controls at least one County. It is the second title rank available and the lowest rank that is playable. On the map, the territory of a county will contain multiple Baronies and cannot be altered. Each county belongs to a de jure Duchy, which also cannot be changed.

### Popular opinion

- Popular Opinion represents the sentiment of the populace towards the county's direct owner. If Popular Opinion is negative, Populist or Peasant Factions can form in the County. Each county has a culture and faith. If the ruler who owns the county title has a different faith, it will lose up to -45 Popular Opinion depending on faith hostility and the county's faith's Fervor.

### Control

- Control represents the power a landed Count has over their County and ranges from 0 to 100. It can be decreased from events, baronies being captured in sieges (unless title holder has Enduring Hardships perk), or being forcefully seized (-75). Control increases at a rate of 0.1 per month and can be increased faster with the Increase Control in County councilor task.
- If the title holder has the Absolute Control perk when Control is 100 it will read as Absolute and the county will provide an additional +10% gold Taxes and +5% Levies.

### Development

- Development is the measurement of technological advancement and general infrastructure in a county and ranges from 0 to 100. Each point of development increases a county's Supply limit by +150. The average development of counties following a culture will affect that culture's adoption rate of innovations by 0.02 per average level.

### Development growth

- Increasing county development by 1 requires accumulating 100 development growth. Development radiates outwards from high-development counties to all other counties connected by a land route at 0.1 per difference in development level between these two counties. Development growth can be most significantly increased via the steward's development Increase Development in County task in the council.
- ( 0.1 + 0.175 * stewardship Councilor stewardship ) * (1 - existing development penalty)
- existing development penalty is capped at 87.5%:
- existing development penalty = min( 0.875, development/100 * 9.13 * Innovation development )
- Innovation development applies only if your steward's culture knows the following civic innovations:

### Corruption

- Corruption includes various negative modifiers that can appear for 10 years in a County if Control falls below 35% or the title holder is in Debt for more than 3 months. They can also be added for 5 years by the Collect Taxes councilor action if the Steward has low skill (Stewardship). A county can have up to 3 Corruption modifiers at the same time.

### Fomented Revolts

- Fomented Revolts is a form of corruption that can only be created by characters who have a Yamen Grievance Drum estate upgrade at level 3 or 4. They come in 3 levels of severity depending on how much the character who uses the interaction pays.

### Siberian permafrost

- Counties in the region of Siberia are affected by Siberian Permafrost, which affects the county differently depending on where its owner's culture has the Tribes of the North tradition. Feudalizing the county's holding costs 2500 Gold but removes the permafrost.

## Related Wiki Topics

- [[mechanics-content/activity|Activity]]
- [[mechanics-content/adventurer|Adventurer]]
- [[mechanics-content/alliance|Alliance]]
- [[mechanics-content/army|Army]]
- [[mechanics-content/artifacts|Artifacts]]
- [[mechanics-content/attributes|Attributes]]
- [[mechanics-content/barony|Barony]]
- [[mechanics-content/building|Building]]
- [[mechanics-content/casus-belli|Casus belli]]
- [[mechanics-content/council|Council]]
- [[mechanics-content/court|Court]]
- [[mechanics-content/culture|Culture]]
- [[mechanics-content/decisions|Decisions]]
- [[mechanics-content/doctrines|Doctrines]]
- [[mechanics-content/domicile|Domicile]]
- [[mechanics-content/duel|Duel]]
- [[mechanics-content/dynasty|Dynasty]]
- [[mechanics-content/faith|Faith]]
- [[mechanics-content/game-rules|Game rules]]
- [[mechanics-content/government|Government]]

## Machine Reference

- Mechanics content slug: `county`
- Source title: `County`
- Source page length: `11309`
