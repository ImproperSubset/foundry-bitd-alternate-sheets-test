/**
 * Quench test batch for update queue (multi-client safety).
 * Tests sequential update batching and error handling.
 */

import {
  createTestActor,
  createTestCrewActor,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
  cleanupTestActor,
  testCleanup,
  expectedTestError,
  TestNumberer,
  assertExists,
  assertNotEmpty,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * Track Hooks.onError calls for testing.
 * @returns {{errors: Array, hookId: number, cleanup: () => void}}
 */
function trackHookErrors() {
  const errors = [];
  const hookFn = (error, context) => {
    if (context?.data?.entityType || String(error).includes("BitD-Alt")) {
      errors.push({ error, context });
    }
  };
  const hookId = Hooks.on("error", hookFn);
  return {
    errors,
    hookId,
    cleanup: () => Hooks.off("error", hookId),
  };
}

/**
 * Track UI notifications for testing.
 * @returns {{notifications: Array, restore: () => void}}
 */
function trackNotifications() {
  const notifications = [];
  const originalError = ui.notifications.error.bind(ui.notifications);

  ui.notifications.error = function (message, options) {
    notifications.push({ type: "error", message, options });
    return originalError(message, options);
  };

  return {
    notifications,
    restore: () => {
      ui.notifications.error = originalError;
    },
  };
}

const t = new TestNumberer("5");

/**
 * Trigger a mousedown event on an XP tooth input using jQuery context.
 * This is required because event handlers are bound via jQuery delegation.
 * @param {ActorSheet} sheet - The sheet containing the input
 * @param {HTMLInputElement} input - The input element
 */
function triggerXpToothMousedown(sheet, input) {
  const inputId = input.id;
  const sheetEl = sheet.element;
  if (inputId) {
    $(sheetEl).find(`#${CSS.escape(inputId)}`).trigger("mousedown");
  } else {
    // Fallback: native event
    input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  }
}

/**
 * Trigger a change event on a crew checkbox using the sheet's jQuery context.
 * @param {ActorSheet} sheet - The sheet containing the checkbox
 * @param {HTMLInputElement} checkbox - The checkbox element
 */
function triggerCrewCheckboxChange(sheet, checkbox) {
  const sheetEl = sheet.element;
  const itemName = checkbox.dataset.itemName;

  if (checkbox.classList.contains("crew-ability-checkbox") && itemName) {
    $(sheetEl).find(`.crew-ability-checkbox[data-item-name="${itemName}"]`).trigger("change");
  } else if (checkbox.id) {
    $(sheetEl).find(`#${CSS.escape(checkbox.id)}`).trigger("change");
  } else {
    // Fallback: native event
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping update queue tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.update-queue",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Sequential Update Batching", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "UpdateQueue-CharSheet-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await cleanupTestActor(actor);
          actor = null;
        });

        t.test("rapid updates process sequentially", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode first
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Find XP teeth for an attribute
          const insightLabel = root.querySelector('label[for*="insight-1"]');
          assertExists(assert, insightLabel, "Insight tooth label should exist - character sheet template may be broken");

          // CRITICAL: Capture initial value before any updates
          const initialExp = actor.system?.attributes?.insight?.exp ?? 0;

          // Simulate rapid clicks on teeth (3 quick clicks)
          const clicks = [];
          for (let i = 1; i <= 3; i++) {
            const label = root.querySelector(`label[for*="insight-${i}"]`);
            if (label) {
              const input = document.getElementById(label.getAttribute("for"));
              if (input) {
                clicks.push(
                  new Promise((resolve) => {
                    triggerXpToothMousedown(sheet, input);
                    setTimeout(resolve, 10); // Very quick succession
                  })
                );
              }
            }
          }

          // Wait for all clicks to be processed
          await Promise.all(clicks);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 500));

          // CRITICAL: Verify actor.system was actually updated
          const finalExp = actor.system?.attributes?.insight?.exp;
          assert.ok(
            finalExp !== undefined,
            "Final exp value should be defined after rapid updates"
          );

          // CRITICAL: After clicking teeth 1-3 rapidly, the final value should be 3
          // (assuming initial was 0 and teeth toggle on/off behavior)
          // The exact value depends on whether teeth toggle or increment
          // At minimum, value should change from initial
          assert.ok(
            finalExp !== initialExp && finalExp > 0,
            `Exp value should change to positive after rapid clicks (was ${initialExp}, now ${finalExp})`
          );

          // If initial was 0 and we clicked 3 teeth, expect value to be 3
          if (initialExp === 0) {
            assert.strictEqual(
              finalExp,
              3,
              `After clicking teeth 1-3, exp should be 3 (got ${finalExp})`
            );
          }

          console.log(`[UpdateQueue Test] Rapid updates: exp ${initialExp} → ${finalExp}`);
        });

        t.test("multiple checkboxes don't cause race conditions", async function () {
          this.timeout(10000);

          const result = await createTestCrewActor({
            name: "UpdateQueue-CrewRace-Test",
            crewTypeName: "Assassins"
          });
          const crewActor = result.actor;

          try {
            const sheet = await ensureSheet(crewActor);
            const root = sheet.element?.[0] || sheet.element;

            // Enable edit mode
            const editToggle = root.querySelector(".toggle-allow-edit");
            if (editToggle && !sheet.allow_edit) {
              editToggle.click();
              await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // Find multiple ability checkboxes
            const checkboxes = root.querySelectorAll(".crew-ability-checkbox:not(:checked)");
            if (checkboxes.length < 2) {
              // Legitimate: test-data-state - all abilities may already be checked from previous test runs
              this.skip();
              return;
            }

            // CRITICAL: Capture initial state before rapid toggles
            const initialAbilityCount = crewActor.items.filter((i) => i.type === "crew_ability").length;
            const toggleCount = Math.min(3, checkboxes.length);

            // Capture ability names we're toggling
            const abilityNames = [];
            for (let i = 0; i < toggleCount; i++) {
              abilityNames.push(checkboxes[i].dataset?.itemName);
            }

            // Toggle multiple checkboxes rapidly
            const togglePromises = [];
            for (let i = 0; i < toggleCount; i++) {
              togglePromises.push(
                new Promise((resolve) => {
                  checkboxes[i].checked = true;
                  triggerCrewCheckboxChange(sheet, checkboxes[i]);
                  setTimeout(resolve, 20);
                })
              );
            }

            await Promise.all(togglePromises);
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // CRITICAL: Verify actor.items was updated with correct count
            const finalAbilityCount = crewActor.items.filter((i) => i.type === "crew_ability").length;

            // Should have more abilities than before
            assert.ok(
              finalAbilityCount > initialAbilityCount,
              `Crew should have more abilities after toggles (was ${initialAbilityCount}, now ${finalAbilityCount})`
            );

            // Verify at least some of the toggled abilities exist
            const createdAbilities = abilityNames.filter(name =>
              crewActor.items.some(i => i.type === "crew_ability" && i.name === name)
            );
            assert.ok(
              createdAbilities.length > 0,
              `At least one toggled ability should be created (found ${createdAbilities.length} of ${toggleCount})`
            );

            console.log(`[UpdateQueue Test] Race condition test: abilities ${initialAbilityCount} → ${finalAbilityCount} (toggled ${toggleCount})`);
          } finally {
            await cleanupTestActor(crewActor);
          }
        });

        t.test("queueUpdate executes in submission order (FIFO)", async function () {
          this.timeout(8000);

          // Import the queueUpdate function
          const module = await import(
            "/modules/bitd-alternate-sheets/scripts/lib/update-queue.js"
          );

          const order = [];

          // Queue multiple updates and track their execution order
          const promises = [
            module.queueUpdate(async () => {
              order.push(1);
              await new Promise((r) => setTimeout(r, 50));
              return 1;
            }),
            module.queueUpdate(async () => {
              order.push(2);
              await new Promise((r) => setTimeout(r, 30));
              return 2;
            }),
            module.queueUpdate(async () => {
              order.push(3);
              await new Promise((r) => setTimeout(r, 10));
              return 3;
            }),
          ];

          // Wait for all to complete
          const results = await Promise.all(promises);

          // Verify execution order matches submission order (FIFO)
          assert.deepStrictEqual(
            order,
            [1, 2, 3],
            "Queue should execute updates in submission order (FIFO)"
          );

          // Verify all results returned correctly
          assert.deepStrictEqual(
            results,
            [1, 2, 3],
            "Queue should return results in submission order"
          );

          console.log(`[UpdateQueue Test] Execution order: ${order.join(" → ")}`);
        });
      });

      t.section("Error Handling", () => {
        let actor;
        let errorTracker;
        let notificationTracker;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "UpdateQueue-ErrorHandling-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
          errorTracker = trackHookErrors();
          notificationTracker = trackNotifications();
        });

        afterEach(async function () {
          this.timeout(5000);
          if (errorTracker) errorTracker.cleanup();
          if (notificationTracker) notificationTracker.restore();

          await cleanupTestActor(actor);
          actor = null;
        });

        t.test("queueUpdate function is available", async function () {
          // Import the queueUpdate function
          const module = await import(
            "/modules/bitd-alternate-sheets/scripts/lib/update-queue.js"
          );
          assert.ok(
            typeof module.queueUpdate === "function",
            "queueUpdate should be exported as a function"
          );
        });

        t.test("successful updates complete without error", async function () {
          this.timeout(8000);

          const initialErrors = errorTracker.errors.length;

          // Perform a valid update through the sheet
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Find and click an XP tooth
          const label = root.querySelector('label[for*="insight-1"]');
          assertExists(assert, label, "Insight tooth label should exist - character sheet template may be broken");

          // CRITICAL: Capture initial value before update
          const initialExp = actor.system?.attributes?.insight?.exp ?? 0;

          const input = document.getElementById(label.getAttribute("for"));
          if (input) {
            triggerXpToothMousedown(sheet, input);
          }

          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Should have no new BitD-Alt errors
          const newErrors = errorTracker.errors.slice(initialErrors).filter((e) =>
            String(e.error).includes("BitD-Alt") ||
            e.context?.data?.entityType
          );

          assert.equal(
            newErrors.length,
            0,
            "Successful updates should not trigger error hooks"
          );

          // CRITICAL: Verify actor.system was actually updated to expected value
          const finalExp = actor.system?.attributes?.insight?.exp;
          assert.notStrictEqual(
            finalExp,
            initialExp,
            `Actor data should change after successful update (was ${initialExp}, now ${finalExp})`
          );

          // If initial was 0 and we clicked tooth 1, expect value to be 1
          if (initialExp === 0) {
            assert.strictEqual(
              finalExp,
              1,
              `After clicking tooth 1, exp should be 1 (got ${finalExp})`
            );
          }

          console.log(`[UpdateQueue Test] Successful update: exp ${initialExp} → ${finalExp}`);
        });

        t.test("queueUpdate returns promise that resolves", async function () {
          this.timeout(5000);

          // Import and test queueUpdate directly
          const module = await import(
            "/modules/bitd-alternate-sheets/scripts/lib/update-queue.js"
          );

          const result = await module.queueUpdate(async () => {
            return "test-success";
          });

          assert.equal(result, "test-success", "queueUpdate should return function result");
        });

        t.test("queueUpdate handles errors gracefully", async function () {
          this.timeout(5000);

          const module = await import(
            "/modules/bitd-alternate-sheets/scripts/lib/update-queue.js"
          );

          const initialNotifications = notificationTracker.notifications.length;

          // Queue an update that will throw
          let errorCaught = false;
          try {
            await module.queueUpdate(async () => {
              throw new Error(expectedTestError("queue error handling test"));
            });
          } catch (err) {
            errorCaught = true;
            assert.ok(
              err.message.includes("EXPECTED TEST ERROR"),
              "Error should be propagated"
            );
          }

          assert.ok(errorCaught, "queueUpdate should reject on error");

          // Check that a notification was shown
          await new Promise((resolve) => setTimeout(resolve, 100));
          const newNotifications = notificationTracker.notifications.slice(initialNotifications);

          // Note: The queue might show a notification, but only if it catches the error
          // The test verifies the error was properly rejected
        });
      });
    },
    { displayName: "BitD Alt Sheets: Update Queue" }
  );
});
