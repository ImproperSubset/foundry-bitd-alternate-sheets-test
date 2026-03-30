/**
 * Quench test batch for zero-load item behavior.
 * Tests that items with load 0 (e.g., Spiritbane Charm) do not
 * incorrectly increment the load total when equipped.
 *
 * Regression test for upstream issue #157.
 */

import {
  createTestActor,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
  testCleanup,
  getEquippedItems,
  TestNumberer,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

const t = new TestNumberer("31");

/**
 * Create a zero-load item on an actor.
 * @param {Actor} actor
 * @param {string} [name="Test Zero-Load Item"]
 * @returns {Promise<Item>}
 */
async function createZeroLoadItem(actor, name = "Test Zero-Load Item") {
  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name,
    type: "item",
    system: { load: 0, description: "A zero-load test item" },
  }]);
  return item;
}

/**
 * Parse the loadout value from the load display element.
 * The display uses "X/Y" format (loadout/max_load).
 * @param {HTMLElement} root - Sheet root element
 * @returns {number}
 */
function parseLoadout(root) {
  const loadEl = root.querySelector(".load-box .load-amounts");
  if (!loadEl) return NaN;
  const text = loadEl.textContent.trim();
  return parseInt(text.split("/")[0]) || 0;
}

/**
 * Trigger a gear checkbox change using the sheet's jQuery context.
 * @param {ActorSheet} sheet
 * @param {HTMLInputElement} checkbox
 * @param {string} itemId
 */
