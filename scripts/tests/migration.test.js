/**
 * Quench test batch for migration logic.
 * Tests data migration for ability progress, equipped items, healing clock, and legacy fields.
 */

import {
  createTestActor,
  isTargetModuleActive,
  cleanupTestActor,
  TestNumberer,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

const t = new TestNumberer("15");

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping migration tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.migration",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Ability Progress Migration", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Migration-AbilityProgress-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await cleanupTestActor(actor);
          actor = null;
        });

        t.test("preserves valid 16-char ability progress keys", async function () {
          this.timeout(8000);

          // Set up a progress map with a valid 16-char ID
          const validId = "abcdefgh12345678"; // 16 chars
          const progressMap = {
            [validId]: { value: 3, max: 5 }
          };
          await actor.setFlag(TARGET_MODULE_ID, "multiAbilityProgress", progressMap);

          // Import and run migration
          const { Migration } = await import(
            "/modules/bitd-alternate-sheets/scripts/migration.js"
          );
          await Migration.migrateAbilityProgress(actor);

          // Verify the valid key is preserved
          const newProgress = actor.getFlag(TARGET_MODULE_ID, "multiAbilityProgress");
          assert.ok(newProgress, "Progress map should still exist");
          assert.ok(
            newProgress[validId],
            `Valid 16-char key "${validId}" should be preserved`
          );
          assert.strictEqual(
            newProgress[validId].value,
            3,
            "Progress value should be preserved"
          );
        });

        t.test("removes orphaned ability progress keys (non-16-char)", async function () {
          this.timeout(8000);

          // Set up a progress map with both valid and invalid keys
          const validId = "abcdefgh12345678"; // 16 chars
          const orphanedName = "Reflexes"; // Name-based key (should be removed)
          const shortId = "short123"; // Too short (should be removed)
          const progressMap = {
            [validId]: { value: 3, max: 5 },
            [orphanedName]: { value: 2, max: 5 },
            [shortId]: { value: 1, max: 5 }
          };
          await actor.setFlag(TARGET_MODULE_ID, "multiAbilityProgress", progressMap);

          // Import and run migration
          const { Migration } = await import(
            "/modules/bitd-alternate-sheets/scripts/migration.js"
          );
          await Migration.migrateAbilityProgress(actor);

          // Wait for update to complete
          await new Promise(resolve => setTimeout(resolve, 300));

          // Refresh actor data
          const newProgress = actor.getFlag(TARGET_MODULE_ID, "multiAbilityProgress") || {};

          // Valid key should be preserved
          assert.ok(
            newProgress[validId],
            `Valid 16-char key "${validId}" should be preserved`
          );

          // Orphaned keys should be removed
          assert.ok(
            !newProgress[orphanedName],
            `Orphaned name-based key "${orphanedName}" should be removed`
          );
          assert.ok(
            !newProgress[shortId],
            `Short ID key "${shortId}" should be removed`
          );
        });

        t.test("handles empty progress gracefully", async function () {
          this.timeout(5000);

          // No progress flag set (undefined)
          const { Migration } = await import(
            "/modules/bitd-alternate-sheets/scripts/migration.js"
          );

          // Should not throw
          await Migration.migrateAbilityProgress(actor);

          // Verify no errors and no new flags created
          const progress = actor.getFlag(TARGET_MODULE_ID, "multiAbilityProgress");
          assert.ok(
            progress === undefined || foundry.utils.isEmpty(progress),
            "Empty progress should remain empty"
          );
        });
      });

      t.section("Equipped Items Migration", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Migration-EquippedItems-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await cleanupTestActor(actor);
          actor = null;
        });

        t.test("converts array format to object format", async function () {
          this.timeout(8000);

          // Set up equipped items in old array format
          const arrayFormat = [
            { id: "item1", name: "Knife" },
            { id: "item2", name: "Rope" }
          ];
          await actor.setFlag(TARGET_MODULE_ID, "equipped-items", arrayFormat);

          // Import and run migration
          const { Migration } = await import(
            "/modules/bitd-alternate-sheets/scripts/migration.js"
          );
          await Migration.migrateEquippedItems(actor);

          // Wait for update to complete
          await new Promise(resolve => setTimeout(resolve, 300));

          // Verify converted to object format
          const newEquipped = actor.getFlag(TARGET_MODULE_ID, "equipped-items");
          assert.ok(
            !Array.isArray(newEquipped),
            "Equipped items should no longer be an array"
          );
          assert.ok(
            typeof newEquipped === "object",
            "Equipped items should be an object"
          );
          assert.ok(
            newEquipped.item1,
            "Item1 should exist in object format"
          );
          assert.ok(
            newEquipped.item2,
            "Item2 should exist in object format"
          );
          assert.strictEqual(
            newEquipped.item1.name,
            "Knife",
            "Item1 name should be preserved"
          );
        });

        t.test("preserves already-migrated object data", async function () {
          this.timeout(5000);

          // Set up equipped items already in object format
          const objectFormat = {
            item1: { id: "item1", name: "Knife" },
            item2: { id: "item2", name: "Rope" }
          };
          await actor.setFlag(TARGET_MODULE_ID, "equipped-items", objectFormat);

          // Import and run migration
          const { Migration } = await import(
            "/modules/bitd-alternate-sheets/scripts/migration.js"
          );
          await Migration.migrateEquippedItems(actor);

          // Verify data unchanged
          const newEquipped = actor.getFlag(TARGET_MODULE_ID, "equipped-items");
          assert.deepEqual(
            newEquipped,
            objectFormat,
            "Already-migrated object format should be unchanged"
          );
        });

        t.test("handles null array entries gracefully", async function () {
          this.timeout(8000);

          // Set up array with null/undefined entries
          const arrayWithNulls = [
            { id: "item1", name: "Knife" },
            null,
            undefined,
            { id: "item2", name: "Rope" }
          ];
          await actor.setFlag(TARGET_MODULE_ID, "equipped-items", arrayWithNulls);

          // Import and run migration
          const { Migration } = await import(
            "/modules/bitd-alternate-sheets/scripts/migration.js"
          );
          await Migration.migrateEquippedItems(actor);

          // Wait for update
          await new Promise(resolve => setTimeout(resolve, 300));

          // Verify only valid items migrated
          const newEquipped = actor.getFlag(TARGET_MODULE_ID, "equipped-items");
          assert.ok(
            newEquipped.item1,
            "Valid item1 should be migrated"
          );
          assert.ok(
            newEquipped.item2,
            "Valid item2 should be migrated"
          );
          // null/undefined entries should not create keys
          const keyCount = Object.keys(newEquipped).length;
          assert.strictEqual(
            keyCount,
            2,
            `Should have exactly 2 keys (got ${keyCount})`
          );
        });
      });

      t.section("Healing Clock Migration", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Migration-HealingClock-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await cleanupTestActor(actor);
          actor = null;
        });

        t.test("migrates legacy clock value to current field", async function () {
          this.timeout(8000);

          // Set up legacy healing clock value
          await actor.update({ "system.healing-clock": 3 });

          // Clear current value if it exists
          if (actor.system.healing_clock) {
            await actor.update({ "system.healing_clock.value": 0 });
          }

          // Import and run migration
          const { Migration } = await import(
            "/modules/bitd-alternate-sheets/scripts/migration.js"
          );
          await Migration.migrateHealingClock(actor);

          // Wait for update
          await new Promise(resolve => setTimeout(resolve, 300));

          // Verify migration
          const currentValue = actor.system.healing_clock?.value;
          const normalizedValue = Array.isArray(currentValue) ? currentValue[0] : currentValue;
          assert.strictEqual(
            normalizedValue,
            3,
            `Healing clock should be migrated to system.healing_clock.value (got ${normalizedValue})`
          );
        });

        t.test("skips migration when no legacy data exists", async function () {
          this.timeout(5000);

          // Ensure no legacy value
          await actor.update({ "system.healing-clock": 0 });

          // Set a current value
          await actor.update({ "system.healing_clock.value": 2 });

          // Import and run migration
          const { Migration } = await import(
            "/modules/bitd-alternate-sheets/scripts/migration.js"
          );
          await Migration.migrateHealingClock(actor);

          // Current value should be unchanged
          const currentValue = actor.system.healing_clock?.value;
          const normalizedValue = Array.isArray(currentValue) ? currentValue[0] : currentValue;
          assert.strictEqual(
            normalizedValue,
            2,
            "Current value should be unchanged when no legacy data"
          );
        });

        t.test("skips migration when values already match", async function () {
          this.timeout(5000);

          // Set matching values
          await actor.update({
            "system.healing-clock": 3,
            "system.healing_clock.value": 3
          });

          // Import and run migration
          const { Migration } = await import(
            "/modules/bitd-alternate-sheets/scripts/migration.js"
          );
          await Migration.migrateHealingClock(actor);

          // Values should still match
          const currentValue = actor.system.healing_clock?.value;
          const normalizedValue = Array.isArray(currentValue) ? currentValue[0] : currentValue;
          assert.strictEqual(
            normalizedValue,
            3,
            "Matching values should remain unchanged"
          );
        });
      });

      t.section("Legacy Fields Migration", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Migration-LegacyFields-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await cleanupTestActor(actor);
          actor = null;
        });

        t.test("migrates background-details to flag", async function () {
          this.timeout(8000);

          // Set up legacy field
          const testDetails = "A mysterious past in Crow's Foot.";
          await actor.update({ "system.background-details": testDetails });

          // Ensure no flag exists
          await actor.unsetFlag(TARGET_MODULE_ID, "background_details");

          // Import and run migration
          const { Migration } = await import(
            "/modules/bitd-alternate-sheets/scripts/migration.js"
          );
          await Migration.migrateLegacyFields(actor);

          // Wait for update
          await new Promise(resolve => setTimeout(resolve, 300));

          // Verify flag created
          const flagValue = actor.getFlag(TARGET_MODULE_ID, "background_details");
          assert.strictEqual(
            flagValue,
            testDetails,
            "background_details flag should contain migrated value"
          );
        });

        t.test("migrates vice-purveyor to flag", async function () {
          this.timeout(8000);

          // Set up legacy field
          const testPurveyor = "Baszo Baz";
          await actor.update({ "system.vice-purveyor": testPurveyor });

          // Ensure no flag exists
          await actor.unsetFlag(TARGET_MODULE_ID, "vice_purveyor");

          // Import and run migration
          const { Migration } = await import(
            "/modules/bitd-alternate-sheets/scripts/migration.js"
          );
          await Migration.migrateLegacyFields(actor);

          // Wait for update
          await new Promise(resolve => setTimeout(resolve, 300));

          // Verify flag created
          const flagValue = actor.getFlag(TARGET_MODULE_ID, "vice_purveyor");
          assert.strictEqual(
            flagValue,
            testPurveyor,
            "vice_purveyor flag should contain migrated value"
          );
        });

        t.test("preserves existing flag when both exist", async function () {
          this.timeout(8000);

          // Set up both legacy field and existing flag
          const legacyValue = "Old value from system";
          const flagValue = "New value in flag";
          await actor.update({ "system.vice-purveyor": legacyValue });
          await actor.setFlag(TARGET_MODULE_ID, "vice_purveyor", flagValue);

          // Import and run migration
          const { Migration } = await import(
            "/modules/bitd-alternate-sheets/scripts/migration.js"
          );
          await Migration.migrateLegacyFields(actor);

          // Wait for update
          await new Promise(resolve => setTimeout(resolve, 300));

          // Flag value should be preserved (not overwritten by legacy)
          const currentFlag = actor.getFlag(TARGET_MODULE_ID, "vice_purveyor");
          assert.strictEqual(
            currentFlag,
            flagValue,
            "Existing flag value should be preserved"
          );
        });
      });
    },
    { displayName: "BitD Alt Sheets: Migration" }
  );
});
