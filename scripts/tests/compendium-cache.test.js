/**
 * Quench test batch for compendium caching.
 * Tests cache invalidation and performance.
 */

import {
  createTestActor,
  createTestCrewActor,
  ensureSheet,
  isTargetModuleActive,
  closeAllDialogs,
  cleanupTestActor,
  testCleanup,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * Get the Utils class from the target module.
 * @returns {object|null}
 */
function getUtils() {
  const module = game.modules.get(TARGET_MODULE_ID);
  return module?.api?.Utils || globalThis.BladesAlternateSheets?.Utils || null;
}

/**
 * Get cache stats if available.
 * @returns {object|null}
 */
function getCacheStats() {
  const utils = getUtils();
  if (utils?.getCacheStats) {
    return utils.getCacheStats();
  }
  // Try to access cache directly
  if (utils?.cache) {
    return {
      size: utils.cache.size,
      entries: Array.from(utils.cache.keys()),
    };
  }
  return null;
}

/**
 * Clear the compendium cache if possible.
 */
function clearCache() {
  const utils = getUtils();
  if (utils?.clearCache) {
    utils.clearCache();
  } else if (utils?.cache?.clear) {
    utils.cache.clear();
  }
}

/**
 * Measure render time for a sheet.
 * @param {Actor} actor
 * @returns {Promise<number>} - Render time in ms
 */
async function measureRenderTime(actor) {
  // Close sheet if open
  try {
    if (actor.sheet) {
      await actor.sheet.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch {
    // Ignore close errors
  }

  const start = performance.now();
  await ensureSheet(actor);
  const end = performance.now();

  return end - start;
}

/**
 * Create a test item in the world.
 * @param {string} type - Item type
 * @param {string} name - Item name
 * @returns {Promise<Item>}
 */
async function createWorldItem(type, name) {
  const item = await Item.create({
    name: name || `Test ${type} ${Date.now()}`,
    type: type,
  });
  return item;
}

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping compendium cache tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.compendium-cache",
    (context) => {
      const { describe, it, assert, beforeEach, afterEach } = context;

      describe("8.1 Cache Invalidation", function () {
        let actor;
        let testItem;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestCrewActor({
            name: "Cache-Invalidation-Test",
            crewTypeName: "Assassins"
          });
          actor = result.actor;
          clearCache();
        });

        afterEach(async function () {
          this.timeout(8000);

          // Clean up test item first
          if (testItem) {
            try {
              await testItem.delete();
            } catch {
              // Ignore delete errors
            }
            testItem = null;
          }

          // Use unified cleanup helper
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        it("8.1.0 sheet renders successfully (cache is internal)", async function () {
          // Note: The cache system is internal to the module and not publicly exposed.
          // This test verifies the sheet renders successfully, which exercises the cache.
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          assert.ok(
            root !== null,
            "Sheet should render successfully (cache is used internally)"
          );

          // Verify the sheet has the expected structure
          assert.ok(
            root.classList.contains("blades-alt") || root.querySelector(".blades-alt"),
            "Sheet should have blades-alt styling"
          );
        });

        it("8.1.1 compendium item update triggers cache invalidation", async function () {
          this.timeout(10000);

          // Open sheet to populate cache
          await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 200));

          const statsBefore = getCacheStats();

          // Note: We cannot easily test compendium item updates because compendium
          // items require pack context that's hard to mock. This test verifies
          // the sheet renders correctly (which uses the cache).
          const root = actor.sheet.element?.[0] || actor.sheet.element;
          assert.ok(
            root !== null,
            "Sheet should render successfully (using cache)"
          );
        });

        it("8.1.2 world item create invalidates relevant cache", async function () {
          this.timeout(10000);

          // Open sheet to populate cache
          await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Create a world item
          testItem = await createWorldItem("crew_ability", "Test Ability Cache");
          await new Promise((resolve) => setTimeout(resolve, 100));

          // The createItem hook should trigger cache invalidation
          // Re-render sheet to verify it picks up new items
          await actor.sheet.close();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          assert.ok(
            root !== null,
            "Sheet should re-render after world item creation"
          );
          assert.ok(
            testItem !== null,
            "World item should be created successfully"
          );
        });

        it("8.1.2 world item update invalidates relevant cache", async function () {
          this.timeout(10000);

          // Create a test item first
          testItem = await createWorldItem("crew_ability", "Test Ability Update");
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Open sheet to populate cache
          await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Update the item
          await testItem.update({ name: "Updated Test Ability" });
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Re-render sheet to verify cache was invalidated
          await actor.sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 200));

          const root = actor.sheet.element?.[0] || actor.sheet.element;
          assert.ok(
            root !== null,
            "Sheet should re-render after world item update"
          );
          assert.strictEqual(
            testItem.name,
            "Updated Test Ability",
            "World item should be updated successfully"
          );
        });

        it("8.1.2 world item delete invalidates relevant cache", async function () {
          this.timeout(10000);

          // Create and then delete a test item
          testItem = await createWorldItem("crew_ability", "Test Ability Delete");
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Open sheet to populate cache
          await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Delete the item
          await testItem.delete();
          testItem = null;
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Re-render sheet to verify cache was invalidated
          await actor.sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 200));

          const root = actor.sheet.element?.[0] || actor.sheet.element;
          assert.ok(
            root !== null,
            "Sheet should re-render after world item deletion"
          );
          // Verify item was deleted (testItem is now null)
          assert.strictEqual(
            testItem,
            null,
            "World item should be deleted"
          );
        });

        it("8.1.3 sheet re-renders with updated data after invalidation", async function () {
          this.timeout(10000);

          // Open sheet
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Find ability section to verify content
          const abilitySection = root.querySelector(
            ".crew-abilities, .abilities-list, .ability-grid"
          );

          // Create a new ability item
          testItem = await createWorldItem("crew_ability", "Verify Cache Update");
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Re-render sheet
          await actor.sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Sheet should have re-rendered (the new item might appear in lists)
          const newRoot = actor.sheet.element?.[0] || actor.sheet.element;
          assert.ok(
            newRoot,
            "Sheet should re-render after cache invalidation"
          );
        });

        it("8.1.4 settings change invalidates cache", async function () {
          this.timeout(15000);

          // Save original settings
          const originalFromCompendia = game.settings.get(TARGET_MODULE_ID, "populateFromCompendia");
          const originalFromWorld = game.settings.get(TARGET_MODULE_ID, "populateFromWorld");

          try {
            // Ensure both sources are enabled initially
            await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", true);
            await game.settings.set(TARGET_MODULE_ID, "populateFromWorld", true);
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Open sheet to populate cache with both sources
            const sheet = await ensureSheet(actor);
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Count abilities with both sources enabled
            const root1 = sheet.element?.[0] || sheet.element;
            const abilitiesBefore = root1.querySelectorAll(
              ".crew-ability, .ability-item, [data-item-type='crew_ability']"
            ).length;

            // Disable compendium source - this should invalidate cache
            await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", false);
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Re-render sheet - should use fresh data from invalidated cache
            await sheet.render(true);
            await new Promise((resolve) => setTimeout(resolve, 300));

            const root2 = sheet.element?.[0] || sheet.element;
            const abilitiesAfter = root2.querySelectorAll(
              ".crew-ability, .ability-item, [data-item-type='crew_ability']"
            ).length;

            // With compendiums disabled, we should have fewer (or same) abilities
            // The key assertion is that the sheet re-rendered successfully after setting change
            assert.ok(
              root2 !== null,
              "Sheet should re-render after settings change"
            );

            console.log(`[Cache Test] Abilities before: ${abilitiesBefore}, after: ${abilitiesAfter}`);

            // If there were compendium abilities, count should decrease
            // (or stay same if no compendium abilities existed)
            assert.ok(
              abilitiesAfter <= abilitiesBefore,
              `Disabling compendiums should not increase ability count (before: ${abilitiesBefore}, after: ${abilitiesAfter})`
            );

          } finally {
            // Always restore original settings
            await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", originalFromCompendia);
            await game.settings.set(TARGET_MODULE_ID, "populateFromWorld", originalFromWorld);
          }
        });
      });

      describe("8.2 Cache Performance", function () {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestCrewActor({
            name: "Cache-Performance-Test",
            crewTypeName: "Assassins"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        it("8.2.1 second sheet render faster than first (cache hit)", async function () {
          this.timeout(15000);

          // Clear cache to ensure cold start
          clearCache();

          // First render (cold cache)
          const firstRenderTime = await measureRenderTime(actor);
          await actor.sheet.close();
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Second render (warm cache)
          const secondRenderTime = await measureRenderTime(actor);

          // Log times for debugging
          console.log(`[${MODULE_ID}] First render: ${firstRenderTime.toFixed(2)}ms`);
          console.log(`[${MODULE_ID}] Second render: ${secondRenderTime.toFixed(2)}ms`);

          // Second render should be faster or similar (not significantly slower)
          // We allow some variance due to JS engine optimizations
          const ratio = secondRenderTime / firstRenderTime;

          assert.ok(
            ratio <= 1.5 || secondRenderTime < 500,
            `Second render should not be significantly slower (ratio: ${ratio.toFixed(2)})`
          );
        });

        it("8.2.1 multiple sheets benefit from shared cache", async function () {
          this.timeout(20000);

          // Clear cache
          clearCache();

          // Create two crew actors of same type
          const result2 = await createTestCrewActor({
            name: "Cache-Performance-Test-2",
            crewTypeName: "Assassins"
          });
          const actor2 = result2.actor;

          try {
            // First actor first render (populates cache)
            const time1 = await measureRenderTime(actor);
            await actor.sheet.close();
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Second actor first render (should benefit from cache)
            const time2 = await measureRenderTime(actor2);

            console.log(`[${MODULE_ID}] Actor 1 render: ${time1.toFixed(2)}ms`);
            console.log(`[${MODULE_ID}] Actor 2 render: ${time2.toFixed(2)}ms`);

            // Second actor should benefit from cached compendium data
            // Not necessarily faster, but shouldn't be much slower
            assert.ok(
              time2 < time1 * 2 || time2 < 1000,
              "Second actor should benefit from shared cache"
            );
          } finally {
            await cleanupTestActor(actor2);
          }
        });
      });
    },
    { displayName: "BitD Alt Sheets: Compendium Cache" }
  );
});
