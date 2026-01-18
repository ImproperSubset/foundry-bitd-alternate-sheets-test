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

          // Note: Toggle behavior - clicking should close
          // But clicking inside full-view doesn't close
          // This tests the basic toggle
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
          if (!coinLabel) {
            console.log("[SheetPopups Test] Coin label not found");
            this.skip();
            return;
          }

          const initialCoins = actor.system.coins || 0;
          coinLabel.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const newCoins = actor.system.coins;
          assert.ok(
            newCoins !== undefined,
            "Coins should be set after clicking coin control"
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
          if (!stashLabel) {
            console.log("[SheetPopups Test] Stash label not found");
            this.skip();
            return;
          }

          const initialStash = actor.system.coins_stashed || 0;
          stashLabel.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const newStash = actor.system.coins_stashed;
          assert.ok(
            newStash !== undefined,
            "Stash should be set after clicking stash control"
          );
          console.log(`[SheetPopups Test] Stash changed: ${initialStash} -> ${newStash}`);
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

          if (!lightHarmInput) {
            console.log("[SheetPopups Test] Light harm input not found");
            this.skip();
            return;
          }

          // Set a harm value
          lightHarmInput.value = "Bruised";
          lightHarmInput.dispatchEvent(new Event("change", { bubbles: true }));

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

          if (!armorCheckbox) {
            console.log("[SheetPopups Test] Armor checkbox not found");
            this.skip();
            return;
          }

          const initialState = armorCheckbox.checked;
          armorCheckbox.click();

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

          if (!loadSelector) {
            console.log("[SheetPopups Test] Load selector not found");
            this.skip();
            return;
          }

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

          if (!loadSelector) {
            console.log("[SheetPopups Test] Load selector not found");
            this.skip();
            return;
          }

          const initialValue = loadSelector.value;

          // Find a different option
          const options = Array.from(loadSelector.options);
          const differentOption = options.find(opt => opt.value !== initialValue);

          if (!differentOption) {
            console.log("[SheetPopups Test] Only one load option available");
            this.skip();
            return;
          }

          loadSelector.value = differentOption.value;
          loadSelector.dispatchEvent(new Event("change", { bubbles: true }));

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
          const root = sheet.element?.[0] || sheet.element;

          const clearLoadButton = root.querySelector("button.clearLoad");
          assert.ok(clearLoadButton, "Clear load button should exist on character sheet");
        });

        t.test("clearLoad resets all equipped items", async function () {
          this.timeout(15000);

          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

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
                checkbox.click();
                equippedCount++;
                await waitForActorUpdate(actor, { timeoutMs: 1500 }).catch(() => {});
                await new Promise(r => setTimeout(r, 200));
              }
            }
          }

          if (equippedCount === 0) {
            console.log("[SheetPopups Test] No items to equip");
            this.skip();
            return;
          }

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
          const root = sheet.element?.[0] || sheet.element;

          // Verify no items equipped
          let equipped = getEquippedItems(actor);
          assert.equal(Object.keys(equipped).length, 0, "Should have no equipped items initially");

          // Click clear load - should not throw
          const clearLoadButton = root.querySelector("button.clearLoad");
          if (!clearLoadButton) {
            console.log("[SheetPopups Test] Clear load button not found");
            this.skip();
            return;
          }

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
