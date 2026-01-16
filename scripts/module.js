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
 * - bitd-alternate-sheets.teeth: XP teeth toggle behavior
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
  console.log(`  game.modules.get("${MODULE_ID}").api.runAllTests()`);
});
