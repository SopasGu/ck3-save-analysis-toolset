export const LINT_PATTERNS = {
  version: 1,
  description:
    "Registered campaign-only identifiers for the durable-content lint. " +
    "Patterns here should not appear in committed knowledge/ or fixtures/ content " +
    "because they describe a single campaign instance rather than durable save structure. " +
    "Add new entries when a new campaign introduces a new identifying string. " +
    "Treat numeric record IDs cautiously: prefer distinctive name patterns over raw IDs.",
  identifiers: [
    {
      id: "nino-player-name",
      pattern: "Nino of the Bastards of the Monolith",
      description:
        "Full player character name from current Nino campaign. Do not promote into durable knowledge.",
    },
    {
      id: "nino-dynasty-name",
      pattern: "Bastards of the Monolith",
      description:
        "Player dynasty/house name from current Nino campaign. Unique enough to flag without false positives.",
    },
    {
      id: "nino-character-id-37885",
      pattern: "\\bcharacter:37885\\b",
      description:
        "Specific character record ID tied to the current Nino campaign player. Bare integers are NOT flagged; only the typed character:ID form is.",
    },
    {
      id: "nino-character-id-33596132",
      pattern: "\\bcharacter:33596132\\b",
      description:
        "Specific character record ID used in current Nino campaign scout targets.",
    },
  ],
};
