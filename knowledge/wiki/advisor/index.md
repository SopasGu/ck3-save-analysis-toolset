---
pageType: advisor_kernel
status: maintained
generatedFrom:
  - "knowledge/schema/graph.json"
  - "knowledge/claims/claims.json"
  - "knowledge/sources/registry.json"
---

# Advisor Kernel

This directory is the user-facing synthesis layer for the CK3 evidence graph. Generated graph-node pages are useful provenance appendices, but an advisor should start here when answering campaign questions.

The advisor kernel connects three evidence families:

- CK3 mechanics concepts from `knowledge/wiki/pages/mechanics/`
- durable save-schema graph IDs from `knowledge/schema/graph.json`
- ephemeral facts from the currently analyzed save, which must remain under ignored `state/`

## Operating Rule

For any player question, first choose the closest advisor model below, then inspect the current save through the listed graph IDs and existing report/query tools. Explain advice in game-mechanics terms, cite the relevant mechanics source IDs, and cite the save-derived paths or report fields that ground the current campaign facts.

## Advisor Models

- [[advisor/characters|Characters and player state]]
- [[advisor/adventurer-contracts|Adventurer camp and contracts]]
- [[advisor/realm|Realm, titles, provinces, and governance]]
- [[advisor/culture-faith|Culture and faith]]
- [[advisor/warfare|Warfare and armies]]
- [[advisor/relationships|Hooks, schemes, secrets, and relations]]

## Boundaries

Durable advisor pages describe how to reason. They must not store campaign-character names, record IDs, balances, locations, contracts, wars, or other live save facts. Current-save details belong in ephemeral analysis output.
