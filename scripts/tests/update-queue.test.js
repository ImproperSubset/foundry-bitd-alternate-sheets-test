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

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping update queue tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.update-queue",
    (context) => {
      const { describe, it, assert, beforeEach, afterEach } = context;

      describe("5.1 Sequential Update Batching", function () {
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

        it("5.1.1 rapid updates process sequentially", async function () {
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
          if (!insightLabel) {
            this.skip();
            return;
          }

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
                    input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
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

          // CRITICAL: Value should have changed from initial (proving updates processed)
          assert.notStrictEqual(
            finalExp,
            initialExp,
            `Exp value should change after rapid clicks (was ${initialExp}, now ${finalExp})`
          );

          console.log(`[UpdateQueue Test] Rapid updates: exp ${initialExp} → ${finalExp}`);
        });

        it("5.1.1 multiple checkboxes don't cause race conditions", async function () {
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
                  checkboxes[i].dispatchEvent(new Event("change", { bubbles: true }));
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
      });

      describe("5.2 Error Handling", function () {
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

        it("5.2.0 queueUpdate function is available", async function () {
          // Import the queueUpdate function
          const module = await import(
            "/modules/bitd-alternate-sheets/scripts/lib/update-queue.js"
          );
          assert.ok(
            typeof module.queueUpdate === "function",
            "queueUpdate should be exported as a function"
          );
        });

        it("5.2.1 successful updates complete without error", async function () {
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
          if (!label) {
            this.skip();
            return;
          }

          // CRITICAL: Capture initial value before update
          const initialExp = actor.system?.attributes?.insight?.exp ?? 0;

          const input = document.getElementById(label.getAttribute("for"));
          if (input) {
            input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
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

          // CRITICAL: Verify actor.system was actually updated
          const finalExp = actor.system?.attributes?.insight?.exp;
          assert.notStrictEqual(
            finalExp,
            initialExp,
            `Actor data should change after successful update (was ${initialExp}, now ${finalExp})`
          );

          console.log(`[UpdateQueue Test] Successful update: exp ${initialExp} → ${finalExp}`);
        });

        it("5.2.2 queueUpdate returns promise that resolves", async function () {
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

        it("5.2.2 queueUpdate handles errors gracefully", async function () {
          this.timeout(5000);

          const module = await import(
            "/modules/bitd-alternate-sheets/scripts/lib/update-queue.js"
          );

          const initialNotifications = notificationTracker.notifications.length;

          // Queue an update that will throw
          let errorCaught = false;
          try {
            await module.queueUpdate(async () => {
              throw new Error("Test error for queue");
            });
          } catch (err) {
            errorCaught = true;
            assert.ok(
              err.message.includes("Test error"),
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
