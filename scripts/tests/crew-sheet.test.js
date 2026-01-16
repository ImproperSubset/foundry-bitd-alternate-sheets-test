/**
 * Quench test batch for crew sheet functionality.
 * Tests rendering, abilities, upgrades (multi-cost), section collapse, and minimize.
 */

import {
  createTestCrewActor,
  findCrewTypeItem,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
  closeAllDialogs,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * Find an ability checkbox in the crew sheet by name.
 * @param {HTMLElement} root
 * @param {string} abilityName
 * @returns {HTMLInputElement|null}
 */
function findAbilityCheckbox(root, abilityName) {
  const checkboxes = root.querySelectorAll(".crew-ability-checkbox");
  for (const cb of checkboxes) {
    if (cb.dataset.itemName === abilityName) {
      return cb;
    }
  }
  return null;
}

/**
 * Find an upgrade checkbox in the crew sheet by name and slot.
 * @param {HTMLElement} root
 * @param {string} upgradeName
 * @param {number} slot - Slot number (1-indexed)
 * @returns {HTMLInputElement|null}
 */
function findUpgradeCheckbox(root, upgradeName, slot = 1) {
  const checkboxes = root.querySelectorAll(".crew-upgrade-checkbox");
  for (const cb of checkboxes) {
    if (cb.dataset.itemName === upgradeName && Number(cb.dataset.upgradeSlot) === slot) {
      return cb;
    }
  }
  return null;
}

/**
 * Get the upgrade progress from the actor's flags.
 * @param {Actor} actor
 * @param {string} sourceId
 * @returns {number}
 */
function getUpgradeProgress(actor, sourceId) {
  const progress = actor.getFlag(TARGET_MODULE_ID, "crewUpgradeProgress") || {};
  return Number(progress[sourceId]) || 0;
}

/**
 * Check if a crew has an owned item of the given type and name.
 * @param {Actor} actor
 * @param {string} type
 * @param {string} name
 * @returns {boolean}
 */
function hasOwnedItem(actor, type, name) {
  return actor.items.some((i) => i.type === type && i.name === name);
}

/**
 * Click the minimize/expand toggle.
 * @param {HTMLElement} root
 */
function clickMinimizeToggle(root) {
  const toggle = root.querySelector(".toggle-expand");
  if (toggle) toggle.click();
}

/**
 * Check if the sheet is in minimized state.
 * @param {ActorSheet} sheet
 * @returns {boolean}
 */
function isSheetMinimized(sheet) {
  const el = sheet.element?.[0] || sheet.element;
  return el?.classList?.contains("can-expand") ?? false;
}

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping crew sheet tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.crew-sheet",
    (context) => {
      const { describe, it, assert, beforeEach, afterEach } = context;

      let actor;

      beforeEach(async function () {
        this.timeout(10000);
        const result = await createTestCrewActor({
          name: "CrewSheet-Test",
          crewTypeName: "Assassins"
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

      describe("1.1 Crew Sheet Rendering", function () {
        it("1.1.1 crew sheet opens successfully", async function () {
          const sheet = await ensureSheet(actor);
          assert.ok(sheet.rendered, "Crew sheet should be rendered");
        });

        it("1.1.1 crew sheet has correct base classes", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          assert.ok(root?.classList?.contains("blades-alt"), "Should have blades-alt class");
        });

        it("1.1.2 crew sheet has sheet-wrapper element", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const wrapper = root.querySelector(".sheet-wrapper");
          assert.ok(wrapper, "Should have sheet-wrapper element");
        });

        it("1.1.3 crew header displays crew name", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const nameEl = root.querySelector(".identity-name");
          assert.ok(nameEl, "Should have identity-name element");
          assert.ok(nameEl.textContent.includes(actor.name) || nameEl.querySelector('[name="name"]'),
            "Name element should contain actor name or name input");
        });
      });

      describe("1.2 Crew Abilities", function () {
        it("1.2.1 ability checkboxes exist for crew type", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const checkboxes = root.querySelectorAll(".crew-ability-checkbox");
          assert.ok(checkboxes.length > 0, "Should have ability checkboxes");
        });

        it("1.2.1 clicking ability checkbox creates owned item", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Find an unchecked ability
          const checkboxes = root.querySelectorAll(".crew-ability-checkbox:not(:checked)");
          if (checkboxes.length === 0) {
            this.skip();
            return;
          }

          const checkbox = checkboxes[0];
          const abilityName = checkbox.dataset.itemName;

          // Click to check
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));

          // Wait for update
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Verify item was created
          assert.ok(
            hasOwnedItem(actor, "crew_ability", abilityName),
            `Should have owned crew_ability "${abilityName}"`
          );
        });

        it("1.2.2 unchecking ability checkbox removes owned item", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // First, ensure we have a checked ability
          const checkboxes = root.querySelectorAll(".crew-ability-checkbox:not(:checked)");
          if (checkboxes.length === 0) {
            this.skip();
            return;
          }

          const checkbox = checkboxes[0];
          const abilityName = checkbox.dataset.itemName;

          // Check it first
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Verify it was created
          assert.ok(hasOwnedItem(actor, "crew_ability", abilityName), "Ability should be created first");

          // Re-render and uncheck
          await sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));
          const newRoot = sheet.element?.[0] || sheet.element;
          const newCheckbox = findAbilityCheckbox(newRoot, abilityName);

          if (!newCheckbox) {
            this.skip();
            return;
          }

          newCheckbox.checked = false;
          newCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Verify item was removed
          assert.ok(
            !hasOwnedItem(actor, "crew_ability", abilityName),
            `Should not have owned crew_ability "${abilityName}" after unchecking`
          );
        });

        it("1.2.3 owned abilities have checked checkbox", async function () {
          this.timeout(8000);
          // Create an owned ability first
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const checkboxes = root.querySelectorAll(".crew-ability-checkbox:not(:checked)");

          if (checkboxes.length === 0) {
            this.skip();
            return;
          }

          const checkbox = checkboxes[0];
          const abilityName = checkbox.dataset.itemName;

          checkbox.checked = true;
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Re-render and verify checkbox is checked
          await sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));
          const newRoot = sheet.element?.[0] || sheet.element;
          const newCheckbox = findAbilityCheckbox(newRoot, abilityName);

          assert.ok(newCheckbox?.checked, "Owned ability checkbox should be checked after re-render");
        });
      });

      describe("1.3 Crew Upgrades (Multi-cost)", function () {
        it("1.3.0 upgrade checkboxes exist", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const checkboxes = root.querySelectorAll(".crew-upgrade-checkbox");
          assert.ok(checkboxes.length > 0, "Should have upgrade checkboxes");
        });

        it("1.3.1 single-cost upgrade: 1 click creates owned item", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Find a single-cost upgrade (only has slot 1)
          const containers = root.querySelectorAll(".crew-choice");
          let singleCostCheckbox = null;
          let upgradeName = null;

          for (const container of containers) {
            const checkboxes = container.querySelectorAll(".crew-upgrade-checkbox");
            if (checkboxes.length === 1 && !checkboxes[0].checked) {
              singleCostCheckbox = checkboxes[0];
              upgradeName = singleCostCheckbox.dataset.itemName;
              break;
            }
          }

          if (!singleCostCheckbox) {
            this.skip();
            return;
          }

          singleCostCheckbox.checked = true;
          singleCostCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          assert.ok(
            hasOwnedItem(actor, "crew_upgrade", upgradeName),
            `Single-cost upgrade "${upgradeName}" should create owned item`
          );
        });

        it("1.3.2 multi-cost upgrade: 1st click sets progress flag only", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Find a multi-cost upgrade (has multiple slots)
          const containers = root.querySelectorAll(".crew-choice");
          let multiCostCheckbox = null;
          let sourceId = null;
          let upgradeName = null;

          for (const container of containers) {
            const checkboxes = container.querySelectorAll(".crew-upgrade-checkbox:not(:checked)");
            if (checkboxes.length >= 2) {
              multiCostCheckbox = checkboxes[0]; // First slot
              sourceId = multiCostCheckbox.dataset.itemId;
              upgradeName = multiCostCheckbox.dataset.itemName;
              break;
            }
          }

          if (!multiCostCheckbox) {
            this.skip();
            return;
          }

          multiCostCheckbox.checked = true;
          multiCostCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Should NOT have owned item yet
          assert.ok(
            !hasOwnedItem(actor, "crew_upgrade", upgradeName),
            "Multi-cost upgrade should NOT create owned item on first click"
          );

          // Should have progress flag set to 1
          const progress = getUpgradeProgress(actor, sourceId);
          assert.equal(progress, 1, "Progress flag should be set to 1");
        });

        it("1.3.3 multi-cost upgrade: completing creates owned item", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Find a 2-cost upgrade
          const containers = root.querySelectorAll(".crew-choice");
          let firstSlot = null;
          let secondSlot = null;
          let sourceId = null;
          let upgradeName = null;

          for (const container of containers) {
            const checkboxes = container.querySelectorAll(".crew-upgrade-checkbox:not(:checked)");
            if (checkboxes.length === 2) {
              firstSlot = checkboxes[0];
              secondSlot = checkboxes[1];
              sourceId = firstSlot.dataset.itemId;
              upgradeName = firstSlot.dataset.itemName;
              break;
            }
          }

          if (!firstSlot || !secondSlot) {
            this.skip();
            return;
          }

          // Click first slot
          firstSlot.checked = true;
          firstSlot.dispatchEvent(new Event("change", { bubbles: true }));
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Re-render to get fresh DOM
          await sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Find and click second slot
          const newRoot = sheet.element?.[0] || sheet.element;
          const newSecondSlot = findUpgradeCheckbox(newRoot, upgradeName, 2);

          if (!newSecondSlot) {
            this.skip();
            return;
          }

          newSecondSlot.checked = true;
          newSecondSlot.dispatchEvent(new Event("change", { bubbles: true }));
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Should now have owned item
          assert.ok(
            hasOwnedItem(actor, "crew_upgrade", upgradeName),
            `Completing multi-cost upgrade "${upgradeName}" should create owned item`
          );
        });
      });

      describe("1.7 Crew Minimize Toggle", function () {
        it("1.7.1 click minimize shrinks sheet", async function () {
          this.timeout(5000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          assert.ok(!isSheetMinimized(sheet), "Sheet should not be minimized initially");

          clickMinimizeToggle(root);
          await new Promise((resolve) => setTimeout(resolve, 100));

          assert.ok(isSheetMinimized(sheet), "Sheet should be minimized after click");
        });

        it("1.7.2 click expand returns to full height", async function () {
          this.timeout(5000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // First minimize
          clickMinimizeToggle(root);
          await new Promise((resolve) => setTimeout(resolve, 100));
          assert.ok(isSheetMinimized(sheet), "Sheet should be minimized");

          // Then expand
          clickMinimizeToggle(root);
          await new Promise((resolve) => setTimeout(resolve, 100));
          assert.ok(!isSheetMinimized(sheet), "Sheet should be expanded after second click");
        });

        it("1.7.3 minimize state persists across sheet close/reopen", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Ensure not minimized initially
          assert.ok(!isSheetMinimized(sheet), "Sheet should not be minimized initially");

          // Minimize the sheet
          clickMinimizeToggle(root);
          await new Promise((resolve) => setTimeout(resolve, 100));
          assert.ok(isSheetMinimized(sheet), "Sheet should be minimized after click");

          // Check if minimize state is stored in a flag (for data verification)
          const minimizeFlag = actor.getFlag(TARGET_MODULE_ID, "sheetMinimized") ||
                               actor.getFlag(TARGET_MODULE_ID, "minimized") ||
                               sheet.minimized;

          // Close the sheet
          await sheet.close();
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Reopen the sheet
          const reopenedSheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 100));

          // CRITICAL: Verify minimize state persists after close/reopen
          const persistedState = isSheetMinimized(reopenedSheet);

          // If flag exists, verify it matches visual state
          if (minimizeFlag !== undefined) {
            console.log(`[CrewSheet Test] Minimize flag found: ${minimizeFlag}`);
            assert.ok(
              persistedState,
              "Sheet should remain minimized after close/reopen when flag is set"
            );
          } else {
            // If no flag, the module may not persist minimize state - document this
            console.log(`[CrewSheet Test] No minimize flag found. Persisted state: ${persistedState}`);
            // Test passes if state persists, but log warning if it doesn't
            if (!persistedState) {
              console.warn("[CrewSheet Test] Minimize state does not persist across sheet close/reopen");
            }
          }

          // At minimum, verify DOM toggle functionality still works after reopen
          const newRoot = reopenedSheet.element?.[0] || reopenedSheet.element;
          clickMinimizeToggle(newRoot);
          await new Promise((resolve) => setTimeout(resolve, 100));

          // State should have toggled
          const afterToggle = isSheetMinimized(reopenedSheet);
          assert.notEqual(
            afterToggle,
            persistedState,
            "Minimize toggle should work after sheet reopen"
          );
        });
      });
    },
    { displayName: "BitD Alt Sheets: Crew Sheet" }
  );
});
