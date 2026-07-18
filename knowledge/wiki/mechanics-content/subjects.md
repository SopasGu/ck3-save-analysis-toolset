---
pageType: mechanics_content
title: "Subjects"
topicGroup: "realm"
sourceId: "source:ck3-paradoxwikis-com:subjects"
sourceRevisionId: 35050
sourceOldidUrl: "https://ck3.paradoxwikis.com/Subjects?oldid=35050"
license: "CC BY-SA 3.0"
generatedAt: "2026-07-18T07:02:11.038Z"
contentHash: "396393dc8caa650f6158303aadb72df06b3f0e3b3073afd3bfb90f2a42d3c1b6"
---

# Subjects

## Source And Attribution

- Source: `source:ck3-paradoxwikis-com:subjects`
- Revision: <https://ck3.paradoxwikis.com/Subjects?oldid=35050>
- License: Creative Commons Attribution-ShareAlike 3.0 (`https://creativecommons.org/licenses/by-sa/3.0/`)
- Scope: official CK3 Wiki mechanics documentation; all DLC is assumed active for this project unless a cited source says otherwise.
- Content basis: bounded section notes derived from revision-pinned wiki text. This page is not a full copy of the source article.

## Advisor Use

Use this page when a question needs CK3 mechanics context for Subjects. Combine these mechanics notes with current-save evidence paths and advisor models before giving player advice.

## Mechanics Notes

### Overview

- A subject is a ruler who submits to a more powerful ruler, providing them with resources in exchange for not being attacked and, in some cases, military protection from other threats. There are three kinds of subjects: vassals, tributaries, and lessees.
- There is no reduction if the ruler owns the title 1 rank above the subject (i.e. the Kingdom title a Duchy vassal is de jure part of)
- There is a 25% reduction if the ruler only owns a title 2 ranks above the subject (i.e. the Kingdom title a Count vassal is de jure part of)
- There is a 50% reduction if the ruler does not own any title that the vassal's primary title is de jure part of
- If the liege or suzerain's government uses Treasury the subject's tax income will be added as Treasury instead of Gold.

### Vassals

- A vassal is a subject who surrenders its sovereignty to a ruler with a higher title rank, called their liege. A vassal will join all its liege's wars (unless they're fighting against them in a civil war), but is not obligated to actively participate in the wars and will generally not do so.
- governor efficiency Administrative, Celestial, Meritocratic, Meritocratic Khanate and Ritsuryō vassals provide taxes and levies based on their governor efficiency.
- Feudal and Sōryō vassals provide taxes and levies based on their vassal contracts.
- Tribal and Wanua vassals provide taxes and levies based on the liege's level of fame, with minimum amounts determined by tribal authority. For details, see Fame.
- Clan vassals provide taxes and levies based on their opinion towards their liege, with minimum amounts determined by crown authority. If the liege has the same government the vassal will have to be assigned to a Tax Jurisdiction to provide taxes and levies.

### Vassal limit

- Every ruler has a Vassal Limit. Each vassal above the Vassal Limit reduces the gold Taxes and Levies of all vassals by -5%, up to a maximum penalty of -95%. Baron vassals do not count towards the Vassal Limit. For most governments the vassal limit is decided by the title rank but there are a few exceptions:
- For governor efficiency Administrative rulers the Vassal Limit is decided by the title rank and the level of authority law
- For Nomadic rulers the Vassal Limit is decided by the Dominance law
- For Mandala rulers the Vassal Limit is decided by the Level of Devotion and the level of their Capital Temple Complex building
- For Wanua rulers the Vassal Limit is increased by building tribe buildings

### Vassal directives

- Vassals can be given a directive either by interacting with them or from the Vassals tab. Directives can be used to influence what kind of buildings a vassal will construct in its sub-realm or make them convert the sub-realm's faith or culture. Vassals can only be given a directive if one of the following requirements are met and will stop following the directive if none of the requirements are met.
- node martial Absolute Control or node stewardship Honored to Serve perk
- Both the liege and the vassal have governor efficiency Administrative, Celestial, Meritocratic, Meritocratic Khanate or Ritsuryō government

### Powerful vassals

- In each realm, vassals with the income of Gold and Levies are designated as powerful vassals, who expect to be part of the liege's council and will have -40 opinion of their liege if they're not. The number of powerful vassals a liege will have depends on the rank of their primary title:
- In elective succession types, powerful vassals have more votes than regular vassals. They're also much harder to use the sway scheme on. In order for the succession law of a realm to be changed, all powerful vassals must either have positive opinion of the liege, be terrified or be imprisoned.

### Vassal stances

- Each vassal has a Vassal Stance, which is primarily determined by their AI personality. The Vassal Stance determines which of their liege's actions they will like and/or dislike, as well as which of their liege's heirs they prefer, according to the gender succession law of the realm. If the heir preferred by the vassal is the Primary Heir of their liege, they will gain a temporary +30 Opinion upon succession.

### Vassal contracts

- All Feudal, Clan, Nomadic and Sōryō vassals have a vassal contract with their liege, which determines their obligations as well as whether they have special rights. The contract can only be changed once per lifetime of either liege or vassal and this limit is shared between the liege and the vassal. Up to 4 things can be changed at once in a vassal contract.

### Rights

