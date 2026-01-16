/**
 * Blades in the Dark Alternate Sheets Test Harness
 *
 * Entry point for the test module. Test batches are registered via
 * the quenchReady hook in individual test files.
 *
 * Test files are loaded as ES modules via module.json esmodules array.
 * Each test file registers its own Quench batch.
 *
 * Available test batches:
 * - bitd-alternate-sheets.teeth: XP teeth toggle behavior (character sheets)
 * - bitd-alternate-sheets.crew-radio-toggle: Tier/heat/wanted toggle behavior (crew sheets)
 * - bitd-alternate-sheets.edit-mode: Allow edit toggle behavior (both sheet types)
 * - bitd-alternate-sheets.healing-clock: Healing clock rendering and interaction (character sheets)
 * - bitd-alternate-sheets.crew-sheet: Crew sheet abilities, upgrades, collapse, minimize
 * - bitd-alternate-sheets.crew-member-rerender: Crew member sheet rerender on upgrade changes
 * - bitd-alternate-sheets.smart-fields: Smart item selectors and tooltips
 * - bitd-alternate-sheets.global-clocks: Clock links in chat, journals, and harm popup
 * - bitd-alternate-sheets.update-queue: Sequential update batching and error handling
 * - bitd-alternate-sheets.acquaintances: Acquaintance standing colors, toggle, filtering
 * - bitd-alternate-sheets.compendium-cache: Cache invalidation and performance
 * - bitd-alternate-sheets.npc-integration: NPC vice purveyors and playbook filtering
 * - bitd-alternate-sheets.error-handling: Null safety and error notifications
 * - bitd-alternate-sheets.binary-checkboxes: Binary item checkboxes and load pills
 */

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

// Export utilities for console access
import {
  createTestActor,
  waitForActorUpdate,
  waitForActorCondition,
  ensureSheet,
  applyToothClick,
  setAttributeExp,
  getAttributeExpMax,
  getAttributeExp,
  getTeethState,
  getLitValues,
  // Crew utilities
  createTestCrewActor,
  getCrewStatMax,
  getCrewStat,
  setCrewStat,
  getCrewTeethState,
  applyCrewToothClick,
} from "./test-utils.js";

Hooks.once("ready", () => {
  if (!game?.modules?.get(TARGET_MODULE_ID)?.active) {
    ui.notifications?.warn(
      `[${MODULE_ID}] ${TARGET_MODULE_ID} is not active; tests will not run.`
    );
    return;
  }

  // Expose utilities via module API for console access
  const api = {
    // Character utilities
    createTestActor,
    waitForActorUpdate,
    waitForActorCondition,
    ensureSheet,
    applyToothClick,
    setAttributeExp,
    getAttributeExpMax,
    getAttributeExp,
    getTeethState,
    getLitValues,
    // Crew utilities
    createTestCrewActor,
    getCrewStatMax,
    getCrewStat,
    setCrewStat,
    getCrewTeethState,
    applyCrewToothClick,
    // Helper to run all tests programmatically
    runAllTests: () => {
      if (typeof quench !== "undefined") {
        quench.runBatches(/^bitd-alternate-sheets\./);
      } else {
        console.error(`[${MODULE_ID}] Quench not available`);
      }
    },
  };

  game.modules.get(MODULE_ID).api = api;

  console.log(`[${MODULE_ID}] Test module ready. Run tests via Quench UI or:`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.teeth")`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.crew-radio-toggle")`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.edit-mode")`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.healing-clock")`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.crew-sheet")`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.crew-member-rerender")`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.smart-fields")`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.global-clocks")`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.update-queue")`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.acquaintances")`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.compendium-cache")`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.npc-integration")`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.error-handling")`);
  console.log(`  quench.runBatches("bitd-alternate-sheets.binary-checkboxes")`);
  console.log(`  game.modules.get("${MODULE_ID}").api.runAllTests()`);
});
