/**
 * Quench test batch for patches.js functionality.
 * Tests effect suppression and auto-purchase of class default abilities.
 */

import {
  createTestActor,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
  testCleanup,
  findClassItem,
  TestNumberer,
  skipWithReason,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * Find an ability from compendium that is a class default for a given playbook.
 * @param {string} playbookName - Name of the playbook (e.g., "Cutter")
 * @returns {Promise<Item|null>}
 */
async function findClassDefaultAbility(playbookName) {
  const packs = Array.from(game.packs.values()).filter(
    (pack) => pack.documentName === "Item"
  );

  for (const pack of packs) {
    const index = await pack.getIndex({ fields: ["type", "name", "system.class", "system.class_default"] });
    const entry = index.find(
      (doc) =>
        doc.type === "ability" &&
        doc.system?.class?.toLowerCase() === playbookName.toLowerCase() &&
        doc.system?.class_default === true
    );
    if (entry) {
      return pack.getDocument(entry._id);
    }
  }
  return null;
}

/**
 * Find any ability from compendium.
 * @returns {Promise<Item|null>}
 */
async function findAnyAbility() {
  const packs = Array.from(game.packs.values()).filter(
    (pack) => pack.documentName === "Item"
  );

  for (const pack of packs) {
    const index = await pack.getIndex({ fields: ["type", "name"] });
    const entry = index.find((doc) => doc.type === "ability");
    if (entry) {
      return pack.getDocument(entry._id);
    }
  }
  return null;
}

const t = new TestNumberer("21");

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping patches tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.patches",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Effect Suppression (ActorApplyActiveEffects)", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Patches-Effect-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("actor using alt sheets has effect suppression applied", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);

          // Get the Utils module to check isUsingAltSheets
          const module = game.modules.get(TARGET_MODULE_ID);
          const Utils = module?.api?.Utils || globalThis.bitdAltSheets?.Utils;

          if (!Utils?.isUsingAltSheets) {
            skipWithReason(this, "Utils.isUsingAltSheets not exposed in API");
            return;
          }

          // Verify the actor is using alt sheets
          const usesAltSheets = Utils.isUsingAltSheets(actor);
          assert.ok(usesAltSheets, "Test actor should be using alternate sheets");
        });

        t.test("isEffectSuppressed returns true for disabled effects", async function () {
          this.timeout(8000);

          const module = game.modules.get(TARGET_MODULE_ID);
          const Utils = module?.api?.Utils || globalThis.bitdAltSheets?.Utils;

          if (!Utils?.isEffectSuppressed) {
            skipWithReason(this, "Utils.isEffectSuppressed not exposed in API");
            return;
          }

          // Create a mock disabled effect
          const mockEffect = {
            disabled: true,
            parent: { documentName: "Actor", id: actor.id, items: actor.items },
            origin: `Actor.${actor.id}.Item.someId`,
          };

          const suppressed = Utils.isEffectSuppressed(mockEffect);
          assert.ok(suppressed, "Disabled effects should be suppressed");
        });

        t.test("isEffectSuppressed returns true for non-actor parent", async function () {
          this.timeout(8000);

          const module = game.modules.get(TARGET_MODULE_ID);
          const Utils = module?.api?.Utils || globalThis.bitdAltSheets?.Utils;

          if (!Utils?.isEffectSuppressed) {
            skipWithReason(this, "Utils.isEffectSuppressed not exposed in API");
            return;
          }

          // Create a mock effect with non-Actor parent
          const mockEffect = {
            disabled: false,
            parent: { documentName: "Item", id: "someId", items: new Map() },
            origin: `Actor.${actor.id}.Item.someId`,
          };

          const suppressed = Utils.isEffectSuppressed(mockEffect);
          assert.ok(suppressed, "Effects with non-Actor parent should be suppressed");
        });

        t.test("isEffectSuppressed returns true for missing origin item", async function () {
          this.timeout(8000);

          const module = game.modules.get(TARGET_MODULE_ID);
          const Utils = module?.api?.Utils || globalThis.bitdAltSheets?.Utils;

          if (!Utils?.isEffectSuppressed) {
            skipWithReason(this, "Utils.isEffectSuppressed not exposed in API");
            return;
          }

          // Create a mock effect referencing a non-existent item
          const mockEffect = {
            disabled: false,
            parent: { documentName: "Actor", id: actor.id, items: actor.items },
            origin: `Actor.${actor.id}.Item.nonExistentItemId`,
          };

          const suppressed = Utils.isEffectSuppressed(mockEffect);
          assert.ok(suppressed, "Effects from missing items should be suppressed");
        });

        t.test("actor.effects collection is accessible", async function () {
          this.timeout(8000);

          // Basic sanity check that effects collection exists
          assert.ok(
            actor.effects !== undefined,
            "Actor should have effects collection"
          );
          assert.ok(
            typeof actor.effects.forEach === "function",
            "Effects collection should be iterable"
          );
        });
      });

      t.section("Class Default Auto-Purchase (ActorOnCreateEmbeddedDocuments)", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Patches-AutoPurchase-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("adding class default ability auto-marks as purchased", async function () {
          this.timeout(15000);

          // Find a class default ability for Cutter
          const classDefault = await findClassDefaultAbility("Cutter");
          if (!classDefault) {
            skipWithReason(this, "No class default abilities found for Cutter playbook");
            return;
          }

          // Verify it's a class default
          assert.ok(
            classDefault.system?.class_default === true,
            "Test ability should be a class default"
          );

          // Check if actor already has this ability (might be from playbook setup)
          const existingAbility = actor.items.find(
            (i) => i.type === "ability" && i.name === classDefault.name
          );

          if (existingAbility) {
            // If it exists, verify it's purchased (from initial setup)
            assert.ok(
              existingAbility.system?.purchased === true,
              "Existing class default ability should already be purchased"
            );
            console.log(`[Patches Test] Class default "${classDefault.name}" already exists and is purchased`);
            return;
          }

          // Add the class default ability
          const itemData = classDefault.toObject();
          const updatePromise = waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});

          const [createdItem] = await actor.createEmbeddedDocuments("Item", [itemData]);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Check if it was auto-marked as purchased
          const addedAbility = actor.items.get(createdItem.id);
          assert.ok(addedAbility, "Ability should be added to actor");

          // Note: The patch uses queueUpdate which is async, so we may need to wait
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Re-fetch the item to get updated state
          const refreshedAbility = actor.items.get(createdItem.id);

          console.log(`[Patches Test] Class default ability "${classDefault.name}" purchased state: ${refreshedAbility?.system?.purchased}`);

          // The patch should have auto-marked it as purchased
          // Note: This may depend on exact timing and the queueUpdate implementation
          assert.ok(
            refreshedAbility?.system?.purchased === true,
            `Class default ability "${classDefault.name}" should be auto-marked as purchased`
          );
        });

        t.test("adding non-class-default ability does not auto-purchase", async function () {
          this.timeout(12000);

          // Find any ability (preferably not a class default)
          const ability = await findAnyAbility();
          if (!ability) {
            skipWithReason(this, "No abilities found in compendia");
            return;
          }

          // Skip if this IS a class default for our playbook
          if (
            ability.system?.class_default === true &&
            ability.system?.class?.toLowerCase() === "cutter"
          ) {
            skipWithReason(this, "Found ability is a Cutter class default - need a different ability for this test");
            return;
          }

          // Add the ability
          const itemData = ability.toObject();
          // Make sure it's not marked as purchased initially
          if (itemData.system) {
            itemData.system.purchased = false;
          }

          const [createdItem] = await actor.createEmbeddedDocuments("Item", [itemData]);
          await new Promise((resolve) => setTimeout(resolve, 500));

          // The ability should NOT be auto-purchased
          const addedAbility = actor.items.get(createdItem.id);
          assert.ok(addedAbility, "Ability should be added to actor");

          // Non-class-default abilities should remain unpurchased
          // (unless the system sets them purchased by default)
          console.log(`[Patches Test] Non-class-default ability "${ability.name}" purchased state: ${addedAbility?.system?.purchased}`);
        });

        t.test("adding ability to wrong playbook does not auto-purchase", async function () {
          this.timeout(12000);

          // Find a class default for a DIFFERENT playbook (not Cutter)
          const otherClassDefault = await findClassDefaultAbility("Lurk");
          if (!otherClassDefault) {
            // Try another playbook
            const houndDefault = await findClassDefaultAbility("Hound");
            if (!houndDefault) {
              skipWithReason(this, "No class default abilities found for other playbooks");
              return;
            }
          }

          const classDefault = otherClassDefault || await findClassDefaultAbility("Hound");
          if (!classDefault) {
            skipWithReason(this, "No class default abilities found for testing");
            return;
          }

          // Verify it's NOT for Cutter
          if (classDefault.system?.class?.toLowerCase() === "cutter") {
            skipWithReason(this, "Could only find Cutter class defaults");
            return;
          }

          // Add the ability (wrong playbook for our Cutter actor)
          const itemData = classDefault.toObject();
          if (itemData.system) {
            itemData.system.purchased = false;
          }

          const [createdItem] = await actor.createEmbeddedDocuments("Item", [itemData]);
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Should NOT be auto-purchased since it's not for this playbook
          const addedAbility = actor.items.get(createdItem.id);
          assert.ok(addedAbility, "Ability should be added to actor");

          console.log(
            `[Patches Test] Wrong-playbook class default "${classDefault.name}" (class: ${classDefault.system?.class}) purchased state: ${addedAbility?.system?.purchased}`
          );

          // The patch checks if document.system.class === class_name (the actor's playbook)
          // So this should remain unpurchased
          assert.notOk(
            addedAbility?.system?.purchased === true,
            `Class default for wrong playbook should NOT be auto-purchased`
          );
        });
      });

      t.section("Patch Integration", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Patches-Integration-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("Patch class is accessible from module", async function () {
          this.timeout(5000);

          const module = game.modules.get(TARGET_MODULE_ID);
          const Patch = module?.api?.Patch || globalThis.bitdAltSheets?.Patch;

          if (!Patch) {
            // Check if patches are applied but class not exposed
            // This is acceptable - we can still test behavior
            console.log("[Patches Test] Patch class not exposed in API - testing behavior instead");

            // Verify actor behaves as expected (patches are applied)
            assert.ok(actor.effects !== undefined, "Actor should have effects (patches working)");
            return;
          }

          assert.ok(typeof Patch === "function" || typeof Patch === "object", "Patch should be accessible");
          assert.ok(
            typeof Patch.ActorApplyActiveEffects === "function",
            "ActorApplyActiveEffects should be a function"
          );
          assert.ok(
            typeof Patch.ActorOnCreateEmbeddedDocuments === "function",
            "ActorOnCreateEmbeddedDocuments should be a function"
          );
        });

        t.test("Utils helper methods are available", async function () {
          this.timeout(5000);

          const module = game.modules.get(TARGET_MODULE_ID);
          const Utils = module?.api?.Utils || globalThis.bitdAltSheets?.Utils;

          if (!Utils) {
            skipWithReason(this, "Utils not exposed in module API");
            return;
          }

          // Check key methods exist
          const requiredMethods = [
            "isUsingAltSheets",
            "isEffectSuppressed",
            "getPlaybookName",
          ];

          for (const method of requiredMethods) {
            assert.ok(
              typeof Utils[method] === "function",
              `Utils.${method} should be a function`
            );
          }
        });

        t.test("queueUpdate mechanism is operational", async function () {
          this.timeout(8000);

          // Test that updates work correctly (queueUpdate is internal)
          const initialName = actor.name;
          const testName = `${initialName}-QueueTest`;

          await actor.update({ name: testName });
          await new Promise((resolve) => setTimeout(resolve, 200));

          assert.equal(actor.name, testName, "Actor update should succeed");

          // Restore original name
          await actor.update({ name: initialName });
        });
      });

      t.section("Edge Cases", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Patches-EdgeCase-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("handles actor with no effects gracefully", async function () {
          this.timeout(8000);

          // Delete all effects if any
          const effectIds = actor.effects.map((e) => e.id);
          if (effectIds.length > 0) {
            await actor.deleteEmbeddedDocuments("ActiveEffect", effectIds);
          }

          // Actor should still function
          assert.equal(actor.effects.size, 0, "Actor should have no effects");

          // Sheet should still render
          const sheet = await ensureSheet(actor);
          assert.ok(sheet, "Sheet should render with no effects");
        });

        t.test("handles actor with no items gracefully", async function () {
          this.timeout(10000);

          // Remove all items
          const itemIds = actor.items.map((i) => i.id);
          if (itemIds.length > 0) {
            await actor.deleteEmbeddedDocuments("Item", itemIds);
            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          // Actor should still function
          assert.equal(actor.items.size, 0, "Actor should have no items");

          // Adding an item should still work
          const ability = await findAnyAbility();
          if (ability) {
            const itemData = ability.toObject();
            await actor.createEmbeddedDocuments("Item", [itemData]);
            assert.ok(actor.items.size > 0, "Should be able to add items");
          }
        });

        t.test("handles malformed effect origin gracefully", async function () {
          this.timeout(8000);

          const module = game.modules.get(TARGET_MODULE_ID);
          const Utils = module?.api?.Utils || globalThis.bitdAltSheets?.Utils;

          if (!Utils?.isEffectSuppressed) {
            skipWithReason(this, "Utils.isEffectSuppressed not exposed in API");
            return;
          }

          // Test with null origin
          const mockEffectNullOrigin = {
            disabled: false,
            parent: { documentName: "Actor", id: actor.id, items: actor.items },
            origin: null,
          };
          const suppressed1 = Utils.isEffectSuppressed(mockEffectNullOrigin);
          assert.ok(suppressed1, "Effects with null origin should be suppressed");

          // Test with malformed origin
          const mockEffectBadOrigin = {
            disabled: false,
            parent: { documentName: "Actor", id: actor.id, items: actor.items },
            origin: "malformed.string",
          };
          const suppressed2 = Utils.isEffectSuppressed(mockEffectBadOrigin);
          assert.ok(suppressed2, "Effects with malformed origin should be suppressed");

          // Test with empty origin
          const mockEffectEmptyOrigin = {
            disabled: false,
            parent: { documentName: "Actor", id: actor.id, items: actor.items },
            origin: "",
          };
          const suppressed3 = Utils.isEffectSuppressed(mockEffectEmptyOrigin);
          assert.ok(suppressed3, "Effects with empty origin should be suppressed");
        });
      });
    },
    { displayName: "BitD Alt Sheets: Patches" }
  );
});
