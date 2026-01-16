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

/**
 * Log test summary when Quench reports are available.
 * Outputs failed and skipped tests to the console after all test output.
 *
 * Tests with "[DISABLED]" in their name are excluded from the skipped count
 * since they represent intentionally disabled functionality.
 */
Hooks.on("quenchReports", (report) => {
  // Delay slightly to ensure this appears after all test logging
  setTimeout(() => {
    try {
      const data = JSON.parse(report.json);
      const stats = data.stats || {};

      // Separate disabled tests from unexpected skips
      const disabledTests = (data.pending || []).filter(t =>
        t.fullTitle?.includes("[DISABLED]") || t.title?.includes("[DISABLED]")
      );
      const unexpectedSkips = (data.pending || []).filter(t =>
        !t.fullTitle?.includes("[DISABLED]") && !t.title?.includes("[DISABLED]")
      );

      console.log("\n\n%c════════════════════════════════════════════════════════════", "color: #888;");
      console.log("%c                    QUENCH TEST SUMMARY", "font-weight: bold; font-size: 14px;");
      console.log("%c════════════════════════════════════════════════════════════", "color: #888;");
      console.log(`  Passed:   %c${stats.passes || 0}`, "color: green;");
      console.log(`  Failed:   %c${stats.failures || 0}`, stats.failures ? "color: red; font-weight: bold;" : "color: green;");
      console.log(`  Skipped:  %c${unexpectedSkips.length}`, unexpectedSkips.length ? "color: orange;" : "color: inherit;");
      if (disabledTests.length > 0) {
        console.log(`  Disabled: %c${disabledTests.length}`, "color: #888;");
      }
      console.log(`  Duration: ${stats.duration || 0}ms`);

      // Log failed tests in a collapsed group
      if (data.failures?.length > 0) {
        console.log("");
        console.groupCollapsed(`%c✗ Failed Tests (${data.failures.length})`, "color: red; font-weight: bold;");
        for (const failure of data.failures) {
          console.log(`%c✗ ${failure.fullTitle}`, "color: red;");
          if (failure.err?.message) {
            console.log(`  %c${failure.err.message}`, "color: #c66;");
          }
        }
        console.groupEnd();
      }

      // Log unexpected skipped tests in a collapsed group (not disabled ones)
      if (unexpectedSkips.length > 0) {
        console.groupCollapsed(`%c⊘ Skipped Tests (${unexpectedSkips.length})`, "color: orange; font-weight: bold;");
        for (const skipped of unexpectedSkips) {
          console.log(`%c⊘ ${skipped.fullTitle}`, "color: orange;");
        }
        console.groupEnd();
      }

      // Log disabled tests separately (collapsed, dimmed)
      if (disabledTests.length > 0) {
        console.groupCollapsed(`%c⊗ Disabled Tests (${disabledTests.length})`, "color: #888;");
        for (const disabled of disabledTests) {
          console.log(`%c⊗ ${disabled.fullTitle}`, "color: #888;");
        }
        console.groupEnd();
      }

      // Final status line
      console.log("%c════════════════════════════════════════════════════════════", "color: #888;");
      if (stats.failures === 0 && stats.passes > 0) {
        console.log("%c✓ All tests passed!", "color: green; font-weight: bold; font-size: 12px;");
      } else if (stats.failures > 0) {
        console.log(`%c✗ ${stats.failures} test(s) failed`, "color: red; font-weight: bold; font-size: 12px;");
      }
      console.log("%c════════════════════════════════════════════════════════════\n", "color: #888;");

    } catch (err) {
      console.error(`[${MODULE_ID}] Error parsing Quench report:`, err);
    }
  }, 100);
});
