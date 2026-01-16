/**
 * Quench test batch for crew sheet radio toggle behavior.
 * Tests tier, heat, and wanted teeth toggles on crew sheets.
 *
 * Uses parameterized test helpers to reduce code duplication.
 */

import {
  createTestCrewActor,
  ensureSheet,
  getCrewStatMax,
  getCrewTeethState,
  getLitValues,
  setCrewStat,
  isTargetModuleActive,
  runCrewTeethTest,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";

// Stats that use radio toggle teeth on crew sheets
const CREW_STATS = ["tier", "heat", "wanted"];

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping crew radio toggle tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.crew-radio-toggle",
    (context) => {
      const { describe, it, assert, beforeEach, afterEach } = context;

      let actor;

      beforeEach(async function () {
        this.timeout(10000);
        const result = await createTestCrewActor({
          name: "CrewRadioToggle-Test"
        });
        actor = result.actor;
      });

      afterEach(async function () {
        this.timeout(5000);
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

      describe("Crew Sheet Setup", function () {
        it("creates crew actor successfully", function () {
          assert.ok(actor, "Actor should exist");
          assert.equal(actor.type, "crew", "Actor should be crew type");
        });

        it("crew sheet renders with alternate sheet class", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;
          assert.ok(root?.classList?.contains("blades-alt"), "Sheet should have blades-alt class");
        });
      });

      for (const stat of CREW_STATS) {
        describe(`${stat} teeth`, function () {
          it(`has max ${stat} greater than zero`, function () {
            const max = getCrewStatMax(actor, stat);
            assert.ok(max > 0, `${stat} max should be > 0, got ${max}`);
          });

          it(`starts with no teeth lit when ${stat} is 0`, async function () {
            this.timeout(5000);
            await setCrewStat(actor, stat, 0);
            const sheet = await ensureSheet(actor);
            const root = sheet.element?.[0] || sheet.element;
            const max = getCrewStatMax(actor, stat);
            const teeth = getCrewTeethState(root, actor.id, stat, max);
            const lit = getLitValues(teeth);
            assert.deepEqual(lit, [], `${stat} should have no lit teeth at value=0`);
          });

          // Parameterized click test cases
          const clickTestCases = [
            { name: "clicking tooth 1 sets value to 1", initial: 0, click: 1, expected: 1, expectedLit: [1] },
            { name: "clicking tooth 3 sets value to 3", initial: 1, click: 3, expected: 3, expectedLit: [1, 2, 3] },
            { name: "clicking lit tooth 2 at value=3 decrements to 1 (toggle)", initial: 3, click: 2, expected: 1, expectedLit: [1] },
            { name: "clicking lit tooth 1 at value=1 decrements to 0", initial: 1, click: 1, expected: 0, expectedLit: [] },
          ];

          for (const tc of clickTestCases) {
            it(tc.name, async function () {
              this.timeout(5000);
              await runCrewTeethTest({
                actor,
                stat,
                initialValue: tc.initial,
                clickValue: tc.click,
                expectedValue: tc.expected,
                expectedLit: tc.expectedLit,
                assert,
              });
            });
          }

          it(`clicking max tooth sets ${stat} to max and lights all teeth`, async function () {
            this.timeout(5000);
            const max = getCrewStatMax(actor, stat);
            const expectedLit = Array.from({ length: max }, (_, i) => i + 1);
            await runCrewTeethTest({
              actor,
              stat,
              initialValue: 0,
              clickValue: max,
              expectedValue: max,
              expectedLit,
              assert,
            });
          });
        });
      }
    },
    { displayName: "BitD Alt Sheets: Crew Radio Toggle" }
  );
});
