---
pageType: mechanics_content
title: "Titles"
topicGroup: "realm"
sourceId: "source:ck3-paradoxwikis-com:titles"
sourceRevisionId: 35027
sourceOldidUrl: "https://ck3.paradoxwikis.com/Titles?oldid=35027"
license: "CC BY-SA 3.0"
generatedAt: "2026-07-18T07:20:18.943Z"
contentHash: "2e42fd3c6d5d3841194bc7c59e6dea15d9b6b4f0545157b0c2c0f817084ab1f2"
---

# Titles

## Source And Attribution

- Source: `source:ck3-paradoxwikis-com:titles`
- Revision: <https://ck3.paradoxwikis.com/Titles?oldid=35027>
- License: Creative Commons Attribution-ShareAlike 3.0 (`https://creativecommons.org/licenses/by-sa/3.0/`)
- Scope: official CK3 Wiki mechanics documentation; all DLC is assumed active for this project unless a cited source says otherwise.
- Content basis: bounded section notes derived from revision-pinned wiki text. This page is not a full copy of the source article.

## Advisor Use

Use this page when a question needs CK3 mechanics context for Titles. Combine these mechanics notes with current-save evidence paths and advisor models before giving player advice.

## Mechanics Notes

### Overview

- A title is essentially a certificate of land ownership, decreeing which characters own a certain place or lead a certain landless group of people. Each title has a rank, a unique coat of arms, and a color on map. A character's titles along with those held by its vassals form a character's Realm.

### Title rank

- Each title has a rank, which determines its place in the feudal pecking order. Rank primarily governs who holders of that title can vassalize or become vassals of. A ruler can only have vassals of lower rank and can only be a vassal of someone of higher rank. Title Rank also determines what bonuses it grants to players who hold that title.

### Duchy

- Duchy is the third rank of titles, and the first rank that can be destroyed or created by characters. However, it has some unique properties:
- Each duchy has a duchy capital [[mechanics-content/building|building]] slot in its capital [[mechanics-content/county|county]]'s capital [[mechanics-content/barony|barony]].
- Characters can hold at most 2 duchy titles without suffering opinion penalties from their vassals; this rule does not apply to any other ranks.
- Emperors and Hegemons can have duchy rank vassals without penalties.

### De Jure

- De Jure, meaning "by [[mechanics-content/laws|law]]", means that a title historically covered certain lower Rank titles. Every duchy in the game is considered to be part of a specific de jure kingdom and every kingdom to be part of a specific de jure empire. Vassals within a de jure border have fewer reasons and abilities to revolt against their liege and declare independence.
- Seize De Jure [[mechanics-content/county|County]] requires the Tribal-era [[mechanics-content/innovation|innovation]] [[mechanics-content/casus-belli|Casus Belli]].
- Seize De Jure Duchy requires the Early Medieval-era [[mechanics-content/innovation|innovation]] Chronicle Writing.
- Seize De Jure Titles requires the Late Medieval-era [[mechanics-content/innovation|innovation]] Rightful Ownership.
- If a vassal's primary title does not fall under the de jure territory of any titles their liege holds, that vassal gives 50% less [[mechanics-content/resources|gold]] Taxes and Levies alongside -5 Opinion of Liege. Furthermore, count rank vassals give 25% less gold Taxes and Levies alongside -5 Opinion of Liege if their liege does not hold the de jure duchy of their primary title, but does hold its de jure kingdom or empire.

### Usurpation

- If a character has at least two titles of lower rank or one title of equal or higher rank and is [[mechanics-content/barony|holding]] more than 50% of the De Jure [[mechanics-content/county|Counties]] of a title held by a Ruler of the same [[mechanics-content/faith|Faith]] or a Faith which is not considered Hostile or Evil, then the character can Usurp the title. This process gives the title to the usurper.

### De jure drift

- De jure drift or assimilation is the process by which the de jure borders of kingdoms, empires and hegemonies can change over time. If a ruler completely controls a duchy, kingdom or empire, owns a higher ranked title, and does not own the higher title that the lower title De Jure belongs to, then the said duchy, kingdom or empire will slowly become De Jure part of the character's Primary title.
- The entire duchy (i.e. all [[mechanics-content/county|county]] titles belonging de jure to the duchy; [[mechanics-content/barony|baronies]] are allowed to be outside the realm) is within the realm of the king.
- The duchy is not part of the kingdom of Jerusalem.
- The kingdom is its owner's primary title. (Note: there are some corner cases / possible bugs where drift continues even if primary title changes)
- The duchy either shares a land border with, or is a maximum of 2 sea tiles away from the existing de jure kingdom.

### Claim

- A claim represents a character's legal right to obtain a title which is not theirs and allows the creation of a claimant faction. If the title belongs to a vassal, the claim allows the liege to revoke the claimed title without incurring tyranny. Otherwise, a claim provides a [[mechanics-content/casus-belli|casus belli]] to gain the claimed title through [[mechanics-content/warfare|war]].
- Pressed claimPressed claimPressed claims on a character's titles are given to all legitimate children upon the title holder's death, except to primary heirs under any partition succession. Primary heirs under a partition succession do not inherit claims on their siblings land, with the exception of any claims for titles that are of equal rank to their primary title.
- Unpressed claimUnpressed claimUnpressed claims are never inherited but can become pressed if a claim [[mechanics-content/warfare|war]] using the claim ends in a white peace.
- Implicit claimImplicit claimImplicit claims on a character's current titles are given to children favored by the [[mechanics-content/faith|faith]]'s View on Gender [[mechanics-content/doctrines|doctrine]] while the title holder is still alive. Children with [[mechanics-content/traits|traits]] that prevent inheriting titles will not get claims.
- Claims on landed titles can be obtained the following ways:

### Revocation

- Revoking titles of vassals is a crucial part of realm management, as it allows redistribution of power. Revoking titles requires the realm's authority [[mechanics-content/laws|law]] to be at least at level 2. Revoking Titles incurs +20 opinion Tyranny unless the liege has a Claim on the title being revoked, the vassal committed a Crime that allows warrants revocation or the title is a [[mechanics-content/barony|barony]].

### Holding too many titles

- Overextension: If a character is a county Count or duchy Duke, their realm can include a maximum of 30 County titles without penalties; for Dukes, this include the [[mechanics-content/county|Counties]] controlled by their Count Vassals. Each county over the limit gives an overextension penalty that reduces the character's [[mechanics-content/resources|Gold]] income by -5%.

### Head of faith titles

- [[mechanics-content/faith|Head of faith]] titles are not part of the de jure hierarchy as they do not contain any de jure territory. Instead they designate which character is a the head of faith for faiths with Spiritual or Temporal head of faith [[mechanics-content/doctrines|doctrine]]. Creating a head of faith title requires control of a [[mechanics-content/holy-sites|Holy Site]], 300 [[mechanics-content/resources|Gold]] and at least a Devoted level of devotion.

### Roman Empire

- The Roman Empire is an initially titular title that has special mechanics. It can be created via the Restore the Roman Empire [[mechanics-content/decisions|decision]] and will replace the current primary title. If multiple empire titles are held, they will all be merged into the Roman Empire title that will gain all their de jure territory. The character [[mechanics-content/barony|holding]] the Roman Empire title will always have the Augustus [[mechanics-content/traits|trait]].

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

- Mechanics content slug: `titles`
- Source title: `Titles`
- Source page length: `27714`
