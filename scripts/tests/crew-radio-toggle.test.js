/**
 * Quench test batch for crew sheet radio toggle behavior.
 * Tests tier, heat, and wanted teeth toggles on crew sheets.
 */

import {
  createTestCrewActor,
  ensureSheet,
  getCrewStatMax,
  getCrewStat,
  getCrewTeethState,
  getLitValues,
  applyCrewToothClick,
  setCrewStat,
  isTargetModuleActive,
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

          it(`clicking tooth 1 sets ${stat} to 1`, async function () {
            this.timeout(5000);
            await setCrewStat(actor, stat, 0);
            const result = await applyCrewToothClick({ actor, stat, value: 1 });
            assert.equal(
              Number(result.statValue),
              1,
              `${stat} should be 1 after clicking tooth 1`
            );
          });

          it(`after clicking tooth 1, only tooth 1 is lit`, async function () {
            this.timeout(5000);
            await setCrewStat(actor, stat, 0);
            const result = await applyCrewToothClick({ actor, stat, value: 1 });
            const lit = getLitValues(result.teeth);
            assert.deepEqual(lit, [1], `${stat} should have only tooth 1 lit`);
          });

          it(`clicking tooth 3 sets ${stat} to 3`, async function () {
            this.timeout(5000);
            await setCrewStat(actor, stat, 1);
            const result = await applyCrewToothClick({ actor, stat, value: 3 });
            assert.equal(
              Number(result.statValue),
              3,
              `${stat} should be 3 after clicking tooth 3`
            );
          });

          it(`after clicking tooth 3, teeth 1-3 are lit`, async function () {
            this.timeout(5000);
            await setCrewStat(actor, stat, 1);
            const result = await applyCrewToothClick({ actor, stat, value: 3 });
            const lit = getLitValues(result.teeth);
            assert.deepEqual(lit, [1, 2, 3], `${stat} should have teeth 1-3 lit`);
          });

          it(`clicking lit tooth 2 at value=3 decrements to 1 (toggle behavior)`, async function () {
            this.timeout(5000);
            await setCrewStat(actor, stat, 3);
            const result = await applyCrewToothClick({ actor, stat, value: 2 });
            assert.equal(
              Number(result.statValue),
              1,
              `${stat} should be 1 after clicking lit tooth 2 (decrement to one below clicked)`
            );
          });

          it(`after clicking lit tooth 2 from value=3, only tooth 1 is lit`, async function () {
            this.timeout(5000);
            await setCrewStat(actor, stat, 3);
            const result = await applyCrewToothClick({ actor, stat, value: 2 });
            const lit = getLitValues(result.teeth);
            assert.deepEqual(lit, [1], `${stat} should have only tooth 1 lit after toggle`);
          });

          it(`clicking lit tooth 1 at value=1 decrements to 0`, async function () {
            this.timeout(5000);
            await setCrewStat(actor, stat, 1);
            const result = await applyCrewToothClick({ actor, stat, value: 1 });
            assert.equal(
              Number(result.statValue),
              0,
              `${stat} should be 0 after clicking lit tooth 1`
            );
          });

          it(`after clicking lit tooth 1, no teeth are lit`, async function () {
            this.timeout(5000);
            await setCrewStat(actor, stat, 1);
            const result = await applyCrewToothClick({ actor, stat, value: 1 });
            const lit = getLitValues(result.teeth);
            assert.deepEqual(lit, [], `${stat} should have no teeth lit after decrement to 0`);
          });

          it(`clicking max tooth sets ${stat} to max`, async function () {
            this.timeout(5000);
            const max = getCrewStatMax(actor, stat);
            await setCrewStat(actor, stat, 0);
            const result = await applyCrewToothClick({ actor, stat, value: max });
            assert.equal(
              Number(result.statValue),
              max,
              `${stat} should be ${max} after clicking max tooth`
            );
          });

          it(`after clicking max tooth, all teeth are lit`, async function () {
            this.timeout(5000);
            const max = getCrewStatMax(actor, stat);
            await setCrewStat(actor, stat, 0);
            const result = await applyCrewToothClick({ actor, stat, value: max });
            const lit = getLitValues(result.teeth);
            const expected = Array.from({ length: max }, (_, i) => i + 1);
            assert.deepEqual(lit, expected, `${stat} should have all ${max} teeth lit`);
          });
        });
      }
    },
    { displayName: "BitD Alt Sheets: Crew Radio Toggle" }
  );
});
