# Living Record Collection

This page describes the durable schema for the `living` collection observed in Rakaly JSON output.

## Field Notes

- `culture`: integer reference to the `culture_id` identity domain.
- `faith`: integer reference to the `faith_id` identity domain.
- `dynasty_house`: optional reference to a house record.

See `graph.json` for the canonical durable edge definitions.
