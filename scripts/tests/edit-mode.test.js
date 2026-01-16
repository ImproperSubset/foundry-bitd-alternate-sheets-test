/**
 * Quench test batch for edit mode (allow_edit) toggle behavior.
 * Tests that sheets default to locked and unlock toggle works.
 */

import {
  createTestActor,
  createTestCrewActor,
  ensureSheet,
  waitForActorCondition,
  isTargetModuleActive,
  closeAllDialogs,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * Check if the sheet has allow-edit class (unlocked state).
 * @param {ActorSheet} sheet
 * @returns {boolean}
 */
function isSheetUnlocked(sheet) {
  const root = sheet.element?.[0] || sheet.element;
  if (!root) return false;
  const wrapper = root.querySelector(".sheet-wrapper");
  return wrapper?.classList?.contains("allow-edit") ?? false;
}

/**
 * Click the allow-edit toggle button on a sheet.
 * @param {ActorSheet} sheet
 */
async function clickEditToggle(sheet) {
  const root = sheet.element?.[0] || sheet.element;
  if (!root) throw new Error("Sheet DOM not available");
  const toggle = root.querySelector(".toggle-allow-edit");
  if (!toggle) throw new Error("Edit toggle button not found");
  toggle.click();
  // Wait for re-render
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/**
 * Clear the user's allow edit states for clean test isolation.
 */
async function clearAllowEditStates() {
  await game.user?.unsetFlag(TARGET_MODULE_ID, "allowEditStates");
}

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping edit mode tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.edit-mode",
    (context) => {
      const { describe, it, assert, beforeEach, afterEach } = context;

      describe("Character Sheet Edit Mode", function () {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          await clearAllowEditStates();
          const result = await createTestActor({
            name: "EditMode-CharSheet-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await closeAllDialogs();
          if (actor) {
            try {
              if (actor.sheet) {
                await actor.sheet.close();
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
            } catch {
              // Ignore close errors
            }
            await actor.delete();
            actor = null;
          }
          await clearAllowEditStates();
        });

        it("sheet defaults to locked (allow_edit = false)", async function () {
          const sheet = await ensureSheet(actor);
          assert.equal(sheet.allow_edit, false, "Sheet should default to locked");
          assert.ok(!isSheetUnlocked(sheet), "Sheet DOM should not have allow-edit class");
        });

        it("clicking edit toggle unlocks the sheet", async function () {
          this.timeout(5000);
          const sheet = await ensureSheet(actor);
          assert.ok(!isSheetUnlocked(sheet), "Sheet should start locked");

          await clickEditToggle(sheet);

          assert.equal(sheet.allow_edit, true, "Sheet allow_edit should be true after toggle");
          assert.ok(isSheetUnlocked(sheet), "Sheet DOM should have allow-edit class");
        });

        it("clicking edit toggle again locks the sheet", async function () {
          this.timeout(5000);
          const sheet = await ensureSheet(actor);

          await clickEditToggle(sheet); // Unlock
          assert.ok(isSheetUnlocked(sheet), "Sheet should be unlocked");

          await clickEditToggle(sheet); // Lock again
          assert.equal(sheet.allow_edit, false, "Sheet allow_edit should be false after second toggle");
          assert.ok(!isSheetUnlocked(sheet), "Sheet DOM should not have allow-edit class");
        });

        it("edit state persists across sheet close/reopen", async function () {
          this.timeout(5000);
          let sheet = await ensureSheet(actor);

          await clickEditToggle(sheet); // Unlock
          assert.ok(isSheetUnlocked(sheet), "Sheet should be unlocked");

          // CRITICAL: Verify user flag was actually stored
          const userFlags = game.user?.getFlag(TARGET_MODULE_ID, "allowEditStates");
          assert.ok(
            userFlags !== undefined,
            "User should have allowEditStates flag after toggling edit mode"
          );
          assert.ok(
            userFlags?.[actor.id] === true,
            `User flag should store actor ${actor.id} as unlocked (flag value: ${JSON.stringify(userFlags)})`
          );

          // Close and reopen sheet
          await sheet.close();
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Reset the sheet instance's allow_edit to undefined to simulate fresh open
          actor._sheet = null;
          sheet = await ensureSheet(actor);

          assert.equal(sheet.allow_edit, true, "Sheet should remember unlocked state");
          assert.ok(isSheetUnlocked(sheet), "Sheet DOM should still have allow-edit class");

          // CRITICAL: Verify flag is still present after reopen
          const userFlagsAfter = game.user?.getFlag(TARGET_MODULE_ID, "allowEditStates");
          assert.ok(
            userFlagsAfter?.[actor.id] === true,
            `User flag should still store actor ${actor.id} as unlocked after reopen`
          );

          console.log(`[EditMode Test] Edit state persisted via user flag for actor ${actor.id}`);
        });

        it("locked sheet hides delete buttons", async function () {
          const sheet = await ensureSheet(actor);
          assert.ok(!isSheetUnlocked(sheet), "Sheet should be locked");

          const root = sheet.element?.[0] || sheet.element;
          // In locked mode, delete buttons should not be visible (CSS hides them)
          // We check that the allow-edit class controls visibility
          assert.ok(
            !root.querySelector(".sheet-wrapper.allow-edit"),
            "Sheet wrapper should not have allow-edit class when locked"
          );
        });

        it("unlocked sheet shows edit controls", async function () {
          this.timeout(5000);
          const sheet = await ensureSheet(actor);
          await clickEditToggle(sheet);

          const root = sheet.element?.[0] || sheet.element;
          assert.ok(
            root.querySelector(".sheet-wrapper.allow-edit"),
            "Sheet wrapper should have allow-edit class when unlocked"
          );
        });
      });

      describe("Crew Sheet Edit Mode", function () {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          await clearAllowEditStates();
          const result = await createTestCrewActor({
            name: "EditMode-CrewSheet-Test"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await closeAllDialogs();
          if (actor) {
            try {
              if (actor.sheet) {
                await actor.sheet.close();
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
            } catch {
              // Ignore close errors
            }
            await actor.delete();
            actor = null;
          }
          await clearAllowEditStates();
        });

        it("crew sheet defaults to locked", async function () {
          const sheet = await ensureSheet(actor);
          assert.equal(sheet.allow_edit, false, "Crew sheet should default to locked");
          assert.ok(!isSheetUnlocked(sheet), "Crew sheet DOM should not have allow-edit class");
        });

        it("clicking edit toggle unlocks the crew sheet", async function () {
          this.timeout(5000);
          const sheet = await ensureSheet(actor);
          assert.ok(!isSheetUnlocked(sheet), "Crew sheet should start locked");

          await clickEditToggle(sheet);

          assert.equal(sheet.allow_edit, true, "Crew sheet allow_edit should be true after toggle");
          assert.ok(isSheetUnlocked(sheet), "Crew sheet DOM should have allow-edit class");
        });

        it("crew sheet edit state persists across close/reopen", async function () {
          this.timeout(5000);
          let sheet = await ensureSheet(actor);

          await clickEditToggle(sheet); // Unlock
          assert.ok(isSheetUnlocked(sheet), "Crew sheet should be unlocked");

          // CRITICAL: Verify user flag was actually stored
          const userFlags = game.user?.getFlag(TARGET_MODULE_ID, "allowEditStates");
          assert.ok(
            userFlags !== undefined,
            "User should have allowEditStates flag after toggling crew edit mode"
          );
          assert.ok(
            userFlags?.[actor.id] === true,
            `User flag should store crew actor ${actor.id} as unlocked (flag value: ${JSON.stringify(userFlags)})`
          );

          // Close and reopen sheet
          await sheet.close();
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Reset the sheet instance
          actor._sheet = null;
          sheet = await ensureSheet(actor);

          assert.equal(sheet.allow_edit, true, "Crew sheet should remember unlocked state");
          assert.ok(isSheetUnlocked(sheet), "Crew sheet DOM should still have allow-edit class");

          // CRITICAL: Verify flag is still present after reopen
          const userFlagsAfter = game.user?.getFlag(TARGET_MODULE_ID, "allowEditStates");
          assert.ok(
            userFlagsAfter?.[actor.id] === true,
            `User flag should still store crew actor ${actor.id} as unlocked after reopen`
          );

          console.log(`[EditMode Test] Crew edit state persisted via user flag for actor ${actor.id}`);
        });
      });
    },
    { displayName: "BitD Alt Sheets: Edit Mode" }
  );
});
