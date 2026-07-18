---
pageType: mechanics_content
title: "Characters"
topicGroup: "characterSystems"
sourceId: "source:ck3-paradoxwikis-com:character"
sourceRevisionId: 34938
sourceOldidUrl: "https://ck3.paradoxwikis.com/Character?oldid=34938"
license: "CC BY-SA 3.0"
generatedAt: "2026-07-18T07:20:18.943Z"
contentHash: "49a274750cb2097c3aab600320590fab815be86428f26398e2d4549a0983e343"
---

# Characters

## Source And Attribution

- Source: `source:ck3-paradoxwikis-com:character`
- Revision: <https://ck3.paradoxwikis.com/Character?oldid=34938>
- License: Creative Commons Attribution-ShareAlike 3.0 (`https://creativecommons.org/licenses/by-sa/3.0/`)
- Scope: official CK3 Wiki mechanics documentation; all DLC is assumed active for this project unless a cited source says otherwise.
- Content basis: bounded section notes derived from revision-pinned wiki text. This page is not a full copy of the source article.

## Advisor Use

Use this page when a question needs CK3 mechanics context for Characters. Combine these mechanics notes with current-save evidence paths and advisor models before giving player advice.

## Mechanics Notes

### Overview

- A character refers to any person, historical or generated, that is represented personally in Crusader Kings III. Every single character is an individual, living entity that will act individually and has the potential to change history. Characters can be either noble or lowborn, and landed or unlanded.
- Lowborn characters are not members of a [[mechanics-content/dynasty|dynasty]]. If they are landed with a playable [[mechanics-content/government|government]] [[mechanics-content/titles|title]] they will become noble and found a dynasty.
- Unlanded characters do not own any [[mechanics-content/barony|holdings]]; a character who Leases holdings (e.g. a Realm Priest) is considered an unlanded character.
- All Characters are part of a certain Religion and [[mechanics-content/culture|Culture]], and may have a variety of [[mechanics-content/attributes|Attributes]], [[mechanics-content/traits|Traits]], [[mechanics-content/modifiers|Modifiers]] and [[mechanics-content/resources|Resources]] that further shape each individual. Some may even attempt to interact with others through [[mechanics-content/schemes|Schemes]]. If they are landed, they will also have [[mechanics-content/titles|Titles]], [[mechanics-content/council|Council]] (if they are at least a Count), a specific [[mechanics-content/government|Government]], a [[mechanics-content/lifestyle|Lifestyle]] and a [[mechanics-content/court|Court]].

### Appearance

- Every character's physical appearance is internally determined by a DNA system, which defines how they look: body proportions, facial features, skin pigmentation, height, and hair color are all stored as DNA. It can be directly edited with the Ruler Designer. DNA is stored as dominant and recessive genes and passed on to a character's children, affecting their appearance.

### Sexual Orientation

- A character's sexual orientation determines with which gender they will gain attraction opinion and can form lover relations. It is decided when the character is around 10 years old and cannot be changed. AI characters will never try to form a relation with characters that do not match their sexual orientation.

### Opinion

- Each character has an opinion opinion of every other character. The opinion the player character holds influences the success rate of certain actions that target another character while the opinion of AI characters also determines their behavior towards other characters.
- Positive opinion towards predecessor: 25% of opinion is inherited.
- Negative opinion towards predecessor: 50% of opinion is inherited.

### General

- General is an opinion modifier that affects every character, this means only Popular Opinion of [[mechanics-content/county|Counties]] are independent of this modifier. See also [[mechanics-content/attributes|Attributes]]. These are [[mechanics-content/modifiers|modifiers]] that influence General opinion:

### Attraction

- Attraction is an opinion modifier that can only be held towards characters one's sexual preference allows. Male characters aged above 65 years and female character above 50 years are not affected by attraction. Only adults (16 year old and above) can generate attraction and have attraction towards another. These are [[mechanics-content/modifiers|modifiers]] that influence Attractionopinion:
- +5/+10 [[mechanics-content/traits|Trait]] "Hunter" (Falconer way) (Level 1/Level 2)
- +5/+10/+15 [[mechanics-content/traits|Trait]] "Amazonian"/("Herculean")/"Robust"/"Hale"
- -30/-20/-10/+10/+20/+30 [[mechanics-content/traits|Trait]] "Hideous"/"Ugly"/"Homely"/"Comely"/"Handsome"("Pretty")/"Beautiful"

