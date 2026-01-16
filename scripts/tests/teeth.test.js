/**
 * Quench test batch for XP teeth toggle behavior.
 * Tests that clicking lit teeth decrements and clicking unlit teeth sets value.
 */

import {
  createTestActor,
  ensureSheet,
  getAttributeExpMax,
  getTeethState,
  getLitValues,
  applyToothClick,
  setAttributeExp,
  isTargetModuleActive,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const ATTRIBUTES = ["insight", "prowess", "resolve"];

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping test registration`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.teeth",
    (context) => {
      const { describe, it, assert, beforeEach, afterEach } = context;

      let actor;
      let playbookItem;

      beforeEach(async function () {
        this.timeout(10000);
        const result = await createTestActor({
          name: "Teeth-XP-Test",
          playbookName: "Cutter"
        });
        actor = result.actor;
        playbookItem = result.playbookItem;
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
          playbookItem = null;
        }
      });

      describe("Playbook Setup", function () {
        it("creates playbook item on actor", function () {
          const hasClass = actor.items.some(
            (item) => item.type === "class" && item.name === playbookItem.name
          );
          assert.ok(hasClass, "Actor should have the playbook item");
        });

        it("sets system.playbook to match playbook name", function () {
          assert.equal(
            actor.system.playbook,
            playbookItem.name,
            "system.playbook should match playbook item name"
          );
        });
      });

      for (const attr of ATTRIBUTES) {
        describe(`${attr} XP teeth`, function () {
          it("has exp_max greater than zero", function () {
            const max = getAttributeExpMax(actor, attr);
            assert.ok(max > 0, `${attr} exp_max should be > 0, got ${max}`);
          });

          it("starts with no teeth lit when exp is 0", async function () {
            this.timeout(5000);
            await setAttributeExp(actor, attr, 0);
            const sheet = await ensureSheet(actor);
            const root = sheet.element?.[0] || sheet.element;
            const max = getAttributeExpMax(actor, attr);
            const teeth = getTeethState(root, actor.id, attr, max);
            const lit = getLitValues(teeth);
            assert.deepEqual(lit, [], `${attr} should have no lit teeth at exp=0`);
          });

          it("clicking tooth 1 sets exp to 1", async function () {
            this.timeout(5000);
            await setAttributeExp(actor, attr, 0);
            const result = await applyToothClick({ actor, attribute: attr, value: 1 });
            assert.equal(
              String(result.exp),
              "1",
              `${attr} exp should be 1 after clicking tooth 1`
            );
          });

          it("after clicking tooth 1, only tooth 1 is lit", async function () {
            this.timeout(5000);
            await setAttributeExp(actor, attr, 0);
            const result = await applyToothClick({ actor, attribute: attr, value: 1 });
            const lit = getLitValues(result.teeth);
            assert.deepEqual(lit, [1], `${attr} should have only tooth 1 lit`);
          });

          it("clicking tooth 3 sets exp to 3", async function () {
            this.timeout(5000);
            await setAttributeExp(actor, attr, 1);
            const result = await applyToothClick({ actor, attribute: attr, value: 3 });
            assert.equal(
              String(result.exp),
              "3",
              `${attr} exp should be 3 after clicking tooth 3`
            );
          });

          it("after clicking tooth 3, teeth 1-3 are lit", async function () {
            this.timeout(5000);
            await setAttributeExp(actor, attr, 1);
            const result = await applyToothClick({ actor, attribute: attr, value: 3 });
            const lit = getLitValues(result.teeth);
            assert.deepEqual(lit, [1, 2, 3], `${attr} should have teeth 1-3 lit`);
          });

          it("clicking max tooth sets exp to max", async function () {
            this.timeout(5000);
            const max = getAttributeExpMax(actor, attr);
            await setAttributeExp(actor, attr, 0);
            const result = await applyToothClick({ actor, attribute: attr, value: max });
            assert.equal(
              String(result.exp),
              String(max),
              `${attr} exp should be ${max} after clicking max tooth`
            );
          });

          it("after clicking max tooth, all teeth are lit", async function () {
            this.timeout(5000);
            const max = getAttributeExpMax(actor, attr);
            await setAttributeExp(actor, attr, 0);
            const result = await applyToothClick({ actor, attribute: attr, value: max });
            const lit = getLitValues(result.teeth);
            const expected = Array.from({ length: max }, (_, i) => i + 1);
            assert.deepEqual(lit, expected, `${attr} should have all ${max} teeth lit`);
          });

          it("clicking lit tooth 5 at max decrements to 4 (toggle behavior)", async function () {
            this.timeout(5000);
            const max = getAttributeExpMax(actor, attr);
            if (max < 5) {
              this.skip();
              return;
            }
            // Set to max first
            await setAttributeExp(actor, attr, max);
            // Click tooth 5 (which is lit) - should decrement
            const result = await applyToothClick({ actor, attribute: attr, value: 5 });
            assert.equal(
              String(result.exp),
              "4",
              `${attr} exp should be 4 after clicking lit tooth 5`
            );
          });

          it("after clicking lit tooth 5, teeth 1-4 are lit", async function () {
            this.timeout(5000);
            const max = getAttributeExpMax(actor, attr);
            if (max < 5) {
              this.skip();
              return;
            }
            await setAttributeExp(actor, attr, max);
            const result = await applyToothClick({ actor, attribute: attr, value: 5 });
            const lit = getLitValues(result.teeth);
            assert.deepEqual(lit, [1, 2, 3, 4], `${attr} should have teeth 1-4 lit after toggle`);
          });
        });
      }
    },
    { displayName: "BitD Alt Sheets: XP Teeth" }
  );
});
