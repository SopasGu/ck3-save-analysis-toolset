---
pageType: mechanics_content
title: "Army"
topicGroup: "warfare"
sourceId: "source:ck3-paradoxwikis-com:army"
sourceRevisionId: 35041
sourceOldidUrl: "https://ck3.paradoxwikis.com/Army?oldid=35041"
license: "CC BY-SA 3.0"
generatedAt: "2026-07-18T07:20:18.943Z"
contentHash: "05d23cf53a9a96469a2c03da9104606fbf9556621ae413415dcdf1c37579815e"
---

# Army

## Source And Attribution

- Source: `source:ck3-paradoxwikis-com:army`
- Revision: <https://ck3.paradoxwikis.com/Army?oldid=35041>
- License: Creative Commons Attribution-ShareAlike 3.0 (`https://creativecommons.org/licenses/by-sa/3.0/`)
- Scope: official CK3 Wiki mechanics documentation; all DLC is assumed active for this project unless a cited source says otherwise.
- Content basis: bounded section notes derived from revision-pinned wiki text. This page is not a full copy of the source article.

## Advisor Use

Use this page when a question needs CK3 mechanics context for Army. Combine these mechanics notes with current-save evidence paths and advisor models before giving player advice.

## Mechanics Notes

### Overview

- An army is a large group of soldiers that can be controlled to attack other armies or siege a [[mechanics-content/barony|holding]] during [[mechanics-content/warfare|wars]]. Hovering over an allied army will display its current orders. Armies can be automated in the Military tab, which will cause them to be controlled by the AI.

### Stats

