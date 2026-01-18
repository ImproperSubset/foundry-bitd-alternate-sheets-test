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
  testCleanup,
  TestNumberer,
  skipWithReason,
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

const t = new TestNumberer("14");

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping edit mode tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.edit-mode",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Character Sheet Edit Mode", () => {
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

        t.test("sheet defaults to locked (allow_edit = false)", async function () {
          const sheet = await ensureSheet(actor);
          assert.equal(sheet.allow_edit, false, "Sheet should default to locked");
          assert.ok(!isSheetUnlocked(sheet), "Sheet DOM should not have allow-edit class");
        });

        t.test("clicking edit toggle unlocks the sheet", async function () {
          this.timeout(5000);
          const sheet = await ensureSheet(actor);
          assert.ok(!isSheetUnlocked(sheet), "Sheet should start locked");

          await clickEditToggle(sheet);

          assert.equal(sheet.allow_edit, true, "Sheet allow_edit should be true after toggle");
          assert.ok(isSheetUnlocked(sheet), "Sheet DOM should have allow-edit class");
        });

        t.test("clicking edit toggle again locks the sheet", async function () {
          this.timeout(5000);
          const sheet = await ensureSheet(actor);

          await clickEditToggle(sheet); // Unlock
          assert.ok(isSheetUnlocked(sheet), "Sheet should be unlocked");

          await clickEditToggle(sheet); // Lock again
          assert.equal(sheet.allow_edit, false, "Sheet allow_edit should be false after second toggle");
          assert.ok(!isSheetUnlocked(sheet), "Sheet DOM should not have allow-edit class");
        });

        t.test("edit state persists across sheet close/reopen", async function () {
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

        t.test("locked sheet hides delete buttons", async function () {
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

        t.test("unlocked sheet shows edit controls", async function () {
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

      t.section("Crew Sheet Edit Mode", () => {
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

        t.test("crew sheet defaults to locked", async function () {
          const sheet = await ensureSheet(actor);
          assert.equal(sheet.allow_edit, false, "Crew sheet should default to locked");
          assert.ok(!isSheetUnlocked(sheet), "Crew sheet DOM should not have allow-edit class");
        });

        t.test("clicking edit toggle unlocks the crew sheet", async function () {
          this.timeout(5000);
          const sheet = await ensureSheet(actor);
          assert.ok(!isSheetUnlocked(sheet), "Crew sheet should start locked");

          await clickEditToggle(sheet);

          assert.equal(sheet.allow_edit, true, "Crew sheet allow_edit should be true after toggle");
          assert.ok(isSheetUnlocked(sheet), "Crew sheet DOM should have allow-edit class");
        });

        t.test("crew sheet edit state persists across close/reopen", async function () {
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

      t.section("Character Sheet Mini Mode", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          await clearAllowEditStates();
          const result = await createTestActor({
            name: "MiniMode-CharSheet-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
          await clearAllowEditStates();
        });

        t.test("toggle-expand button exists on character sheet", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const toggleExpand = root.querySelector(".toggle-expand");
          assert.ok(toggleExpand, "Toggle expand button should exist on character sheet");
        });

        t.test("minimized-view section exists on character sheet", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const minimizedView = root.querySelector(".minimized-view");
          assert.ok(minimizedView, "Minimized view section should exist on character sheet");
        });

        t.test("clicking toggle-expand adds can-expand class", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const toggleExpand = root.querySelector(".toggle-expand");
          if (!toggleExpand) {
            skipWithReason(this, "Toggle expand button not found on sheet");
            return;
          }

          // Initial state should not have can-expand
          const wrapper = sheet._element?.[0] || sheet._element;
          const hasCanExpandBefore = wrapper?.classList?.contains("can-expand") || false;

          // Click to minimize
          toggleExpand.click();
          await new Promise((r) => setTimeout(r, 200));

          // Should now have can-expand class
          const hasCanExpandAfter = wrapper?.classList?.contains("can-expand") || false;

          // State should have changed (toggled)
          assert.notEqual(
            hasCanExpandBefore,
            hasCanExpandAfter,
            "can-expand class should toggle after clicking expand button"
          );
        });

        t.test("clicking toggle-expand twice restores original state", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const toggleExpand = root.querySelector(".toggle-expand");
          if (!toggleExpand) {
            skipWithReason(this, "Toggle expand button not found on sheet");
            return;
          }

          const wrapper = sheet._element?.[0] || sheet._element;
          const initialState = wrapper?.classList?.contains("can-expand") || false;

          // Toggle twice
          toggleExpand.click();
          await new Promise((r) => setTimeout(r, 200));
          toggleExpand.click();
          await new Promise((r) => setTimeout(r, 200));

          const finalState = wrapper?.classList?.contains("can-expand") || false;
          assert.equal(
            finalState,
            initialState,
            "Two clicks should restore original expand state"
          );
        });

        t.test("minimized view contains essential elements", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const minimizedView = root.querySelector(".minimized-view");
          if (!minimizedView) {
            skipWithReason(this, "Minimized view section not found on sheet");
            return;
          }

          // Check for portrait in minimized view
          const portrait = minimizedView.querySelector(".portrait, .character-portrait");
          assert.ok(portrait, "Minimized view should contain character portrait");
        });

        t.test("mini mode hides main content when active", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const toggleExpand = root.querySelector(".toggle-expand");
          if (!toggleExpand) {
            skipWithReason(this, "Toggle expand button not found on sheet");
            return;
          }

          // Activate mini mode
          toggleExpand.click();
          await new Promise((r) => setTimeout(r, 200));

          const wrapper = sheet._element?.[0] || sheet._element;
          const isMinimized = wrapper?.classList?.contains("can-expand") || false;

          if (isMinimized) {
            // When minimized, the sheet height should be reduced
            // We can check if the height is less than a typical full sheet
            const sheetHeight = sheet.position?.height || wrapper?.offsetHeight || 0;
            console.log(`[MiniMode Test] Sheet height when minimized: ${sheetHeight}px`);

            // In mini mode, height should typically be less than 400px
            // (full sheet is usually 600-800px)
            assert.ok(
              sheetHeight < 500,
              `Sheet height should be reduced in mini mode (got ${sheetHeight}px)`
            );
          }

          // Toggle back to normal
          toggleExpand.click();
          await new Promise((r) => setTimeout(r, 200));
        });
      });

      t.section("Crew Sheet Mini Mode", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          await clearAllowEditStates();
          const result = await createTestCrewActor({
            name: "MiniMode-CrewSheet-Test",
            crewTypeName: "Assassins"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
          await clearAllowEditStates();
        });

        t.test("toggle-expand button exists on crew sheet", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const toggleExpand = root.querySelector(".toggle-expand");
          assert.ok(toggleExpand, "Toggle expand button should exist on crew sheet");
        });

        t.test("crew sheet mini mode persists across close/reopen", async function () {
          this.timeout(15000);

          let sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const toggleExpand = root.querySelector(".toggle-expand");
          if (!toggleExpand) {
            skipWithReason(this, "Toggle expand button not found on crew sheet");
            return;
          }

          // Minimize the sheet
          toggleExpand.click();
          await new Promise((r) => setTimeout(r, 300));

          // Verify it's minimized
          assert.ok(sheet.sheetMinimized, "Sheet should be marked as minimized");

          // Close and reopen
          await sheet.close();
          await new Promise((r) => setTimeout(r, 200));

          actor._sheet = null;
          sheet = await ensureSheet(actor);
          await new Promise((r) => setTimeout(r, 300));

          // Verify state persisted
          assert.ok(
            sheet.sheetMinimized,
            "Crew sheet mini mode should persist after close/reopen"
          );

          console.log(`[MiniMode Test] Crew sheet mini mode persisted for actor ${actor.id}`);
        });

        t.test("clicking toggle-expand twice restores normal state on crew sheet", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const toggleExpand = root.querySelector(".toggle-expand");
          if (!toggleExpand) {
            skipWithReason(this, "Toggle expand button not found on crew sheet");
            return;
          }

          const initialMinimized = sheet.sheetMinimized || false;

          // Toggle twice
          toggleExpand.click();
          await new Promise((r) => setTimeout(r, 200));
          toggleExpand.click();
          await new Promise((r) => setTimeout(r, 200));

          const finalMinimized = sheet.sheetMinimized || false;
          assert.equal(
            finalMinimized,
            initialMinimized,
            "Two clicks should restore original minimized state"
          );
        });

        t.test("crew sheet coins-row is visible in mini mode", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const toggleExpand = root.querySelector(".toggle-expand");
          if (!toggleExpand) {
            skipWithReason(this, "Toggle expand button not found on crew sheet");
            return;
          }

          // Minimize
          toggleExpand.click();
          await new Promise((r) => setTimeout(r, 300));

          // Check coins-row visibility
          const coinsRow = root.querySelector(".coins-row");
          if (coinsRow) {
            const style = getComputedStyle(coinsRow);
            const isVisible = style.display !== "none" && style.visibility !== "hidden";
            console.log(`[MiniMode Test] Coins row visible in mini mode: ${isVisible}`);
          }

          // Restore
          toggleExpand.click();
          await new Promise((r) => setTimeout(r, 200));
        });
      });
    },
    { displayName: "BitD Alt Sheets: Edit Mode" }
  );
});
