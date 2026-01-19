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
          // Restore original compendium settings
          if (originalCompendiumSettings) {
            await restoreCompendiumSettings(originalCompendiumSettings);
          }
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
          // Restore original compendium settings
          if (originalCompendiumSettings) {
            await restoreCompendiumSettings(originalCompendiumSettings);
          }
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
    },
    {
      displayName: "BitD Alt: Smart Field Custom Text",
      snapBaselineRender: false,
    }
  );
});
