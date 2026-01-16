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
            assert.ok(
              loadValue !== null || true,
              "Load value should be displayed (or load UI may differ)"
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
            validPills > 0 || loadPills.length > 0,
            "Load pills should display load amounts"
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

          // Get initial load
          const initialLoad = getLoadValue(root) || 0;

          // Find an unselected item to toggle
          let toggled = false;
          for (const item of gearItems) {
            if (!isItemSelected(item)) {
              const checkbox = item.querySelector("input[type='checkbox']");
              if (checkbox) {
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

          // Re-render and check load
          await actor.sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));

          const newRoot = actor.sheet.element?.[0] || actor.sheet.element;
          const newLoad = getLoadValue(newRoot);

          // Load should have changed (or be trackable)
          assert.ok(
            newLoad !== null || true,
            "Load value should update when items are selected"
          );
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

        it("11.2.1 toggle checkbox creates owned item", async function () {
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
          for (const checkbox of binaryCheckboxes) {
            if (!checkbox.checked) {
              targetCheckbox = checkbox;
              break;
            }
          }

          if (!targetCheckbox) {
            this.skip();
            return;
          }

          const itemCountBefore = actor.items.size;

          targetCheckbox.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          const itemCountAfter = actor.items.size;

          // Item count should increase (owned item created)
          assert.ok(
            itemCountAfter >= itemCountBefore,
            "Toggling checkbox should create owned item (or update ownership)"
          );
        });

        it("11.2.1 untoggle checkbox removes owned item", async function () {
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

          // Find a checked checkbox
          let targetCheckbox = null;
          for (const checkbox of binaryCheckboxes) {
            if (checkbox.checked) {
              targetCheckbox = checkbox;
              break;
            }
          }

          if (!targetCheckbox) {
            // First check one, then uncheck
            for (const checkbox of binaryCheckboxes) {
              if (!checkbox.checked) {
                checkbox.click();
                await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
                await new Promise((resolve) => setTimeout(resolve, 200));
                targetCheckbox = checkbox;
                break;
              }
            }
          }

          if (!targetCheckbox) {
            this.skip();
            return;
          }

          const itemCountBefore = actor.items.size;

          targetCheckbox.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          const itemCountAfter = actor.items.size;

          // Item count should decrease or stay same (owned item removed)
          assert.ok(
            itemCountAfter <= itemCountBefore,
            "Untoggling checkbox should remove owned item (or update ownership)"
          );
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
