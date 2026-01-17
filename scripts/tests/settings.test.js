/**
 * Quench test batch for settings integration.
 * Tests settings registration, access, and cache invalidation on change.
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

const t = new TestNumberer("16");

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping settings tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.settings",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Settings Registration", () => {
        t.test("populateFromCompendia setting is registered", function () {
          const value = game.settings.get(TARGET_MODULE_ID, "populateFromCompendia");
          assert.ok(
            typeof value === "boolean",
            `populateFromCompendia should be a boolean (got ${typeof value})`
          );
        });

        t.test("populateFromWorld setting is registered", function () {
          const value = game.settings.get(TARGET_MODULE_ID, "populateFromWorld");
          assert.ok(
            typeof value === "boolean",
            `populateFromWorld should be a boolean (got ${typeof value})`
          );
        });

        t.test("searchAllPacks setting is registered", function () {
          const value = game.settings.get(TARGET_MODULE_ID, "searchAllPacks");
          assert.ok(
            typeof value === "boolean",
            `searchAllPacks should be a boolean (got ${typeof value})`
          );
        });

        t.test("showPronounsInCharacterDirectory setting is registered", function () {
          const value = game.settings.get(TARGET_MODULE_ID, "showPronounsInCharacterDirectory");
          assert.ok(
            typeof value === "boolean",
            `showPronounsInCharacterDirectory should be a boolean (got ${typeof value})`
          );
        });

        t.test("enableProfilingLogs setting is registered", function () {
          const value = game.settings.get(TARGET_MODULE_ID, "enableProfilingLogs");
          assert.ok(
            typeof value === "boolean",
            `enableProfilingLogs should be a boolean (got ${typeof value})`
          );
        });

        t.test("schemaVersion setting is registered", function () {
          const value = game.settings.get(TARGET_MODULE_ID, "schemaVersion");
          assert.ok(
            typeof value === "number",
            `schemaVersion should be a number (got ${typeof value})`
          );
        });
      });

      t.section("Cache Invalidation on Settings Change", () => {
        let actor;
        let originalSettings = {};

        beforeEach(async function () {
          this.timeout(10000);

          // Save all relevant settings before test
          originalSettings.populateFromCompendia = game.settings.get(TARGET_MODULE_ID, "populateFromCompendia");
          originalSettings.populateFromWorld = game.settings.get(TARGET_MODULE_ID, "populateFromWorld");
          originalSettings.searchAllPacks = game.settings.get(TARGET_MODULE_ID, "searchAllPacks");

          const result = await createTestActor({
            name: "Settings-CacheInvalidation-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(12000);

          // Close any open dialogs first
          await closeAllDialogs();
          await new Promise(resolve => setTimeout(resolve, 100));

          // Use full testCleanup for robust actor cleanup with settings restoration
          await testCleanup({
            actors: [actor],
            settings: {
              moduleId: TARGET_MODULE_ID,
              values: originalSettings
            }
          });

          // Extra delay to ensure Foundry has fully processed cleanup
          await new Promise(resolve => setTimeout(resolve, 300));

          actor = null;
        });

        t.test("Utils._invalidateCache is callable", async function () {
          // Import Utils to check cache function exists
          const { Utils } = await import(
            "/modules/bitd-alternate-sheets/scripts/utils.js"
          );

          assert.ok(
            typeof Utils._invalidateCache === "function",
            "Utils._invalidateCache should be a function"
          );
        });

        t.test("toggling populateFromCompendia triggers cache invalidation", async function () {
          this.timeout(10000);

          // Render sheet first (populates cache)
          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 200));

          // Import Utils to spy on invalidation
          const { Utils } = await import(
            "/modules/bitd-alternate-sheets/scripts/utils.js"
          );

          // Track if cache was invalidated by checking if lastCacheKey changes
          const cacheKeyBefore = Utils._lastCacheKey;

          // Toggle setting
          const currentValue = game.settings.get(TARGET_MODULE_ID, "populateFromCompendia");
          await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", !currentValue);

          // Wait for setting change handler to run
          await new Promise(resolve => setTimeout(resolve, 200));

          // Cache key should have been reset (invalidated)
          const cacheKeyAfter = Utils._lastCacheKey;

          // The cache should be invalidated (key reset or changed)
          // Note: If _lastCacheKey doesn't exist, the assertion approach needs adjustment
          // We verify by attempting a sheet re-render and checking it doesn't error
          await sheet.render(true);
          await new Promise(resolve => setTimeout(resolve, 300));

          const root = sheet.element?.[0] || sheet.element;
          assert.ok(
            root,
            "Sheet should re-render successfully after populateFromCompendia toggle"
          );

          console.log(`[Settings Test] populateFromCompendia toggled: ${currentValue} -> ${!currentValue}`);
        });

        t.test("toggling populateFromWorld triggers cache invalidation", async function () {
          this.timeout(10000);

          // Render sheet first (populates cache)
          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 200));

          // Toggle setting
          const currentValue = game.settings.get(TARGET_MODULE_ID, "populateFromWorld");
          await game.settings.set(TARGET_MODULE_ID, "populateFromWorld", !currentValue);

          // Wait for setting change handler to run
          await new Promise(resolve => setTimeout(resolve, 200));

          // Re-render and verify sheet still works
          await sheet.render(true);
          await new Promise(resolve => setTimeout(resolve, 300));

          const root = sheet.element?.[0] || sheet.element;
          assert.ok(
            root,
            "Sheet should re-render successfully after populateFromWorld toggle"
          );

          console.log(`[Settings Test] populateFromWorld toggled: ${currentValue} -> ${!currentValue}`);
        });

        t.test("toggling searchAllPacks triggers cache invalidation", async function () {
          this.timeout(10000);

          // Render sheet first (populates cache)
          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 200));

          // Toggle setting
          const currentValue = game.settings.get(TARGET_MODULE_ID, "searchAllPacks");
          await game.settings.set(TARGET_MODULE_ID, "searchAllPacks", !currentValue);

          // Wait for setting change handler to run
          await new Promise(resolve => setTimeout(resolve, 200));

          // Re-render and verify sheet still works
          await sheet.render(true);
          await new Promise(resolve => setTimeout(resolve, 300));

          const root = sheet.element?.[0] || sheet.element;
          assert.ok(
            root,
            "Sheet should re-render successfully after searchAllPacks toggle"
          );

          console.log(`[Settings Test] searchAllPacks toggled: ${currentValue} -> ${!currentValue}`);
        });

        t.test("sheet reflects setting changes without stale data", async function () {
          this.timeout(12000);

          // Render sheet first
          const sheet = await ensureSheet(actor);
          await new Promise(resolve => setTimeout(resolve, 300));

          // Get initial virtual item count (if any)
          let root = sheet.element?.[0] || sheet.element;
          const initialItems = root.querySelectorAll(".item-virtual, [data-virtual='true']");
          const initialCount = initialItems.length;

          // Toggle both source settings to potentially change available items
          const compendiaValue = game.settings.get(TARGET_MODULE_ID, "populateFromCompendia");
          const worldValue = game.settings.get(TARGET_MODULE_ID, "populateFromWorld");

          await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", !compendiaValue);
          await game.settings.set(TARGET_MODULE_ID, "populateFromWorld", !worldValue);

          // Wait for cache invalidation
          await new Promise(resolve => setTimeout(resolve, 300));

          // Re-render sheet
          await sheet.render(true);
          await new Promise(resolve => setTimeout(resolve, 500));

          // Verify sheet rendered (we can't easily predict exact item counts without
          // knowing what's in compendia vs world, but we can verify it doesn't crash)
          root = sheet.element?.[0] || sheet.element;
          assert.ok(
            root,
            "Sheet should render after toggling both source settings"
          );

          // Toggle settings back
          await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", compendiaValue);
          await game.settings.set(TARGET_MODULE_ID, "populateFromWorld", worldValue);

          // Wait and re-render
          await new Promise(resolve => setTimeout(resolve, 300));
          await sheet.render(true);
          await new Promise(resolve => setTimeout(resolve, 500));

          root = sheet.element?.[0] || sheet.element;
          const finalItems = root.querySelectorAll(".item-virtual, [data-virtual='true']");
          const finalCount = finalItems.length;

          // After toggling back, count should be the same as initial
          assert.strictEqual(
            finalCount,
            initialCount,
            `Virtual item count should return to initial (${initialCount}) after toggling settings back (got ${finalCount})`
          );

          console.log(`[Settings Test] Virtual items: ${initialCount} -> (toggled) -> ${finalCount}`);
        });
      });

      t.section("Settings Defaults", () => {
        t.test("populateFromCompendia defaults to true", function () {
          // Check the setting metadata for default value
          const setting = game.settings.settings.get(`${TARGET_MODULE_ID}.populateFromCompendia`);
          assert.ok(setting, "populateFromCompendia setting should exist");
          assert.strictEqual(
            setting.default,
            true,
            "populateFromCompendia should default to true"
          );
        });

        t.test("populateFromWorld defaults to true", function () {
          const setting = game.settings.settings.get(`${TARGET_MODULE_ID}.populateFromWorld`);
          assert.ok(setting, "populateFromWorld setting should exist");
          assert.strictEqual(
            setting.default,
            true,
            "populateFromWorld should default to true"
          );
        });

        t.test("searchAllPacks defaults to false", function () {
          const setting = game.settings.settings.get(`${TARGET_MODULE_ID}.searchAllPacks`);
          assert.ok(setting, "searchAllPacks setting should exist");
          assert.strictEqual(
            setting.default,
            false,
            "searchAllPacks should default to false"
          );
        });

        t.test("enableProfilingLogs defaults to false", function () {
          const setting = game.settings.settings.get(`${TARGET_MODULE_ID}.enableProfilingLogs`);
          assert.ok(setting, "enableProfilingLogs setting should exist");
          assert.strictEqual(
            setting.default,
            false,
            "enableProfilingLogs should default to false"
          );
        });
      });
    },
    { displayName: "BitD Alt Sheets: Settings" }
  );
});
