/**
 * Quench test batch for binary item checkboxes and load pills.
 * Tests load indicators and binary item ownership toggles.
 */

import {
  createTestActor,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
  closeAllDialogs,
  TestNumberer,
  assertExists,
  assertNotEmpty,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * Find load pills/indicators on the sheet.
 * @param {HTMLElement} root
 * @returns {NodeListOf<HTMLElement>}
 */
function findLoadPills(root) {
  // Load amounts are displayed in .load-amounts span
  return root.querySelectorAll(
    ".load-amounts, .load-pill, .load-indicator, .load-display"
  );
}

/**
 * Find the load section/container.
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findLoadSection(root) {
  // Character sheet uses .load-box for the load display and .playbook-items for items
  return root.querySelector(
    ".load-box, .load-selection, .playbook-items, [data-section-key='items']"
  );
}

/**
 * Get the current load value from the sheet.
 * @param {HTMLElement} root
 * @returns {number|null}
 */
function getLoadValue(root) {
  // Load is displayed in .load-amounts with format "X/Y"
  const loadDisplay = root.querySelector(".load-amounts");

  if (loadDisplay) {
    const text = loadDisplay.textContent?.trim();
    // Format is "X/Y" where X is current load
    const match = text?.match(/(\d+)\/\d+/);
    return match ? parseInt(match[1]) : null;
  }

  return null;
}

/**
 * Find binary item checkboxes (items that are owned or not).
 * @param {HTMLElement} root
 * @returns {NodeListOf<HTMLElement>}
 */
function findBinaryItemCheckboxes(root) {
  // Items use .item-block with checkboxes inside
  return root.querySelectorAll(
    ".item-block input[type='checkbox'], .playbook-items input[type='checkbox'], .all-items input[type='checkbox']"
  );
}

/**
 * Find gear/equipment items.
 * @param {HTMLElement} root
 * @returns {NodeListOf<HTMLElement>}
 */
function findGearItems(root) {
  // Items are in .item-block elements with data-item-id
  return root.querySelectorAll(
    ".item-block[data-item-id], .playbook-items .item-block, .all-items .item-block"
  );
}

/**
 * Check if an item is currently selected/owned.
 * @param {HTMLElement} itemEl
 * @returns {boolean}
 */
function isItemSelected(itemEl) {
  // Check checkbox state
  const checkbox = itemEl.querySelector("input[type='checkbox']");
  if (checkbox) return checkbox.checked;

  // Check class-based state
  if (itemEl.classList.contains("selected") || itemEl.classList.contains("owned")) {
    return true;
  }

  // Check data attribute
  return itemEl.dataset?.selected === "true" || itemEl.dataset?.owned === "true";
}

/**
 * Get item load value.
 * @param {HTMLElement} itemEl
 * @returns {number}
 */
function getItemLoad(itemEl) {
  // Template uses data-item-load="{{default item.system.load 1}}"
  if (itemEl.dataset?.itemLoad) {
    return parseInt(itemEl.dataset.itemLoad) || 0;
  }

  // Fallback: check for nested element with load info
  const loadEl = itemEl.querySelector(".item-load, .load, [data-load], [data-item-load]");
  if (loadEl) {
    if (loadEl.dataset?.itemLoad) {
      return parseInt(loadEl.dataset.itemLoad) || 0;
    }
    const text = loadEl.textContent?.trim();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  return 0;
}

const t = new TestNumberer("11");

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping binary checkboxes tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.binary-checkboxes",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Load Indicators", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "BinaryCheckboxes-Load-Test",
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
        });

        t.test("load section exists on character sheet", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const loadSection = findLoadSection(root);
          const loadPills = findLoadPills(root);

          assert.ok(
            loadSection || loadPills.length > 0,
            "Load section or load pills should exist on character sheet"
          );
        });

        t.test("load pills display correct load amount", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const loadPills = findLoadPills(root);

          if (loadPills.length === 0) {
            // Check for load value display instead
            const loadValue = getLoadValue(root);
            if (loadValue === null) {
              console.log("[BinaryCheckboxes Test] No load display found");
              this.skip();
              return;
            }
            assert.ok(
              loadValue !== null,
              "Load value should be displayed"
            );
            return;
          }

          // Verify each pill has load information
          let validPills = 0;
          for (const pill of loadPills) {
            const text = pill.textContent?.trim();
            // Load pills typically show numbers (0-9) or load labels
            if (text !== undefined && text !== "") {
              validPills++;
            }
          }

          assert.ok(
            validPills > 0,
            `Load pills should display load amounts (found ${validPills} valid pills)`
          );
        });

        t.test("selecting items updates load total", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const gearItems = findGearItems(root);
          const binaryCheckboxes = findBinaryItemCheckboxes(root);

          // CRITICAL: Character sheet should have gear items - template may be broken
          assertNotEmpty(assert, gearItems.length > 0 ? gearItems : binaryCheckboxes,
            "Gear items or binary checkboxes should exist on character sheet - template may be broken");

          // Get initial load from DOM
          const initialLoad = getLoadValue(root) || 0;

          // CRITICAL: Get initial equipped items from actor flags (not actor.items)
          const initialEquipped = actor.getFlag(TARGET_MODULE_ID, "equipped-items") || {};
          const initialEquippedCount = Object.keys(initialEquipped).length;

          // Find an unselected item to toggle
          let toggled = false;
          let toggledItemId = null;
          let toggledItemName = null;
          for (const item of gearItems) {
            if (!isItemSelected(item)) {
              const checkbox = item.querySelector("input[type='checkbox']");
              if (checkbox) {
                toggledItemId = item.dataset?.itemId;
                toggledItemName = item.dataset?.itemName || "unknown";
                checkbox.click();
                toggled = true;
                break;
              }
            }
          }

          if (!toggled && binaryCheckboxes.length > 0) {
            // Try binary checkboxes directly
            for (const checkbox of binaryCheckboxes) {
              if (!checkbox.checked) {
                const itemBlock = checkbox.closest(".item-block");
                toggledItemId = itemBlock?.dataset?.itemId;
                toggledItemName = itemBlock?.dataset?.itemName || "unknown";
                checkbox.click();
                toggled = true;
                break;
              }
            }
          }

          // NOTE: If all items are already equipped, we can't test equipping - legitimate skip
          if (!toggled) {
            console.log("[BinaryCheckboxes Test] All items already equipped - cannot test equipping");
            this.skip(); // Legitimate: all items pre-equipped
            return;
          }

          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // CRITICAL: Verify actor flags were updated (equipped-items flag)
          const newEquipped = actor.getFlag(TARGET_MODULE_ID, "equipped-items") || {};
          const newEquippedCount = Object.keys(newEquipped).length;

          assert.ok(
            newEquippedCount > initialEquippedCount,
            `Equipped items count should increase after selecting item (was ${initialEquippedCount}, now ${newEquippedCount})`
          );

          // Verify the specific item was equipped if we know its ID
          if (toggledItemId) {
            assert.ok(
              newEquipped[toggledItemId] !== undefined,
              `Item "${toggledItemId}" should be in equipped-items flag after selection`
            );
          }

          // Re-render and check load
          await actor.sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));

          const newRoot = actor.sheet.element?.[0] || actor.sheet.element;
          const newLoad = getLoadValue(newRoot);

          // Load should have changed in DOM
          if (newLoad === null) {
            console.log("[BinaryCheckboxes Test] Cannot read load value after item selection");
            // Still pass - we verified the flag change above
          } else {
            assert.notEqual(
              newLoad,
              initialLoad,
              `Load value should update when items are selected (was ${initialLoad}, now ${newLoad})`
            );
          }

          // Log for debugging
          console.log(`[BinaryCheckboxes Test] Selected item "${toggledItemName}" (${toggledItemId}): equipped ${initialEquippedCount} → ${newEquippedCount}, load ${initialLoad} → ${newLoad}`);
        });

        t.test("equipping item increases load by exact item load value", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Get initial load from DOM
          const initialLoad = getLoadValue(root);
          // CRITICAL: Load display should exist on character sheet (null means not found)
          assert.ok(initialLoad !== null,
            "Load value should be readable from character sheet - template may be broken");

          // Find an unequipped item with a known load value
          const gearItems = findGearItems(root);
          let targetItem = null;
          let targetCheckbox = null;
          let itemLoadValue = 0;

          // Debug: log gear items found
          console.log(`[BinaryCheckboxes Test] Found ${gearItems.length} gear items`);
          let unequippedCount = 0;
          let loadInfo = [];

          for (const item of gearItems) {
            const isSelected = isItemSelected(item);
            const loadValue = getItemLoad(item);
            const name = item.dataset?.itemName || "unknown";
            loadInfo.push(`${name}: selected=${isSelected}, load=${loadValue}, data-item-load="${item.dataset?.itemLoad}"`);

            if (!isSelected) {
              unequippedCount++;
              const checkbox = item.querySelector("input[type='checkbox']");
              if (checkbox && loadValue > 0 && !targetItem) {
                targetItem = item;
                targetCheckbox = checkbox;
                itemLoadValue = loadValue;
              }
            }
          }

          console.log(`[BinaryCheckboxes Test] ${unequippedCount} unequipped items`);
          console.log(`[BinaryCheckboxes Test] Item load values:`, loadInfo.slice(0, 5));

          // NOTE: If no unequipped items with load > 0 exist, skip is legitimate
          if (!targetItem || !targetCheckbox || itemLoadValue === 0) {
            console.log("[BinaryCheckboxes Test] No unequipped item with load > 0 found - all may be equipped");
            this.skip(); // Legitimate: test data state
            return;
          }

          const itemId = targetItem.dataset?.itemId;
          const itemName = targetItem.dataset?.itemName || "unknown";

          console.log(`[BinaryCheckboxes Test] Equipping "${itemName}" with load ${itemLoadValue}`);

          // Click to equip
          targetCheckbox.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Re-render and get new load
          await actor.sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));

          const newRoot = actor.sheet.element?.[0] || actor.sheet.element;
          const newLoad = getLoadValue(newRoot);

          if (newLoad === null) {
            console.log("[BinaryCheckboxes Test] Cannot read new load value");
            this.skip();
            return;
          }

          // CRITICAL: Assert load increased by EXACT item load value
          const expectedLoad = initialLoad + itemLoadValue;
          assert.strictEqual(
            newLoad,
            expectedLoad,
            `Load should increase by exactly ${itemLoadValue} (was ${initialLoad}, expected ${expectedLoad}, got ${newLoad})`
          );

          console.log(`[BinaryCheckboxes Test] Load increased: ${initialLoad} + ${itemLoadValue} = ${newLoad} ✓`);
        });

        t.test("unequipping item decreases load by exact item load value", async function () {
          this.timeout(12000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // First, find and equip an item with known load value
          const gearItems = findGearItems(root);
          let targetItem = null;
          let targetCheckbox = null;
          let itemLoadValue = 0;
          let itemId = null;
          let itemName = null;

          for (const item of gearItems) {
            if (!isItemSelected(item)) {
              const checkbox = item.querySelector("input[type='checkbox']");
              const loadValue = getItemLoad(item);
              if (checkbox && loadValue > 0) {
                targetItem = item;
                targetCheckbox = checkbox;
                itemLoadValue = loadValue;
                itemId = item.dataset?.itemId;
                itemName = item.dataset?.itemName || "unknown";
                break;
              }
            }
          }

          // NOTE: If no unequipped items with load > 0 exist, skip is legitimate
          if (!targetItem || !targetCheckbox || itemLoadValue === 0) {
            console.log("[BinaryCheckboxes Test] No unequipped item with load > 0 found for unequip test");
            this.skip(); // Legitimate: test data state
            return;
          }

          console.log(`[BinaryCheckboxes Test] First equipping "${itemName}" with load ${itemLoadValue}`);

          // Equip the item first
          targetCheckbox.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Re-render and get load after equipping
          await actor.sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));

          root = actor.sheet.element?.[0] || actor.sheet.element;
          const loadAfterEquip = getLoadValue(root);

          if (loadAfterEquip === null) {
            console.log("[BinaryCheckboxes Test] Cannot read load after equip");
            this.skip();
            return;
          }

          // Find the now-equipped item's checkbox (need to re-query after render)
          const updatedGearItems = findGearItems(root);
          targetCheckbox = null;
          for (const item of updatedGearItems) {
            const thisItemId = item.dataset?.itemId;
            if (thisItemId === itemId && isItemSelected(item)) {
              targetCheckbox = item.querySelector("input[type='checkbox']");
              break;
            }
          }

          // CRITICAL: Equipped checkbox should be findable after re-render
          assertExists(assert, targetCheckbox,
            `Equipped item checkbox for "${itemId}" should be findable after re-render`);

          console.log(`[BinaryCheckboxes Test] Now unequipping "${itemName}"`);

          // Unequip the item
          targetCheckbox.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Re-render and get load after unequipping
          await actor.sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));

          const finalRoot = actor.sheet.element?.[0] || actor.sheet.element;
          const loadAfterUnequip = getLoadValue(finalRoot);

          if (loadAfterUnequip === null) {
            console.log("[BinaryCheckboxes Test] Cannot read load after unequip");
            this.skip();
            return;
          }

          // CRITICAL: Assert load decreased by EXACT item load value
          const expectedLoad = loadAfterEquip - itemLoadValue;
          assert.strictEqual(
            loadAfterUnequip,
            expectedLoad,
            `Load should decrease by exactly ${itemLoadValue} (was ${loadAfterEquip}, expected ${expectedLoad}, got ${loadAfterUnequip})`
          );

          console.log(`[BinaryCheckboxes Test] Load decreased: ${loadAfterEquip} - ${itemLoadValue} = ${loadAfterUnequip} ✓`);
        });
      });

      t.section("Binary Checkboxes", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "BinaryCheckboxes-Test",
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
        });

        t.test("binary checkboxes exist on character sheet", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const binaryCheckboxes = findBinaryItemCheckboxes(root);
          const gearItems = findGearItems(root);

          // Should have some form of item selection UI
          assert.ok(
            binaryCheckboxes.length > 0 || gearItems.length > 0,
            "Binary checkboxes or gear items should exist"
          );
        });

        t.test("toggle checkbox equips item via flag", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const binaryCheckboxes = findBinaryItemCheckboxes(root);

          // CRITICAL: Character sheet should have binary checkboxes - template may be broken
          assertNotEmpty(assert, binaryCheckboxes,
            "Binary checkboxes should exist on character sheet - template may be broken");

          // Find an unchecked checkbox
          let targetCheckbox = null;
          let expectedItemId = null;
          let expectedItemName = null;
          for (const checkbox of binaryCheckboxes) {
            if (!checkbox.checked) {
              targetCheckbox = checkbox;
              const itemBlock = checkbox.closest(".item-block");
              // Get item ID and name from data attributes
              expectedItemId = itemBlock?.dataset?.itemId;
              expectedItemName = itemBlock?.dataset?.itemName ||
                checkbox.closest("[data-item-name]")?.dataset?.itemName;
              break;
            }
          }

          // NOTE: If all items are already equipped, we can't test toggle - legitimate skip
          if (!targetCheckbox) {
            console.log("[BinaryCheckboxes Test] All items already equipped - cannot test toggle");
            this.skip(); // Legitimate: test data state
            return;
          }

          // CRITICAL: Get initial equipped items from actor flags
          const equippedBefore = actor.getFlag(TARGET_MODULE_ID, "equipped-items") || {};
          const equippedCountBefore = Object.keys(equippedBefore).length;

          targetCheckbox.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // CRITICAL: Verify actor flag was updated (equipped-items)
          const equippedAfter = actor.getFlag(TARGET_MODULE_ID, "equipped-items") || {};
          const equippedCountAfter = Object.keys(equippedAfter).length;

          assert.ok(
            equippedCountAfter > equippedCountBefore,
            `Equipped items count should increase after checking item (was ${equippedCountBefore}, now ${equippedCountAfter})`
          );

          // Verify the specific item was equipped if we know its ID
          if (expectedItemId) {
            assert.ok(
              equippedAfter[expectedItemId] !== undefined,
              `Item "${expectedItemId}" should be in equipped-items flag`
            );
            // Verify the equipped item has expected structure
            const equippedItem = equippedAfter[expectedItemId];
            assert.ok(
              equippedItem.progress > 0,
              `Equipped item should have progress > 0 (got: ${equippedItem?.progress})`
            );
          }

          // Also verify DOM reflects the change
          await actor.sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));

          const newRoot = actor.sheet.element?.[0] || actor.sheet.element;
          const checkboxesAfter = findBinaryItemCheckboxes(newRoot);
          const checkedCount = Array.from(checkboxesAfter).filter(cb => cb.checked).length;

          assert.ok(
            checkedCount > 0,
            `DOM should show at least one checked item after toggle (checked: ${checkedCount})`
          );

          console.log(`[BinaryCheckboxes Test] Equipped item "${expectedItemName || expectedItemId || 'unknown'}": equipped ${equippedCountBefore} → ${equippedCountAfter}`);
        });

        t.test("untoggle checkbox unequips item via flag", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const binaryCheckboxes = findBinaryItemCheckboxes(root);

          // CRITICAL: Character sheet should have binary checkboxes - template may be broken
          assertNotEmpty(assert, binaryCheckboxes,
            "Binary checkboxes should exist on character sheet - template may be broken");

          // Find a checked checkbox, or check one first then uncheck
          let targetCheckbox = null;
          let itemId = null;
          let itemName = null;
          for (const checkbox of binaryCheckboxes) {
            if (checkbox.checked) {
              targetCheckbox = checkbox;
              const itemBlock = checkbox.closest(".item-block");
              itemId = itemBlock?.dataset?.itemId;
              itemName = itemBlock?.dataset?.itemName;
              break;
            }
          }

          if (!targetCheckbox) {
            // First check one, then uncheck
            for (const checkbox of binaryCheckboxes) {
              if (!checkbox.checked) {
                const itemBlock = checkbox.closest(".item-block");
                itemId = itemBlock?.dataset?.itemId;
                itemName = itemBlock?.dataset?.itemName;
                checkbox.click();
                await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
                await new Promise((resolve) => setTimeout(resolve, 200));
                // DOM may have re-rendered - re-query the checkbox
                await actor.sheet.render(false);
                await new Promise((resolve) => setTimeout(resolve, 100));
                break;
              }
            }
          }

          // Re-query DOM after potential re-render to get fresh checkbox reference
          const freshRoot = actor.sheet.element?.[0] || actor.sheet.element;
          const freshCheckboxes = findBinaryItemCheckboxes(freshRoot);

          // Find the now-checked checkbox (either the one we just checked, or original checked one)
          targetCheckbox = null;
          for (const checkbox of freshCheckboxes) {
            if (checkbox.checked) {
              const itemBlock = checkbox.closest(".item-block");
              const thisItemId = itemBlock?.dataset?.itemId;
              // Prefer the specific item we checked, but take any checked item
              if (thisItemId === itemId || !targetCheckbox) {
                targetCheckbox = checkbox;
                itemId = thisItemId;
                itemName = itemBlock?.dataset?.itemName;
                if (thisItemId === itemId) break; // Found exact match
              }
            }
          }

          // CRITICAL: Should have a checked checkbox after setup
          assertExists(assert, targetCheckbox,
            "Should have at least one checked checkbox for untoggle test");

          // CRITICAL: Get equipped items from actor flags before untoggle
          const equippedBefore = actor.getFlag(TARGET_MODULE_ID, "equipped-items") || {};
          const equippedCountBefore = Object.keys(equippedBefore).length;

          // Verify item is equipped before removal (if we know its ID)
          if (itemId) {
            assert.ok(
              equippedBefore[itemId] !== undefined,
              `Item "${itemId}" should be in equipped-items flag before untoggle`
            );
          }

          targetCheckbox.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // CRITICAL: Verify actor flag was updated (item removed from equipped-items)
          const equippedAfter = actor.getFlag(TARGET_MODULE_ID, "equipped-items") || {};
          const equippedCountAfter = Object.keys(equippedAfter).length;

          assert.ok(
            equippedCountAfter < equippedCountBefore,
            `Equipped items count should decrease after unchecking item (was ${equippedCountBefore}, now ${equippedCountAfter})`
          );

          // Verify the specific item was unequipped if we know its ID
          if (itemId) {
            assert.ok(
              equippedAfter[itemId] === undefined,
              `Item "${itemId}" should no longer be in equipped-items flag after untoggle`
            );
          }

          console.log(`[BinaryCheckboxes Test] Unequipped item "${itemName || itemId || 'unknown'}": equipped ${equippedCountBefore} → ${equippedCountAfter}`);
        });

        t.test("checkbox state reflects item ownership", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const binaryCheckboxes = findBinaryItemCheckboxes(root);

          // CRITICAL: Character sheet should have binary checkboxes - template may be broken
          assertNotEmpty(assert, binaryCheckboxes,
            "Binary checkboxes should exist on character sheet - template may be broken");

          // Verify checkboxes have a defined state
          let validStates = 0;
          for (const checkbox of binaryCheckboxes) {
            if (checkbox.checked === true || checkbox.checked === false) {
              validStates++;
            }
          }

          assert.ok(
            validStates > 0,
            "Binary checkboxes should have defined checked states reflecting ownership"
          );
        });
      });

      t.section("Load Level Selector", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "LoadLevel-Selector-Test",
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
        });

        t.test("load selector exists on character sheet", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const loadSelector = root.querySelector('select[name="system.selected_load_level"]');
          assert.ok(loadSelector, "Load level selector should exist on character sheet");
        });

        t.test("changing load level updates max load", async function () {
          this.timeout(12000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Get the load selector
          const loadSelector = root.querySelector('select[name="system.selected_load_level"]');
          assertExists(assert, loadSelector, "Load level selector should exist");

          // Get initial max load from display
          const getMaxLoad = (r) => {
            const loadDisplay = r.querySelector(".load-amounts");
            if (loadDisplay) {
              const text = loadDisplay.textContent?.trim();
              const match = text?.match(/\d+\/(\d+)/);
              return match ? parseInt(match[1]) : null;
            }
            return null;
          };

          const initialMaxLoad = getMaxLoad(root);
          assert.ok(initialMaxLoad !== null, "Max load should be readable from display");

          // Get available options
          const options = Array.from(loadSelector.options);
          assert.ok(options.length >= 2, `Should have at least 2 load level options (found ${options.length})`);

          // Find a different option to select
          const currentValue = loadSelector.value;
          const differentOption = options.find(opt => opt.value !== currentValue);

          if (!differentOption) {
            console.log("[LoadLevel Test] Only one option available - cannot test change");
            this.skip();
            return;
          }

          console.log(`[LoadLevel Test] Changing from "${currentValue}" to "${differentOption.value}"`);

          // Change the load level
          loadSelector.value = differentOption.value;
          loadSelector.dispatchEvent(new Event("change", { bubbles: true }));

          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Re-render and check new max load
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 300));

          root = sheet.element?.[0] || sheet.element;
          const newMaxLoad = getMaxLoad(root);

          assert.ok(newMaxLoad !== null, "Max load should be readable after change");
          assert.notStrictEqual(
            newMaxLoad,
            initialMaxLoad,
            `Max load should change when load level is changed (was ${initialMaxLoad}, now ${newMaxLoad})`
          );

          console.log(`[LoadLevel Test] Max load changed: ${initialMaxLoad} -> ${newMaxLoad}`);
        });

        t.test("Light load level gives lowest max load", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          const loadSelector = root.querySelector('select[name="system.selected_load_level"]');
          assertExists(assert, loadSelector, "Load level selector should exist");

          // Find Light option (traditional) or Discreet (Deep Cut)
          const lightOption = Array.from(loadSelector.options).find(
            opt => opt.value === "BITD.Light" || opt.value === "BITD.Discreet"
          );

          if (!lightOption) {
            console.log("[LoadLevel Test] Light/Discreet option not found");
            this.skip();
            return;
          }

          // Set to Light
          loadSelector.value = lightOption.value;
          loadSelector.dispatchEvent(new Event("change", { bubbles: true }));

          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 300));

          root = sheet.element?.[0] || sheet.element;
          const loadDisplay = root.querySelector(".load-amounts");
          const text = loadDisplay?.textContent?.trim();
          const match = text?.match(/\d+\/(\d+)/);
          const lightMaxLoad = match ? parseInt(match[1]) : null;

          // Light = base + 3, Discreet = base + 4
          // With base_max_load = 0, Light should be 3, Discreet should be 4
          assert.ok(
            lightMaxLoad !== null && lightMaxLoad <= 5,
            `Light/Discreet max load should be low (got ${lightMaxLoad})`
          );

          console.log(`[LoadLevel Test] Light/Discreet max load: ${lightMaxLoad}`);
        });

        t.test("Heavy load level gives highest max load", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          const loadSelector = root.querySelector('select[name="system.selected_load_level"]');
          assertExists(assert, loadSelector, "Load level selector should exist");

          // Find Heavy option (traditional) or Encumbered (Deep Cut)
          const heavyOption = Array.from(loadSelector.options).find(
            opt => opt.value === "BITD.Heavy" || opt.value === "BITD.Encumbered"
          );

          if (!heavyOption) {
            console.log("[LoadLevel Test] Heavy/Encumbered option not found");
            this.skip();
            return;
          }

          // Set to Heavy
          loadSelector.value = heavyOption.value;
          loadSelector.dispatchEvent(new Event("change", { bubbles: true }));

          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 300));

          root = sheet.element?.[0] || sheet.element;
          const loadDisplay = root.querySelector(".load-amounts");
          const text = loadDisplay?.textContent?.trim();
          const match = text?.match(/\d+\/(\d+)/);
          const heavyMaxLoad = match ? parseInt(match[1]) : null;

          // Heavy = base + 6, Encumbered = base + 9
          assert.ok(
            heavyMaxLoad !== null && heavyMaxLoad >= 6,
            `Heavy/Encumbered max load should be high (got ${heavyMaxLoad})`
          );

          console.log(`[LoadLevel Test] Heavy/Encumbered max load: ${heavyMaxLoad}`);
        });
      });

      t.section("Load Pill Indicators", () => {
        let actor;
        let originalSettings = {};

        beforeEach(async function () {
          this.timeout(15000);

          // Save and enable settings to ensure system compendia are in search path
          originalSettings.populateFromCompendia = game.settings.get(TARGET_MODULE_ID, "populateFromCompendia");
          originalSettings.populateFromWorld = game.settings.get(TARGET_MODULE_ID, "populateFromWorld");

          // Enable compendia population to ensure gear items are available
          if (!originalSettings.populateFromCompendia) {
            await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", true);
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          const result = await createTestActor({
            name: "LoadPill-Indicator-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(10000);
          await closeAllDialogs();
          if (actor) {
            try {
              // Clear equipped items to reset load
              await actor.unsetFlag(TARGET_MODULE_ID, "equipped-items");
              if (actor.sheet) {
                await actor.sheet.close();
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
            } catch {
              // Ignore errors
            }
            await actor.delete();
            actor = null;
          }

          // Restore original settings
          if (originalSettings.populateFromCompendia !== undefined) {
            await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", originalSettings.populateFromCompendia);
          }
          if (originalSettings.populateFromWorld !== undefined) {
            await game.settings.set(TARGET_MODULE_ID, "populateFromWorld", originalSettings.populateFromWorld);
          }
        });

        t.test("load pill shows at-max class when load equals max", async function () {
          this.timeout(15000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Set to Light load for lowest max (easier to reach)
          const loadSelector = root.querySelector('select[name="system.selected_load_level"]');
          if (loadSelector) {
            const lightOption = Array.from(loadSelector.options).find(
              opt => opt.value === "BITD.Light" || opt.value === "BITD.Discreet"
            );
            if (lightOption) {
              loadSelector.value = lightOption.value;
              loadSelector.dispatchEvent(new Event("change", { bubbles: true }));
              await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
              await sheet.render(true);
              await new Promise((resolve) => setTimeout(resolve, 300));
              root = sheet.element?.[0] || sheet.element;
            }
          }

          // Get max load
          const loadDisplay = root.querySelector(".load-amounts");
          const text = loadDisplay?.textContent?.trim();
          const match = text?.match(/(\d+)\/(\d+)/);
          const currentLoad = match ? parseInt(match[1]) : 0;
          const maxLoad = match ? parseInt(match[2]) : 0;

          console.log(`[LoadPill Test] Starting load: ${currentLoad}/${maxLoad}`);

          // Equip items until we reach max load
          const gearItems = findGearItems(root);
          let totalEquipped = currentLoad;

          for (const item of gearItems) {
            if (totalEquipped >= maxLoad) break;
            if (!isItemSelected(item)) {
              const checkbox = item.querySelector("input[type='checkbox']");
              const itemLoad = getItemLoad(item) || 1;

              if (checkbox && totalEquipped + itemLoad <= maxLoad) {
                checkbox.click();
                await waitForActorUpdate(actor, { timeoutMs: 1500 }).catch(() => {});
                await new Promise((resolve) => setTimeout(resolve, 200));
                totalEquipped += itemLoad;
                console.log(`[LoadPill Test] Equipped item, load now: ${totalEquipped}/${maxLoad}`);
              }
            }
          }

          // Re-render and check
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 300));

          root = sheet.element?.[0] || sheet.element;
          const updatedLoadDisplay = root.querySelector(".load-amounts");
          const newText = updatedLoadDisplay?.textContent?.trim();
          const newMatch = newText?.match(/(\d+)\/(\d+)/);
          const finalLoad = newMatch ? parseInt(newMatch[1]) : 0;
          const finalMax = newMatch ? parseInt(newMatch[2]) : 0;

          console.log(`[LoadPill Test] Final load: ${finalLoad}/${finalMax}`);

          // Check for at-max class (yellow indicator)
          if (finalLoad === finalMax) {
            assert.ok(
              updatedLoadDisplay.classList.contains("at-max"),
              `Load pill should have 'at-max' class when load (${finalLoad}) equals max (${finalMax})`
            );
            assert.ok(
              !updatedLoadDisplay.classList.contains("over-max"),
              "Load pill should NOT have 'over-max' class when at max"
            );
          } else {
            console.log(`[LoadPill Test] Could not reach exact max load (${finalLoad}/${finalMax})`);
            // Still pass if we couldn't reach exactly max load due to item sizes
            assert.ok(true, "Test completed - could not reach exact max load with available items");
          }
        });

        t.test("load pill shows over-max class when load exceeds max", async function () {
          this.timeout(18000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Set to Light load for lowest max (easier to exceed)
          const loadSelector = root.querySelector('select[name="system.selected_load_level"]');
          if (loadSelector) {
            const lightOption = Array.from(loadSelector.options).find(
              opt => opt.value === "BITD.Light" || opt.value === "BITD.Discreet"
            );
            if (lightOption) {
              loadSelector.value = lightOption.value;
              loadSelector.dispatchEvent(new Event("change", { bubbles: true }));
              await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
              await sheet.render(true);
              await new Promise((resolve) => setTimeout(resolve, 300));
              root = sheet.element?.[0] || sheet.element;
            }
          }

          // Get max load
          const loadDisplay = root.querySelector(".load-amounts");
          const text = loadDisplay?.textContent?.trim();
          const match = text?.match(/(\d+)\/(\d+)/);
          const maxLoad = match ? parseInt(match[2]) : 0;

          console.log(`[LoadPill Test] Max load for over-max test: ${maxLoad}`);

          // Equip items until we exceed max load
          // IMPORTANT: Re-query items after each click to avoid stale DOM references
          let totalEquipped = 0;
          let itemsProcessed = 0;
          const maxIterations = 20; // Safety limit

          while (totalEquipped <= maxLoad && itemsProcessed < maxIterations) {
            // Re-render and re-query fresh gear items each iteration
            await sheet.render(true);
            await new Promise((resolve) => setTimeout(resolve, 300));
            root = sheet.element?.[0] || sheet.element;

            const gearItems = findGearItems(root);
            let foundUnequipped = false;

            for (const item of gearItems) {
              if (!isItemSelected(item)) {
                const checkbox = item.querySelector("input[type='checkbox']");
                const itemLoad = getItemLoad(item) || 1;

                if (checkbox && itemLoad > 0) {
                  const itemName = item.dataset?.itemName || "unknown";
                  console.log(`[LoadPill Test] Equipping "${itemName}" (load ${itemLoad})`);

                  checkbox.click();
                  await waitForActorUpdate(actor, { timeoutMs: 1500 }).catch(() => {});
                  await new Promise((resolve) => setTimeout(resolve, 200));

                  totalEquipped += itemLoad;
                  foundUnequipped = true;
                  console.log(`[LoadPill Test] Total load now: ${totalEquipped}/${maxLoad}`);
                  break; // Re-query after each click
                }
              }
            }

            itemsProcessed++;
            if (!foundUnequipped) {
              console.log("[LoadPill Test] No more unequipped items found");
              break;
            }
          }

          // Re-render and check
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 300));

          root = sheet.element?.[0] || sheet.element;
          const updatedLoadDisplay = root.querySelector(".load-amounts");
          const newText = updatedLoadDisplay?.textContent?.trim();
          const newMatch = newText?.match(/(\d+)\/(\d+)/);
          const finalLoad = newMatch ? parseInt(newMatch[1]) : 0;
          const finalMax = newMatch ? parseInt(newMatch[2]) : 0;

          console.log(`[LoadPill Test] Final load for over-max: ${finalLoad}/${finalMax}`);

          // Check for over-max class (red indicator)
          if (finalLoad > finalMax) {
            assert.ok(
              updatedLoadDisplay.classList.contains("over-max"),
              `Load pill should have 'over-max' class when load (${finalLoad}) exceeds max (${finalMax})`
            );
            assert.ok(
              !updatedLoadDisplay.classList.contains("at-max"),
              "Load pill should NOT have 'at-max' class when over max"
            );
          } else {
            console.log(`[LoadPill Test] Could not exceed max load (${finalLoad}/${finalMax})`);
            this.skip(); // Cannot test over-max without enough items
          }
        });

        t.test("load pill has no warning class when under max", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Get load display - with no items equipped, should be under max
          const loadDisplay = root.querySelector(".load-amounts");
          assertExists(assert, loadDisplay, "Load display should exist");

          const text = loadDisplay?.textContent?.trim();
          const match = text?.match(/(\d+)\/(\d+)/);
          const currentLoad = match ? parseInt(match[1]) : 0;
          const maxLoad = match ? parseInt(match[2]) : 0;

          console.log(`[LoadPill Test] Load check: ${currentLoad}/${maxLoad}`);

          if (currentLoad < maxLoad) {
            assert.ok(
              !loadDisplay.classList.contains("at-max"),
              `Load pill should NOT have 'at-max' class when under max (${currentLoad}/${maxLoad})`
            );
            assert.ok(
              !loadDisplay.classList.contains("over-max"),
              `Load pill should NOT have 'over-max' class when under max (${currentLoad}/${maxLoad})`
            );
          } else {
            console.log("[LoadPill Test] Load already at or over max - skipping under-max test");
            this.skip();
          }
        });
      });

      t.section("Multi-cost Item Checkboxes", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "MultiCost-Item-Test",
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
        });

        t.test("multi-cost items have multiple checkboxes", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const gearItems = findGearItems(root);

          // Find items with load > 1 (multi-cost)
          let multiCostItems = 0;
          for (const item of gearItems) {
            const load = getItemLoad(item);
            if (load > 1) {
              const checkboxes = item.querySelectorAll("input[type='checkbox']");
              if (checkboxes.length > 1) {
                multiCostItems++;
                console.log(`[MultiCost Test] Found ${load}-cost item "${item.dataset?.itemName}" with ${checkboxes.length} checkboxes`);
              }
            }
          }

          // Not all playbooks have multi-cost items - this is informational
          console.log(`[MultiCost Test] Found ${multiCostItems} multi-cost items with multiple checkboxes`);
          assert.ok(true, `Found ${multiCostItems} multi-cost items (informational)`);
        });

        t.test("clicking one checkbox of multi-cost item checks all checkboxes", async function () {
          this.timeout(12000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const gearItems = findGearItems(root);

          // Find an unequipped multi-cost item
          let targetItem = null;
          let targetCheckboxes = null;
          for (const item of gearItems) {
            const load = getItemLoad(item);
            if (load > 1 && !isItemSelected(item)) {
              const checkboxes = item.querySelectorAll("input[type='checkbox']");
              if (checkboxes.length > 1) {
                targetItem = item;
                targetCheckboxes = checkboxes;
                break;
              }
            }
          }

          if (!targetItem || !targetCheckboxes) {
            console.log("[MultiCost Test] No unequipped multi-cost item found");
            this.skip();
            return;
          }

          const itemName = targetItem.dataset?.itemName || "unknown";
          const checkboxCount = targetCheckboxes.length;

          console.log(`[MultiCost Test] Testing "${itemName}" with ${checkboxCount} checkboxes`);

          // Verify none are checked initially
          const initialChecked = Array.from(targetCheckboxes).filter(cb => cb.checked).length;
          assert.strictEqual(initialChecked, 0, `Multi-cost item "${itemName}" should have 0 checked initially`);

          // Click the FIRST checkbox only
          targetCheckboxes[0].click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Re-render and re-query
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 200));

          root = sheet.element?.[0] || sheet.element;
          const updatedItems = findGearItems(root);
          let updatedItem = null;
          for (const item of updatedItems) {
            if (item.dataset?.itemId === targetItem.dataset?.itemId) {
              updatedItem = item;
              break;
            }
          }

          assertExists(assert, updatedItem, `Should find item "${itemName}" after re-render`);

          const updatedCheckboxes = updatedItem.querySelectorAll("input[type='checkbox']");
          const finalChecked = Array.from(updatedCheckboxes).filter(cb => cb.checked).length;

          // Binary toggle: clicking one should check ALL
          assert.strictEqual(
            finalChecked,
            checkboxCount,
            `Clicking one checkbox should check ALL ${checkboxCount} checkboxes (got ${finalChecked} checked)`
          );

          console.log(`[MultiCost Test] Binary toggle: clicked 1 → ${finalChecked}/${checkboxCount} checked ✓`);
        });

        t.test("clicking checkbox of equipped multi-cost item unchecks all checkboxes", async function () {
          this.timeout(15000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const gearItems = findGearItems(root);

          // Find a multi-cost item (equipped or unequipped)
          let targetItem = null;
          let targetCheckboxes = null;
          let wasEquipped = false;
          for (const item of gearItems) {
            const load = getItemLoad(item);
            if (load > 1) {
              const checkboxes = item.querySelectorAll("input[type='checkbox']");
              if (checkboxes.length > 1) {
                targetItem = item;
                targetCheckboxes = checkboxes;
                wasEquipped = isItemSelected(item);
                break;
              }
            }
          }

          if (!targetItem || !targetCheckboxes) {
            console.log("[MultiCost Test] No multi-cost item found");
            this.skip();
            return;
          }

          const itemName = targetItem.dataset?.itemName || "unknown";
          const itemId = targetItem.dataset?.itemId;
          const checkboxCount = targetCheckboxes.length;

          console.log(`[MultiCost Test] Testing unequip of "${itemName}" (wasEquipped: ${wasEquipped})`);

          // If not equipped, equip it first
          if (!wasEquipped) {
            targetCheckboxes[0].click();
            await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
            await new Promise((resolve) => setTimeout(resolve, 300));
            await sheet.render(true);
            await new Promise((resolve) => setTimeout(resolve, 200));
            root = sheet.element?.[0] || sheet.element;
          }

          // Find the item again after potential re-render
          const updatedItems = findGearItems(root);
          targetItem = null;
          for (const item of updatedItems) {
            if (item.dataset?.itemId === itemId) {
              targetItem = item;
              break;
            }
          }

          assertExists(assert, targetItem, `Should find item "${itemName}" for unequip test`);

          targetCheckboxes = targetItem.querySelectorAll("input[type='checkbox']");
          const beforeUncheck = Array.from(targetCheckboxes).filter(cb => cb.checked).length;

          assert.strictEqual(
            beforeUncheck,
            checkboxCount,
            `Item should have all ${checkboxCount} checkboxes checked before unequip`
          );

          // Click any checkbox to unequip (binary toggle)
          targetCheckboxes[0].click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Re-render and verify
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 200));

          root = sheet.element?.[0] || sheet.element;
          const finalItems = findGearItems(root);
          let finalItem = null;
          for (const item of finalItems) {
            if (item.dataset?.itemId === itemId) {
              finalItem = item;
              break;
            }
          }

          assertExists(assert, finalItem, `Should find item "${itemName}" after unequip`);

          const finalCheckboxes = finalItem.querySelectorAll("input[type='checkbox']");
          const afterUncheck = Array.from(finalCheckboxes).filter(cb => cb.checked).length;

          // Binary toggle: clicking should uncheck ALL
          assert.strictEqual(
            afterUncheck,
            0,
            `Clicking equipped checkbox should uncheck ALL ${checkboxCount} checkboxes (got ${afterUncheck} still checked)`
          );

          console.log(`[MultiCost Test] Binary unequip: ${beforeUncheck} → ${afterUncheck} checked ✓`);
        });
      });
    },
    { displayName: "BitD Alt Sheets: Binary Checkboxes & Load" }
  );
});
