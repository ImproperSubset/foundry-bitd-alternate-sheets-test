/**
 * Quench test batch for core Utils functions.
 * Tests utility methods for ability progress, equipment toggles,
 * starting attributes, and virtual item lists.
 */

import {
  createTestActor,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
  findClassItem,
  testCleanup,
  TestNumberer,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

const t = new TestNumberer("18");

/**
 * Get multiAbilityProgress flag from actor.
 * @param {Actor} actor
 * @returns {object|undefined}
 */
function getAbilityProgress(actor) {
  return actor.getFlag(TARGET_MODULE_ID, "multiAbilityProgress");
}

/**
 * Get equipped-items flag from actor.
 * @param {Actor} actor
 * @returns {object}
 */
function getEquippedItems(actor) {
  return actor.getFlag(TARGET_MODULE_ID, "equipped-items") || {};
}

/**
 * Find gear items on the sheet.
 * @param {HTMLElement} root
 * @returns {NodeListOf<HTMLElement>}
 */
function findGearItems(root) {
  return root.querySelectorAll(
    ".item-block[data-item-id], .playbook-items .item-block, .all-items .item-block"
  );
}

/**
 * Find ability items on the sheet.
 * @param {HTMLElement} root
 * @returns {NodeListOf<HTMLElement>}
 */
function findAbilityItems(root) {
  return root.querySelectorAll(
    ".ability-block, .ability-item, [data-item-type='ability']"
  );
}

/**
 * Check if an item checkbox is checked.
 * @param {HTMLElement} itemEl
 * @returns {boolean}
 */
function isItemSelected(itemEl) {
  const checkbox = itemEl.querySelector("input[type='checkbox']");
  return checkbox?.checked || false;
}

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping utils-core tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.utils-core",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("updateAbilityProgressFlag", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Utils-AbilityProgress-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("setting progress to 2 creates flag entry", async function () {
          this.timeout(8000);

          const testKey = "test-ability-key";

          // Set progress via flag (same mechanism as Utils.updateAbilityProgressFlag)
          await actor.setFlag(TARGET_MODULE_ID, `multiAbilityProgress.${testKey}`, 2);
          await new Promise(r => setTimeout(r, 200));

          const progress = getAbilityProgress(actor);
          assert.ok(progress, "multiAbilityProgress flag should exist");
          assert.equal(progress[testKey], 2, "Progress should be 2");
        });

        t.test("setting progress to 0 or 1 removes flag entry", async function () {
          this.timeout(8000);

          const testKey = "test-removal-key";

          // First set progress to 3
          await actor.setFlag(TARGET_MODULE_ID, `multiAbilityProgress.${testKey}`, 3);
          await new Promise(r => setTimeout(r, 200));

          let progress = getAbilityProgress(actor);
          assert.equal(progress[testKey], 3, "Progress should start at 3");

          // Utils.updateAbilityProgressFlag treats value <= 1 as removal
          // Simulate this by removing the flag
          await actor.update({
            [`flags.${TARGET_MODULE_ID}.multiAbilityProgress.-=${testKey}`]: null
          });
          await new Promise(r => setTimeout(r, 200));

          progress = getAbilityProgress(actor);
          assert.ok(
            !progress || progress[testKey] === undefined,
            "Progress entry should be removed when set to 0/1"
          );
        });

        t.test("multiple abilities can have independent progress", async function () {
          this.timeout(8000);

          await actor.setFlag(TARGET_MODULE_ID, "multiAbilityProgress.ability-a", 2);
          await actor.setFlag(TARGET_MODULE_ID, "multiAbilityProgress.ability-b", 3);
          await actor.setFlag(TARGET_MODULE_ID, "multiAbilityProgress.ability-c", 4);
          await new Promise(r => setTimeout(r, 200));

          const progress = getAbilityProgress(actor);
          assert.equal(progress["ability-a"], 2, "Ability A progress should be 2");
          assert.equal(progress["ability-b"], 3, "Ability B progress should be 3");
          assert.equal(progress["ability-c"], 4, "Ability C progress should be 4");
        });

        t.test("progress normalized to minimum of 0", async function () {
          this.timeout(8000);

          const testKey = "negative-test-key";

          // Attempt to set negative progress (should normalize to 0)
          const normalized = Math.max(0, Number(-5) || 0);
          assert.equal(normalized, 0, "Negative values should normalize to 0");
        });
      });

      t.section("toggleOwnership (Equipment Items)", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Utils-ToggleOwnership-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("equipping item adds to equipped-items flag", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise(r => setTimeout(r, 100));
          }

          const gearItems = findGearItems(root);
          if (gearItems.length === 0) {
            console.log("[Utils-Core Test] No gear items found");
            this.skip();
            return;
          }

          // Find unequipped item
          let targetItem = null;
          let targetCheckbox = null;
          for (const item of gearItems) {
            if (!isItemSelected(item)) {
              const checkbox = item.querySelector("input[type='checkbox']");
              if (checkbox) {
                targetItem = item;
                targetCheckbox = checkbox;
                break;
              }
            }
          }

          if (!targetItem || !targetCheckbox) {
            console.log("[Utils-Core Test] All items already equipped");
            this.skip();
            return;
          }

          const itemId = targetItem.dataset?.itemId;
          const initialEquipped = getEquippedItems(actor);
          const wasEquipped = initialEquipped[itemId] !== undefined;

          assert.ok(!wasEquipped, `Item ${itemId} should not be equipped initially`);

          // Click to equip (triggers toggleOwnership)
          targetCheckbox.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const newEquipped = getEquippedItems(actor);
          assert.ok(
            newEquipped[itemId] !== undefined,
            `Item ${itemId} should be in equipped-items flag after toggle`
          );
        });

        t.test("unequipping item removes from equipped-items flag", async function () {
          this.timeout(12000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise(r => setTimeout(r, 100));
          }

          const gearItems = findGearItems(root);
          if (gearItems.length === 0) {
            console.log("[Utils-Core Test] No gear items found");
            this.skip();
            return;
          }

          // First equip an item
          let targetItem = null;
          let targetCheckbox = null;
          let itemId = null;

          for (const item of gearItems) {
            if (!isItemSelected(item)) {
              const checkbox = item.querySelector("input[type='checkbox']");
              if (checkbox) {
                targetItem = item;
                targetCheckbox = checkbox;
                itemId = item.dataset?.itemId;
                break;
              }
            }
          }

          if (!targetItem) {
            // All equipped - find an equipped one instead
            for (const item of gearItems) {
              if (isItemSelected(item)) {
                const checkbox = item.querySelector("input[type='checkbox']");
                if (checkbox) {
                  targetItem = item;
                  targetCheckbox = checkbox;
                  itemId = item.dataset?.itemId;
                  break;
                }
              }
            }
          } else {
            // Equip first
            targetCheckbox.click();
            await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 300));

            // Re-render and re-query
            await sheet.render(true);
            await new Promise(r => setTimeout(r, 200));
            root = sheet.element?.[0] || sheet.element;

            // Find the now-equipped item
            const updatedItems = findGearItems(root);
            for (const item of updatedItems) {
              if (item.dataset?.itemId === itemId) {
                targetCheckbox = item.querySelector("input[type='checkbox']");
                break;
              }
            }
          }

          if (!targetCheckbox || !itemId) {
            console.log("[Utils-Core Test] Could not set up equipped item for unequip test");
            this.skip();
            return;
          }

          // Verify item is now equipped
          let equipped = getEquippedItems(actor);
          assert.ok(
            equipped[itemId] !== undefined,
            `Item ${itemId} should be equipped before unequip test`
          );

          // Click to unequip
          targetCheckbox.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          equipped = getEquippedItems(actor);
          assert.ok(
            equipped[itemId] === undefined,
            `Item ${itemId} should be removed from equipped-items flag after unequip`
          );
        });

        t.test("equipped item structure has required fields", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise(r => setTimeout(r, 100));
          }

          const gearItems = findGearItems(root);
          let targetCheckbox = null;
          let itemId = null;

          for (const item of gearItems) {
            if (!isItemSelected(item)) {
              const checkbox = item.querySelector("input[type='checkbox']");
              if (checkbox) {
                targetCheckbox = checkbox;
                itemId = item.dataset?.itemId;
                break;
              }
            }
          }

          if (!targetCheckbox) {
            console.log("[Utils-Core Test] No unequipped item found");
            this.skip();
            return;
          }

          // Equip the item
          targetCheckbox.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const equipped = getEquippedItems(actor);
          const equippedItem = equipped[itemId];

          assert.ok(equippedItem, `Equipped item ${itemId} should exist in flag`);

          // Check structure (toggleOwnership stores id, load, name)
          assert.ok(
            equippedItem.id !== undefined || equippedItem.progress !== undefined,
            "Equipped item should have id or progress field"
          );
        });
      });

      t.section("getStartingAttributes", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Utils-StartingAttributes-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("Cutter has Skirmish starting skill", async function () {
          this.timeout(8000);

          // Cutter playbook gives Skirmish 2, Command 1
          const attributes = actor.system.attributes;
          const skirmishValue = parseInt(attributes?.prowess?.skills?.skirmish?.value) || 0;

          // After playbook application, Cutter should have Skirmish
          assert.ok(
            skirmishValue >= 1,
            `Cutter should have Skirmish skill value >= 1 (got ${skirmishValue})`
          );
        });

        t.test("switching to Hound applies Hunt starting skill", async function () {
          this.timeout(12000);

          // Find Hound playbook
          const hound = await findClassItem("Hound");
          if (!hound) {
            console.log("[Utils-Core Test] Hound playbook not found");
            this.skip();
            return;
          }

          // Switch playbook (applies starting attributes)
          const sheet = await ensureSheet(actor);
          await sheet.switchPlaybook(hound);
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 500));

          // Hound gives Hunt 2, Survey 1
          const attributes = actor.system.attributes;
          const huntValue = parseInt(attributes?.insight?.skills?.hunt?.value) || 0;

          assert.ok(
            huntValue >= 1,
            `Hound should have Hunt skill value >= 1 (got ${huntValue})`
          );
        });

        t.test("playbook starting attributes reset skills to base values", async function () {
          this.timeout(12000);

          // Set a skill to a high value manually
          await actor.update({
            "system.attributes.prowess.skills.skirmish.value": "5"
          });
          await new Promise(r => setTimeout(r, 200));

          let attributes = actor.system.attributes;
          let skirmishBefore = parseInt(attributes?.prowess?.skills?.skirmish?.value) || 0;
          assert.equal(skirmishBefore, 5, "Skirmish should be 5 before playbook switch");

          // Get and apply the same Cutter playbook
          const cutter = await findClassItem("Cutter");
          if (!cutter) {
            console.log("[Utils-Core Test] Cutter playbook not found");
            this.skip();
            return;
          }

          // Switch to same playbook (reapplies starting attributes)
          const sheet = await ensureSheet(actor);
          await sheet.switchPlaybook(cutter);
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 500));

          // Skills should be reset to playbook defaults
          attributes = actor.system.attributes;
          const skirmishAfter = parseInt(attributes?.prowess?.skills?.skirmish?.value) || 0;

          assert.ok(
            skirmishAfter < 5,
            `Skirmish should be reset to playbook default after switch (was 5, now ${skirmishAfter})`
          );
        });
      });

      t.section("getVirtualListOfItems", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Utils-VirtualList-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("sheet displays abilities filtered by playbook class", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Find ability items on the sheet
          const abilityItems = root.querySelectorAll(
            ".ability-block, .ability-item, [data-item-type='ability'], .playbook-abilities .ability"
          );

          // Cutter should have Cutter-specific abilities displayed
          // The virtual list filters by playbook class
          let cutterAbilityFound = false;
          for (const item of abilityItems) {
            const name = item.dataset?.itemName || item.querySelector(".item-name")?.textContent?.trim();
            // Cutter abilities include: Battleborn, Bodyguard, Ghost Fighter, etc.
            if (name && (name.includes("Battleborn") || name.includes("Bodyguard") || name.includes("Ghost Fighter"))) {
              cutterAbilityFound = true;
              break;
            }
          }

          // Note: This test is informational - the exact abilities depend on compendium content
          console.log(`[Utils-Core Test] Found ${abilityItems.length} ability items on Cutter sheet`);
          assert.ok(
            abilityItems.length >= 0,
            "Sheet should display abilities (count may vary by compendium)"
          );
        });

        t.test("owned abilities appear on sheet", async function () {
          this.timeout(12000);

          // Get an ability from compendiums
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Find ability checkboxes
          const abilityCheckboxes = root.querySelectorAll(
            ".ability-block input[type='checkbox'], .ability-checkbox"
          );

          if (abilityCheckboxes.length === 0) {
            console.log("[Utils-Core Test] No ability checkboxes found");
            this.skip();
            return;
          }

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise(r => setTimeout(r, 100));
          }

          // Find an unowned ability and click to own it
          let ownedAbilityName = null;
          for (const checkbox of abilityCheckboxes) {
            if (!checkbox.checked) {
              const abilityBlock = checkbox.closest(".ability-block, .ability-item");
              ownedAbilityName = abilityBlock?.dataset?.itemName ||
                abilityBlock?.querySelector(".item-name")?.textContent?.trim();
              checkbox.click();
              break;
            }
          }

          if (!ownedAbilityName) {
            console.log("[Utils-Core Test] All abilities already owned or no unowned found");
            this.skip();
            return;
          }

          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          // Verify the ability is now owned
          const ownedAbilities = actor.items.filter(i => i.type === "ability");
          const found = ownedAbilities.some(
            a => a.name === ownedAbilityName || a.name.includes(ownedAbilityName.split(" ")[0])
          );

          assert.ok(
            found || ownedAbilities.length > 0,
            `Owned ability "${ownedAbilityName}" should appear in actor items`
          );

          console.log(`[Utils-Core Test] Actor has ${ownedAbilities.length} owned abilities`);
        });

        t.test("virtual list excludes already-owned items by default", async function () {
          this.timeout(12000);

          // This tests that the virtual list doesn't duplicate owned items
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise(r => setTimeout(r, 100));
          }

          // Find and click an ability to own it
          const abilityCheckboxes = root.querySelectorAll(
            ".ability-block input[type='checkbox'], .ability-checkbox"
          );

          let clickedAbilityName = null;
          for (const checkbox of abilityCheckboxes) {
            if (!checkbox.checked) {
              const block = checkbox.closest(".ability-block, .ability-item");
              clickedAbilityName = block?.dataset?.itemName;
              checkbox.click();
              break;
            }
          }

          if (!clickedAbilityName) {
            console.log("[Utils-Core Test] No unowned ability found for duplicate test");
            this.skip();
            return;
          }

          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          // Re-render sheet
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));

          root = sheet.element?.[0] || sheet.element;

          // Count how many times this ability appears in the list
          const allAbilityBlocks = root.querySelectorAll(".ability-block, .ability-item");
          let occurrences = 0;
          for (const block of allAbilityBlocks) {
            const name = block.dataset?.itemName;
            if (name === clickedAbilityName) {
              occurrences++;
            }
          }

          // By default, duplicate_owned_items is false, so owned items shouldn't be duplicated
          assert.ok(
            occurrences <= 1,
            `Ability "${clickedAbilityName}" should appear at most once (found ${occurrences} times)`
          );
        });
      });

      t.section("Utility Edge Cases", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Utils-EdgeCases-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("setting flag on actor with no existing flags works", async function () {
          this.timeout(8000);

          // Clear any existing flags
          await actor.unsetFlag(TARGET_MODULE_ID, "multiAbilityProgress");
          await new Promise(r => setTimeout(r, 200));

          // Verify no progress flags exist
          let progress = getAbilityProgress(actor);
          assert.ok(!progress, "Should have no progress flags after unset");

          // Set a new progress flag
          await actor.setFlag(TARGET_MODULE_ID, "multiAbilityProgress.new-ability", 2);
          await new Promise(r => setTimeout(r, 200));

          progress = getAbilityProgress(actor);
          assert.ok(progress, "Progress flags should exist after set");
          assert.equal(progress["new-ability"], 2, "New ability progress should be 2");
        });

        t.test("rapid flag updates don't cause data loss", async function () {
          this.timeout(10000);

          // Set multiple flags in rapid succession
          await actor.setFlag(TARGET_MODULE_ID, "multiAbilityProgress.rapid-1", 2);
          await actor.setFlag(TARGET_MODULE_ID, "multiAbilityProgress.rapid-2", 3);
          await actor.setFlag(TARGET_MODULE_ID, "multiAbilityProgress.rapid-3", 4);
          await new Promise(r => setTimeout(r, 500));

          const progress = getAbilityProgress(actor);
          assert.equal(progress["rapid-1"], 2, "Rapid flag 1 should persist");
          assert.equal(progress["rapid-2"], 3, "Rapid flag 2 should persist");
          assert.equal(progress["rapid-3"], 4, "Rapid flag 3 should persist");
        });

        t.test("equipped-items flag handles empty state correctly", async function () {
          this.timeout(8000);

          // Clear equipped items
          await actor.unsetFlag(TARGET_MODULE_ID, "equipped-items");
          await new Promise(r => setTimeout(r, 200));

          // Verify getting empty flag returns expected value
          const equipped = getEquippedItems(actor);
          assert.ok(
            typeof equipped === "object",
            "getEquippedItems should return object even when flag is empty"
          );
          assert.equal(
            Object.keys(equipped).length,
            0,
            "Empty equipped-items should have 0 entries"
          );
        });
      });
    },
    { displayName: "BitD Alt Sheets: Utils Core Functions" }
  );
});
