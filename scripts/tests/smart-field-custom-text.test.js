/**
 * Quench test batch for custom text entry in smart field chooser dialogs.
 * Tests the ability to enter custom values instead of selecting from compendium items.
 *
 * Affected fields:
 * - Character sheet: Heritage, Background, Vice, Vice Purveyor
 * - Crew sheet: Reputation, Hunting Ground
 */

import {
  createTestActor,
  createTestCrewActor,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
  closeAllDialogs,
  testCleanup,
  TestNumberer,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * Ensure compendium settings are properly configured for tests.
 * @returns {Promise<{populateFromCompendia: boolean}>} Original settings to restore
 */
async function ensureCompendiumSettings() {
  const originalPopulateFromCompendia = game.settings.get(TARGET_MODULE_ID, "populateFromCompendia");
  if (!originalPopulateFromCompendia) {
    await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", true);
  }
  return { populateFromCompendia: originalPopulateFromCompendia };
}

/**
 * Restore original compendium settings.
 * @param {{populateFromCompendia: boolean}} originalSettings
 */
async function restoreCompendiumSettings(originalSettings) {
  if (originalSettings.populateFromCompendia !== undefined) {
    await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", originalSettings.populateFromCompendia);
  }
}

/**
 * Find a smart-field-label element by item type (crew sheets).
 * @param {HTMLElement} root
 * @param {string} itemType - e.g., "crew_reputation" or "hunting_grounds"
 * @returns {HTMLElement|null}
 */
function findSmartItemSelector(root, itemType) {
  return root.querySelector(`[data-action="smart-item-selector"][data-item-type="${itemType}"]`);
}

/**
 * Find a smart-field-label element by field name (character sheets).
 * @param {HTMLElement} root
 * @param {string} fieldName - e.g., "system.heritage", "system.background"
 * @returns {HTMLElement|null}
 */
function findSmartEditField(root, fieldName) {
  return root.querySelector(`[data-action="smart-edit"][data-field="${fieldName}"]`);
}

/**
 * Wait for a card selection dialog to appear.
 * Returns an object with element and helper methods.
 * @param {number} timeoutMs
 * @returns {Promise<{element: HTMLElement, isV2: boolean, close: Function, getTextInput: Function, getCards: Function, clickOk: Function}|null>}
 */
async function waitForCardDialog(timeoutMs = 2000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      // Check for V2 dialogs first (native <dialog> elements in DOM)
      const v2Dialog = document.querySelector("dialog[open]");
      if (v2Dialog?.querySelector("form.selection-dialog, .card-content, input[name='customTextValue']")) {
        resolve(createDialogHelper(v2Dialog, true));
        return;
      }

      // Check for V1 dialogs in ui.windows
      const apps = Object.values(ui.windows).filter((w) => {
        const el = w.element?.[0] || w.element;
        return el?.querySelector?.(".card-content, form.selection-dialog, input[name='customTextValue']");
      });
      if (apps.length > 0) {
        const app = apps[apps.length - 1];
        const el = app.element?.[0] || app.element;
        resolve(createDialogHelper(el, false, app));
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

/**
 * Create a helper object for interacting with the dialog.
 */
function createDialogHelper(element, isV2, appInstance = null) {
  return {
    element,
    isV2,
    close: async () => {
      if (isV2) {
        const cancelBtn = element.querySelector('button[data-action="cancel"]');
        if (cancelBtn) {
          cancelBtn.click();
          await new Promise((r) => setTimeout(r, 100));
        } else {
          element.close?.();
        }
      } else if (appInstance) {
        await appInstance.close();
      }
    },
    getTextInput: () => element.querySelector('input[name="customTextValue"]'),
    getClearButton: () => element.querySelector('.clear-text-btn'),
    getCards: () => element.querySelectorAll('.card-content'),
    getRadios: () => element.querySelectorAll('input[name="selectionId"]'),
    clickOk: async () => {
      const okButton = element.querySelector(
        'button[data-action="ok"], button[data-button="confirm"]'
      );
      if (okButton) {
        okButton.click();
        await new Promise((r) => setTimeout(r, 100));
      }
    },
    clickClear: async () => {
      const clearButton = element.querySelector(
        'button[data-action="clear"], button[data-button="clear"]'
      );
      if (clearButton) {
        clearButton.click();
        await new Promise((r) => setTimeout(r, 100));
      }
    },
  };
}

/**
 * Type text into an input element.
 * @param {HTMLInputElement} input
 * @param {string} text
 */
function typeIntoInput(input, text) {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Check if actor has an owned item of a specific type.
 * @param {Actor} actor
 * @param {string} type
 * @returns {Item|null}
 */
function getOwnedItemByType(actor, type) {
  return actor.items.find((i) => i.type === type) ?? null;
}

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping smart field custom text tests`);
    return;
  }

  const t = new TestNumberer("14");

  quench.registerBatch(
    "bitd-alternate-sheets.smart-field-custom-text",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      // ========================================================================
      // CHARACTER SHEET TESTS (Heritage as example)
      // ========================================================================
      t.section("Character Sheet Custom Text (Heritage)", () => {
        let actor;
        let originalCompendiumSettings;

        beforeEach(async function () {
          this.timeout(10000);
          // Ensure compendium settings are enabled
          originalCompendiumSettings = await ensureCompendiumSettings();
          const result = await createTestActor({ name: "CustomText-Character-Test" });
          actor = result.actor;
          await closeAllDialogs();
        });

        afterEach(async function () {
          this.timeout(8000);
          await testCleanup({
            actors: [actor],
            settings: originalCompendiumSettings ? {
              moduleId: TARGET_MODULE_ID,
              values: { populateFromCompendia: originalCompendiumSettings.populateFromCompendia }
            } : null
          });
          actor = null;
        });

        t.test("dialog shows text input field", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const selector = findSmartEditField(root, "system.heritage");
          assert.ok(selector, "Heritage field should exist in edit mode");

          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          const textInput = dialog.getTextInput();
          assert.ok(textInput, "Dialog should have text input field for custom values");

          await dialog.close();
        });

        t.test("enter custom text saves to actor and displays on sheet", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Clear any existing heritage
          await actor.update({ "system.heritage": "" });
          await new Promise((r) => setTimeout(r, 100));

          // Re-render and re-get root after clearing
          sheet.render(false);
          await new Promise((r) => setTimeout(r, 200));
          root = sheet.element?.[0] || sheet.element;

          const selector = findSmartEditField(root, "system.heritage");
          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          const textInput = dialog.getTextInput();
          typeIntoInput(textInput, "Custom Heritage");

          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          assert.equal(actor.system.heritage, "Custom Heritage", "Custom text should be saved to heritage");

          // Verify custom text displays on the sheet
          sheet.render(false);
          await new Promise((r) => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;

          const selectorAfter = findSmartEditField(root, "system.heritage");
          const displayedText = selectorAfter?.textContent?.trim();
          assert.equal(
            displayedText,
            "Custom Heritage",
            "Custom heritage text should display on the sheet"
          );
        });

        t.test("select compendium item saves to actor", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          await actor.update({ "system.heritage": "" });
          await new Promise((r) => setTimeout(r, 100));

          const selector = findSmartEditField(root, "system.heritage");
          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          const radios = dialog.getRadios();
          assert.ok(radios.length > 0, "Compendium items should be available - check populateFromCompendia setting");

          const firstRadio = radios[0];
          const label = firstRadio.closest("label");
          if (label) label.click();
          else firstRadio.click();
          await new Promise((r) => setTimeout(r, 100));

          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          assert.ok(actor.system.heritage?.length > 0, "Compendium item name should be saved to heritage");
        });

        t.test("card click populates text field", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const selector = findSmartEditField(root, "system.heritage");
          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          const textInput = dialog.getTextInput();
          const radios = dialog.getRadios();

          assert.ok(radios.length > 0, "Compendium items should be available - check populateFromCompendia setting");

          const firstRadio = radios[0];
          const label = firstRadio.closest("label");
          if (label) label.click();
          else firstRadio.click();
          await new Promise((r) => setTimeout(r, 100));

          assert.ok(textInput.value.length > 0, "Text input should be populated after card selection");

          await dialog.close();
        });

        t.test("typing clears card selection highlight", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const selector = findSmartEditField(root, "system.heritage");
          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          const textInput = dialog.getTextInput();
          const radios = dialog.getRadios();

          assert.ok(radios.length > 0, "Compendium items should be available - check populateFromCompendia setting");

          // Select a card first
          const firstRadio = radios[0];
          const label = firstRadio.closest("label");
          if (label) label.click();
          else firstRadio.click();
          await new Promise((r) => setTimeout(r, 100));

          // Now type custom text
          typeIntoInput(textInput, "Typed Value");

          // Check that card is unchecked
          const checkedRadio = dialog.element.querySelector('input[name="selectionId"]:checked');
          assert.notOk(checkedRadio, "Card selection should be cleared after typing");

          await dialog.close();
        });

        t.test("clear button empties text and card selection", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const selector = findSmartEditField(root, "system.heritage");
          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          const textInput = dialog.getTextInput();
          const clearBtn = dialog.getClearButton();

          // Enter text
          typeIntoInput(textInput, "Some value");
          assert.ok(textInput.value.length > 0, "Text input should have value");

          // Click clear button
          if (clearBtn) {
            clearBtn.click();
            await new Promise((r) => setTimeout(r, 100));
            assert.equal(textInput.value, "", "Text input should be empty after clear button click");
          }

          await dialog.close();
        });

        t.test("whitespace-only text is treated as clear", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Set initial value
          await actor.update({ "system.heritage": "Initial Value" });
          await new Promise((r) => setTimeout(r, 100));

          const selector = findSmartEditField(root, "system.heritage");
          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          const textInput = dialog.getTextInput();
          typeIntoInput(textInput, "   ");

          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          assert.equal(actor.system.heritage, "", "Whitespace-only should clear the field");
        });

        t.test("field is NOT clickable in non-edit mode", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Ensure edit mode is OFF
          if (sheet.allow_edit) {
            const editToggle = root.querySelector(".toggle-allow-edit");
            if (editToggle) {
              editToggle.click();
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }

          // Verify we're in non-edit mode
          assert.strictEqual(sheet.allow_edit, false, "Sheet must be in non-edit mode for this test");

          const selector = findSmartEditField(root, "system.heritage");
          // In non-edit mode, the element might not exist or should not respond to clicks
          if (selector) {
            selector.click();
            await new Promise((r) => setTimeout(r, 300));

            // Dialog should NOT open in non-edit mode
            const dialog = await waitForCardDialog(500);
            assert.notOk(dialog, "Dialog must NOT open when clicking field in non-edit mode");
          }
          // If selector doesn't exist in non-edit mode, that's also acceptable
        });

        t.test("reopening dialog pre-populates existing custom value", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Set a custom value directly
          await actor.update({ "system.heritage": "Pre-existing Heritage" });
          await new Promise((r) => setTimeout(r, 200));

          // Re-render to pick up the change
          sheet.render(false);
          await new Promise((r) => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;

          const selector = findSmartEditField(root, "system.heritage");
          assert.ok(selector, "Heritage field must exist");

          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          const textInput = dialog.getTextInput();
          assert.ok(textInput, "Text input must exist");
          assert.strictEqual(
            textInput.value,
            "Pre-existing Heritage",
            "Text input MUST be pre-populated with existing value"
          );

          await dialog.close();
        });

        t.test("special characters save and display correctly", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          await actor.update({ "system.heritage": "" });
          await new Promise((r) => setTimeout(r, 100));

          sheet.render(false);
          await new Promise((r) => setTimeout(r, 200));
          root = sheet.element?.[0] || sheet.element;

          const selector = findSmartEditField(root, "system.heritage");
          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          // Test with special characters that could break HTML or cause XSS
          const specialText = `"Heritage" & <Test> 'Quotes'`;
          const textInput = dialog.getTextInput();
          typeIntoInput(textInput, specialText);

          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          // Verify data saved correctly (not corrupted)
          assert.strictEqual(
            actor.system.heritage,
            specialText,
            "Special characters must be saved without corruption"
          );

          // Verify display on sheet (not rendered as HTML)
          sheet.render(false);
          await new Promise((r) => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;

          const selectorAfter = findSmartEditField(root, "system.heritage");
          const displayedText = selectorAfter?.textContent?.trim();
          assert.strictEqual(
            displayedText,
            specialText,
            "Special characters must display correctly on sheet"
          );
        });

        t.test("Cancel button leaves actor unchanged", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Set initial value
          const originalValue = "Original Heritage";
          await actor.update({ "system.heritage": originalValue });
          await new Promise((r) => setTimeout(r, 100));

          const selector = findSmartEditField(root, "system.heritage");
          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          // Type new value but then cancel
          const textInput = dialog.getTextInput();
          typeIntoInput(textInput, "New Value That Should Not Save");

          // Click cancel/close instead of OK
          await dialog.close();
          await new Promise((r) => setTimeout(r, 300));

          // Verify actor was NOT changed
          assert.strictEqual(
            actor.system.heritage,
            originalValue,
            "Cancel must NOT modify actor data"
          );
        });

        t.test("dialog works with compendiums disabled (empty choices)", async function () {
          this.timeout(10000);

          // Disable compendium population
          const originalSetting = game.settings.get(TARGET_MODULE_ID, "populateFromCompendia");
          await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", false);
          await new Promise((r) => setTimeout(r, 100));

          try {
            const sheet = await ensureSheet(actor);
            let root = sheet.element?.[0] || sheet.element;

            const editToggle = root.querySelector(".toggle-allow-edit");
            if (editToggle && !sheet.allow_edit) {
              editToggle.click();
              await new Promise((resolve) => setTimeout(resolve, 100));
            }

            await actor.update({ "system.heritage": "" });
            await new Promise((r) => setTimeout(r, 100));

            sheet.render(false);
            await new Promise((r) => setTimeout(r, 200));
            root = sheet.element?.[0] || sheet.element;

            const selector = findSmartEditField(root, "system.heritage");
            selector.click();
            const dialog = await waitForCardDialog(3000);
            assert.ok(dialog, "Dialog must open even with compendiums disabled");

            // Text input should still work
            const textInput = dialog.getTextInput();
            assert.ok(textInput, "Text input must exist even with no compendium items");

            typeIntoInput(textInput, "Custom Without Compendium");

            await dialog.clickOk();
            await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
            await new Promise((r) => setTimeout(r, 300));

            assert.strictEqual(
              actor.system.heritage,
              "Custom Without Compendium",
              "Custom text must save when compendiums are disabled"
            );
          } finally {
            // Restore setting
            await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", originalSetting);
          }
        });
      });

      // ========================================================================
      // CHARACTER SHEET TESTS - Additional Fields
      // ========================================================================
      t.section("Character Sheet Custom Text (Background)", () => {
        let actor;
        let originalCompendiumSettings;

        beforeEach(async function () {
          this.timeout(10000);
          originalCompendiumSettings = await ensureCompendiumSettings();
          const result = await createTestActor({ name: "CustomText-Background-Test" });
          actor = result.actor;
          await closeAllDialogs();
        });

        afterEach(async function () {
          this.timeout(8000);
          await testCleanup({
            actors: [actor],
            settings: originalCompendiumSettings ? {
              moduleId: TARGET_MODULE_ID,
              values: { populateFromCompendia: originalCompendiumSettings.populateFromCompendia }
            } : null
          });
          actor = null;
        });

        t.test("custom background saves and displays correctly", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          await actor.update({ "system.background": "" });
          await new Promise((r) => setTimeout(r, 100));

          sheet.render(false);
          await new Promise((r) => setTimeout(r, 200));
          root = sheet.element?.[0] || sheet.element;

          const selector = findSmartEditField(root, "system.background");
          assert.ok(selector, "Background field must exist");

          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open for background");

          const textInput = dialog.getTextInput();
          assert.ok(textInput, "Text input must exist");

          typeIntoInput(textInput, "Custom Background");

          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          assert.strictEqual(
            actor.system.background,
            "Custom Background",
            "Custom background must be saved"
          );

          // Verify display
          sheet.render(false);
          await new Promise((r) => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;

          const selectorAfter = findSmartEditField(root, "system.background");
          const displayedText = selectorAfter?.textContent?.trim();
          assert.strictEqual(
            displayedText,
            "Custom Background",
            "Custom background must display on sheet"
          );
        });
      });

      t.section("Character Sheet Custom Text (Vice Purveyor)", () => {
        let actor;
        let originalCompendiumSettings;

        beforeEach(async function () {
          this.timeout(10000);
          originalCompendiumSettings = await ensureCompendiumSettings();
          const result = await createTestActor({ name: "CustomText-VicePurveyor-Test" });
          actor = result.actor;
          await closeAllDialogs();
        });

        afterEach(async function () {
          this.timeout(8000);
          await testCleanup({
            actors: [actor],
            settings: originalCompendiumSettings ? {
              moduleId: TARGET_MODULE_ID,
              values: { populateFromCompendia: originalCompendiumSettings.populateFromCompendia }
            } : null
          });
          actor = null;
        });

        t.test("custom vice purveyor saves to flag and displays correctly", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Clear existing flag
          await actor.unsetFlag(TARGET_MODULE_ID, "vice_purveyor");
          await new Promise((r) => setTimeout(r, 100));

          sheet.render(false);
          await new Promise((r) => setTimeout(r, 200));
          root = sheet.element?.[0] || sheet.element;

          // Vice purveyor uses a flag, not system field
          const selector = findSmartEditField(root, `flags.${TARGET_MODULE_ID}.vice_purveyor`);
          assert.ok(selector, "Vice purveyor field must exist");

          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open for vice purveyor");

          const textInput = dialog.getTextInput();
          assert.ok(textInput, "Text input must exist");

          typeIntoInput(textInput, "Custom Vice Purveyor");

          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          // Vice purveyor saves to flag, not system field
          const flag = actor.getFlag(TARGET_MODULE_ID, "vice_purveyor");
          assert.strictEqual(
            flag,
            "Custom Vice Purveyor",
            "Custom vice purveyor must be saved to flag"
          );

          // Verify display
          sheet.render(false);
          await new Promise((r) => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;

          const selectorAfter = findSmartEditField(root, `flags.${TARGET_MODULE_ID}.vice_purveyor`);
          const displayedText = selectorAfter?.textContent?.trim();
          assert.strictEqual(
            displayedText,
            "Custom Vice Purveyor",
            "Custom vice purveyor must display on sheet"
          );
        });
      });

      // ========================================================================
      // CREW SHEET TESTS (Reputation as example)
      // ========================================================================
      t.section("Crew Sheet Custom Text (Reputation)", () => {
        let actor;
        let originalCompendiumSettings;

        beforeEach(async function () {
          this.timeout(10000);
          // Ensure compendium settings are enabled
          originalCompendiumSettings = await ensureCompendiumSettings();
          const result = await createTestCrewActor({
            name: "CustomText-Crew-Test",
            crewTypeName: "Assassins"
          });
          actor = result.actor;
          await closeAllDialogs();
        });

        afterEach(async function () {
          this.timeout(8000);
          await testCleanup({
            actors: [actor],
            settings: originalCompendiumSettings ? {
              moduleId: TARGET_MODULE_ID,
              values: { populateFromCompendia: originalCompendiumSettings.populateFromCompendia }
            } : null
          });
          actor = null;
        });

        t.test("enter custom reputation saves to flag and displays on sheet", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Ensure no existing reputation item or flag
          const existingRep = getOwnedItemByType(actor, "crew_reputation");
          if (existingRep) {
            await actor.deleteEmbeddedDocuments("Item", [existingRep.id]);
          }
          await actor.unsetFlag(TARGET_MODULE_ID, "customReputationType");
          await new Promise((r) => setTimeout(r, 100));

          // Re-render and re-get root after cleanup
          sheet.render(false);
          await new Promise((r) => setTimeout(r, 200));
          root = sheet.element?.[0] || sheet.element;

          const selector = findSmartItemSelector(root, "crew_reputation");
          assert.ok(selector, "Reputation selector should exist");

          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          const textInput = dialog.getTextInput();
          typeIntoInput(textInput, "Custom Rep");

          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          // Verify flag was set and no item was created
          const flag = actor.getFlag(TARGET_MODULE_ID, "customReputationType");
          const item = getOwnedItemByType(actor, "crew_reputation");

          assert.equal(flag, "Custom Rep", "Custom reputation should be saved to flag");
          assert.notOk(item, "No crew_reputation item should exist for custom value");

          // CRITICAL: Verify custom text displays on the sheet (not just saved to flag)
          // Re-render and check display
          sheet.render(false);
          await new Promise((r) => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;

          const selectorAfter = findSmartItemSelector(root, "crew_reputation");
          const displayedText = selectorAfter?.textContent?.trim();
          assert.equal(
            displayedText,
            "Custom Rep",
            "Custom reputation text should display on the sheet"
          );
        });

        t.test("select compendium reputation creates item (not flag)", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Clear existing
          const existingRep = getOwnedItemByType(actor, "crew_reputation");
          if (existingRep) {
            await actor.deleteEmbeddedDocuments("Item", [existingRep.id]);
          }
          await actor.unsetFlag(TARGET_MODULE_ID, "customReputationType");
          await new Promise((r) => setTimeout(r, 100));

          const selector = findSmartItemSelector(root, "crew_reputation");
          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          const radios = dialog.getRadios();
          assert.ok(radios.length > 0, "Compendium items should be available - check populateFromCompendia setting");

          const firstRadio = radios[0];
          const label = firstRadio.closest("label");
          if (label) label.click();
          else firstRadio.click();
          await new Promise((r) => setTimeout(r, 100));

          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          const item = getOwnedItemByType(actor, "crew_reputation");
          const flag = actor.getFlag(TARGET_MODULE_ID, "customReputationType");

          assert.ok(item, "crew_reputation item should be created for compendium selection");
          assert.notOk(flag, "Custom flag should not be set for compendium selection");
        });

        t.test("changing from item to custom text deletes item and sets flag", async function () {
          this.timeout(12000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // First, select a compendium item
          let existingRep = getOwnedItemByType(actor, "crew_reputation");
          if (existingRep) {
            await actor.deleteEmbeddedDocuments("Item", [existingRep.id]);
          }
          await actor.unsetFlag(TARGET_MODULE_ID, "customReputationType");
          await new Promise((r) => setTimeout(r, 100));

          let selector = findSmartItemSelector(root, "crew_reputation");
          selector.click();
          let dialog = await waitForCardDialog(3000);

          const radios = dialog.getRadios();
          assert.ok(radios.length > 0, "Compendium items should be available - check populateFromCompendia setting");

          const firstRadio = radios[0];
          const label = firstRadio.closest("label");
          if (label) label.click();
          else firstRadio.click();
          await new Promise((r) => setTimeout(r, 100));
          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          // Verify item exists
          let item = getOwnedItemByType(actor, "crew_reputation");
          assert.ok(item, "Item should exist after compendium selection");

          // Re-render and re-get element refs
          sheet.render(false);
          await new Promise((r) => setTimeout(r, 200));
          const newRoot = sheet.element?.[0] || sheet.element;

          // Now switch to custom text
          selector = findSmartItemSelector(newRoot, "crew_reputation");
          selector.click();
          dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should reopen");

          const textInput = dialog.getTextInput();
          typeIntoInput(textInput, "My Custom Rep");

          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          // Verify item was deleted and flag was set
          item = getOwnedItemByType(actor, "crew_reputation");
          const flag = actor.getFlag(TARGET_MODULE_ID, "customReputationType");

          assert.notOk(item, "Item should be deleted when switching to custom text");
          assert.equal(flag, "My Custom Rep", "Flag should be set with custom text");
        });

        t.test("changing from custom flag to compendium item clears flag", async function () {
          this.timeout(12000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Start with custom flag
          const existingRep = getOwnedItemByType(actor, "crew_reputation");
          if (existingRep) {
            await actor.deleteEmbeddedDocuments("Item", [existingRep.id]);
          }
          await actor.setFlag(TARGET_MODULE_ID, "customReputationType", "Initial Custom");
          await new Promise((r) => setTimeout(r, 100));

          let selector = findSmartItemSelector(root, "crew_reputation");
          selector.click();
          const dialog = await waitForCardDialog(3000);

          const radios = dialog.getRadios();
          assert.ok(radios.length > 0, "Compendium items should be available - check populateFromCompendia setting");

          const firstRadio = radios[0];
          const label = firstRadio.closest("label");
          if (label) label.click();
          else firstRadio.click();
          await new Promise((r) => setTimeout(r, 100));

          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          const item = getOwnedItemByType(actor, "crew_reputation");
          const flag = actor.getFlag(TARGET_MODULE_ID, "customReputationType");

          assert.ok(item, "Item should be created");
          assert.notOk(flag, "Flag should be cleared when selecting compendium item");
        });

        t.test("clear removes both item and flag", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Set up with both (shouldn't happen in real use, but test cleanup)
          await actor.setFlag(TARGET_MODULE_ID, "customReputationType", "Custom Value");
          await new Promise((r) => setTimeout(r, 100));

          const selector = findSmartItemSelector(root, "crew_reputation");
          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          await dialog.clickClear();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          const item = getOwnedItemByType(actor, "crew_reputation");
          const flag = actor.getFlag(TARGET_MODULE_ID, "customReputationType");

          assert.notOk(item, "Item should be deleted after clear");
          assert.notOk(flag, "Flag should be cleared after clear");
        });
      });

      // ========================================================================
      // CREW SHEET TESTS (Hunting Grounds)
      // ========================================================================
      t.section("Crew Sheet Custom Text (Hunting Grounds)", () => {
        let actor;
        let originalCompendiumSettings;

        beforeEach(async function () {
          this.timeout(10000);
          originalCompendiumSettings = await ensureCompendiumSettings();
          const result = await createTestCrewActor({
            name: "CustomText-HuntingGrounds-Test",
            crewTypeName: "Assassins"
          });
          actor = result.actor;
          await closeAllDialogs();
        });

        afterEach(async function () {
          this.timeout(8000);
          await testCleanup({
            actors: [actor],
            settings: originalCompendiumSettings ? {
              moduleId: TARGET_MODULE_ID,
              values: { populateFromCompendia: originalCompendiumSettings.populateFromCompendia }
            } : null
          });
          actor = null;
        });

        t.test("enter custom hunting grounds saves to flag and displays on sheet", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Ensure no existing hunting grounds item or flag
          const existingHG = getOwnedItemByType(actor, "hunting_grounds");
          if (existingHG) {
            await actor.deleteEmbeddedDocuments("Item", [existingHG.id]);
          }
          await actor.unsetFlag(TARGET_MODULE_ID, "customHuntingGrounds");
          await new Promise((r) => setTimeout(r, 100));

          // Re-render and re-get root after cleanup
          sheet.render(false);
          await new Promise((r) => setTimeout(r, 200));
          root = sheet.element?.[0] || sheet.element;

          const selector = findSmartItemSelector(root, "hunting_grounds");
          assert.ok(selector, "Hunting grounds selector must exist");

          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          const textInput = dialog.getTextInput();
          assert.ok(textInput, "Text input must exist for custom value entry");

          typeIntoInput(textInput, "Custom Hunting Grounds");

          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          // Verify flag was set and no item was created
          const flag = actor.getFlag(TARGET_MODULE_ID, "customHuntingGrounds");
          const item = getOwnedItemByType(actor, "hunting_grounds");

          assert.strictEqual(flag, "Custom Hunting Grounds", "Custom hunting grounds must be saved to flag");
          assert.notOk(item, "No hunting_grounds item should exist for custom value");

          // CRITICAL: Verify custom text displays on the sheet (not just saved to flag)
          sheet.render(false);
          await new Promise((r) => setTimeout(r, 300));
          root = sheet.element?.[0] || sheet.element;

          const selectorAfter = findSmartItemSelector(root, "hunting_grounds");
          const displayedText = selectorAfter?.textContent?.trim();
          assert.strictEqual(
            displayedText,
            "Custom Hunting Grounds",
            "Custom hunting grounds text must display on the sheet"
          );
        });

        t.test("select compendium hunting grounds creates item (not flag)", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Clear existing
          const existingHG = getOwnedItemByType(actor, "hunting_grounds");
          if (existingHG) {
            await actor.deleteEmbeddedDocuments("Item", [existingHG.id]);
          }
          await actor.unsetFlag(TARGET_MODULE_ID, "customHuntingGrounds");
          await new Promise((r) => setTimeout(r, 100));

          const selector = findSmartItemSelector(root, "hunting_grounds");
          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          const radios = dialog.getRadios();
          assert.ok(radios.length > 0, "Compendium hunting grounds items should be available");

          const firstRadio = radios[0];
          const label = firstRadio.closest("label");
          if (label) label.click();
          else firstRadio.click();
          await new Promise((r) => setTimeout(r, 100));

          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          const item = getOwnedItemByType(actor, "hunting_grounds");
          const flag = actor.getFlag(TARGET_MODULE_ID, "customHuntingGrounds");

          assert.ok(item, "hunting_grounds item must be created for compendium selection");
          assert.notOk(flag, "Custom flag must NOT be set for compendium selection");
        });

        t.test("changing from item to custom text deletes item and sets flag", async function () {
          this.timeout(12000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // First, select a compendium item
          let existingHG = getOwnedItemByType(actor, "hunting_grounds");
          if (existingHG) {
            await actor.deleteEmbeddedDocuments("Item", [existingHG.id]);
          }
          await actor.unsetFlag(TARGET_MODULE_ID, "customHuntingGrounds");
          await new Promise((r) => setTimeout(r, 100));

          let selector = findSmartItemSelector(root, "hunting_grounds");
          selector.click();
          let dialog = await waitForCardDialog(3000);

          const radios = dialog.getRadios();
          assert.ok(radios.length > 0, "Compendium items should be available");

          const firstRadio = radios[0];
          const label = firstRadio.closest("label");
          if (label) label.click();
          else firstRadio.click();
          await new Promise((r) => setTimeout(r, 100));
          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          // Verify item exists BEFORE switching (fail fast if setup broken)
          let item = getOwnedItemByType(actor, "hunting_grounds");
          assert.ok(item, "Item MUST exist after compendium selection (test setup)");

          // Re-render and re-get element refs
          sheet.render(false);
          await new Promise((r) => setTimeout(r, 200));
          const newRoot = sheet.element?.[0] || sheet.element;

          // Now switch to custom text
          selector = findSmartItemSelector(newRoot, "hunting_grounds");
          selector.click();
          dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should reopen");

          const textInput = dialog.getTextInput();
          typeIntoInput(textInput, "My Custom Hunting Grounds");

          await dialog.clickOk();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          // Verify item was deleted and flag was set
          item = getOwnedItemByType(actor, "hunting_grounds");
          const flag = actor.getFlag(TARGET_MODULE_ID, "customHuntingGrounds");

          assert.notOk(item, "Item must be deleted when switching to custom text");
          assert.strictEqual(flag, "My Custom Hunting Grounds", "Flag must be set with custom text");
        });

        t.test("clear removes both item and flag", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Set up with custom flag
          await actor.setFlag(TARGET_MODULE_ID, "customHuntingGrounds", "Custom Value To Clear");
          await new Promise((r) => setTimeout(r, 100));

          // Verify flag was set (fail fast if setup broken)
          const flagBefore = actor.getFlag(TARGET_MODULE_ID, "customHuntingGrounds");
          assert.strictEqual(flagBefore, "Custom Value To Clear", "Flag MUST be set before clear (test setup)");

          const selector = findSmartItemSelector(root, "hunting_grounds");
          selector.click();
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Dialog should open");

          await dialog.clickClear();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));

          const item = getOwnedItemByType(actor, "hunting_grounds");
          const flag = actor.getFlag(TARGET_MODULE_ID, "customHuntingGrounds");

          assert.notOk(item, "Item must be deleted after clear");
          assert.notOk(flag, "Flag must be cleared after clear");
        });
      });
    },
    {
      displayName: "BitD Alt: Smart Field Custom Text",
      snapBaselineRender: false,
    }
  );
});