- Rights grant a vassal vassal permissions that vassals do not have by default. When changing the contract, a score is calculated for how desirable the previous and new setup of the contract are to the vassal, including all rights and obligations. For every point the score of the new total contract is lower than it was, the liege suffers 20 tyranny.

### Special contract

- Special contracts require a certain innovation and grant additional bonuses to the vassal. March is only available if the vassal borders another realm.

### Obligations

- All Feudal, Nomadic and Sōryō vassals have Obligations included into their vassal contract, which can only be changed one step at a time. Obligations can be lowered at any time, but raising them will add +20 tyranny opinion (doubled for raising taxes from Normal to High) unless the liege lowers the other obligation or provides the vassal a right. The liege can also use a hook on the vassal to avoid tyranny.

### Base obligations

- Vassals with Clan government do not have obligations and must be assigned to Tax Jurisdictions instead.

### Factions

- Factions are organized groups that are united against their liege for a common purpose. As long as their issue isn't resolved, they will keep growing until they will be large enough to deliver an ultimatum to the liege. Faction members unlock an interaction with all characters to force them to join the faction for 10 years if they have a Strong Hook on them or 500 Influence. All factions have two important values:
- Military Power is the ratio between the combined military strength of all faction members and the military strength of the liege. When the ratio is above 80% the Faction will gain discontent and when the ratio is below 80%, the faction will lose discontent.
- Discontent is a measure of how close the faction is to sending their ultimatum. How fast Discontent increases or falls depends on how far above or below the Military Power threshold the faction is.
- A faction will deliver its ultimatum shortly after discontent reaches 100%. It can also send the ultimatum early if the liege unjustly imprisons someone. Player-led factions can send the ultimatum at any time. If the ultimatum is accepted, the liege will lose -20 Dread and Legitimacy. If it is refused, it will start a civil war.

### Civil wars

- If a faction's ultimatum is refused, it will start a Civil War. During a Civil War, faction members stop providing taxes and levies to the liege and their liege loses access to certain powers such as imprisonment. All faction members will turn hostile to both the liege and all vassals that did not join the faction, though they will focus on fighting the liege.
- If the war ends in white peace, the liege will gain an imprisonment reason against all faction members.
- If the war is won by the faction, they will enforce the faction's ultimatum.
- If the war is won by the liege, all faction members are imprisoned and the liege gains +20 Dread. If the faction was caused by opinion popular opinion, each rebelling county will gain +20 opinion popular opinion for 10 years. The liege will also have cause to revoke a title from each faction member (allowing the liege to revoke a title without gaining tyranny).

### Vassal factions

- Vassal factions can only be created manually by vassals. They all require sufficient military power to gain Discontent and their military power is calculated by comparing their members' armies with the armies of the liege and every vassal who is not a member of the faction.

### Popular factions

- Popular factions cannot be created or joined by vassals and are created automatically if counties in the Domain have negative Popular Opinion. How negative Popular Opinion has to be depends on the Realm Stability game rule. Popular factions' military power is calculated by comparing the Levies produced by the member counties with the Levies produced by the owner's domain.

### Tributaries

- A tributary is the most independent subject type, paying tribute in exchange for a truce with a ruler with higher or equal title rank, called their suzerain. Rulers with Nomadic, Celestial and Mandala government can have tributaries regardless of authority law and can ask their neighbors to become tributaries.
- Suzerain Guarantee: Guaranteed allows the tributary to call the suzerain into their defensive wars and increase the tributary's Opinion by +25.
- Tributary War Support: Forced brings the tributary into the suzerain's wars and reduces their Opinion by -25 and is only available if the tributary is Obedient or a Blood Brother.
- Tributaries have a yearly chance to stop paying tribute depending on their military strength relative to that of their suzerain. Should that happen, the suzerain will have the option to either let them become independent or go to war.

### Pay tribute

- Tributaries can travel to their suzerain directly to pay tribute via the Pay Tribute decision. The amount of tribute paid depends on culture era and whether the suzerain is a Rival or Nemesis. The following tribute options are available:
- Gold is available to every tributary that does not have Treasury.
- Treasury is available to every tributary uses the resource.
- Artifact is available to tributaries that have an unequipped artifact.
- Concubine is available if the suzerain has the Concubines tenet or tradition and can take additional concubines. Unlike other forms of tribute this one requires the suzerain to accept the concubine.

### Hegemonic tributaries

- Independent rulers unlock the Pay Tribute decision on hegemony Hegemons too and using it is necessary to become a tributary. Tributaries of hegemonies track a value called Subject Standing, or Imperial Grace if the suzerain is China, which ranges from 0 to 100 and is visible when reviewing the contract. Unlike other subject contracts, their contracts can be changed every 5 years.

## Related Wiki Topics

- [[mechanics-content/activity|Activity]]
- [[mechanics-content/adventurer|Adventurer]]
- [[mechanics-content/alliance|Alliance]]
- [[mechanics-content/army|Army]]
- [[mechanics-content/artifacts|Artifacts]]
- [[mechanics-content/attributes|Attributes]]
- [[mechanics-content/barony|Barony]]
- [[mechanics-content/casus-belli|Casus belli]]
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

- Mechanics content slug: `subjects`
- Source title: `Subjects`
- Source page length: `45586`
