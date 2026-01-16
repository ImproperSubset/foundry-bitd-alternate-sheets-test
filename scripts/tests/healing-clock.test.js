/**
 * Quench test batch for healing clock behavior.
 * Tests the 4-segment healing clock on character sheets.
 */

import {
  createTestActor,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
  closeAllDialogs,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";

/**
 * Get the healing clock value from the actor.
 * @param {Actor} actor
 * @returns {number}
 */
function getHealingClockValue(actor) {
  const raw = foundry.utils.getProperty(actor.system, "healing_clock.value");
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Set the healing clock value directly.
 * @param {Actor} actor
 * @param {number} value
 */
async function setHealingClockValue(actor, value) {
  await actor.update({ "system.healing_clock.value": value });
  const sheet = await ensureSheet(actor);
  await sheet.render(false);
  await new Promise((resolve) => setTimeout(resolve, 50));
}

/**
 * Find the healing clock element in the sheet.
 * @param {HTMLElement} root - Sheet root element
 * @returns {HTMLElement|null}
 */
function findHealingClockElement(root) {
  return root.querySelector(".healing-clock .blades-clock");
}

/**
 * Get the current visual value of a clock from its background image.
 * @param {HTMLElement} clockEl
 * @returns {number}
 */
function getClockVisualValue(clockEl) {
  const bg = clockEl?.style?.backgroundImage || "";
  const match = bg.match(/(\d+)clock_(\d+)\./);
  return match ? parseInt(match[2]) : 0;
}

/**
 * Click a specific segment on the healing clock.
 * @param {HTMLElement} root - Sheet root element
 * @param {number} segment - Segment number (1-4)
 */
function clickClockSegment(root, segment) {
  const clockEl = findHealingClockElement(root);
  if (!clockEl) throw new Error("Healing clock element not found");

  // Find the label for the segment
  const labels = clockEl.querySelectorAll("label.radio-toggle");
  if (segment < 1 || segment > labels.length) {
    throw new Error(`Invalid segment ${segment}, clock has ${labels.length} segments`);
  }

  const label = labels[segment - 1];
  label.click();
}

/**
 * Right-click on the healing clock to decrement.
 * @param {HTMLElement} root - Sheet root element
 */
function rightClickClock(root) {
  const clockEl = findHealingClockElement(root);
  if (!clockEl) throw new Error("Healing clock element not found");

  clockEl.dispatchEvent(new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    button: 2,
  }));
}

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping healing clock tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.healing-clock",
    (context) => {
      const { describe, it, assert, beforeEach, afterEach } = context;

      let actor;

      beforeEach(async function () {
        this.timeout(10000);
        const result = await createTestActor({
          name: "HealingClock-Test",
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

      describe("Healing Clock Rendering", function () {
        it("healing clock element exists on character sheet", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const clockEl = findHealingClockElement(root);
          assert.ok(clockEl, "Healing clock element should exist");
        });

        it("healing clock is a 4-segment clock", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const clockEl = findHealingClockElement(root);
          const labels = clockEl?.querySelectorAll("label.radio-toggle");
          assert.equal(labels?.length, 4, "Healing clock should have 4 segments");
        });

        it("healing clock displays correct value from system.healing_clock.value", async function () {
          await setHealingClockValue(actor, 2);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const clockEl = findHealingClockElement(root);
          const visualValue = getClockVisualValue(clockEl);
          assert.equal(visualValue, 2, "Clock visual should match data value");
        });

        it("healing clock starts at 0 (empty) for new character", async function () {
          await setHealingClockValue(actor, 0);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          const clockEl = findHealingClockElement(root);
          const visualValue = getClockVisualValue(clockEl);
          assert.equal(visualValue, 0, "Clock should be empty at value 0");
        });
      });

      describe("Healing Clock Click Interaction", function () {
        it("clicking segment 1 when clock is empty sets value to 1", async function () {
          this.timeout(5000);
          await setHealingClockValue(actor, 0);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          clickClockSegment(root, 1);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 100));

          const newValue = getHealingClockValue(actor);
          assert.equal(newValue, 1, "Clicking segment 1 should set value to 1");
        });

        it("clicking segment 3 when clock is at 1 sets value to 3", async function () {
          this.timeout(5000);
          await setHealingClockValue(actor, 1);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          clickClockSegment(root, 3);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 100));

          const newValue = getHealingClockValue(actor);
          assert.equal(newValue, 3, "Clicking segment 3 should set value to 3");
        });

        it("clicking segment 4 fills the clock completely", async function () {
          this.timeout(5000);
          await setHealingClockValue(actor, 2);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          clickClockSegment(root, 4);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 100));

          const newValue = getHealingClockValue(actor);
          assert.equal(newValue, 4, "Clicking segment 4 should fill clock to 4");
        });

        it("clicking filled segment decrements clock (toggle behavior)", async function () {
          this.timeout(5000);
          await setHealingClockValue(actor, 3);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          // Click segment 2 which is currently filled - should decrement to 1
          clickClockSegment(root, 2);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 100));

          const newValue = getHealingClockValue(actor);
          assert.equal(newValue, 1, "Clicking filled segment 2 should decrement to 1");
        });

        it("clicking segment 1 when clock is at 1 decrements to 0", async function () {
          this.timeout(5000);
          await setHealingClockValue(actor, 1);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          clickClockSegment(root, 1);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 100));

          const newValue = getHealingClockValue(actor);
          assert.equal(newValue, 0, "Clicking segment 1 when at 1 should decrement to 0");
        });
      });

      describe("Healing Clock Right-Click", function () {
        it("right-click on clock decrements value by 1", async function () {
          this.timeout(5000);
          await setHealingClockValue(actor, 3);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          rightClickClock(root);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 100));

          const newValue = getHealingClockValue(actor);
          assert.equal(newValue, 2, "Right-click should decrement from 3 to 2");
        });

        it("right-click on clock at 0 stays at 0", async function () {
          this.timeout(5000);
          await setHealingClockValue(actor, 0);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // No update expected since we're already at 0
          rightClickClock(root);
          await new Promise((resolve) => setTimeout(resolve, 200));

          const newValue = getHealingClockValue(actor);
          assert.equal(newValue, 0, "Right-click at 0 should stay at 0");
        });

        it("multiple right-clicks decrement correctly", async function () {
          this.timeout(5000);
          await setHealingClockValue(actor, 4);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // First right-click
          let updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          rightClickClock(root);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 100));

          let newValue = getHealingClockValue(actor);
          assert.equal(newValue, 3, "First right-click should decrement to 3");

          // Re-render to get fresh DOM
          await sheet.render(false);
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Second right-click
          updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          rightClickClock(sheet.element?.[0] || sheet.element);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 100));

          newValue = getHealingClockValue(actor);
          assert.equal(newValue, 2, "Second right-click should decrement to 2");
        });
      });
    },
    { displayName: "BitD Alt Sheets: Healing Clock" }
  );
});
