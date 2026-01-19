/**
 * Quench test batch for Clear Load button in load popout.
 * Tests visibility based on user role and setting, button functionality, and localization.
 */

import {
  createTestActor,
  ensureSheet,
  isTargetModuleActive,
  testCleanup,
  closeAllDialogs,
  TestNumberer,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

const t = new TestNumberer("30");

/**
 * Helper to temporarily mock game.user.isGM for testing player perspective.
 * Returns a restore function that MUST be called to restore original value.
 */
function mockIsGM(value) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(game.user, "isGM");
  const originalValue = game.user.isGM;

  Object.defineProperty(game.user, "isGM", {
    get: () => value,
    configurable: true,
  });

  return function restore() {
    if (originalDescriptor) {
      Object.defineProperty(game.user, "isGM", originalDescriptor);
    } else {
      Object.defineProperty(game.user, "isGM", {
        get: () => originalValue,
        configurable: true,
      });
    }
  };
}

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping clear-load-button tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.clear-load-button",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Setting Registration", () => {
        t.test("showClearLoadButton setting is registered", function () {
          const value = game.settings.get(TARGET_MODULE_ID, "showClearLoadButton");
          assert.ok(
            typeof value === "boolean",
            `showClearLoadButton should be a boolean (got ${typeof value})`
          );
        });

        t.test("showClearLoadButton defaults to false", function () {
          const setting = game.settings.settings.get(`${TARGET_MODULE_ID}.showClearLoadButton`);
          assert.ok(setting, "showClearLoadButton setting should exist");
          assert.strictEqual(
            setting.default,
            false,
            "showClearLoadButton should default to false"
          );
        });

        t.test("showClearLoadButton is world-scoped", function () {
          const setting = game.settings.settings.get(`${TARGET_MODULE_ID}.showClearLoadButton`);
          assert.ok(setting, "showClearLoadButton setting should exist");
          assert.strictEqual(
            setting.scope,
            "world",
            "showClearLoadButton should be world-scoped"
          );
        });
      });

      t.section("GM Button Visibility", () => {
        let actor;
        let originalSetting;

        beforeEach(async function () {
          this.timeout(10000);
          originalSetting = game.settings.get(TARGET_MODULE_ID, "showClearLoadButton");

          const result = await createTestActor({
            name: "ClearLoadButton-GM-Visibility-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(12000);
          await closeAllDialogs();
          await new Promise(resolve => setTimeout(resolve, 100));

          await testCleanup({
            actors: [actor],
            settings: {
              moduleId: TARGET_MODULE_ID,
              values: { showClearLoadButton: originalSetting }
            }
          });

          await new Promise(resolve => setTimeout(resolve, 300));
          actor = null;
        });

        t.test("GM sees button when setting is OFF", async function () {
          this.timeout(10000);

          // Precondition: must be running as GM
          assert.ok(game.user.isGM, "This test requires GM user");

          await game.settings.set(TARGET_MODULE_ID, "showClearLoadButton", false);
          await new Promise(resolve => setTimeout(resolve, 100));

          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 300));

          const root = sheet.element?.[0] || sheet.element;
          const loadBox = root.querySelector(".load-box");
          assert.ok(loadBox, "Load box must exist on sheet");

          loadBox.click();
          await new Promise(resolve => setTimeout(resolve, 200));

          const fullView = root.querySelector(".load-box .full-view");
          const clearButton = fullView?.querySelector("button.clearLoad");

          assert.ok(clearButton, "GM MUST see Clear Load button even with setting OFF");
        });

        t.test("GM sees button when setting is ON", async function () {
          this.timeout(10000);

          assert.ok(game.user.isGM, "This test requires GM user");

          await game.settings.set(TARGET_MODULE_ID, "showClearLoadButton", true);
          await new Promise(resolve => setTimeout(resolve, 100));

          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 300));

          const root = sheet.element?.[0] || sheet.element;
          const loadBox = root.querySelector(".load-box");
          loadBox.click();
          await new Promise(resolve => setTimeout(resolve, 200));

          const fullView = root.querySelector(".load-box .full-view");
          const clearButton = fullView?.querySelector("button.clearLoad");

          assert.ok(clearButton, "GM MUST see Clear Load button with setting ON");
        });

        t.test("getData returns showClearLoadButton=true for GM regardless of setting", async function () {
          this.timeout(10000);

          assert.ok(game.user.isGM, "This test requires GM user");

          // Test with setting OFF
          await game.settings.set(TARGET_MODULE_ID, "showClearLoadButton", false);
          await new Promise(resolve => setTimeout(resolve, 100));

          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 300));

          const sheetData = await sheet.getData();
          assert.strictEqual(
            sheetData.showClearLoadButton,
            true,
            "showClearLoadButton MUST be true for GM even with setting OFF"
          );
        });
      });

      t.section("Player Button Visibility (Monkey Patched)", () => {
        let actor;
        let originalSetting;
        let restoreIsGM;

        beforeEach(async function () {
          this.timeout(10000);
          originalSetting = game.settings.get(TARGET_MODULE_ID, "showClearLoadButton");

          const result = await createTestActor({
            name: "ClearLoadButton-Player-Visibility-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(12000);

          // CRITICAL: Always restore isGM first
          if (restoreIsGM) {
            restoreIsGM();
            restoreIsGM = null;
          }

          await closeAllDialogs();
          await new Promise(resolve => setTimeout(resolve, 100));

          await testCleanup({
            actors: [actor],
            settings: {
              moduleId: TARGET_MODULE_ID,
              values: { showClearLoadButton: originalSetting }
            }
          });

          await new Promise(resolve => setTimeout(resolve, 300));
          actor = null;
        });

        t.test("Player does NOT see button when setting is OFF", async function () {
          this.timeout(10000);

          // Set setting to OFF BEFORE mocking isGM
          await game.settings.set(TARGET_MODULE_ID, "showClearLoadButton", false);
          await new Promise(resolve => setTimeout(resolve, 100));

          // Mock as non-GM player
          restoreIsGM = mockIsGM(false);
          assert.strictEqual(game.user.isGM, false, "isGM should be mocked to false");

          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 300));

          // Force re-render with mocked isGM
          await sheet.render(true);
          await new Promise(resolve => setTimeout(resolve, 300));

          const root = sheet.element?.[0] || sheet.element;
          const loadBox = root.querySelector(".load-box");
          assert.ok(loadBox, "Load box must exist on sheet");

          loadBox.click();
          await new Promise(resolve => setTimeout(resolve, 200));

          const fullView = root.querySelector(".load-box .full-view");
          const clearButton = fullView?.querySelector("button.clearLoad");

          assert.ok(
            !clearButton,
            "Player MUST NOT see Clear Load button when setting is OFF"
          );

          console.log("[ClearLoadButton Test] Player correctly cannot see button with setting OFF");
        });

        t.test("Player DOES see button when setting is ON", async function () {
          this.timeout(10000);

          // Set setting to ON BEFORE mocking isGM
          await game.settings.set(TARGET_MODULE_ID, "showClearLoadButton", true);
          await new Promise(resolve => setTimeout(resolve, 100));

          // Mock as non-GM player
          restoreIsGM = mockIsGM(false);
          assert.strictEqual(game.user.isGM, false, "isGM should be mocked to false");

          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 300));

          // Force re-render with mocked isGM
          await sheet.render(true);
          await new Promise(resolve => setTimeout(resolve, 300));

          const root = sheet.element?.[0] || sheet.element;
          const loadBox = root.querySelector(".load-box");
          loadBox.click();
          await new Promise(resolve => setTimeout(resolve, 200));

          const fullView = root.querySelector(".load-box .full-view");
          const clearButton = fullView?.querySelector("button.clearLoad");

          assert.ok(
            clearButton,
            "Player MUST see Clear Load button when setting is ON"
          );

          console.log("[ClearLoadButton Test] Player correctly sees button with setting ON");
        });

        t.test("getData returns showClearLoadButton=false for player with setting OFF", async function () {
          this.timeout(10000);

          await game.settings.set(TARGET_MODULE_ID, "showClearLoadButton", false);
          await new Promise(resolve => setTimeout(resolve, 100));

          // Mock as non-GM player
          restoreIsGM = mockIsGM(false);
          assert.strictEqual(game.user.isGM, false, "isGM should be mocked to false");

          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 300));

          const sheetData = await sheet.getData();
          assert.strictEqual(
            sheetData.showClearLoadButton,
            false,
            "showClearLoadButton MUST be false for player with setting OFF"
          );
        });

        t.test("getData returns showClearLoadButton=true for player with setting ON", async function () {
          this.timeout(10000);

          await game.settings.set(TARGET_MODULE_ID, "showClearLoadButton", true);
          await new Promise(resolve => setTimeout(resolve, 100));

          // Mock as non-GM player
          restoreIsGM = mockIsGM(false);
          assert.strictEqual(game.user.isGM, false, "isGM should be mocked to false");

          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 300));

          const sheetData = await sheet.getData();
          assert.strictEqual(
            sheetData.showClearLoadButton,
            true,
            "showClearLoadButton MUST be true for player with setting ON"
          );
        });
      });

      t.section("Button Functionality", () => {
        let actor;
        let originalSetting;

        beforeEach(async function () {
          this.timeout(15000);

          originalSetting = game.settings.get(TARGET_MODULE_ID, "showClearLoadButton");
          await game.settings.set(TARGET_MODULE_ID, "showClearLoadButton", true);

          const result = await createTestActor({
            name: "ClearLoadButton-Functionality-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(12000);

          await closeAllDialogs();
          await new Promise(resolve => setTimeout(resolve, 100));

          await testCleanup({
            actors: [actor],
            settings: {
              moduleId: TARGET_MODULE_ID,
              values: { showClearLoadButton: originalSetting }
            }
          });

          await new Promise(resolve => setTimeout(resolve, 300));
          actor = null;
        });

        t.test("clicking button clears equipped items flag", async function () {
          this.timeout(15000);

          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 500));

          let root = sheet.element?.[0] || sheet.element;

          // Find real item checkboxes on the sheet and get their IDs
          const itemBlocks = root.querySelectorAll(".item-block[data-item-id]");
          assert.ok(
            itemBlocks.length >= 2,
            `Sheet must have at least 2 items to test clearing (found ${itemBlocks.length})`
          );

          // Get real item IDs and their load values from the DOM
          const item1 = itemBlocks[0];
          const item2 = itemBlocks[1];
          const item1Id = item1.dataset.itemId;
          const item2Id = item2.dataset.itemId;
          const item1Load = parseInt(item1.dataset.itemLoad) || 1;
          const item2Load = parseInt(item2.dataset.itemLoad) || 1;
          const expectedLoad = item1Load + item2Load;

          assert.ok(item1Id, "First item must have a valid ID");
          assert.ok(item2Id, "Second item must have a valid ID");

          // Equip these real items by setting the flag
          await actor.setFlag(TARGET_MODULE_ID, "equipped-items", {
            [item1Id]: { id: item1Id, load: item1Load, name: "Item 1", progress: item1Load },
            [item2Id]: { id: item2Id, load: item2Load, name: "Item 2", progress: item2Load }
          });
          await new Promise(resolve => setTimeout(resolve, 200));

          // Re-render to reflect equipped state
          await sheet.render(true);
          await new Promise(resolve => setTimeout(resolve, 400));

          // CRITICAL: Verify loadout is non-zero BEFORE clearing
          root = sheet.element?.[0] || sheet.element;
          // The load display uses .load-amounts class with format "X/Y" (loadout/max_load)
          const loadValueEl = root.querySelector(".load-box .load-amounts");
          assert.ok(loadValueEl, "Load value element must exist on sheet");

          // Parse loadout from "X/Y" format (e.g., "3/5")
          const loadText = loadValueEl.textContent.trim();
          const loadoutBefore = parseInt(loadText.split("/")[0]);
          assert.ok(
            !Number.isNaN(loadoutBefore),
            `Loadout must be a valid number before clearing (got "${loadText}")`
          );
          assert.ok(
            loadoutBefore >= expectedLoad,
            `Loadout MUST be >= ${expectedLoad} before clearing to prove items are equipped (got ${loadoutBefore})`
          );

          // Count checked item checkboxes BEFORE clearing
          const checkedBefore = root.querySelectorAll(".item-checkbox:checked").length;
          assert.ok(
            checkedBefore >= 2,
            `At least 2 item checkboxes MUST be checked before clearing (found ${checkedBefore})`
          );

          console.log(`[ClearLoadButton Test] BEFORE: loadout=${loadoutBefore}, checked=${checkedBefore}`);

          // Now open the load popout and click clear
          const loadBox = root.querySelector(".load-box");
          loadBox.click();
          await new Promise(resolve => setTimeout(resolve, 200));

          const fullView = root.querySelector(".load-box .full-view");
          const clearButton = fullView?.querySelector("button.clearLoad");
          assert.ok(clearButton, "Clear Load button must exist in popout");

          clearButton.click();
          await new Promise(resolve => setTimeout(resolve, 500));

          // Verify flag is completely removed (must be undefined, not empty object)
          const equippedAfter = actor.getFlag(TARGET_MODULE_ID, "equipped-items");
          assert.strictEqual(
            equippedAfter,
            undefined,
            `equipped-items flag MUST be undefined after clearing (got ${JSON.stringify(equippedAfter)})`
          );

          // Re-render and verify UI changed
          await sheet.render(true);
          await new Promise(resolve => setTimeout(resolve, 400));

          root = sheet.element?.[0] || sheet.element;
          const loadValueElAfter = root.querySelector(".load-box .load-amounts");
          // Parse loadout from "X/Y" format
          const loadTextAfter = loadValueElAfter?.textContent?.trim() || "0/0";
          const loadoutAfter = parseInt(loadTextAfter.split("/")[0]) || 0;

          assert.strictEqual(
            loadoutAfter,
            0,
            `Loadout MUST be exactly 0 after clearing (got ${loadoutAfter})`
          );

          // Verify NO item checkboxes are checked
          const checkedAfter = root.querySelectorAll(".item-checkbox:checked").length;
          assert.strictEqual(
            checkedAfter,
            0,
            `Zero item checkboxes must be checked after clearing (found ${checkedAfter})`
          );

          console.log(`[ClearLoadButton Test] AFTER: loadout=${loadoutAfter}, checked=${checkedAfter}`);
        });

        t.test("button uses localized label matching exact translation", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 300));

          const root = sheet.element?.[0] || sheet.element;
          const loadBox = root.querySelector(".load-box");
          loadBox.click();
          await new Promise(resolve => setTimeout(resolve, 200));

          const fullView = root.querySelector(".load-box .full-view");
          const clearButton = fullView?.querySelector("button.clearLoad");
          assert.ok(clearButton, "Clear Load button must be visible");

          const actualText = clearButton.textContent.trim();

          // The button text must not be the raw key
          assert.notStrictEqual(
            actualText,
            "bitd-alt.ClearLoad",
            "Button must display translated text, not the raw localization key"
          );

          // The button text must not be empty
          assert.ok(
            actualText.length > 0,
            "Button text must not be empty"
          );

          // Verify it matches the localized value
          const expectedText = game.i18n.localize("bitd-alt.ClearLoad");
          assert.strictEqual(
            actualText,
            expectedText,
            `Button text must match localized value "${expectedText}" (got "${actualText}")`
          );
        });
      });

      t.section("No-Op Edge Cases", () => {
        let actor;
        let originalSetting;

        beforeEach(async function () {
          this.timeout(15000);

          originalSetting = game.settings.get(TARGET_MODULE_ID, "showClearLoadButton");
          await game.settings.set(TARGET_MODULE_ID, "showClearLoadButton", true);

          const result = await createTestActor({
            name: "ClearLoadButton-NoOp-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(12000);

          await closeAllDialogs();
          await new Promise(resolve => setTimeout(resolve, 100));

          await testCleanup({
            actors: [actor],
            settings: {
              moduleId: TARGET_MODULE_ID,
              values: { showClearLoadButton: originalSetting }
            }
          });

          await new Promise(resolve => setTimeout(resolve, 300));
          actor = null;
        });

        t.test("clicking button when flag is undefined does not error", async function () {
          this.timeout(10000);

          // Ensure no equipped items flag exists
          const existingFlag = actor.getFlag(TARGET_MODULE_ID, "equipped-items");
          if (existingFlag !== undefined) {
            await actor.unsetFlag(TARGET_MODULE_ID, "equipped-items");
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          // Verify precondition: flag must be undefined
          const flagBefore = actor.getFlag(TARGET_MODULE_ID, "equipped-items");
          assert.strictEqual(
            flagBefore,
            undefined,
            "equipped-items flag MUST be undefined before test"
          );

          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 300));

          const root = sheet.element?.[0] || sheet.element;
          const loadBox = root.querySelector(".load-box");
          loadBox.click();
          await new Promise(resolve => setTimeout(resolve, 200));

          const fullView = root.querySelector(".load-box .full-view");
          const clearButton = fullView?.querySelector("button.clearLoad");
          assert.ok(clearButton, "Clear Load button must exist");

          // This should not throw an error
          let errorOccurred = false;
          try {
            clearButton.click();
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (e) {
            errorOccurred = true;
            console.error("[ClearLoadButton Test] Error clicking clear on undefined flag:", e);
          }

          assert.strictEqual(
            errorOccurred,
            false,
            "Clicking Clear Load when flag is undefined must not throw an error"
          );

          // Flag should still be undefined (no empty object created)
          const flagAfter = actor.getFlag(TARGET_MODULE_ID, "equipped-items");
          assert.strictEqual(
            flagAfter,
            undefined,
            "equipped-items flag must remain undefined after no-op clear"
          );

          console.log("[ClearLoadButton Test] No-op on undefined flag: PASS");
        });

        t.test("clicking button when flag is empty object does not error", async function () {
          this.timeout(10000);

          // Set flag to empty object (simulates unequipping all items one by one)
          await actor.setFlag(TARGET_MODULE_ID, "equipped-items", {});
          await new Promise(resolve => setTimeout(resolve, 200));

          // Verify precondition: flag must be empty object
          const flagBefore = actor.getFlag(TARGET_MODULE_ID, "equipped-items");
          assert.ok(
            flagBefore !== undefined,
            "equipped-items flag must exist (as empty object)"
          );
          assert.strictEqual(
            Object.keys(flagBefore).length,
            0,
            "equipped-items flag must be an empty object"
          );

          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 300));

          const root = sheet.element?.[0] || sheet.element;
          const loadBox = root.querySelector(".load-box");
          loadBox.click();
          await new Promise(resolve => setTimeout(resolve, 200));

          const fullView = root.querySelector(".load-box .full-view");
          const clearButton = fullView?.querySelector("button.clearLoad");
          assert.ok(clearButton, "Clear Load button must exist");

          // This should not throw an error
          let errorOccurred = false;
          try {
            clearButton.click();
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (e) {
            errorOccurred = true;
            console.error("[ClearLoadButton Test] Error clicking clear on empty object flag:", e);
          }

          assert.strictEqual(
            errorOccurred,
            false,
            "Clicking Clear Load when flag is empty object must not throw an error"
          );

          // Flag should be cleared (undefined) after clicking
          const flagAfter = actor.getFlag(TARGET_MODULE_ID, "equipped-items");
          assert.strictEqual(
            flagAfter,
            undefined,
            "equipped-items flag should be undefined after clearing empty object"
          );

          console.log("[ClearLoadButton Test] Clear on empty object flag: PASS");
        });

        t.test("loadout displays 0 when nothing is equipped", async function () {
          this.timeout(10000);

          // Ensure no equipped items
          await actor.unsetFlag(TARGET_MODULE_ID, "equipped-items");
          await new Promise(resolve => setTimeout(resolve, 200));

          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 300));

          const root = sheet.element?.[0] || sheet.element;
          // The load display uses .load-amounts class with format "X/Y" (loadout/max_load)
          const loadValueEl = root.querySelector(".load-box .load-amounts");
          assert.ok(loadValueEl, "Load value element must exist");

          // Parse loadout from "X/Y" format
          const loadText = loadValueEl.textContent.trim();
          const loadout = parseInt(loadText.split("/")[0]) || 0;
          assert.strictEqual(
            loadout,
            0,
            `Loadout must be 0 when nothing is equipped (got ${loadout} from "${loadText}")`
          );
        });
      });

      t.section("Localization", () => {
        t.test("bitd-alt.ClearLoad localization key exists and is not the key itself", function () {
          const localized = game.i18n.localize("bitd-alt.ClearLoad");

          // If the key doesn't exist, localize returns the key itself
          assert.notStrictEqual(
            localized,
            "bitd-alt.ClearLoad",
            "bitd-alt.ClearLoad must return a translation, not the key itself"
          );
        });

        t.test("English translation is exactly 'Clear Load'", function () {
          const localized = game.i18n.localize("bitd-alt.ClearLoad");

          // Check if we're in English locale
          if (game.i18n.lang === "en") {
            assert.strictEqual(
              localized,
              "Clear Load",
              `English translation must be exactly "Clear Load" (got "${localized}")`
            );
          } else {
            // If not English, just verify it's a non-empty translation
            assert.ok(
              localized && localized.length > 0 && localized !== "bitd-alt.ClearLoad",
              `Non-English translation must be non-empty and not the key (got "${localized}")`
            );
            console.log(`[ClearLoadButton Test] Skipping exact English check - current locale: ${game.i18n.lang}`);
          }
        });
      });
    },
    { displayName: "BitD Alt Sheets: Clear Load Button" }
  );
});