- Damage: Each point causes 0.03 damage during the battle phase.
- Toughness: Reduces losses caused by damage (both routed and killed). Each point allows taking 1 damage before losing all strength.
- Pursuit: Each point causes 0.17 damage during the retreat phase.
- Screen: Each point blocks 0.33 damage during the retreat phase.
- levies Strength: Represents how many soldiers are in the unit and affects the total amount of stats. Heavy cavalry and asawira have 50 soldiers; elephant cavalry have 25 soldiers; siege weapons have 10 soldiers; all other [[mechanics-content/army#men-at-arms|men-at-arms]] have 100 soldiers. The number of soldiers for levies is their total amount. Men-at-arms can have their size increased for the same cost as recruiting them.

### Damage dealing

- The entire army's Damage is taken into account (which can be modified by Terrain, counters, etc), and then modified by a further +5% per Advantage for the side with more Advantage (this damage bonus per Advantage can be changed with a [[mechanics-content/game-rules|game rules]] setting). This is then modified by the Terrain width which is ((Enemy + Ally) Strength x (0.5 x Terrain width)).

### Rallying and Disbanding Armies

- To raise an army, you must raise them at a "Rally Point". There is always one by default at the capital holding, but additional ones can be added at other [[mechanics-content/barony|holdings]] under your realm to a maximum of ten. You can't raise armies where enemy armies are present. You also cannot disband armies when enemy armies are nearby (this generally means 1 [[mechanics-content/county|county]] or an adjacent seazone away). The army composition will be made up of:
- Levies from each of your vassal that contributes
- They can be divided and regrouped in different ways as you see fit by manually selecting the army and clicking on "Split Off New Army". "Split in Half" also allows to cut armies in roughly half proportions for convenience. You can also "Split off Hired or Special Soldiers" if you have any Mercenaries or Special Soldiers and use them for other purposes.

### Reinforcing Armies

- Armies must be within friendly territory or disbanded to be reinforced; they will reinforce at the start of each month (although there appears to be a rather complex bug that forbids armies from reinforcing if they leave friendly territory and/or battle; disbanding armies should solve this issue).

### Quality

- Based on its composition an army will be shown having a certain quality. This is a rough measure that allows player to see how skilled an army is, and will also determine the appearance of the army. For instance, an army composed entirely of levies would have the lowest quality, with the "army character" shown with peasant clothing.

### Commander

- Each army can have one Commander: a character who commands the army and uses their [[mechanics-content/attributes|Martial]] skill to improve an army's Advantage. There are many different [[mechanics-content/traits|Commander traits]] available, which have a direct effect on battles and/or give the Commander bonuses outside of battles. A commander can be any Vassal (unless they are in a civil [[mechanics-content/warfare|war]]) or Courtier who is allowed to be so by Martial Custom.

### Knights

- [[mechanics-content/knight|Knights]] are "elites" that fight in an army; unlike other fighters, they are Characters assigned to combat.

### Basic soldiers

- Basic soldiers are conscripted peasants with limited training that make up the bulk of armies. They are not very impressive on their own, but they are cheap, requiring no cost to maintain or reinforce, and are used in great numbers to complement more important troops and outnumber defenders in a siege or raid.
- Levies are used by all [[mechanics-content/government|governments]] except Nomadic and [[mechanics-content/adventurer|Adventurer]]. Their numbers are determined by the [[mechanics-content/barony|holdings]] of the ruler's domain, as well as any that are given by their vassals and Realm Priest. A Levy has 10 Damage and 10 Toughness and a monthly cost of 3 [[mechanics-content/resources|Gold]] per 1,000 when raised. Levies don't tend to increase much in stats with Eras and are fairly static.
- Horde Riders are used by Nomadic [[mechanics-content/government|governments]]. The base rate of Horde Riders conversion is 15% of a Ruler's [[mechanics-content/resources|Herd]], which consumes the equivalent amount of Herd, but this can be increased by various factors. Herd can also be converted into [[mechanics-content/army#men-at-arms|men-at-arms regiments]]. If the government switches to something else, the Horde Riders will become special soldiers.

### Men-at-Arms

- [[mechanics-content/army#men-at-arms|Men-at-Arms]] are trained troops that come in several different Regiment types which excel in their given role, all with their own stats and uses. Each type of Men-at-Arms will counter at least one other type, reducing their Damage proportional to the size difference of the countering Men-at-Arms (-45% in 1:1, a max of -90% in 2:1, in certain cases can have effectiveness modified as 2x or 0.

### Regular

- Regular [[mechanics-content/army#men-at-arms|Men-at-Arms]] are available to all [[mechanics-content/culture|cultures]] as long as the other requirements are met.

### Traditional

- Traditional [[mechanics-content/army#men-at-arms|Men-at-Arms]] are available through [[mechanics-content/traditions|traditions]] and reaching a certain era. [[mechanics-content/adventurer|Adventurers]] with the Take the Custom Where it Comes can also recruit them if the [[mechanics-content/culture|culture]] of the [[mechanics-content/county|county]] where the camp is located can.

### Regional

- Regional [[mechanics-content/army#men-at-arms|Men-at-Arms]] are made available through regional [[mechanics-content/innovation|innovations]].

### Cultural

- Cultural [[mechanics-content/army#men-at-arms|Men-at-Arms]] require [[mechanics-content/innovation|innovations]] only available to certain [[mechanics-content/culture|cultures]], except Teulu, which is completely dependent on culture. [[mechanics-content/adventurer|Adventurers]] with the Take the Custom Where it Comes perk can also recruit them if the culture of the [[mechanics-content/county|county]] where the camp is located can.

### Dynastic

- Dynastic [[mechanics-content/army#men-at-arms|Men-at-Arms]] are only available to rulers whose [[mechanics-content/dynasty|dynasty]] has certain legacies.

### Siege weapons

- Siege weapons are regiments that cannot fight in battle, but will greatly increase Siege Progress when attacking [[mechanics-content/barony|holdings]]. Note that the Daily Siege Progress refers to the total effect of one regiment size and will be increased if the regiment increases in size and decreased if the regiment is damaged. There are two sets of siege weapons depending on the [[mechanics-content/culture|culture]]'s heritage but the stats are identical.

### Retinue

- Retinue [[mechanics-content/army#men-at-arms|Men-at-Arms]] are only available to rulers who have a certain [[mechanics-content/knight#accolades|Accolade]] at rank 3-6. They are twice as effective at countering other Men-at-Arms and their stats scale with the era of their ruler's [[mechanics-content/culture|culture]].

### Outcasts

- Outcasts [[mechanics-content/army#men-at-arms|Men-at-Arms]] are spawned for [[mechanics-content/adventurer|adventurers]] who take the Levy the Outcasts [[mechanics-content/decisions|decision]] or complete a criminal [[mechanics-content/adventurer#contracts|contract]] after taking the decision. They are lost upon succession.

## Related Wiki Topics

- [[mechanics-content/activity|Activity]]
- [[mechanics-content/adventurer|Adventurer]]
- [[mechanics-content/alliance|Alliance]]
- [[mechanics-content/artifacts|Artifacts]]
- [[mechanics-content/attributes|Attributes]]
- [[mechanics-content/barony|Barony]]
- [[mechanics-content/casus-belli|Casus belli]]
- [[mechanics-content/characters|Characters]]
- [[mechanics-content/council|Council]]
- [[mechanics-content/county|County]]
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

- Mechanics content slug: `army`
- Source title: `Army`
- Source page length: `86621`
