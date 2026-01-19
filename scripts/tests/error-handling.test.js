/**
 * Quench test batch for error handling and recovery.
 * Tests null safety and error notifications.
 */

import {
  createTestActor,
  createTestCrewActor,
  ensureSheet,
  isTargetModuleActive,
  waitForActorUpdate,
  expectedTestError,
  TestNumberer,
  assertExists,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * Track UI notifications.
 * @returns {{notifications: Array, restore: () => void}}
 */
function trackNotifications() {
  const notifications = [];
  const originalError = ui.notifications.error.bind(ui.notifications);
  const originalWarn = ui.notifications.warn.bind(ui.notifications);

  ui.notifications.error = function (message, options) {
    notifications.push({ type: "error", message, options });
    return originalError(message, options);
  };

  ui.notifications.warn = function (message, options) {
    notifications.push({ type: "warn", message, options });
    return originalWarn(message, options);
  };

  return {
    notifications,
    restore: () => {
      ui.notifications.error = originalError;
      ui.notifications.warn = originalWarn;
    },
  };
}

/**
 * Track console errors.
 * @returns {{errors: Array, restore: () => void}}
 */
function trackConsoleErrors() {
  const errors = [];
  const originalError = console.error;

  console.error = function (...args) {
    errors.push(args);
    return originalError.apply(console, args);
  };

  return {
    errors,
    restore: () => {
      console.error = originalError;
    },
  };
}

/**
 * Find inline edit fields.
 * @param {HTMLElement} root
 * @returns {NodeListOf<HTMLElement>}
 */
function findInlineEditFields(root) {
  return root.querySelectorAll(
    ".inline-edit, [contenteditable='true'], input.inline-input, .editable-field"
  );
}

/**
 * Find radio toggle elements.
 * @param {HTMLElement} root
 * @returns {NodeListOf<HTMLElement>}
 */
function findRadioToggles(root) {
  return root.querySelectorAll(
    "input[type='radio'].radio-toggle, label.radio-toggle, .teeth input[type='radio']"
  );
}

/**
 * Find crew ability checkboxes.
 * @param {HTMLElement} root
 * @returns {NodeListOf<HTMLElement>}
 */
function findAbilityCheckboxes(root) {
  return root.querySelectorAll(
    ".crew-ability-checkbox, .ability-checkbox, input[type='checkbox'][data-ability]"
  );
}

/**
 * Trigger a change event on a crew checkbox using the sheet's jQuery context.
 * This is required because event handlers are bound via jQuery delegation on sheet.element.
 * @param {ActorSheet} sheet - The sheet containing the checkbox
 * @param {HTMLInputElement} checkbox - The checkbox element
 */
function triggerCrewCheckboxChange(sheet, checkbox) {
  const sheetEl = sheet.element;
  const itemName = checkbox.dataset?.itemName ||
                   checkbox.closest("[data-item-name]")?.dataset?.itemName;
  const slot = checkbox.dataset?.upgradeSlot;

  // Toggle the checkbox state first
  checkbox.checked = !checkbox.checked;

  if (checkbox.classList.contains("crew-ability-checkbox") && itemName) {
    $(sheetEl).find(`.crew-ability-checkbox[data-item-name="${itemName}"]`).trigger("change");
  } else if (checkbox.classList.contains("crew-upgrade-checkbox") && itemName && slot) {
    $(sheetEl).find(`.crew-upgrade-checkbox[data-item-name="${itemName}"][data-upgrade-slot="${slot}"]`).trigger("change");
  } else if (checkbox.classList.contains("crew-upgrade-checkbox") && itemName) {
    $(sheetEl).find(`.crew-upgrade-checkbox[data-item-name="${itemName}"]`).trigger("change");
  } else if (checkbox.id) {
    $(sheetEl).find(`#${CSS.escape(checkbox.id)}`).trigger("change");
  } else {
    // Fallback: native event
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

/**
 * Find crew upgrade checkboxes.
 * @param {HTMLElement} root
 * @returns {NodeListOf<HTMLElement>}
 */
function findUpgradeCheckboxes(root) {
  return root.querySelectorAll(
    ".crew-upgrade-checkbox, .upgrade-checkbox, input[type='checkbox'][data-upgrade]"
  );
}

const t = new TestNumberer("10");

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping error handling tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.error-handling",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Null Safety", () => {
        let actor;
        let consoleTracker;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "ErrorHandling-NullSafety-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
          consoleTracker = trackConsoleErrors();
        });

        afterEach(async function () {
          this.timeout(5000);
          if (consoleTracker) consoleTracker.restore();

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

        t.test("sheet renders without throwing errors", async function () {
          const errorsBefore = consoleTracker.errors.length;

          const sheet = await ensureSheet(actor);

          const errorsAfter = consoleTracker.errors.length;
          const newErrors = errorsAfter - errorsBefore;

          // Filter for BitD-Alt specific errors
          const relevantErrors = consoleTracker.errors
            .slice(errorsBefore)
            .filter(
              (args) =>
                args.some((a) => String(a).includes("BitD-Alt")) ||
                args.some((a) => String(a).includes("bitd-alternate"))
            );

          assert.equal(
            relevantErrors.length,
            0,
            "Sheet should render without BitD-Alt errors"
          );
        });

        t.test("missing previousSibling in inline edit → no crash", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const inlineFields = findInlineEditFields(root);

          // Cutter character sheet should have inline edit fields in edit mode
          assert.ok(inlineFields.length > 0,
            "Cutter sheet should have inline edit fields in edit mode - template may be broken");

          const errorsBefore = consoleTracker.errors.length;

          // Simulate interaction with inline edit field
          const field = inlineFields[0];

          // Focus and blur (this might trigger previousSibling access)
          field.focus();
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Try to dispatch key events
          field.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
          );
          await new Promise((resolve) => setTimeout(resolve, 50));

          field.blur();
          await new Promise((resolve) => setTimeout(resolve, 100));

          const errorsAfter = consoleTracker.errors.length;

          // Check for crashes (no uncaught errors)
          const crashErrors = consoleTracker.errors
            .slice(errorsBefore)
            .filter(
              (args) =>
                args.some((a) => String(a).includes("Cannot read")) ||
                args.some((a) => String(a).includes("undefined")) ||
                args.some((a) => String(a).includes("null"))
            );

          assert.equal(
            crashErrors.length,
            0,
            "Inline edit should handle missing previousSibling gracefully"
          );
        });

        t.test("null radio toggle values → graceful fallback", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const radioToggles = findRadioToggles(root);

          // Cutter character sheet should have radio toggles (XP teeth, action ratings)
          assert.ok(radioToggles.length > 0,
            "Cutter sheet should have radio toggles (XP teeth) - template may be broken");

          const errorsBefore = consoleTracker.errors.length;

          // Try to interact with radio toggles
          for (let i = 0; i < Math.min(3, radioToggles.length); i++) {
            const toggle = radioToggles[i];

            // Dispatch events that might expose null handling issues
            toggle.dispatchEvent(
              new MouseEvent("mousedown", { bubbles: true })
            );
            await new Promise((resolve) => setTimeout(resolve, 30));
          }

          await new Promise((resolve) => setTimeout(resolve, 200));

          const crashErrors = consoleTracker.errors
            .slice(errorsBefore)
            .filter(
              (args) =>
                args.some((a) => String(a).includes("Cannot read")) ||
                args.some((a) => String(a).includes("TypeError"))
            );

          assert.equal(
            crashErrors.length,
            0,
            "Radio toggles should handle null values gracefully"
          );
        });
      });

      t.section("Error Notifications", () => {
        let actor;
        let notificationTracker;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestCrewActor({
            name: "ErrorHandling-CrewSheet-Test",
            crewTypeName: "Assassins"
          });
          actor = result.actor;
          notificationTracker = trackNotifications();
        });

        afterEach(async function () {
          this.timeout(5000);
          if (notificationTracker) notificationTracker.restore();

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

        t.test("successful operations don't show error notifications", async function () {
          this.timeout(8000);

          const notificationsBefore = notificationTracker.notifications.length;

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // CRITICAL: Capture initial item count before operation
          const itemCountBefore = actor.items.size;

          // Perform a valid operation (toggle an ability if available)
          const checkboxes = findAbilityCheckboxes(root);
          let abilityName = null;
          if (checkboxes.length > 0) {
            const checkbox = checkboxes[0];
            abilityName = checkbox.dataset?.itemName ||
                          checkbox.closest("[data-item-name]")?.dataset?.itemName;
            triggerCrewCheckboxChange(sheet, checkbox);
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          const errorNotifications = notificationTracker.notifications
            .slice(notificationsBefore)
            .filter((n) => n.type === "error");

          assert.equal(
            errorNotifications.length,
            0,
            "Successful operations should not show error notifications"
          );

          // CRITICAL: Verify actor.items was actually updated (if we clicked something)
          if (checkboxes.length > 0) {
            const itemCountAfter = actor.items.size;
            assert.ok(
              itemCountAfter > itemCountBefore,
              `Actor.items.size should increase after successful ability toggle (was ${itemCountBefore}, now ${itemCountAfter})`
            );

            // Verify the specific ability was created if we know its name
            if (abilityName) {
              const hasAbility = actor.items.some(i => i.type === "crew_ability" && i.name === abilityName);
              assert.ok(
                hasAbility,
                `Actor should now have ability "${abilityName}" in actor.items`
              );
            }

            console.log(`[ErrorHandling Test] Successful operation created item: items ${itemCountBefore} → ${itemCountAfter}`);
          }
        });

        t.test("upgrade toggle operates without error notifications", async function () {
          this.timeout(10000);

          const notificationsBefore = notificationTracker.notifications.length;

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const upgradeCheckboxes = findUpgradeCheckboxes(root);

          // Assassins crew should have upgrade checkboxes
          assert.ok(upgradeCheckboxes.length > 0,
            "Assassins crew sheet should have upgrade checkboxes - template or crew type setup may be broken");

          // Get upgrade info for verification
          const checkbox = upgradeCheckboxes[0];
          const upgradeName = checkbox.dataset?.itemName ||
                              checkbox.closest("[data-item-name]")?.dataset?.itemName;

          // Capture state before action
          const flagsBefore = actor.getFlag(TARGET_MODULE_ID, "crewUpgradeProgress") || {};

          // Interact with upgrade
          triggerCrewCheckboxChange(sheet, checkbox);
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Verify no error notifications occurred
          const errorNotifications = notificationTracker.notifications
            .slice(notificationsBefore)
            .filter((n) => n.type === "error");

          assert.equal(
            errorNotifications.length,
            0,
            "Upgrade toggle should not trigger error notifications"
          );

          // Verify state changed - either upgrade progress increased or item was created
          const flagsAfter = actor.getFlag(TARGET_MODULE_ID, "crewUpgradeProgress") || {};
          const hasNewItem = actor.items.some(i => i.type === "crew_upgrade" && i.name === upgradeName);
          const progressChanged = JSON.stringify(flagsAfter) !== JSON.stringify(flagsBefore);

          assert.ok(
            hasNewItem || progressChanged,
            `Upgrade toggle should change state - either create item "${upgradeName}" or update progress flags`
          );

          console.log(`[ErrorHandling Test] Upgrade toggle: hasNewItem=${hasNewItem}, progressChanged=${progressChanged}`);
        });

        t.test("ability toggle operates without error notifications", async function () {
          this.timeout(10000);

          const notificationsBefore = notificationTracker.notifications.length;
          const itemCountBefore = actor.items.size;

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const abilityCheckboxes = findAbilityCheckboxes(root);

          // Assassins crew should have ability checkboxes
          assert.ok(abilityCheckboxes.length > 0,
            "Assassins crew sheet should have ability checkboxes - template or crew type setup may be broken");

          // Get ability info for verification
          const checkbox = abilityCheckboxes[0];
          const abilityName = checkbox.dataset?.itemName ||
                              checkbox.closest("[data-item-name]")?.dataset?.itemName;

          // Interact with ability
          triggerCrewCheckboxChange(sheet, checkbox);
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Verify no error notifications occurred
          const errorNotifications = notificationTracker.notifications
            .slice(notificationsBefore)
            .filter((n) => n.type === "error");

          assert.equal(
            errorNotifications.length,
            0,
            "Ability toggle should not trigger error notifications"
          );

          // Verify state changed - item count should increase
          const itemCountAfter = actor.items.size;
          assert.ok(
            itemCountAfter > itemCountBefore,
            `Ability toggle should create item (was ${itemCountBefore}, now ${itemCountAfter})`
          );

          // Verify specific ability was created if we know its name
          if (abilityName) {
            const hasAbility = actor.items.some(i => i.type === "crew_ability" && i.name === abilityName);
            assert.ok(
              hasAbility,
              `Actor should now have ability "${abilityName}" in actor.items`
            );
          }

          console.log(`[ErrorHandling Test] Ability toggle: items ${itemCountBefore} → ${itemCountAfter}`);
        });
      });

      t.section("Update Failure Handling", () => {
        let actor;
        let notificationTracker;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "ErrorHandling-UpdateFailure-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
          notificationTracker = trackNotifications();
        });

        afterEach(async function () {
          this.timeout(5000);
          if (notificationTracker) notificationTracker.restore();

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

        t.test("error notification appears on update failure", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Find a tooth to click
          const tooth = root.querySelector('label[for*="insight-1"], label[for*="exp"]');
          assertExists(assert, tooth, "XP tooth should exist - character sheet template may be broken");

          const notificationsBefore = notificationTracker.notifications.length;

          // Stub actor.update to throw an error
          const originalUpdate = actor.update.bind(actor);
          actor.update = async function () {
            throw new Error(expectedTestError("Simulated update failure"));
          };

          try {
            // Trigger an update through the UI by clicking a tooth
            const input = document.getElementById(tooth.getAttribute("for"));
            if (input) {
              input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            } else {
              tooth.click();
            }

            // Wait for the update to be attempted and error handling to complete
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Check for error notifications
            const newNotifications = notificationTracker.notifications.slice(notificationsBefore);
            const errorNotifications = newNotifications.filter((n) => n.type === "error");

            // The module should show an error notification when update fails
            // (This verifies error handling exists in the update path)
            console.log(
              `[ErrorHandling Test] Update failure triggered ${errorNotifications.length} error notification(s)`
            );

            // When we force an update failure, the module should show an error notification
            assert.ok(
              errorNotifications.length > 0,
              "Error notification should appear when update fails"
            );
          } finally {
            // Always restore original update function
            actor.update = originalUpdate;
          }
        });

        t.test("update failure does not crash the sheet", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Find a tooth to click
          const tooth = root.querySelector('label[for*="insight-1"], label[for*="exp"]');
          assertExists(assert, tooth, "XP tooth should exist - character sheet template may be broken");

          // Stub actor.update to throw
          const originalUpdate = actor.update.bind(actor);
          actor.update = async function () {
            throw new Error(expectedTestError("Simulated crash-inducing failure"));
          };

          try {
            // Attempt the update
            const input = document.getElementById(tooth.getAttribute("for"));
            if (input) {
              input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            }
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Verify sheet is still functional - should be able to re-render
            await sheet.render(true);
            await new Promise((resolve) => setTimeout(resolve, 200));

            const newRoot = sheet.element?.[0] || sheet.element;
            assert.ok(
              newRoot !== null,
              "Sheet should still be renderable after update failure"
            );
          } finally {
            actor.update = originalUpdate;
          }
        });

        t.test("queueUpdate propagates errors correctly", async function () {
          this.timeout(8000);

          // Import the queueUpdate function
          const module = await import(
            "/modules/bitd-alternate-sheets/scripts/lib/update-queue.js"
          );

          const notificationsBefore = notificationTracker.notifications.length;

          // Queue an update that throws
          let errorCaught = false;
          let thrownError = null;
          try {
            await module.queueUpdate(async () => {
              throw new Error(expectedTestError("queueUpdate propagation test"));
            });
          } catch (err) {
            errorCaught = true;
            thrownError = err;
          }

          // Error should be propagated
          assert.ok(errorCaught, "queueUpdate should propagate errors");
          assert.ok(
            thrownError?.message?.includes("EXPECTED TEST ERROR"),
            "Error message should be preserved"
          );

          // Wait for notification
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Check if notification was shown (queueUpdate may or may not notify)
          const newNotifications = notificationTracker.notifications.slice(notificationsBefore);
          console.log(
            `[ErrorHandling Test] queueUpdate error triggered ${newNotifications.filter(n => n.type === "error").length} notification(s)`
          );
        });
      });
    },
    { displayName: "BitD Alt Sheets: Error Handling" }
  );
});
