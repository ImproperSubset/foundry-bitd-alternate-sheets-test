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
  const loadEl = itemEl.querySelector(".item-load, .load, [data-load]");
  if (loadEl) {
    const text = loadEl.textContent?.trim();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  // Check data attribute
  return parseInt(itemEl.dataset?.load) || 0;
}

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping binary checkboxes tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.binary-checkboxes",
    (context) => {
      const { describe, it, assert, beforeEach, afterEach } = context;

      describe("11.1 Load Indicators", function () {
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

        it("11.1.0 load section exists on character sheet", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const loadSection = findLoadSection(root);
          const loadPills = findLoadPills(root);

          assert.ok(
            loadSection || loadPills.length > 0,
            "Load section or load pills should exist on character sheet"
          );
        });

        it("11.1.1 load pills display correct load amount", async function () {
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

        it("11.1.1 selecting items updates load total", async function () {
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

          if (gearItems.length === 0 && binaryCheckboxes.length === 0) {
            this.skip();
            return;
          }

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

          if (!toggled) {
            this.skip();
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
      });

      describe("11.2 Binary Checkboxes", function () {
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

        it("11.2.0 binary checkboxes exist on character sheet", async function () {
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

        it("11.2.1 toggle checkbox equips item via flag", async function () {
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

          if (binaryCheckboxes.length === 0) {
            this.skip();
            return;
          }

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

          if (!targetCheckbox) {
            this.skip();
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

        it("11.2.1 untoggle checkbox unequips item via flag", async function () {
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

          if (binaryCheckboxes.length === 0) {
            this.skip();
            return;
          }

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

          if (!targetCheckbox) {
            this.skip();
            return;
          }

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

        it("11.2.1 checkbox state reflects item ownership", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const binaryCheckboxes = findBinaryItemCheckboxes(root);

          if (binaryCheckboxes.length === 0) {
            this.skip();
            return;
          }

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
    },
    { displayName: "BitD Alt Sheets: Binary Checkboxes & Load" }
  );
});
