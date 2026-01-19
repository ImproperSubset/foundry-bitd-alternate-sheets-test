/**
 * Quench test batch for crew sheet functionality.
 * Tests rendering, abilities, upgrades (multi-cost), section collapse, and minimize.
 */

import {
  createTestActor,
  createTestCrewActor,
  findCrewTypeItem,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
  closeAllDialogs,
  cleanupTestActor,
  TestNumberer,
  assertExists,
  assertNotEmpty,
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
 * Trigger a change event on a crew checkbox using the sheet's jQuery context.
 * This is required because event handlers are bound via jQuery delegation.
 * @param {ActorSheet} sheet - The sheet containing the checkbox
 * @param {HTMLInputElement} checkbox - The checkbox element
 */
function triggerCrewCheckboxChange(sheet, checkbox) {
  const sheetEl = sheet.element;
  const itemName = checkbox.dataset.itemName;
  const itemId = checkbox.dataset.itemId;
  const turfId = checkbox.dataset.turfId;
  const slot = checkbox.dataset.upgradeSlot;

  // Try various selectors based on checkbox type
  if (checkbox.classList.contains("crew-ability-checkbox") && itemName) {
    $(sheetEl).find(`.crew-ability-checkbox[data-item-name="${itemName}"]`).trigger("change");
  } else if (checkbox.classList.contains("crew-upgrade-checkbox") && itemName && slot) {
    $(sheetEl).find(`.crew-upgrade-checkbox[data-item-name="${itemName}"][data-upgrade-slot="${slot}"]`).trigger("change");
  } else if (checkbox.classList.contains("turf-select") && turfId) {
    $(sheetEl).find(`.turf-select[data-turf-id="${turfId}"]`).trigger("change");
  } else if (itemId) {
    $(sheetEl).find(`[data-item-id="${itemId}"]`).trigger("change");
  } else {
    // Fallback: native event
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

/**
 * Trigger a blur event on an inline input using the sheet's jQuery context.
 * @param {ActorSheet} sheet - The sheet containing the input
 * @param {HTMLElement} input - The input element
 */
function triggerInlineBlur(sheet, input) {
  const sheetEl = sheet.element;
  const dataTarget = input.dataset.target;

  if (dataTarget) {
    $(sheetEl).find(`[data-target="${dataTarget}"]`).trigger("blur");
  } else if (input.classList.contains("inline-input")) {
    // Try to find by parent context
    const parent = input.closest(".identity-name, .meta-value");
    if (parent?.classList.contains("identity-name")) {
      $(sheetEl).find(".identity-name .inline-input").trigger("blur");
    } else if (parent?.classList.contains("meta-value")) {
      $(sheetEl).find(".meta-value .inline-input").trigger("blur");
    } else {
      // Fallback
      input.dispatchEvent(new Event("blur", { bubbles: true }));
    }
  } else {
    // Fallback
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  }
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

  const t = new TestNumberer("1");

  quench.registerBatch(
    "bitd-alternate-sheets.crew-sheet",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

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

      t.section("Crew Sheet Rendering", () => {
        t.test("crew sheet opens successfully", async function () {
          const sheet = await ensureSheet(actor);
          assert.ok(sheet.rendered, "Crew sheet should be rendered");
        });

        t.test("crew sheet has correct base classes", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          assert.ok(root?.classList?.contains("blades-alt"), "Should have blades-alt class");
        });

        t.test("crew sheet has sheet-wrapper element", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const wrapper = root.querySelector(".sheet-wrapper");
          assert.ok(wrapper, "Should have sheet-wrapper element");
        });

        t.test("crew header displays crew name", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const nameEl = root.querySelector(".identity-name");
          assert.ok(nameEl, "Should have identity-name element");
          assert.ok(nameEl.textContent.includes(actor.name) || nameEl.querySelector('[name="name"]'),
            "Name element should contain actor name or name input");
        });
      });

      t.section("Crew Abilities", () => {
        t.test("ability checkboxes exist for crew type", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const checkboxes = root.querySelectorAll(".crew-ability-checkbox");
          assert.ok(checkboxes.length > 0, "Should have ability checkboxes");
        });

        t.test("clicking ability checkbox creates owned item", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Find an unchecked ability
          const checkboxes = root.querySelectorAll(".crew-ability-checkbox:not(:checked)");
          // CRITICAL: Crew sheet should have unchecked ability checkboxes - template may be broken
          assertNotEmpty(assert, checkboxes, "Crew ability checkboxes should exist - template may be broken");

          const checkbox = checkboxes[0];
          const abilityName = checkbox.dataset.itemName;

          // Click to check
          checkbox.checked = true;
          triggerCrewCheckboxChange(sheet, checkbox);

          // Wait for update
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Verify item was created
          assert.ok(
            hasOwnedItem(actor, "crew_ability", abilityName),
            `Should have owned crew_ability "${abilityName}"`
          );
        });

        t.test("unchecking ability checkbox removes owned item", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // First, ensure we have a checked ability
          const checkboxes = root.querySelectorAll(".crew-ability-checkbox:not(:checked)");
          // CRITICAL: Need unchecked abilities to test toggle behavior
          assertNotEmpty(assert, checkboxes, "Unchecked crew ability checkboxes should exist");

          const checkbox = checkboxes[0];
          const abilityName = checkbox.dataset.itemName;

          // Check it first
          checkbox.checked = true;
          triggerCrewCheckboxChange(sheet, checkbox);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Verify it was created
          assert.ok(hasOwnedItem(actor, "crew_ability", abilityName), "Ability should be created first");

          // Re-render and uncheck
          await sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));
          const newRoot = sheet.element?.[0] || sheet.element;
          const newCheckbox = findAbilityCheckbox(newRoot, abilityName);

          // CRITICAL: Checkbox should still exist after re-render
          assertExists(assert, newCheckbox, `Ability checkbox for "${abilityName}" should exist after re-render`);

          newCheckbox.checked = false;
          triggerCrewCheckboxChange(sheet, newCheckbox);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Verify item was removed
          assert.ok(
            !hasOwnedItem(actor, "crew_ability", abilityName),
            `Should not have owned crew_ability "${abilityName}" after unchecking`
          );
        });

        t.test("owned abilities have checked checkbox", async function () {
          this.timeout(8000);
          // Create an owned ability first
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const checkboxes = root.querySelectorAll(".crew-ability-checkbox:not(:checked)");

          // CRITICAL: Need unchecked abilities for this test
          assertNotEmpty(assert, checkboxes, "Unchecked crew ability checkboxes should exist for testing");

          const checkbox = checkboxes[0];
          const abilityName = checkbox.dataset.itemName;

          checkbox.checked = true;
          triggerCrewCheckboxChange(sheet, checkbox);
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

      t.section("Crew Upgrades (Multi-cost)", () => {
        t.test("upgrade checkboxes exist", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const checkboxes = root.querySelectorAll(".crew-upgrade-checkbox");
          assert.ok(checkboxes.length > 0, "Should have upgrade checkboxes");
        });

        t.test("single-cost upgrade: 1 click creates owned item", async function () {
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

          // NOTE: Single-cost upgrades depend on crew type - legitimate skip if none available
          if (!singleCostCheckbox) {
            console.log("[CrewSheet Test] No single-cost upgrade found - crew type may not have any");
            this.skip(); // Legitimate: crew-type-specific
            return;
          }

          singleCostCheckbox.checked = true;
          triggerCrewCheckboxChange(sheet, singleCostCheckbox);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          assert.ok(
            hasOwnedItem(actor, "crew_upgrade", upgradeName),
            `Single-cost upgrade "${upgradeName}" should create owned item`
          );
        });

        t.test("multi-cost upgrade: 1st click sets progress flag only", async function () {
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

          // NOTE: Multi-cost upgrades depend on crew type - legitimate skip if none available
          if (!multiCostCheckbox) {
            console.log("[CrewSheet Test] No multi-cost upgrade found - crew type may not have any");
            this.skip(); // Legitimate: crew-type-specific
            return;
          }

          multiCostCheckbox.checked = true;
          triggerCrewCheckboxChange(sheet, multiCostCheckbox);
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

        t.test("multi-cost upgrade: completing creates owned item", async function () {
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

          // NOTE: 2-cost upgrades depend on crew type - legitimate skip if none available
          if (!firstSlot || !secondSlot) {
            console.log("[CrewSheet Test] No 2-cost upgrade found - crew type may not have any");
            this.skip(); // Legitimate: crew-type-specific
            return;
          }

          // Click first slot
          firstSlot.checked = true;
          triggerCrewCheckboxChange(sheet, firstSlot);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Re-render to get fresh DOM
          await sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Find and click second slot
          const newRoot = sheet.element?.[0] || sheet.element;
          const newSecondSlot = findUpgradeCheckbox(newRoot, upgradeName, 2);

          // CRITICAL: Second slot should exist after re-render if first slot was checked
          assertExists(assert, newSecondSlot, `Second slot for upgrade "${upgradeName}" should exist after re-render`);

          newSecondSlot.checked = true;
          triggerCrewCheckboxChange(sheet, newSecondSlot);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Should now have owned item
          assert.ok(
            hasOwnedItem(actor, "crew_upgrade", upgradeName),
            `Completing multi-cost upgrade "${upgradeName}" should create owned item`
          );
        });
      });

      t.section("Crew Minimize Toggle", () => {
        t.test("click minimize shrinks sheet", async function () {
          this.timeout(5000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          assert.ok(!isSheetMinimized(sheet), "Sheet should not be minimized initially");

          clickMinimizeToggle(root);
          await new Promise((resolve) => setTimeout(resolve, 100));

          assert.ok(isSheetMinimized(sheet), "Sheet should be minimized after click");
        });

        t.test("click expand returns to full height", async function () {
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

        t.test("minimize state persists across sheet close/reopen", async function () {
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
          // Character sheet persists minimized state, so crew sheet must too
          const persistedState = isSheetMinimized(reopenedSheet);

          // Log flag status for debugging
          if (minimizeFlag !== undefined) {
            console.log(`[CrewSheet Test] Minimize flag found: ${minimizeFlag}`);
          } else {
            console.log(`[CrewSheet Test] No minimize flag found`);
          }

          // Assert that minimize state persists (matches character sheet behavior)
          assert.ok(
            persistedState,
            "Crew sheet minimize state must persist across close/reopen (matches character sheet behavior)"
          );

          // Verify DOM toggle functionality still works after reopen
          const newRoot = reopenedSheet.element?.[0] || reopenedSheet.element;
          clickMinimizeToggle(newRoot);
          await new Promise((resolve) => setTimeout(resolve, 100));

          // State should have toggled (now expanded)
          const afterToggle = isSheetMinimized(reopenedSheet);
          assert.ok(
            !afterToggle,
            "Minimize toggle should expand sheet after reopen"
          );
        });

        t.test("minimize behavior matches character sheet", async function () {
          this.timeout(15000);

          // Create a character actor for comparison
          const charResult = await createTestActor({
            name: "MinimizeParity-Char-Test",
            playbookName: "Cutter"
          });
          const charActor = charResult.actor;

          try {
            // Open both sheets
            const charSheet = await ensureSheet(charActor);
            const crewSheet = await ensureSheet(actor);
            await new Promise((resolve) => setTimeout(resolve, 200));

            const charRoot = charSheet.element?.[0] || charSheet.element;
            const crewRoot = crewSheet.element?.[0] || crewSheet.element;

            // Both should start not minimized
            const charMinimizedBefore = isSheetMinimized(charSheet);
            const crewMinimizedBefore = isSheetMinimized(crewSheet);

            assert.strictEqual(
              charMinimizedBefore,
              crewMinimizedBefore,
              "Both sheets should have same initial minimize state"
            );

            // Verify both have minimize toggle
            const charToggle = charRoot.querySelector(".toggle-expand");
            const crewToggle = crewRoot.querySelector(".toggle-expand");

            assert.ok(charToggle, "Character sheet should have minimize toggle");
            assert.ok(crewToggle, "Crew sheet should have minimize toggle");

            // Toggle both
            clickMinimizeToggle(charRoot);
            clickMinimizeToggle(crewRoot);
            await new Promise((resolve) => setTimeout(resolve, 200));

            const charMinimizedAfter = isSheetMinimized(charSheet);
            const crewMinimizedAfter = isSheetMinimized(crewSheet);

            assert.strictEqual(
              charMinimizedAfter,
              crewMinimizedAfter,
              "Crew sheet minimize state should match character sheet after toggle"
            );

            // Both should be minimized
            assert.ok(charMinimizedAfter, "Character sheet should be minimized");
            assert.ok(crewMinimizedAfter, "Crew sheet should be minimized");

            console.log(
              `[CrewSheet Test] Minimize parity: char=${charMinimizedAfter}, crew=${crewMinimizedAfter}`
            );

          } finally {
            await cleanupTestActor(charActor);
          }
        });
      });

      t.section("Turf Selection", () => {
        t.test("turf checkbox toggles turf ownership", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode to interact with turfs
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Find an unchecked turf checkbox
          const turfCheckboxes = root.querySelectorAll(".turf-select:not(:checked)");

          // Assassins crew type should have turfs - verify test setup is correct
          assert.ok(turfCheckboxes.length > 0,
            "Assassins crew should have unchecked turf checkboxes - test setup or template may be broken");

          const turfCheckbox = turfCheckboxes[0];
          const turfId = turfCheckbox.dataset.turfId;

          // Click to check the turf
          turfCheckbox.checked = true;
          triggerCrewCheckboxChange(sheet, turfCheckbox);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Find the crew_type item to verify turf state
          const crewTypeItem = actor.items.find((i) => i.type === "crew_type");
          // crew_type item should exist since we set up the crew with Assassins type
          assert.ok(crewTypeItem,
            "Crew should have crew_type item - test setup with Assassins type may have failed");

          // Verify turf is now selected
          const turfValue = crewTypeItem.system?.turfs?.[turfId]?.value;
          assert.ok(turfValue === true, `Turf ${turfId} should be selected after checking`);
        });

        t.test("turf selection persists across sheet close/reopen", async function () {
          this.timeout(12000);
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Find an unchecked turf checkbox
          const turfCheckboxes = root.querySelectorAll(".turf-select:not(:checked)");

          // Assassins crew type should have turfs - verify test setup is correct
          assert.ok(turfCheckboxes.length > 0,
            "Assassins crew should have unchecked turf checkboxes for persistence test - test setup or template may be broken");

          const turfCheckbox = turfCheckboxes[0];
          const turfId = turfCheckbox.dataset.turfId;

          // Click to check the turf
          turfCheckbox.checked = true;
          triggerCrewCheckboxChange(sheet, turfCheckbox);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Close the sheet
          await sheet.close();
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Reopen the sheet
          const reopenedSheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 200));
          root = reopenedSheet.element?.[0] || reopenedSheet.element;

          // Find the same turf checkbox and verify it's checked
          const persistedCheckbox = root.querySelector(`.turf-select[data-turf-id="${turfId}"]`);
          assert.ok(persistedCheckbox, `Turf checkbox ${turfId} should exist after reopen`);
          assert.ok(persistedCheckbox.checked, `Turf ${turfId} should remain selected after sheet close/reopen`);
        });
      });

      t.section("Crew Inline Edits", () => {
        t.test("editing crew name persists to actor", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Find the inline-input span for the name
          const nameInput = root.querySelector(".identity-name .inline-input");

          // Crew sheet in edit mode should have inline name input
          assert.ok(nameInput,
            "Crew sheet should have inline name input in edit mode - template may be broken");

          // Edit the name
          const newName = "Test Crew Name Edit";
          nameInput.textContent = newName;
          triggerInlineBlur(sheet, nameInput);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Verify actor name was updated
          assert.equal(actor.name, newName, "Actor name should be updated after inline edit");
        });

        t.test("editing lair field persists to actor", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Find the inline-input span for lair
          const lairInput = root.querySelector("[data-target*='system.lair'], .meta-value .inline-input");

          // Crew sheet in edit mode should have inline lair input
          assert.ok(lairInput,
            "Crew sheet should have inline lair input in edit mode - template may be broken");

          // Edit the lair
          const newLair = "Secret Underground Base";
          lairInput.textContent = newLair;
          triggerInlineBlur(sheet, lairInput);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Verify lair was updated
          assert.equal(actor.system.lair, newLair, "Lair should be updated after inline edit");
        });

        t.test("inline edit changes persist across sheet close/reopen", async function () {
          this.timeout(12000);
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Find the inline-input span for the name
          const nameInput = root.querySelector(".identity-name .inline-input");

          // Crew sheet in edit mode should have inline name input
          assert.ok(nameInput,
            "Crew sheet should have inline name input in edit mode for persistence test - template may be broken");

          // Edit the name
          const newName = "Persistent Crew Name";
          nameInput.textContent = newName;
          triggerInlineBlur(sheet, nameInput);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Close the sheet
          await sheet.close();
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Reopen the sheet
          const reopenedSheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 200));
          root = reopenedSheet.element?.[0] || reopenedSheet.element;

          // Verify name persisted
          assert.equal(actor.name, newName, "Crew name should persist after sheet close/reopen");

          // Verify it displays in the reopened sheet
          const displayedName = root.querySelector(".identity-name");
          assert.ok(
            displayedName?.textContent?.includes(newName),
            "Crew name should display correctly after reopen"
          );
        });
      });

      t.section("Crew Upgrade Rollback", () => {
        t.test("unchecking single-cost upgrade removes owned item", async function () {
          this.timeout(10000);
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

          // NOTE: Single-cost upgrades depend on crew type - legitimate skip if none available
          if (!singleCostCheckbox) {
            console.log("[CrewSheet Test] No single-cost upgrade found - crew type may not have any");
            this.skip(); // Legitimate: crew-type-specific
            return;
          }

          // First, check the upgrade to create owned item
          singleCostCheckbox.checked = true;
          triggerCrewCheckboxChange(sheet, singleCostCheckbox);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Verify owned item was created
          assert.ok(
            hasOwnedItem(actor, "crew_upgrade", upgradeName),
            `Upgrade "${upgradeName}" should be owned after checking`
          );

          const ownedBefore = actor.items.filter((i) => i.type === "crew_upgrade").length;

          // Re-render to get fresh DOM
          await sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Find and uncheck the upgrade
          const newRoot = sheet.element?.[0] || sheet.element;
          const newCheckbox = findUpgradeCheckbox(newRoot, upgradeName, 1);

          // CRITICAL: Checkbox should exist after re-render since we just checked it
          assertExists(assert, newCheckbox, `Upgrade checkbox for "${upgradeName}" should exist after re-render`);

          newCheckbox.checked = false;
          triggerCrewCheckboxChange(sheet, newCheckbox);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Verify owned item was removed
          const ownedAfter = actor.items.filter((i) => i.type === "crew_upgrade").length;
          assert.strictEqual(
            ownedAfter,
            ownedBefore - 1,
            `Owned upgrade count should decrease by 1 (was ${ownedBefore}, now ${ownedAfter})`
          );

          assert.ok(
            !hasOwnedItem(actor, "crew_upgrade", upgradeName),
            `Upgrade "${upgradeName}" should be removed after unchecking`
          );

          console.log(`[CrewSheet Test] Single-cost rollback: upgrades ${ownedBefore} → ${ownedAfter}`);
        });

        t.test("unchecking multi-cost upgrade decrements progress", async function () {
          this.timeout(12000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Find a multi-cost upgrade (has multiple slots)
          const containers = root.querySelectorAll(".crew-choice");
          let firstSlot = null;
          let secondSlot = null;
          let sourceId = null;
          let upgradeName = null;

          for (const container of containers) {
            const checkboxes = container.querySelectorAll(".crew-upgrade-checkbox:not(:checked)");
            if (checkboxes.length >= 2) {
              firstSlot = checkboxes[0];
              secondSlot = checkboxes[1];
              sourceId = firstSlot.dataset.itemId;
              upgradeName = firstSlot.dataset.itemName;
              break;
            }
          }

          // NOTE: Multi-cost upgrades depend on crew type - legitimate skip if none available
          if (!firstSlot || !secondSlot) {
            console.log("[CrewSheet Test] No multi-cost upgrade found - crew type may not have any");
            this.skip(); // Legitimate: crew-type-specific
            return;
          }

          // Click first slot to set progress to 1
          firstSlot.checked = true;
          triggerCrewCheckboxChange(sheet, firstSlot);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          const progressAfterFirst = getUpgradeProgress(actor, sourceId);
          assert.strictEqual(progressAfterFirst, 1, "Progress should be 1 after first click");

          // Re-render and click second slot to set progress to 2
          await sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));
          const newRoot1 = sheet.element?.[0] || sheet.element;
          const newSecondSlot = findUpgradeCheckbox(newRoot1, upgradeName, 2);

          // CRITICAL: Second slot should exist after re-render if first slot was checked
          assertExists(assert, newSecondSlot, `Second slot for upgrade "${upgradeName}" should exist after re-render`);

          newSecondSlot.checked = true;
          triggerCrewCheckboxChange(sheet, newSecondSlot);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          const progressAfterSecond = getUpgradeProgress(actor, sourceId);
          // Progress could be 2 (if not yet complete) or 0 (if completed and item was created)
          const hasOwnedUpgrade = hasOwnedItem(actor, "crew_upgrade", upgradeName);

          if (hasOwnedUpgrade) {
            // Upgrade was completed and item was created
            console.log(`[CrewSheet Test] Multi-cost upgrade was completed, owned item created`);

            // Re-render and uncheck the second slot
            await sheet.render(false);
            await new Promise((resolve) => setTimeout(resolve, 100));
            const newRoot2 = sheet.element?.[0] || sheet.element;
            const uncheckedSecond = findUpgradeCheckbox(newRoot2, upgradeName, 2);

            if (uncheckedSecond && uncheckedSecond.checked) {
              uncheckedSecond.checked = false;
              triggerCrewCheckboxChange(sheet, uncheckedSecond);
              await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
              await new Promise((resolve) => setTimeout(resolve, 300));

              // After unchecking second slot, item should be removed
              const stillHasItem = hasOwnedItem(actor, "crew_upgrade", upgradeName);
              assert.ok(
                !stillHasItem,
                "Owned upgrade should be removed when unchecking second slot"
              );
            }
          } else {
            // Progress is set to 2, now uncheck second slot
            assert.strictEqual(progressAfterSecond, 2, "Progress should be 2 after second click");

            await sheet.render(false);
            await new Promise((resolve) => setTimeout(resolve, 100));
            const newRoot2 = sheet.element?.[0] || sheet.element;
            const uncheckedSecond = findUpgradeCheckbox(newRoot2, upgradeName, 2);

            if (uncheckedSecond && uncheckedSecond.checked) {
              uncheckedSecond.checked = false;
              triggerCrewCheckboxChange(sheet, uncheckedSecond);
              await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
              await new Promise((resolve) => setTimeout(resolve, 300));

              const progressAfterUncheck = getUpgradeProgress(actor, sourceId);
              assert.strictEqual(
                progressAfterUncheck,
                1,
                `Progress should decrement to 1 after unchecking (was 2, now ${progressAfterUncheck})`
              );

              console.log(`[CrewSheet Test] Multi-cost rollback: progress ${progressAfterSecond} → ${progressAfterUncheck}`);
            }
          }
        });
      });
    },
    { displayName: "BitD Alt Sheets: Crew Sheet" }
  );
});