function triggerGearCheckboxChange(sheet, checkbox, itemId) {
  const sheetEl = sheet.element;
  checkbox.checked = !checkbox.checked;

  if (itemId) {
    $(sheetEl).find(`.item-block[data-item-id="${itemId}"] input[type="checkbox"]`).trigger("change");
  } else {
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping zero-load-items tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.zero-load-items",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Zero-Load Item Equipping", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(15000);
          const result = await createTestActor({
            name: "ZeroLoad-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("zero-load item has data-item-load='0' in DOM", async function () {
          this.timeout(10000);

          const item = await createZeroLoadItem(actor);
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));

          const root = sheet.element?.[0] || sheet.element;
          const itemBlock = root.querySelector(`.item-block[data-item-id="${item.id}"]`);
          assert.ok(itemBlock, "Zero-load item block must exist on sheet");

          assert.strictEqual(
            itemBlock.dataset.itemLoad,
            "0",
            `data-item-load must be "0" for zero-load items (got "${itemBlock.dataset.itemLoad}")`
          );
        });

        t.test("equipping zero-load item stores load: 0 in flag", async function () {
          this.timeout(12000);

          const item = await createZeroLoadItem(actor);
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));

          const root = sheet.element?.[0] || sheet.element;
          const itemBlock = root.querySelector(`.item-block[data-item-id="${item.id}"]`);
          assert.ok(itemBlock, "Zero-load item block must exist on sheet");

          const checkbox = itemBlock.querySelector("input[type='checkbox']");
          assert.ok(checkbox, "Zero-load item must have a checkbox");
          assert.ok(!checkbox.checked, "Checkbox should start unchecked");

          // Equip the zero-load item
          triggerGearCheckboxChange(sheet, checkbox, item.id);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const equipped = getEquippedItems(actor);
          const entry = equipped[item.id];
          assert.ok(entry, "Zero-load item must appear in equipped-items flag");
          assert.strictEqual(
            entry.load,
            0,
            `Equipped flag must store load: 0 (got ${entry.load})`
          );
        });

        t.test("equipping zero-load item does not increment loadout", async function () {
          this.timeout(12000);

          const item = await createZeroLoadItem(actor);
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));

          let root = sheet.element?.[0] || sheet.element;
          const loadoutBefore = parseLoadout(root);

          const itemBlock = root.querySelector(`.item-block[data-item-id="${item.id}"]`);
          const checkbox = itemBlock.querySelector("input[type='checkbox']");

          // Equip the zero-load item
          triggerGearCheckboxChange(sheet, checkbox, item.id);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          // Re-render to update load display
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));

          root = sheet.element?.[0] || sheet.element;
          const loadoutAfter = parseLoadout(root);

          assert.strictEqual(
            loadoutAfter,
            loadoutBefore,
            `Loadout must not change when equipping a zero-load item (before: ${loadoutBefore}, after: ${loadoutAfter})`
          );
        });

        t.test("zero-load item checkbox shows checked when equipped", async function () {
          this.timeout(12000);

          const item = await createZeroLoadItem(actor);
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));

          let root = sheet.element?.[0] || sheet.element;
          const itemBlock = root.querySelector(`.item-block[data-item-id="${item.id}"]`);
          const checkbox = itemBlock.querySelector("input[type='checkbox']");

          // Equip the zero-load item
          triggerGearCheckboxChange(sheet, checkbox, item.id);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          // Re-render and check the checkbox state
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));

          root = sheet.element?.[0] || sheet.element;
          const updatedBlock = root.querySelector(`.item-block[data-item-id="${item.id}"]`);
          assert.ok(updatedBlock, "Item block must still exist after re-render");

          const updatedCheckbox = updatedBlock.querySelector("input[type='checkbox']");
          assert.ok(
            updatedCheckbox?.checked,
            "Zero-load item checkbox must show as checked when equipped"
          );
        });

        t.test("unequipping zero-load item removes it from flag", async function () {
          this.timeout(15000);

          const item = await createZeroLoadItem(actor);
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));

          let root = sheet.element?.[0] || sheet.element;
          let itemBlock = root.querySelector(`.item-block[data-item-id="${item.id}"]`);
          let checkbox = itemBlock.querySelector("input[type='checkbox']");

          // Equip first
          triggerGearCheckboxChange(sheet, checkbox, item.id);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          let equipped = getEquippedItems(actor);
          assert.ok(equipped[item.id], "Item must be equipped before unequip test");

          // Re-render and find the checkbox again
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));

          root = sheet.element?.[0] || sheet.element;
          itemBlock = root.querySelector(`.item-block[data-item-id="${item.id}"]`);
          checkbox = itemBlock.querySelector("input[type='checkbox']");

          // Unequip
          triggerGearCheckboxChange(sheet, checkbox, item.id);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          equipped = getEquippedItems(actor);
          assert.strictEqual(
            equipped[item.id],
            undefined,
            "Zero-load item must be removed from equipped-items flag after unequip"
          );
        });
      });

      t.section("Mixed Load Items", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(15000);
          const result = await createTestActor({
            name: "ZeroLoad-Mixed-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("equipping zero-load and normal items sums correctly", async function () {
          this.timeout(15000);

          // Create a zero-load item and a normal (load 1) item
          const zeroItem = await createZeroLoadItem(actor, "Zero-Load Charm");
          const [normalItem] = await actor.createEmbeddedDocuments("Item", [{
            name: "Normal Gear",
            type: "item",
            system: { load: 1, description: "A normal 1-load item" },
          }]);

          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));

          let root = sheet.element?.[0] || sheet.element;
          const loadoutBefore = parseLoadout(root);

          // Equip the zero-load item
          let zeroBlock = root.querySelector(`.item-block[data-item-id="${zeroItem.id}"]`);
          let zeroCheckbox = zeroBlock.querySelector("input[type='checkbox']");
          triggerGearCheckboxChange(sheet, zeroCheckbox, zeroItem.id);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          // Re-render before equipping the next item
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;

          // Equip the normal item
          let normalBlock = root.querySelector(`.item-block[data-item-id="${normalItem.id}"]`);
          let normalCheckbox = normalBlock.querySelector("input[type='checkbox']");
          triggerGearCheckboxChange(sheet, normalCheckbox, normalItem.id);
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          // Re-render to see final load
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;

          const loadoutAfter = parseLoadout(root);

          // Only the normal item (load 1) should have added to loadout
          assert.strictEqual(
            loadoutAfter,
            loadoutBefore + 1,
            `Loadout should increase by 1 (normal item only), not 2 (before: ${loadoutBefore}, after: ${loadoutAfter})`
          );
        });
      });
    },
    { displayName: "BitD Alt Sheets: Zero-Load Items (#157)" }
  );
});
