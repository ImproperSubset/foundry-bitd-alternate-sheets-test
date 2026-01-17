/**
 * Quench test batch for XP teeth toggle behavior.
 * Tests that clicking lit teeth decrements and clicking unlit teeth sets value.
 *
 * Uses parameterized test helpers to reduce code duplication.
 */

import {
  createTestActor,
  ensureSheet,
  getAttributeExpMax,
  getTeethState,
  getLitValues,
  setAttributeExp,
  isTargetModuleActive,
  runTeethTest,
  TestNumberer,
  isLegitimateSkip,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const ATTRIBUTES = ["insight", "prowess", "resolve"];

const t = new TestNumberer("3");

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping test registration`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.teeth",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

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

      t.section("Playbook Setup", () => {
        t.test("creates playbook item on actor", function () {
          const hasClass = actor.items.some(
            (item) => item.type === "class" && item.name === playbookItem.name
          );
          assert.ok(hasClass, "Actor should have the playbook item");
        });

        t.test("sets system.playbook to match playbook name", function () {
          assert.equal(
            actor.system.playbook,
            playbookItem.name,
            "system.playbook should match playbook item name"
          );
        });
      });

      for (const attr of ATTRIBUTES) {
        t.section(`${attr} XP teeth`, () => {
          t.test("has exp_max greater than zero", function () {
            const max = getAttributeExpMax(actor, attr);
            assert.ok(max > 0, `${attr} exp_max should be > 0, got ${max}`);
          });

          t.test("starts with no teeth lit when exp is 0", async function () {
            this.timeout(5000);
            await setAttributeExp(actor, attr, 0);
            const sheet = await ensureSheet(actor);
            const root = sheet.element?.[0] || sheet.element;
            const max = getAttributeExpMax(actor, attr);
            const teeth = getTeethState(root, actor.id, attr, max);
            const lit = getLitValues(teeth);
            assert.deepEqual(lit, [], `${attr} should have no lit teeth at exp=0`);
          });

          // Parameterized tests for click behavior
          const clickTestCases = [
            { name: "clicking tooth 1 sets exp to 1", initial: 0, click: 1, expected: 1, expectedLit: [1] },
            { name: "clicking tooth 3 sets exp to 3", initial: 1, click: 3, expected: 3, expectedLit: [1, 2, 3] },
          ];

          for (const tc of clickTestCases) {
            t.test(tc.name, async function () {
              this.timeout(5000);
              await runTeethTest({
                actor,
                attribute: attr,
                initialValue: tc.initial,
                clickValue: tc.click,
                expectedValue: tc.expected,
                expectedLit: tc.expectedLit,
                assert,
              });
            });
          }

          t.test("clicking max tooth sets exp to max and lights all teeth", async function () {
            this.timeout(5000);
            const max = getAttributeExpMax(actor, attr);
            const expectedLit = Array.from({ length: max }, (_, i) => i + 1);
            await runTeethTest({
              actor,
              attribute: attr,
              initialValue: 0,
              clickValue: max,
              expectedValue: max,
              expectedLit,
              assert,
            });
          });

          t.test("clicking lit tooth 5 at max decrements to 4 (toggle behavior)", async function () {
            this.timeout(5000);
            const max = getAttributeExpMax(actor, attr);
            if (max < 5) {
              this.skip();
              return;
            }
            await runTeethTest({
              actor,
              attribute: attr,
              initialValue: max,
              clickValue: 5,
              expectedValue: 4,
              expectedLit: [1, 2, 3, 4],
              assert,
            });
          });
        });
      }
    },
    { displayName: "BitD Alt Sheets: XP Teeth" }
  );
});
