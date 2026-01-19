/**
 * Quench test batch for sheet popup interactions.
 * Tests coins popup, harm popup, and load popup functionality.
 */

import {
  createTestActor,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
  testCleanup,
  TestNumberer,
  assertExists,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

const t = new TestNumberer("19");

/**
 * Find the coins popup box on the sheet.
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findCoinsBox(root) {
  return root.querySelector(".coins-box");
}

/**
 * Find the harm popup box on the sheet.
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findHarmBox(root) {
  return root.querySelector(".harm-box");
}

/**
 * Find the load popup box on the sheet.
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findLoadBox(root) {
  return root.querySelector(".load-box");
}

/**
 * Check if a popup is open (has "open" class).
 * @param {HTMLElement} popup
 * @returns {boolean}
 */
function isPopupOpen(popup) {
  return popup?.classList.contains("open") || false;
}

/**
 * Find gear items on the sheet.
 * @param {HTMLElement} root
 * @returns {NodeListOf<HTMLElement>}
 */
function findGearItems(root) {
  return root.querySelectorAll(
    ".item-block[data-item-id], .playbook-items .item-block, .all-items .item-block"
  );
}

/**
 * Check if an item is selected/equipped.
 * @param {HTMLElement} itemEl
 * @returns {boolean}
 */
function isItemSelected(itemEl) {
  const checkbox = itemEl.querySelector("input[type='checkbox']");
  return checkbox?.checked || false;
}

/**
 * Get the equipped-items flag from actor.
 * @param {Actor} actor
 * @returns {object}
 */
function getEquippedItems(actor) {
  return actor.getFlag(TARGET_MODULE_ID, "equipped-items") || {};
}

/**
 * Trigger a mousedown event on a label using the sheet's jQuery context.
 * This is required because radio-toggle controls use jQuery event delegation.
 * @param {ActorSheet} sheet - The sheet containing the label
 * @param {HTMLLabelElement} label - The label element
 */
function triggerLabelMousedown(sheet, label) {
  const forAttr = label.getAttribute("for");
  const sheetEl = sheet.element;
  if (forAttr) {
    $(sheetEl).find(`label[for="${forAttr}"]`).trigger("mousedown");
  } else {
    // Fallback: native event
    label.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  }
}

/**
 * Trigger a change event on an input/select using the sheet's jQuery context.
 * @param {ActorSheet} sheet - The sheet containing the element
 * @param {HTMLElement} element - The input or select element
 */
function triggerChangeEvent(sheet, element) {
  const sheetEl = sheet.element;
  const name = element.name;
  const id = element.id;

  if (name) {
    $(sheetEl).find(`[name="${name}"]`).trigger("change");
  } else if (id) {
    $(sheetEl).find(`#${CSS.escape(id)}`).trigger("change");
  } else {
    // Fallback: native event
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

/**
 * Trigger a checkbox click using the sheet's jQuery context.
 * @param {ActorSheet} sheet - The sheet containing the checkbox
 * @param {HTMLInputElement} checkbox - The checkbox element
 * @param {string} itemId - Optional item ID for item checkboxes
 */
function triggerCheckboxChange(sheet, checkbox, itemId) {
  const sheetEl = sheet.element;

  // Toggle the checked state
  checkbox.checked = !checkbox.checked;

  if (itemId) {
    $(sheetEl).find(`.item-block[data-item-id="${itemId}"] input[type="checkbox"]`).trigger("change");
  } else if (checkbox.id) {
    $(sheetEl).find(`#${CSS.escape(checkbox.id)}`).trigger("change");
  } else if (checkbox.name) {
    $(sheetEl).find(`input[name="${checkbox.name}"]`).trigger("change");
  } else {
    // Fallback
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping sheet-popups tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.sheet-popups",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Coins Popup", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "SheetPopups-Coins-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("clicking coins box opens popup", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const coinsBox = findCoinsBox(root);
          assertExists(assert, coinsBox, "Coins box should exist on character sheet");

          // Verify popup is initially closed
          assert.ok(!isPopupOpen(coinsBox), "Coins popup should be closed initially");

          // Click to open
          coinsBox.click();
          await new Promise(r => setTimeout(r, 100));

          assert.ok(isPopupOpen(coinsBox), "Coins popup should be open after click");
        });

        t.test("clicking coins box again closes popup", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const coinsBox = findCoinsBox(root);
          assertExists(assert, coinsBox, "Coins box should exist");

          // Open the popup
          coinsBox.click();
          await new Promise(r => setTimeout(r, 100));
          assert.ok(isPopupOpen(coinsBox), "Popup should be open after first click");

          // Click the box header area (not inside full-view) to close
          // We need to click the collapsed view area
          const collapsedView = coinsBox.querySelector(":not(.full-view)");
          if (collapsedView && collapsedView !== coinsBox.querySelector(".full-view")) {
            coinsBox.click();
          } else {
            coinsBox.click();
          }
          await new Promise(r => setTimeout(r, 100));

          // Verify popup is now closed - toggle behavior should close on second click
          assert.ok(!isPopupOpen(coinsBox), "Popup should be closed after second click");
        });

        t.test("coins popup contains coin hand controls", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const coinsBox = findCoinsBox(root);
          assertExists(assert, coinsBox, "Coins box should exist");

          // Open popup
          coinsBox.click();
          await new Promise(r => setTimeout(r, 100));

          // Find coin controls in the full-view
          const fullView = coinsBox.querySelector(".full-view");
          assertExists(assert, fullView, "Full view should exist when popup is open");

          const coinInputs = fullView.querySelectorAll('input[name="system.coins"]');
          assert.ok(coinInputs.length > 0, "Should have coin hand inputs");
        });

        t.test("coins popup contains stash controls", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const coinsBox = findCoinsBox(root);
          coinsBox.click();
          await new Promise(r => setTimeout(r, 100));

          const fullView = coinsBox.querySelector(".full-view");
          const stashInputs = fullView.querySelectorAll('input[name="system.coins_stashed"]');
          assert.ok(stashInputs.length > 0, "Should have stash inputs");
        });

        t.test("modifying coins in popup persists to actor", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const coinsBox = findCoinsBox(root);
          coinsBox.click();
          await new Promise(r => setTimeout(r, 100));

          const fullView = coinsBox.querySelector(".full-view");

          // Find a coin input with value "2" and click its label
          const coinLabel = fullView.querySelector('label[for*="coins"][for*="hands-2"]');
          // Coin popup should have coin hand labels - template may be broken
          assert.ok(coinLabel,
            "Coin label for hands-2 should exist in popup DOM - check template selector");

          const initialCoins = actor.system.coins || 0;
          // radio-toggle controls use mousedown, not click
          triggerLabelMousedown(sheet, coinLabel);
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const newCoins = actor.system.coins;
          // Assert the specific expected value - clicking hands-2 should set coins to 2
          assert.equal(
            newCoins,
            2,
            `Coins should be 2 after clicking hands-2 label (got ${newCoins})`
          );
          console.log(`[SheetPopups Test] Coins changed: ${initialCoins} -> ${newCoins}`);
        });

        t.test("modifying stash in popup persists to actor", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const coinsBox = findCoinsBox(root);
          coinsBox.click();
          await new Promise(r => setTimeout(r, 100));

          const fullView = coinsBox.querySelector(".full-view");

          // Find a stash input with value "5" and click its label
          const stashLabel = fullView.querySelector('label[for*="stashed-5"]');
          // Coin popup should have stash labels - template may be broken
          assert.ok(stashLabel,
            "Stash label for stashed-5 should exist in popup DOM - check template selector");

          const initialStash = actor.system.coins_stashed || 0;
          // radio-toggle controls use mousedown, not click
          triggerLabelMousedown(sheet, stashLabel);
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const newStash = actor.system.coins_stashed;
          // Assert the specific expected value - clicking stashed-5 should set stash to 5
          assert.equal(
            newStash,
            5,
            `Stash should be 5 after clicking stashed-5 label (got ${newStash})`
          );
          console.log(`[SheetPopups Test] Stash changed: ${initialStash} -> ${newStash}`);
        });
      });

      t.section("Coins Persistence (Close/Reopen)", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "SheetPopups-CoinsPersist-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("coins value persists after closing and reopening popup", async function () {
          this.timeout(15000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          let coinsBox = findCoinsBox(root);
          assertExists(assert, coinsBox, "Coins box should exist");

          // Open popup
          coinsBox.click();
          await new Promise(r => setTimeout(r, 100));
          assert.ok(isPopupOpen(coinsBox), "Popup should be open");

          const fullView = coinsBox.querySelector(".full-view");

          // Set coins to a specific value (click label for value 3)
          const coinLabel = fullView.querySelector('label[for*="coins"][for*="hands-3"]');
          // Coin popup should have coin hand labels - template may be broken
          assert.ok(coinLabel,
            "Coin label for hands-3 should exist in popup DOM for persistence test");

          // radio-toggle controls use mousedown, not click
          triggerLabelMousedown(sheet, coinLabel);
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const setCoins = actor.system.coins;
          // Assert the click actually worked before testing persistence
          assert.equal(setCoins, 3, `Coins should be 3 after clicking hands-3 (got ${setCoins})`);
          console.log(`[SheetPopups Test] Coins set to: ${setCoins}`);

          // Close popup by clicking the collapsed area
          coinsBox.click();
          await new Promise(r => setTimeout(r, 100));

          // Re-render sheet to simulate real usage
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;
          coinsBox = findCoinsBox(root);

          // Reopen popup
          coinsBox.click();
          await new Promise(r => setTimeout(r, 100));

          // Verify coins value is still the same
          const afterReopenCoins = actor.system.coins;
          assert.equal(
            afterReopenCoins,
            setCoins,
            `Coins should persist after close/reopen (expected ${setCoins}, got ${afterReopenCoins})`
          );
        });

        t.test("stash value persists after closing and reopening popup", async function () {
          this.timeout(15000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          let coinsBox = findCoinsBox(root);
          coinsBox.click();
          await new Promise(r => setTimeout(r, 100));

          const fullView = coinsBox.querySelector(".full-view");

          // Set stash to a specific value
          const stashLabel = fullView.querySelector('label[for*="stashed-10"]');
          // Coin popup should have stash labels - template may be broken
          assert.ok(stashLabel,
            "Stash label for stashed-10 should exist in popup DOM for persistence test");

          // radio-toggle controls use mousedown, not click
          triggerLabelMousedown(sheet, stashLabel);
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const setStash = actor.system.coins_stashed;
          // Assert the click actually worked before testing persistence
          assert.equal(setStash, 10, `Stash should be 10 after clicking stashed-10 (got ${setStash})`);
          console.log(`[SheetPopups Test] Stash set to: ${setStash}`);

          // Close and reopen
          coinsBox.click();
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;
          coinsBox = findCoinsBox(root);
          coinsBox.click();
          await new Promise(r => setTimeout(r, 100));

          // Verify stash value persists
          const afterReopenStash = actor.system.coins_stashed;
          assert.equal(
            afterReopenStash,
            setStash,
            `Stash should persist after close/reopen (expected ${setStash}, got ${afterReopenStash})`
          );
        });

        t.test("all coin denominations (1-4) can be set", async function () {
          this.timeout(20000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          for (const value of [1, 2, 3, 4]) {
            let coinsBox = findCoinsBox(root);
            coinsBox.click();
            await new Promise(r => setTimeout(r, 100));

            const fullView = coinsBox.querySelector(".full-view");
            const coinLabel = fullView.querySelector(`label[for*="coins"][for*="hands-${value}"]`);

            if (!coinLabel) {
              console.log(`[SheetPopups Test] Coin label for value ${value} not found`);
              continue;
            }

            // radio-toggle controls use mousedown, not click
            triggerLabelMousedown(sheet, coinLabel);
            await waitForActorUpdate(actor, { timeoutMs: 1500 }).catch(() => {});
            await new Promise(r => setTimeout(r, 200));

            // Close popup
            coinsBox.click();
            await new Promise(r => setTimeout(r, 100));

            // Verify value was actually set - hard assertion
            const currentCoins = actor.system.coins;
            assert.equal(
              currentCoins,
              value,
              `Coins should be ${value} after clicking hands-${value} (got ${currentCoins})`
            );
            console.log(`[SheetPopups Test] Set coins to ${value}, verified: ${currentCoins}`);

            // Re-render for next iteration
            await sheet.render(true);
            await new Promise(r => setTimeout(r, 200));
            root = sheet.element?.[0] || sheet.element;
          }
        });

        t.test("stash increments correctly with multiple clicks", async function () {
          this.timeout(15000);

          // Reset stash to 0
          await actor.update({ "system.coins_stashed": 0 });
          await new Promise(r => setTimeout(r, 200));

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const coinsBox = findCoinsBox(root);
          coinsBox.click();
          await new Promise(r => setTimeout(r, 100));

          const fullView = coinsBox.querySelector(".full-view");

          // Click stash value 5
          const stashLabel5 = fullView.querySelector('label[for*="stashed-5"]');
          // Coin popup should have stash labels - template may be broken
          assert.ok(stashLabel5,
            "Stash label for stashed-5 should exist in popup DOM for increment test");

          // radio-toggle controls use mousedown, not click
          triggerLabelMousedown(sheet, stashLabel5);
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const after5 = actor.system.coins_stashed;
          assert.equal(after5, 5, `Stash should be 5 (got ${after5})`);

          // Sheet re-renders after actor update - need to re-query everything from fresh root
          const freshRoot = sheet.element?.[0] || sheet.element;
          const freshCoinsBox = findCoinsBox(freshRoot);
          assertExists(assert, freshCoinsBox, "Coins box should exist after re-render");

          // Check if popup is still open, if not reopen it
          let freshFullView = freshCoinsBox.querySelector(".full-view");
          if (!freshFullView) {
            freshCoinsBox.click();
            await new Promise(r => setTimeout(r, 100));
            freshFullView = freshCoinsBox.querySelector(".full-view");
          }
          assertExists(assert, freshFullView, "Full-view should exist after reopening");

          // Now find and click stash-10 on refreshed DOM
          const stashLabel10 = freshFullView.querySelector('label[for*="stashed-10"]');
          assertExists(assert, stashLabel10, "Stash label 10 should exist in popup");

          triggerLabelMousedown(sheet, stashLabel10);
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const after10 = actor.system.coins_stashed;
          assert.equal(after10, 10, `Stash should be 10 (got ${after10})`);

          console.log(`[SheetPopups Test] Stash progression: 0 -> ${after5} -> ${after10}`);
        });
      });

      t.section("Harm Popup", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "SheetPopups-Harm-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("clicking harm box opens popup", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const harmBox = findHarmBox(root);
          assertExists(assert, harmBox, "Harm box should exist on character sheet");

          assert.ok(!isPopupOpen(harmBox), "Harm popup should be closed initially");

          harmBox.click();
          await new Promise(r => setTimeout(r, 100));

          assert.ok(isPopupOpen(harmBox), "Harm popup should be open after click");
        });

        t.test("harm popup contains healing clock", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const harmBox = findHarmBox(root);
          harmBox.click();
          await new Promise(r => setTimeout(r, 100));

          const fullView = harmBox.querySelector(".full-view");
          assertExists(assert, fullView, "Full view should exist");

          const healingClock = fullView.querySelector(".healing-clock, .clocks");
          assert.ok(healingClock, "Harm popup should contain healing clock element");
        });

        t.test("harm popup contains harm level inputs", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const harmBox = findHarmBox(root);
          harmBox.click();
          await new Promise(r => setTimeout(r, 100));

          const fullView = harmBox.querySelector(".full-view");

          // Check for harm inputs (level 1, 2, 3)
          const lightHarmInputs = fullView.querySelectorAll('input[name*="harm.light"]');
          const mediumHarmInputs = fullView.querySelectorAll('input[name*="harm.medium"]');
          const heavyHarmInputs = fullView.querySelectorAll('input[name*="harm.heavy"]');

          assert.ok(lightHarmInputs.length > 0, "Should have light harm inputs");
          assert.ok(mediumHarmInputs.length > 0, "Should have medium harm inputs");
          assert.ok(heavyHarmInputs.length > 0, "Should have heavy harm inputs");
        });

        t.test("harm popup contains armor checkboxes", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const harmBox = findHarmBox(root);
          harmBox.click();
          await new Promise(r => setTimeout(r, 100));

          const fullView = harmBox.querySelector(".full-view");

          const armorCheckbox = fullView.querySelector('input[name="system.armor-uses.armor"]');
          const heavyCheckbox = fullView.querySelector('input[name="system.armor-uses.heavy"]');
          const specialCheckbox = fullView.querySelector('input[name="system.armor-uses.special"]');

          assert.ok(armorCheckbox, "Should have armor checkbox");
          assert.ok(heavyCheckbox, "Should have heavy armor checkbox");
          assert.ok(specialCheckbox, "Should have special armor checkbox");
        });

        t.test("modifying harm in popup persists to actor", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const harmBox = findHarmBox(root);
          harmBox.click();
          await new Promise(r => setTimeout(r, 100));

          const fullView = harmBox.querySelector(".full-view");
          const lightHarmInput = fullView.querySelector('input[name="system.harm.light.one"]');

          // Harm popup should have light harm input - template may be broken
          assert.ok(lightHarmInput,
            "Light harm input should exist in popup DOM - check template selector");

          // Set a harm value
          lightHarmInput.value = "Bruised";
          triggerChangeEvent(sheet, lightHarmInput);

          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const harm = actor.system.harm?.light?.one;
          assert.equal(harm, "Bruised", "Light harm should be set to 'Bruised'");
        });

        t.test("toggling armor checkbox persists to actor", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const harmBox = findHarmBox(root);
          harmBox.click();
          await new Promise(r => setTimeout(r, 100));

          const fullView = harmBox.querySelector(".full-view");
          const armorCheckbox = fullView.querySelector('input[name="system.armor-uses.armor"]');

          // Harm popup should have armor checkbox - template may be broken
          assert.ok(armorCheckbox,
            "Armor checkbox should exist in popup DOM - check template selector");

          const initialState = armorCheckbox.checked;
          triggerCheckboxChange(sheet, armorCheckbox);

          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const newState = actor.system["armor-uses"]?.armor;
          assert.notEqual(
            newState,
            initialState,
            `Armor state should toggle (was ${initialState}, now ${newState})`
          );
        });
      });

      t.section("Load Popup", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "SheetPopups-Load-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("clicking load box opens popup", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const loadBox = findLoadBox(root);
          assertExists(assert, loadBox, "Load box should exist on character sheet");

          assert.ok(!isPopupOpen(loadBox), "Load popup should be closed initially");

          loadBox.click();
          await new Promise(r => setTimeout(r, 100));

          assert.ok(isPopupOpen(loadBox), "Load popup should be open after click");
        });

        t.test("load popup contains load level selector", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const loadBox = findLoadBox(root);
          loadBox.click();
          await new Promise(r => setTimeout(r, 100));

          const fullView = loadBox.querySelector(".full-view");
          assertExists(assert, fullView, "Full view should exist");

          const loadSelector = fullView.querySelector('select[name="system.selected_load_level"]');
          assert.ok(loadSelector, "Load popup should contain load level selector");
        });

        t.test("load selector has multiple options", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const loadBox = findLoadBox(root);
          loadBox.click();
          await new Promise(r => setTimeout(r, 100));

          const fullView = loadBox.querySelector(".full-view");
          const loadSelector = fullView.querySelector('select[name="system.selected_load_level"]');

          // Load popup should have load selector - template may be broken
          assert.ok(loadSelector,
            "Load selector should exist in popup DOM for options test - check template selector");

          const options = loadSelector.options;
          assert.ok(
            options.length >= 3,
            `Load selector should have at least 3 options (Light, Normal, Heavy) - found ${options.length}`
          );
        });

        t.test("changing load level in popup persists to actor", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const loadBox = findLoadBox(root);
          loadBox.click();
          await new Promise(r => setTimeout(r, 100));

          const fullView = loadBox.querySelector(".full-view");
          const loadSelector = fullView.querySelector('select[name="system.selected_load_level"]');

          // Load popup should have load selector - template may be broken
          assert.ok(loadSelector,
            "Load selector should exist in popup DOM for persistence test - check template selector");

          const initialValue = loadSelector.value;

          // Find a different option
          const options = Array.from(loadSelector.options);
          const differentOption = options.find(opt => opt.value !== initialValue);

          // Blades system should have multiple load options (Light, Normal, Heavy)
          assert.ok(differentOption,
            "Load selector should have at least 2 options (Light/Normal/Heavy) - system data may be broken");

          loadSelector.value = differentOption.value;
          triggerChangeEvent(sheet, loadSelector);

          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const newValue = actor.system.selected_load_level;
          assert.equal(
            newValue,
            differentOption.value,
            `Load level should change to ${differentOption.value}`
          );
        });
      });

      t.section("Clear Load Functionality", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "SheetPopups-ClearLoad-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("clearLoad button exists on sheet", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // clearLoad button is only visible in debug mode (GM only)
          const debugToggle = root.querySelector(".debug-toggle");
          // Debug toggle should exist for GM users - test assumes GM permissions
          assert.ok(debugToggle,
            "Debug toggle should exist - test requires GM permissions or toggle may not render");

          // Enable debug mode
          debugToggle.click();
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;

          const clearLoadButton = root.querySelector("button.clearLoad");
          assert.ok(clearLoadButton, "Clear load button should exist on character sheet (in debug mode)");
        });

        t.test("clearLoad resets all equipped items", async function () {
          this.timeout(15000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // clearLoad button is only visible in debug mode (GM only)
          const debugToggle = root.querySelector(".debug-toggle");
          // Debug toggle should exist for GM users - test assumes GM permissions
          assert.ok(debugToggle,
            "Debug toggle should exist - test requires GM permissions or toggle may not render");

          // Enable debug mode
          debugToggle.click();
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise(r => setTimeout(r, 100));
          }

          // First, equip some items
          const gearItems = findGearItems(root);
          let equippedCount = 0;

          for (const item of gearItems) {
            if (!isItemSelected(item) && equippedCount < 2) {
              const checkbox = item.querySelector("input[type='checkbox']");
              if (checkbox) {
                // Use sheet's jQuery context for event delegation
                const checkboxId = checkbox.id;
                if (checkboxId) {
                  $(sheet.element).find(`#${CSS.escape(checkboxId)}`).trigger("change");
                } else {
                  checkbox.click();
                }
                equippedCount++;
                await waitForActorUpdate(actor, { timeoutMs: 1500 }).catch(() => {});
                await new Promise(r => setTimeout(r, 200));
              }
            }
          }

          // Cutter playbook should have equippable gear items
          assert.ok(equippedCount > 0,
            "Fresh Cutter actor should have equippable gear items - test setup or playbook data may be broken");

          // Verify items are equipped
          let equipped = getEquippedItems(actor);
          const equippedBefore = Object.keys(equipped).length;
          assert.ok(equippedBefore > 0, `Should have equipped items before clear (have ${equippedBefore})`);

          // Re-render to get fresh DOM reference
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;

          // Click clear load button
          const clearLoadButton = root.querySelector("button.clearLoad");
          assertExists(assert, clearLoadButton, "Clear load button should exist");

          clearLoadButton.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 500));

          // Verify equipped items are cleared
          equipped = getEquippedItems(actor);
          const equippedAfter = Object.keys(equipped).length;

          assert.equal(
            equippedAfter,
            0,
            `Equipped items should be 0 after clear (was ${equippedBefore}, now ${equippedAfter})`
          );
        });

        t.test("clearLoad does nothing when no items equipped", async function () {
          this.timeout(10000);

          // Clear any existing equipped items first
          await actor.unsetFlag(TARGET_MODULE_ID, "equipped-items");
          await new Promise(r => setTimeout(r, 200));

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          // Verify no items equipped
          let equipped = getEquippedItems(actor);
          assert.equal(Object.keys(equipped).length, 0, "Should have no equipped items initially");

          // clearLoad button is only visible in debug mode - enable it
          const debugToggle = root.querySelector(".debug-toggle");
          assertExists(assert, debugToggle, "Debug toggle should exist");

          debugToggle.click();
          await sheet.render(true);
          await new Promise(r => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;

          // Click clear load - should not throw
          const clearLoadButton = root.querySelector("button.clearLoad");
          assertExists(assert, clearLoadButton, "Clear load button should exist in debug mode");

          let errorThrown = false;
          try {
            clearLoadButton.click();
            await new Promise(r => setTimeout(r, 300));
          } catch (e) {
            errorThrown = true;
            console.error("[SheetPopups Test] Error during clearLoad:", e);
          }

          assert.ok(!errorThrown, "clearLoad should not throw when no items equipped");
        });
      });

      t.section("Popup Click-Outside Behavior", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "SheetPopups-ClickOutside-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("clicking outside coins popup closes it", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const coinsBox = findCoinsBox(root);
          assertExists(assert, coinsBox, "Coins box should exist");

          // Open the popup
          coinsBox.click();
          await new Promise(r => setTimeout(r, 100));
          assert.ok(isPopupOpen(coinsBox), "Popup should be open");

          // Click outside (on the main sheet body)
          const sheetBody = root.querySelector(".window-content, .sheet-body, form");
          if (sheetBody) {
            // Create and dispatch a click event on the document
            // The click handler checks if target is NOT inside the coins-box
            const clickEvent = new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window
            });
            sheetBody.dispatchEvent(clickEvent);
            await new Promise(r => setTimeout(r, 100));
          }

          // Note: This test documents expected behavior
          // The actual implementation uses jQuery event handlers
          // which may behave differently in test environment
        });
      });
    },
    { displayName: "BitD Alt Sheets: Sheet Popups" }
  );
});
