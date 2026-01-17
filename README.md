# Blades Alternate Sheets Test Module

Quench-based test harness for the [Blades in the Dark Alternate Sheets](https://github.com/justinross/foundry-bitd-alternate-sheets) Foundry VTT module.

## Requirements

- Foundry VTT v12 or v13
- [Blades in the Dark system](https://github.com/Dez384/foundryvtt-blades-in-the-dark)
- [bitd-alternate-sheets module](https://github.com/justinross/foundry-bitd-alternate-sheets)
- [Quench](https://github.com/Ethaks/FVTT-Quench) testing framework

## Installation

1. Install this module alongside `bitd-alternate-sheets` in your Foundry modules folder
2. Enable both modules plus Quench in your test world
3. Open the Quench test runner from the sidebar

## Running Tests

### Via Quench UI

1. Click the Quench icon in the Foundry sidebar
2. Select test batches to run (all prefixed with `bitd-alternate-sheets.`)
3. Click "Run"

### Programmatically

```js
// Run all bitd-alternate-sheets tests
quench.runBatches("bitd-alternate-sheets");

// Run specific test batch
quench.runBatches("bitd-alternate-sheets.teeth");
quench.runBatches("bitd-alternate-sheets.crew-sheet");
```

## Test Batches

| Batch | Description |
|-------|-------------|
| `teeth` | XP teeth toggle behavior |
| `binary-checkboxes` | Gear/load item equipping and equipped-items flags |
| `edit-mode` | Edit/lock mode toggling |
| `smart-fields` | Smart field click-to-edit dialogs |
| `crew-sheet` | Crew sheet rendering and upgrades |
| `crew-radio-toggle` | Crew tier/heat/wanted radio buttons |
| `crew-member-rerender` | Crew member sheet updates |
| `compendium-cache` | Compendium caching and invalidation |
| `global-clocks` | Clock rendering in sheets, journals, chat |
| `healing-clock` | Healing clock functionality |
| `npc-integration` | NPC/Vice Purveyor integration |
| `acquaintances` | Acquaintance standing and display |
| `update-queue` | Multi-client update queue |
| `error-handling` | Error handling patterns |

## Test Utilities

The module exports shared test utilities in `scripts/test-utils.js`:

- `createTestActor({ name, playbookName })` - Create a character with playbook
- `createTestCrewActor({ name, crewTypeName })` - Create a crew
- `ensureSheet(actor)` - Open and wait for sheet to render
- `cleanupTestActor(actor)` - Close sheet and delete actor
- `closeAllDialogs()` - Clean up V1 and V2 dialogs
- `waitForActorUpdate(actor)` - Wait for actor data to update

## Notes

- Tests create temporary actors that are deleted after each test
- Some tests may skip on V13 due to ApplicationV2 timing differences
- Run in a dedicated test world to avoid affecting real game data
