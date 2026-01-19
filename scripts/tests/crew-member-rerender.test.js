/**
 * Quench test batch for crew member sheet rerender.
 * Tests that character sheets belonging to crew members re-render
 * when crew upgrades change (e.g., Steady adds stress boxes).
 */

import {
  createTestActor,
  createTestCrewActor,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
  TestNumberer,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * Link a character to a crew by setting system.crew.
 * @param {Actor} character - The character actor
 * @param {Actor} crew - The crew actor
 */
async function linkCharacterToCrew(character, crew) {
  // The system.crew field is an array of objects with id property
  const crewEntry = { id: crew.id };
  await character.update({ "system.crew": [crewEntry] });
}

/**
 * Trigger a change event on a crew upgrade checkbox using the sheet's jQuery context.
 * This is required because event handlers are bound via jQuery delegation on sheet.element.
 * @param {ActorSheet} sheet - The sheet containing the checkbox
 * @param {HTMLInputElement} checkbox - The checkbox element
 */
function triggerCrewUpgradeChange(sheet, checkbox) {
  const sheetEl = sheet.element;
  const itemName = checkbox.dataset.itemName;
  const slot = checkbox.dataset.upgradeSlot;

  if (itemName && slot) {
    $(sheetEl).find(`.crew-upgrade-checkbox[data-item-name="${itemName}"][data-upgrade-slot="${slot}"]`).trigger("change");
  } else if (itemName) {
    $(sheetEl).find(`.crew-upgrade-checkbox[data-item-name="${itemName}"]`).trigger("change");
  } else if (checkbox.id) {
    $(sheetEl).find(`#${CSS.escape(checkbox.id)}`).trigger("change");
  } else {
    // Fallback: native event
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

/**
 * Find an upgrade checkbox in the crew sheet by looking for unchecked ones.
 * @param {HTMLElement} root
 * @returns {{checkbox: HTMLInputElement, name: string}|null}
 */
function findUncheckedUpgrade(root) {
  const checkboxes = root.querySelectorAll(".crew-upgrade-checkbox:not(:checked)");
  for (const checkbox of checkboxes) {
    // Prefer single-cost upgrades for simplicity
    const container = checkbox.closest(".crew-choice");
    const allInContainer = container?.querySelectorAll(".crew-upgrade-checkbox");
    if (allInContainer?.length === 1) {
      return { checkbox, name: checkbox.dataset.itemName };
    }
  }
  // Fall back to any unchecked
  if (checkboxes.length > 0) {
    return { checkbox: checkboxes[0], name: checkboxes[0].dataset.itemName };
  }
  return null;
}

/**
 * Create a render tracker for a sheet.
 * @param {ActorSheet} sheet
 * @returns {{wasRendered: () => boolean, reset: () => void}}
 */
function createRenderTracker(sheet) {
  let renderCount = 0;
  const originalRender = sheet.render.bind(sheet);

  sheet.render = function (...args) {
    renderCount++;
    return originalRender(...args);
  };

  return {
    wasRendered: () => renderCount > 0,
    getCount: () => renderCount,
    reset: () => { renderCount = 0; },
    restore: () => { sheet.render = originalRender; },
  };
}

const t = new TestNumberer("13");

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping crew member rerender tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.crew-member-rerender",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      let crewActor;
      let memberActor;
      let nonMemberActor;
      let memberTracker;
      let nonMemberTracker;

      beforeEach(async function () {
        this.timeout(15000);

        // Create a crew
        const crewResult = await createTestCrewActor({
          name: "CrewMemberRerender-Crew",
          crewTypeName: "Assassins"
        });
        crewActor = crewResult.actor;

        // Create two character actors
        const memberResult = await createTestActor({
          name: "CrewMemberRerender-Member",
          playbookName: "Cutter"
        });
        memberActor = memberResult.actor;

        const nonMemberResult = await createTestActor({
          name: "CrewMemberRerender-NonMember",
          playbookName: "Cutter"
        });
        nonMemberActor = nonMemberResult.actor;

        // Link only the first character to the crew
        await linkCharacterToCrew(memberActor, crewActor);
      });

      afterEach(async function () {
        this.timeout(10000);

        // Restore trackers
        if (memberTracker) memberTracker.restore();
        if (nonMemberTracker) nonMemberTracker.restore();
        memberTracker = null;
        nonMemberTracker = null;

        // Clean up actors
        for (const actor of [crewActor, memberActor, nonMemberActor]) {
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
          }
        }
        crewActor = null;
        memberActor = null;
        nonMemberActor = null;
      });

      t.section("Crew Member Sheet Rerender", () => {
        t.test("character is linked to crew via system.crew", async function () {
          const crewData = memberActor.system?.crew;
          assert.ok(Array.isArray(crewData), "system.crew should be an array");
          assert.ok(
            crewData.some((entry) => entry?.id === crewActor.id),
            "Character should have crew entry matching crew actor ID"
          );
        });

        t.test("non-member is not linked to crew", async function () {
          const crewData = nonMemberActor.system?.crew;
          const isLinked = Array.isArray(crewData) &&
            crewData.some((entry) => entry?.id === crewActor.id);
          assert.ok(!isLinked, "Non-member should not be linked to crew");
        });

        t.test("crew upgrade triggers member sheet rerender", async function () {
          this.timeout(10000);

          // Open all sheets
          const crewSheet = await ensureSheet(crewActor);
          const memberSheet = await ensureSheet(memberActor);

          // Set up render tracker on member sheet
          memberTracker = createRenderTracker(memberSheet);

          // Find and click an upgrade on the crew sheet
          const crewRoot = crewSheet.element?.[0] || crewSheet.element;
          const upgrade = findUncheckedUpgrade(crewRoot);

          if (!upgrade) {
            this.skip();
            return;
          }

          // Reset tracker right before the action
          memberTracker.reset();

          // Toggle the upgrade
          upgrade.checkbox.checked = true;
          triggerCrewUpgradeChange(crewSheet, upgrade.checkbox);

          // Wait for the crew update
          await waitForActorUpdate(crewActor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 500));

          // CRITICAL: Verify the upgrade was actually created in crew actor
          const hasUpgrade = crewActor.items.some(
            (i) => i.type === "crew_upgrade" && i.name === upgrade.name
          );
          assert.ok(
            hasUpgrade,
            `Crew should have upgrade "${upgrade.name}" in actor.items after checkbox toggle`
          );

          // Verify member sheet was re-rendered
          assert.ok(
            memberTracker.wasRendered(),
            "Member sheet should have been re-rendered after crew upgrade"
          );
        });

        t.test("crew upgrade does not rerender non-member sheets", async function () {
          this.timeout(10000);

          // Open all sheets
          const crewSheet = await ensureSheet(crewActor);
          await ensureSheet(memberActor);
          const nonMemberSheet = await ensureSheet(nonMemberActor);

          // Set up render tracker on non-member sheet
          nonMemberTracker = createRenderTracker(nonMemberSheet);

          // Find and click an upgrade on the crew sheet
          const crewRoot = crewSheet.element?.[0] || crewSheet.element;
          const upgrade = findUncheckedUpgrade(crewRoot);

          if (!upgrade) {
            this.skip();
            return;
          }

          // Reset tracker right before the action
          nonMemberTracker.reset();

          // Toggle the upgrade
          upgrade.checkbox.checked = true;
          triggerCrewUpgradeChange(crewSheet, upgrade.checkbox);

          // Wait for the crew update
          await waitForActorUpdate(crewActor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 500));

          // CRITICAL: Verify the upgrade was actually created in crew actor
          const hasUpgrade = crewActor.items.some(
            (i) => i.type === "crew_upgrade" && i.name === upgrade.name
          );
          assert.ok(
            hasUpgrade,
            `Crew should have upgrade "${upgrade.name}" in actor.items after checkbox toggle`
          );

          // Verify non-member sheet was NOT re-rendered
          assert.ok(
            !nonMemberTracker.wasRendered(),
            "Non-member sheet should NOT have been re-rendered after crew upgrade"
          );
        });

        t.test("only open member sheets are re-rendered", async function () {
          this.timeout(10000);

          // Open crew sheet but NOT the member sheet
          const crewSheet = await ensureSheet(crewActor);
          const memberSheet = await ensureSheet(memberActor);

          // Close the member sheet
          await memberSheet.close();
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Set up tracker (will catch if render is called on closed sheet)
          memberTracker = createRenderTracker(memberSheet);
          memberTracker.reset();

          // Find and click an upgrade on the crew sheet
          const crewRoot = crewSheet.element?.[0] || crewSheet.element;
          const upgrade = findUncheckedUpgrade(crewRoot);

          if (!upgrade) {
            this.skip();
            return;
          }

          // Toggle the upgrade
          upgrade.checkbox.checked = true;
          triggerCrewUpgradeChange(crewSheet, upgrade.checkbox);

          // Wait for the crew update
          await waitForActorUpdate(crewActor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 500));

          // CRITICAL: Verify the upgrade was actually created in crew actor
          const hasUpgrade = crewActor.items.some(
            (i) => i.type === "crew_upgrade" && i.name === upgrade.name
          );
          assert.ok(
            hasUpgrade,
            `Crew should have upgrade "${upgrade.name}" in actor.items after checkbox toggle`
          );

          // Verify closed member sheet was NOT re-rendered
          // (The implementation checks sheet.rendered before calling render)
          assert.ok(
            !memberTracker.wasRendered(),
            "Closed member sheet should NOT have render called"
          );
        });
      });
    },
    { displayName: "BitD Alt Sheets: Crew Member Rerender" }
  );
});