### Same Dynasty

- [[mechanics-content/dynasty|Dynasty]] is an opinion modifier that affects everyone of the same dynasty. These are [[mechanics-content/modifiers|modifiers]] that influence Same Dynasty opinion:

### Virtue & Sins

- Some [[mechanics-content/traits|traits]] are considered virtuous or sinful in certain [[mechanics-content/faith|faiths]], the opinion modifier will be dependant on the character whose faith sees certain traits as virtuous or sinful. (e,g, a Muslim who has the "Forgiving" trait would have no [[mechanics-content/modifiers|modifiers]] from other Muslims, have +10 (virtue) modifier from Christians and -10 (sin) modifier with Asatruans).

### Faith Hostility

- [[mechanics-content/characters#faith-hostility|Faith Hostility]] is determined by the Religious Families to be Righteous/Astray/Hostile/Evil, and are then given 0/-10/-20/-30 opinion maluses, respectively.
- "Pluralist" [[mechanics-content/doctrines|Doctrine]]: -50% [[mechanics-content/characters#faith-hostility|faith hostility]] opinion malus
- "Fundamentalist" [[mechanics-content/doctrines|Doctrine]] +100% [[mechanics-content/characters#faith-hostility|faith hostility]] opinion malus
- The opinion malus from other characters is dependant by how hostile the other [[mechanics-content/faith|faith]] sees that faith that you belong to as, not how hostile your faith sees their faith as. The "Pluralist" and "Fundamentalist" [[mechanics-content/doctrines|Doctrines]] affect how much maluses to opinion they have for you, not vice-versa.

### Relations

- When certain requirements are met, two characters can have one of three types of relations, with each type having three levels. Relations have a great impact on how two characters act towards each other.
- Childhood relations can only be held between two child characters and might evolve into their corresponding adulthood relations when the characters reach adulthood
- Adulthood relations can be gained and lost as a result of events
- Lifelong relations can only be obtained towards characters with an existing adulthood relation and each character can have only one of each lifelong relation
- Two characters who have Nomadic [[mechanics-content/government|government]] or the Way of the Nomad [[mechanics-content/traits|trait]] can swear a Blood Brotherhood with each other as long as they're not family members. Being Blood Siblings has the same benefits as being Friends but also gives the characters a Strong [[mechanics-content/hooks|Hook]] on each other, forms an [[mechanics-content/alliance|alliance]], and allows choosing a Blood Brother [[mechanics-content/modifiers|modifier]] if any is available. Each character can only have one Blood Brother.

### Tyranny

- Tyranny is opinion negative opinion gained by rulers who take unjust actions. It is felt by vassals and courtiers towards a liege. The maximum tyranny a character can have is 1000. Tyranny is not gained if the liege has a valid reason. Tyranny can be lost through certain events and most importantly through Monthly Decay:
- -0.05 Monthly delay by Perk 'Venial' guile legacy Guile [[mechanics-content/dynasty|Dynasty]]
- All tyrannical actions, events and the monthly decay can be affected by the following [[mechanics-content/modifiers|modifiers]]: With the Torturer [[mechanics-content/lifestyle|lifestyle]] perk Malice Implicit, characters gain dread +0.5 dread per tyranny.

### Diplomatic range

- The diplomatic range is the distance within which two characters can interact with each other. Neighboring realms are always within diplomatic range of each other, as well as realms separated by no more than three sea zones.
- The first [[mechanics-content/dynasty|Dynasty Legacy]] from the Adventure Legacy Tree from Northern Lords DLC increases Diplomatic Range by 30%.
- The Rock of Gibraltar increases Diplomatic Range by 20%.
- Diplomatic range map mode is only available in debug mode.

### Nicknames

- Nicknames are epithets granted to characters and are displayed either before or after a character's name. They are mainly gained through decision [[mechanics-content/decisions|decisions]] and events.

### AI Personality

- AI characters will act based on the following [[mechanics-content/attributes|attributes]]:
- Boldness: Characters with high Boldness are less affected by Dread and more likely to declare [[mechanics-content/warfare|war]] on rulers of similar or higher strength, accept and propose [[mechanics-content/duel|Duels]] and take risks. Characters with low Boldness are more affected by Dread and more likely to declare war on weaker rulers, accept faction ultimatums and more reluctant to try to imprison Strong Vassals and take risks.
- Compassion: Characters with high Compassion are more likely to release [[mechanics-content/prisoners|prisoners]] (especially children), use the
- Promote [[mechanics-content/culture#cultural-acceptance|Cultural Acceptance]] steward task, let people marry for love and make friends and more reluctant to harm others, use the Murder scheme, execute [[mechanics-content/prisoners|prisoners]] or torture prisoners. Characters with low Compassion are more likely to harm others, use Hostile [[mechanics-content/schemes|schemes]], execute prisoners or torture prisoners.
- Greed: Characters with high Greed will more often choose short-term gains, go on raidRaids, use the

### Economic Archetype

- An AI ruler would spend their [[mechanics-content/resources|Gold]] according to the following archetypes based on their [[mechanics-content/traits|traits]] and [[mechanics-content/attributes|attributes]]: Warlike: A Warlike ruler will save Gold for [[mechanics-content/warfare|war]] before investing it in developing their realm. If they are at peace for an extended period of time, they will use their gold to build [[mechanics-content/building|Buildings]]. If the Legends of the Dead DLC is installed they are also more likely to create and promote Heroic legends.
- Relevant [[mechanics-content/traits|Traits]]: Wrathful, Impatient, Sadistic, Ambitious, Vengeful, Irritable, and Zealous.
- AI with high Boldness and Greed also tends to be Warlike.
- Cautious: A Cautious ruler is more averse to declaring offensive [[mechanics-content/warfare|wars]], more inclined to save [[mechanics-content/resources|Gold]] for defense, and invest gold for Fortification [[mechanics-content/building|Buildings]] and [[mechanics-content/army#men-at-arms|Men-at-Arms regiments]]. If the Legends of the Dead DLC is installed they are also less likely to create and promote legends.
- Relevant [[mechanics-content/traits|traits]]: Patient, Calm, Craven, Paranoid, and Content.

### Legends

- Legends represent important deeds that a character achieved in life. The story of the legend will be written in various events as the legend is being completed. Creating a legend costs 200 Gold if Count or Duke, 300 if King and 400 if Emperor, and it also has a monthly maintenance cost until it is completed. legitimizing legend Legitimizing legends also cost 75 [[mechanics-content/resources|Prestige]].
- Friend or Best Friend with the legend's creator
- Legends come in three types and three levels of quality, which together determine what benefits they give. When a legend is created it will start at Famed quality. Once it has spread to 100 [[mechanics-content/barony|Baronies]] it can be upgraded to Illustrious quality and will not spread further until upgraded. Once it has spread to 300 Baronies it can be upgraded to Mythical quality and will not spread further until upgraded.

### Historical legend seeds

- Historical legend seeds can only be used once per game, regardless of character. They are restricted to certain [[mechanics-content/dynasty|dynasties]], [[mechanics-content/culture|cultures]] or [[mechanics-content/faith|faiths]]. Some historical seeds have an associated ancient culture. If the [[mechanics-content/royal-court|Royal Court]] DLC is also enabled, completing these legends will give the option to create a [[mechanics-content/culture#divergent-cultures|divergent culture]] with the ancient culture's cultural pillars

### Legitimizing historical seeds

- Legitimizing historical seeds, in addition to their usual bonuses, will also give the character completing the legend claims on a certain major [[mechanics-content/titles|title]].

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

## Machine Reference

- Mechanics content slug: `characters`
- Source title: `Character`
- Source page length: `49795`
