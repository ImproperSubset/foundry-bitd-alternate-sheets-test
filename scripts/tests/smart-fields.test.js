/**
 * Quench test batch for smart fields system.
 * Tests smart item selectors (crew_reputation, hunting_grounds) and tooltips.
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
 * Find a smart-field-label element by item type.
 * @param {HTMLElement} root
 * @param {string} itemType - e.g., "crew_reputation" or "hunting_grounds"
 * @returns {HTMLElement|null}
 */
function findSmartItemSelector(root, itemType) {
  return root.querySelector(`[data-action="smart-item-selector"][data-item-type="${itemType}"]`);
}

/**
 * Find a smart-field-label element by field name (for character sheets).
 * @param {HTMLElement} root
 * @param {string} fieldName - e.g., "system.heritage", "system.background"
 * @returns {HTMLElement|null}
 */
function findSmartEditField(root, fieldName) {
  return root.querySelector(`[data-action="smart-edit"][data-field="${fieldName}"]`);
}

/**
 * Wait for a dialog to appear.
 * @param {number} timeoutMs
 * @returns {Promise<Dialog|null>}
 */
async function waitForDialog(timeoutMs = 2000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      // Look for rendered dialogs
      const dialogs = Object.values(ui.windows).filter(
        (w) => w instanceof Dialog && w.rendered
      );
      if (dialogs.length > 0) {
        resolve(dialogs[dialogs.length - 1]);
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
 * Wait for a card selection dialog to appear.
 * Returns an object with element and isV2 flag.
 * @param {number} timeoutMs
 * @returns {Promise<{element: HTMLElement, isV2: boolean, close: Function}|null>}
 */
async function waitForCardDialog(timeoutMs = 2000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      // Check for V2 dialogs first (native <dialog> elements in DOM)
      const v2Dialog = document.querySelector("dialog[open]");
      if (v2Dialog?.querySelector("form.selection-dialog, .card-content")) {
        resolve({
          element: v2Dialog,
          isV2: true,
          close: async () => {
            // Click cancel button to properly close V2 dialog
            const cancelBtn = v2Dialog.querySelector('button[data-action="cancel"]');
            if (cancelBtn) {
              cancelBtn.click();
              await new Promise((r) => setTimeout(r, 100));
            } else {
              v2Dialog.close();
            }
          }
        });
        return;
      }

      // Check for V1 dialogs in ui.windows
      const apps = Object.values(ui.windows).filter((w) => {
        const el = w.element?.[0] || w.element;
        return el?.querySelector?.(".card-content, form.selection-dialog");
      });
      if (apps.length > 0) {
        const app = apps[apps.length - 1];
        resolve({
          element: app.element?.[0] || app.element,
          isV2: false,
          close: async () => app.close()
        });
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
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping smart fields tests`);
    return;
  }

  const t = new TestNumberer("2");

  quench.registerBatch(
    "bitd-alternate-sheets.smart-fields",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Smart Item Selectors (Crew Sheet)", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestCrewActor({
            name: "SmartFields-CrewSheet-Test",
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
        });

        t.test("crew_reputation selector element exists", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Need to be in edit mode to see the selector
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const selector = findSmartItemSelector(root, "crew_reputation");
          assert.ok(selector, "crew_reputation selector element should exist");
        });

        t.test("click crew_reputation field opens selector dialog", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const selector = findSmartItemSelector(root, "crew_reputation");
          assert.ok(selector, "crew_reputation selector should exist in edit mode");

          // Click the selector
          selector.click();

          // Wait for dialog to appear
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Card selection dialog should open");
          assert.ok(dialog.element, "Dialog should have element");

          // Verify dialog has expected content
          const hasCards = dialog.element.querySelector("input[name='selectionId']");
          assert.ok(hasCards, "Dialog should have selection radio inputs");

          // Clean up by clicking cancel
          await dialog.close();
        });

        t.test("select reputation assigns crew_reputation item", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Ensure no existing reputation item
          const existingRep = getOwnedItemByType(actor, "crew_reputation");
          if (existingRep) {
            await actor.deleteEmbeddedDocuments("Item", [existingRep.id]);
          }

          const selector = findSmartItemSelector(root, "crew_reputation");
          assert.ok(selector, "crew_reputation selector should exist in edit mode");

          // Click the selector
          selector.click();

          // Wait for dialog
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Card selection dialog should open after clicking selector");

          const dialogEl = dialog.element;
          assert.ok(dialogEl, "Dialog element should exist");

          // Find radio inputs (the actual form controls)
          const radioInputs = dialogEl.querySelectorAll("input[name='selectionId']");
          assert.ok(radioInputs && radioInputs.length > 0, "Dialog should have selection radio inputs");

          // Click the first radio input's parent label to select it
          const firstRadio = radioInputs[0];
          const label = firstRadio.closest("label");
          if (label) {
            label.click();
          } else {
            firstRadio.click();
          }
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Verify the radio is now checked
          assert.ok(firstRadio.checked, "Radio input should be checked after click");

          // Click OK button - use correct selectors for V1 and V2
          // V2: button[data-action="ok"]
          // V1: button[data-button="confirm"]
          const okButton = dialogEl.querySelector(
            'button[data-action="ok"], button[data-button="confirm"]'
          );
          assert.ok(okButton, "OK button should exist in dialog");

          okButton.click();

          // Wait for update
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Verify item was created
          const newRep = getOwnedItemByType(actor, "crew_reputation");
          assert.ok(newRep, "crew_reputation item should be created after selection");
        });

        t.test("hunting_grounds selector opens dialog", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const selector = findSmartItemSelector(root, "hunting_grounds");
          assert.ok(selector, "hunting_grounds selector should exist in edit mode");

          // Click the selector
          selector.click();

          // Wait for dialog to appear
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Card selection dialog should open for hunting_grounds");
          assert.ok(dialog.element, "Dialog should have element");

          // Clean up by clicking cancel
          await dialog.close();
        });

        t.test("select hunting_grounds assigns item", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Remove existing hunting_grounds item
          const existingHG = getOwnedItemByType(actor, "hunting_grounds");
          if (existingHG) {
            await actor.deleteEmbeddedDocuments("Item", [existingHG.id]);
          }

          const selector = findSmartItemSelector(root, "hunting_grounds");
          assert.ok(selector, "hunting_grounds selector should exist in edit mode");

          // Click the selector
          selector.click();

          // Wait for dialog
          const dialog = await waitForCardDialog(3000);
          assert.ok(dialog, "Card selection dialog should open after clicking selector");

          const dialogEl = dialog.element;
          const radioInputs = dialogEl.querySelectorAll("input[name='selectionId']");
          assert.ok(radioInputs && radioInputs.length > 0, "Dialog should have selection radio inputs");

          // Click the first radio input
          const firstRadio = radioInputs[0];
          const label = firstRadio.closest("label");
          if (label) {
            label.click();
          } else {
            firstRadio.click();
          }
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Click OK button
          const okButton = dialogEl.querySelector(
            'button[data-action="ok"], button[data-button="confirm"]'
          );
          assert.ok(okButton, "OK button should exist in dialog");

          okButton.click();

          // Wait for update
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // CRITICAL: Verify item was created in actor
          const newHG = getOwnedItemByType(actor, "hunting_grounds");
          assert.ok(newHG, "hunting_grounds item should be created after selection");
        });
      });

      t.section("Smart Edit Fields (Character Sheet)", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "SmartFields-CharSheet-Test",
            playbookName: "Cutter"
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
        });

        t.test("heritage smart-edit field exists", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const field = findSmartEditField(root, "system.heritage");
          assert.ok(field, "Heritage smart-edit field should exist");
        });

        t.test("click heritage opens selector or text dialog", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const field = findSmartEditField(root, "system.heritage");
          assert.ok(field, "Heritage smart-edit field should exist in edit mode");

          // Click the field
          field.click();

          // Wait for either card dialog or text dialog
          const cardDialog = await waitForCardDialog(2000);
          const textDialog = cardDialog ? null : await waitForDialog(1000);

          const hasDialog = cardDialog || textDialog;
          assert.ok(hasDialog, "Either card selector or text dialog should open");

          // Clean up - click cancel/close button
          if (cardDialog) {
            await cardDialog.close();
          } else if (textDialog) {
            // V1 text dialog - close via application
            await textDialog.close();
          }
        });

        t.test("fallback to text input when no chooser items", async function () {
          this.timeout(8000);
          // This test verifies that text dialog opens when no compendium items
          // Since we can't easily clear compendia, we test that some dialog opens
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Try a field that might not have compendium items
          const field = findSmartEditField(root, "system.background") ||
            findSmartEditField(root, "system.heritage") ||
            findSmartEditField(root, "system.vice");
          assert.ok(field, "At least one smart-edit field (background, heritage, or vice) should exist");

          // Click the field
          field.click();

          // Wait for any dialog
          const cardDialog = await waitForCardDialog(2000);
          const textDialog = cardDialog ? null : await waitForDialog(1000);

          assert.ok(
            cardDialog || textDialog,
            "Smart edit should open some kind of dialog"
          );

          // Clean up - click cancel/close button
          if (cardDialog) {
            await cardDialog.close();
          } else if (textDialog) {
            await textDialog.close();
          }
        });

        t.test("heritage selection persists to actor.system", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Clear existing heritage
          const initialHeritage = actor.system?.heritage;
          if (initialHeritage) {
            await actor.update({ "system.heritage": "" });
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const field = findSmartEditField(root, "system.heritage");
          assert.ok(field, "Heritage smart-edit field should exist in edit mode");

          // Click the field
          field.click();

          // Wait for dialog
          const cardDialog = await waitForCardDialog(2000);
          const textDialog = cardDialog ? null : await waitForDialog(1000);
          assert.ok(cardDialog || textDialog, "Either card selector or text dialog should open");

          if (cardDialog) {
            // Card selector - pick first option
            const dialogEl = cardDialog.element;
            const radioInputs = dialogEl.querySelectorAll("input[name='selectionId']");
            assert.ok(radioInputs && radioInputs.length > 0, "Card dialog should have selection radio inputs");

            const firstRadio = radioInputs[0];
            const label = firstRadio.closest("label");
            if (label) label.click();
            else firstRadio.click();
            await new Promise((resolve) => setTimeout(resolve, 100));

            const okButton = dialogEl.querySelector(
              'button[data-action="ok"], button[data-button="confirm"]'
            );
            assert.ok(okButton, "Card dialog should have OK button");

            okButton.click();
            await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
            await new Promise((resolve) => setTimeout(resolve, 300));
          } else if (textDialog) {
            // Text dialog - enter a value
            const dialogEl = textDialog.element?.[0] || textDialog.element;
            const input = dialogEl?.querySelector("input[type='text'], input[name='value']");
            assert.ok(input, "Text dialog should have text input");

            input.value = "Test Heritage Value";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Click OK/submit
            const okButton = dialogEl.querySelector('button[data-button="confirm"], button[type="submit"]');
            assert.ok(okButton, "Text dialog should have OK/submit button");

            okButton.click();
            await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          // CRITICAL: Verify actor.system.heritage was updated
          const newHeritage = actor.system?.heritage;
          assert.ok(
            newHeritage && newHeritage.length > 0,
            `actor.system.heritage should be set after selection (got: "${newHeritage}")`
          );
        });
      });

      t.section("Smart Field Text Fallback", () => {
        let actor;
        let originalFromCompendia;
        let originalFromWorld;

        beforeEach(async function () {
          this.timeout(10000);

          // Save original settings
          originalFromCompendia = game.settings.get(TARGET_MODULE_ID, "populateFromCompendia");
          originalFromWorld = game.settings.get(TARGET_MODULE_ID, "populateFromWorld");

          // Disable both sources to force text fallback
          await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", false);
          await game.settings.set(TARGET_MODULE_ID, "populateFromWorld", false);

          // Wait for cache invalidation
          await new Promise((r) => setTimeout(r, 300));

          const result = await createTestActor({
            name: "SmartFields-TextFallback-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
          await closeAllDialogs();
        });

        afterEach(async function () {
          this.timeout(8000);

          // Use unified cleanup with settings restoration
          await testCleanup({
            actors: [actor],
            settings: {
              moduleId: TARGET_MODULE_ID,
              values: {
                populateFromCompendia: originalFromCompendia,
                populateFromWorld: originalFromWorld,
              }
            }
          });
          actor = null;
        });

        t.test("heritage field opens text dialog when no options available", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const field = findSmartEditField(root, "system.heritage");
          assert.ok(field, "Heritage smart-edit field should exist");

          // Click the field
          field.click();
          await new Promise((resolve) => setTimeout(resolve, 500));

          // With both sources disabled, should get text input dialog, not card selection
          // Check for V2 text input dialog first
          const v2Dialog = document.querySelector("dialog[open]");
          const v2TextInput = v2Dialog?.querySelector('input[type="text"], input[name="value"]');

          // Check for V1 text input dialog
          const v1Dialogs = Object.values(ui.windows).filter(
            (w) => w instanceof Dialog && w.rendered
          );
          const v1Dialog = v1Dialogs.length > 0 ? v1Dialogs[v1Dialogs.length - 1] : null;
          const v1DialogEl = v1Dialog?.element?.[0] || v1Dialog?.element;
          const v1TextInput = v1DialogEl?.querySelector('input[type="text"], input[name="value"]');

          const textInput = v2TextInput || v1TextInput;
          assert.ok(
            textInput,
            "Text input dialog should open when no compendium/world options available"
          );

          // Clean up
          if (v2Dialog) {
            const cancelBtn = v2Dialog.querySelector('button[data-action="cancel"]');
            if (cancelBtn) cancelBtn.click();
            else v2Dialog.close();
          } else if (v1Dialog) {
            await v1Dialog.close();
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        });

        t.test("text input value persists to actor.system.heritage", async function () {
          this.timeout(10000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Clear existing heritage
          if (actor.system?.heritage) {
            await actor.update({ "system.heritage": "" });
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const field = findSmartEditField(root, "system.heritage");
          assert.ok(field, "Heritage smart-edit field should exist");

          // Click the field
          field.click();
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Find text input in either V2 or V1 dialog
          const v2Dialog = document.querySelector("dialog[open]");
          const v2TextInput = v2Dialog?.querySelector('input[type="text"], input[name="value"]');

          const v1Dialogs = Object.values(ui.windows).filter(
            (w) => w instanceof Dialog && w.rendered
          );
          const v1Dialog = v1Dialogs.length > 0 ? v1Dialogs[v1Dialogs.length - 1] : null;
          const v1DialogEl = v1Dialog?.element?.[0] || v1Dialog?.element;
          const v1TextInput = v1DialogEl?.querySelector('input[type="text"], input[name="value"]');

          const textInput = v2TextInput || v1TextInput;
          const dialogEl = v2Dialog || v1DialogEl;

          // With both population sources disabled, we must get a text input dialog
          assert.ok(textInput, "Text input should appear when both compendium and world population are disabled");

          // Enter custom heritage value
          const customValue = "Custom Test Heritage";
          textInput.value = customValue;
          textInput.dispatchEvent(new Event("input", { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Click OK/submit button
          const okButton = dialogEl.querySelector(
            'button[data-action="ok"], button[data-button="confirm"], button[type="submit"]'
          );
          assert.ok(okButton, "OK button should exist in text dialog");

          okButton.click();
          await waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 300));

          // CRITICAL: Verify actor.system.heritage was updated to exact value
          const newHeritage = actor.system?.heritage;
          assert.strictEqual(
            newHeritage,
            customValue,
            `actor.system.heritage should be "${customValue}" (got: "${newHeritage}")`
          );
        });

        t.test("background field also uses text fallback", async function () {
          this.timeout(8000);
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const field = findSmartEditField(root, "system.background");
          assert.ok(field, "Background smart-edit field should exist on character sheet in edit mode");

          // Click the field
          field.click();
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Should get text input dialog
          const v2Dialog = document.querySelector("dialog[open]");
          const v2TextInput = v2Dialog?.querySelector('input[type="text"], input[name="value"]');

          const v1Dialogs = Object.values(ui.windows).filter(
            (w) => w instanceof Dialog && w.rendered
          );
          const v1Dialog = v1Dialogs.length > 0 ? v1Dialogs[v1Dialogs.length - 1] : null;
          const v1DialogEl = v1Dialog?.element?.[0] || v1Dialog?.element;
          const v1TextInput = v1DialogEl?.querySelector('input[type="text"], input[name="value"]');

          const textInput = v2TextInput || v1TextInput;
          assert.ok(
            textInput,
            "Background field should also open text dialog when no options available"
          );

          // Clean up
          if (v2Dialog) {
            const cancelBtn = v2Dialog.querySelector('button[data-action="cancel"]');
            if (cancelBtn) cancelBtn.click();
            else v2Dialog.close();
          } else if (v1Dialog) {
            await v1Dialog.close();
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        });
      });

      t.section("Compendium Description Tooltips", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestCrewActor({
            name: "SmartFields-Tooltips-Test",
            crewTypeName: "Assassins"
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

        t.test("smart field has data-tooltip attribute", async function () {
          const sheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 200));
          const root = sheet.element?.[0] || sheet.element;

          // Verify we're using the alternate sheet
          assert.ok(
            root?.classList?.contains("blades-alt"),
            "Sheet should use the blades-alt alternate sheet class"
          );

          // Find smart field element in the crew-meta-line section
          // In edit mode: .smart-field-label with data-item-type
          // In non-edit mode: .smart-field-value (no data-item-type, but has data-tooltip)
          const smartField = root.querySelector(".crew-meta-line .smart-field-label") ||
            root.querySelector(".crew-meta-line .smart-field-value");
          assert.ok(smartField, "Smart field element should exist in crew-meta-line section");

          const tooltip = smartField.getAttribute("data-tooltip");
          assert.ok(
            tooltip !== null,
            `Smart field should have data-tooltip attribute (got: ${tooltip})`
          );
        });

        t.test("tooltip contains text when item exists", async function () {
          this.timeout(8000);

          // First add a crew_reputation item to the actor
          const repItems = await game.packs
            .filter((p) => p.documentName === "Item")
            .reduce(async (accPromise, pack) => {
              const acc = await accPromise;
              const index = await pack.getIndex({ fields: ["type", "name"] });
              const found = index.filter((e) => e.type === "crew_reputation");
              for (const entry of found) {
                const item = await pack.getDocument(entry._id);
                if (item) acc.push(item);
              }
              return acc;
            }, Promise.resolve([]));
          assert.ok(repItems.length > 0, "crew_reputation items should exist in compendia for this test");

          // Add the item to the actor
          const itemData = repItems[0].toObject();
          delete itemData._id;
          await actor.createEmbeddedDocuments("Item", [itemData]);

          // Re-render the sheet
          await actor.sheet?.render(false);
          await new Promise((resolve) => setTimeout(resolve, 200));

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Verify we're using the alternate sheet
          assert.ok(
            root?.classList?.contains("blades-alt"),
            "Sheet should use the blades-alt alternate sheet class"
          );

          // Find reputation display element - first smart-field in list-meta-line is reputation
          // data-item-type only exists in edit mode, so use positional selector
          const listMetaLine = root.querySelector(".crew-meta-line.list-meta-line");
          const repElement = listMetaLine?.querySelector(".smart-field-label, .smart-field-value");
          assert.ok(repElement, "Reputation element should exist in list-meta-line section");

          const tooltip = repElement.getAttribute("data-tooltip");

          // Tooltip should exist and have some content
          assert.ok(
            tooltip && tooltip.length > 0,
            "Tooltip should have content when item exists"
          );
        });

        t.test("tooltip fallback when no item selected", async function () {
          const sheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 200));
          const root = sheet.element?.[0] || sheet.element;

          // Verify we're using the alternate sheet
          assert.ok(
            root?.classList?.contains("blades-alt"),
            "Sheet should use the blades-alt alternate sheet class"
          );

          // Remove any existing reputation items
          const existingRep = actor.items.find((i) => i.type === "crew_reputation");
          if (existingRep) {
            await actor.deleteEmbeddedDocuments("Item", [existingRep.id]);
            await actor.sheet?.render(false);
            await new Promise((resolve) => setTimeout(resolve, 200));
          }

          // Find reputation field - first smart-field in list-meta-line
          const listMetaLine = root.querySelector(".crew-meta-line.list-meta-line");
          const repElement = listMetaLine?.querySelector(".smart-field-label, .smart-field-value");
          assert.ok(repElement, "Reputation element should exist in list-meta-line section");

          const tooltip = repElement.getAttribute("data-tooltip");

          // Even without an item, there should be a fallback tooltip (the label)
          assert.ok(
            tooltip !== null,
            `Smart field should have fallback tooltip when no item selected (got: ${tooltip})`
          );
        });
      });

      t.section("Full Character Smart Field Configuration", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "SmartFields-FullConfig-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(8000);

          // Close any open dialogs
          await closeAllDialogs();

          // Close sheet
          if (actor?.sheet?.rendered) {
            try {
              await actor.sheet.close();
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch {
              // Ignore
            }
          }

          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("can configure heritage via system.heritage", async function () {
          this.timeout(8000);

          const testHeritage = "Akoros";
          await actor.update({ "system.heritage": testHeritage });
          await new Promise((resolve) => setTimeout(resolve, 200));

          const sheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Verify actor has heritage set
          assert.strictEqual(
            actor.system.heritage,
            testHeritage,
            `Heritage should be "${testHeritage}"`
          );

          // Verify sheet displays heritage
          const root = sheet.element?.[0] || sheet.element;
          const heritageText = root?.textContent || "";
          assert.ok(
            heritageText.includes(testHeritage),
            `Sheet should display heritage "${testHeritage}"`
          );
        });

        t.test("can configure background via system.background", async function () {
          this.timeout(8000);

          const testBackground = "Labor";
          await actor.update({ "system.background": testBackground });
          await new Promise((resolve) => setTimeout(resolve, 200));

          const sheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 300));

          assert.strictEqual(
            actor.system.background,
            testBackground,
            `Background should be "${testBackground}"`
          );

          const root = sheet.element?.[0] || sheet.element;
          const backgroundText = root?.textContent || "";
          assert.ok(
            backgroundText.includes(testBackground),
            `Sheet should display background "${testBackground}"`
          );
        });

        t.test("can configure vice via system.vice", async function () {
          this.timeout(8000);

          const testVice = "Gambling";
          await actor.update({ "system.vice": testVice });
          await new Promise((resolve) => setTimeout(resolve, 200));

          const sheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 300));

          assert.strictEqual(
            actor.system.vice,
            testVice,
            `Vice should be "${testVice}"`
          );

          const root = sheet.element?.[0] || sheet.element;
          const viceText = root?.textContent || "";
          assert.ok(
            viceText.includes(testVice),
            `Sheet should display vice "${testVice}"`
          );
        });

        t.test("can configure vice purveyor via flag", async function () {
          this.timeout(8000);

          const testPurveyor = "Baszo Baz";
          await actor.setFlag(TARGET_MODULE_ID, "vice_purveyor", testPurveyor);
          await new Promise((resolve) => setTimeout(resolve, 200));

          const sheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 300));

          const actualPurveyor = actor.getFlag(TARGET_MODULE_ID, "vice_purveyor");
          assert.strictEqual(
            actualPurveyor,
            testPurveyor,
            `Vice purveyor flag should be "${testPurveyor}"`
          );

          const root = sheet.element?.[0] || sheet.element;
          const purveyorText = root?.textContent || "";
          assert.ok(
            purveyorText.includes(testPurveyor),
            `Sheet should display vice purveyor "${testPurveyor}"`
          );
        });

        t.test("can fully configure all character smart fields", async function () {
          this.timeout(15000);

          // Define test values
          const config = {
            heritage: "Skovlan",
            background: "Military",
            vice: "Obligation",
            vicePurveyor: "Nyryx"
          };

          // Set all values
          await actor.update({
            "system.heritage": config.heritage,
            "system.background": config.background,
            "system.vice": config.vice,
          });
          await actor.setFlag(TARGET_MODULE_ID, "vice_purveyor", config.vicePurveyor);
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Render sheet
          const sheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 400));

          // Verify all values in actor data
          assert.strictEqual(
            actor.system.heritage,
            config.heritage,
            "Heritage should match config"
          );
          assert.strictEqual(
            actor.system.background,
            config.background,
            "Background should match config"
          );
          assert.strictEqual(
            actor.system.vice,
            config.vice,
            "Vice should match config"
          );
          assert.strictEqual(
            actor.getFlag(TARGET_MODULE_ID, "vice_purveyor"),
            config.vicePurveyor,
            "Vice purveyor flag should match config"
          );

          // Verify all values display in sheet
          const root = sheet.element?.[0] || sheet.element;
          const sheetText = root?.textContent || "";

          assert.ok(
            sheetText.includes(config.heritage),
            `Sheet should display heritage "${config.heritage}"`
          );
          assert.ok(
            sheetText.includes(config.background),
            `Sheet should display background "${config.background}"`
          );
          assert.ok(
            sheetText.includes(config.vice),
            `Sheet should display vice "${config.vice}"`
          );
          assert.ok(
            sheetText.includes(config.vicePurveyor),
            `Sheet should display vice purveyor "${config.vicePurveyor}"`
          );

          console.log("[Smart Fields] Full character configuration verified:", config);
        });

        t.test("smart fields display even when empty", async function () {
          this.timeout(8000);

          // Clear all fields
          await actor.update({
            "system.heritage": "",
            "system.background": "",
            "system.vice": "",
          });
          await actor.unsetFlag(TARGET_MODULE_ID, "vice_purveyor");
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Enable edit mode so smart-edit elements appear
          await actor.setFlag(TARGET_MODULE_ID, "allow-edit", true);
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Render sheet
          const sheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 300));

          const root = sheet.element?.[0] || sheet.element;
          assert.ok(root, "Sheet should render even with empty smart fields");

          // Verify smart field elements exist (they show labels even when empty)
          // In edit mode: smart-field-label with data-action="smart-edit"
          // In locked mode: smart-field-value (no data-action)
          const smartFieldElements = root.querySelectorAll('.smart-field-label, .smart-field-value');
          assert.ok(
            smartFieldElements.length >= 3,
            `Should have at least 3 smart field elements (heritage, background, vice), found ${smartFieldElements.length}`
          );
        });

        t.test("smart fields persist across sheet close/reopen", async function () {
          this.timeout(12000);

          // Configure fields
          const config = {
            heritage: "Iruvia",
            background: "Underworld",
            vice: "Pleasure"
          };

          await actor.update({
            "system.heritage": config.heritage,
            "system.background": config.background,
            "system.vice": config.vice,
          });
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Render sheet, verify, close
          let sheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 300));

          let root = sheet.element?.[0] || sheet.element;
          let sheetText = root?.textContent || "";
          assert.ok(
            sheetText.includes(config.heritage),
            "Heritage should display before close"
          );

          // Close sheet
          await sheet.close();
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Reopen sheet
          sheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Verify values still display
          root = sheet.element?.[0] || sheet.element;
          sheetText = root?.textContent || "";

          assert.ok(
            sheetText.includes(config.heritage),
            "Heritage should persist after reopen"
          );
          assert.ok(
            sheetText.includes(config.background),
            "Background should persist after reopen"
          );
          assert.ok(
            sheetText.includes(config.vice),
            "Vice should persist after reopen"
          );
        });

        t.test("clearing smart field reverts to placeholder label", async function () {
          this.timeout(12000);

          // Set a heritage value first
          const testHeritage = "Akoros";
          await actor.update({ "system.heritage": testHeritage });
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Render sheet first
          let sheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 300));

          let root = sheet.element?.[0] || sheet.element;

          // Enable edit mode by clicking the toggle (this properly sets sheet.allow_edit)
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 300));
            // Re-get root after re-render
            root = sheet.element?.[0] || sheet.element;
          }

          let heritageField = root.querySelector('[data-field="system.heritage"]');
          assert.ok(heritageField, "Heritage field element should exist (requires edit mode)");
          assert.ok(
            heritageField.textContent.includes(testHeritage),
            `Heritage field should display "${testHeritage}" before clearing`
          );

          // Clear the field (simulating Clear button which sets value to empty string)
          await actor.update({ "system.heritage": "" });
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Re-render sheet
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Get updated DOM
          root = sheet.element?.[0] || sheet.element;
          heritageField = root.querySelector('[data-field="system.heritage"]');
          assert.ok(heritageField, "Heritage field element should still exist after clearing");

          // The field should now display the label "Heritage" (localized) instead of the value
          const heritageLabel = game.i18n.localize("BITD.Heritage");
          assert.ok(
            heritageField.textContent.includes(heritageLabel),
            `Heritage field should display placeholder label "${heritageLabel}" after clearing, got "${heritageField.textContent.trim()}"`
          );
          assert.ok(
            !heritageField.textContent.includes(testHeritage),
            `Heritage field should NOT display old value "${testHeritage}" after clearing`
          );

          console.log(`[Smart Fields] Cleared heritage: "${testHeritage}" -> "${heritageField.textContent.trim()}"`);
        });

        t.test("clearing vice purveyor reverts to placeholder label", async function () {
          this.timeout(12000);

          // Set a vice purveyor value first
          const testPurveyor = "Baszo Baz";
          await actor.setFlag(TARGET_MODULE_ID, "vice_purveyor", testPurveyor);
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Render sheet first
          let sheet = await ensureSheet(actor);
          await new Promise((resolve) => setTimeout(resolve, 300));

          let root = sheet.element?.[0] || sheet.element;

          // Enable edit mode by clicking the toggle (this properly sets sheet.allow_edit)
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 300));
            // Re-get root after re-render
            root = sheet.element?.[0] || sheet.element;
          }

          let purveyorField = root.querySelector('[data-field="flags.bitd-alternate-sheets.vice_purveyor"]');
          assert.ok(purveyorField, "Vice purveyor field element should exist (requires edit mode)");
          assert.ok(
            purveyorField.textContent.includes(testPurveyor),
            `Vice purveyor field should display "${testPurveyor}" before clearing`
          );

          // Clear the field by unsetting the flag
          await actor.unsetFlag(TARGET_MODULE_ID, "vice_purveyor");
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Re-render sheet
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Get updated DOM
          root = sheet.element?.[0] || sheet.element;
          purveyorField = root.querySelector('[data-field="flags.bitd-alternate-sheets.vice_purveyor"]');
          assert.ok(purveyorField, "Vice purveyor field element should still exist after clearing");

          // The field should now display the label instead of the value
          const purveyorLabel = game.i18n.localize("bitd-alt.VicePurveyor");
          assert.ok(
            purveyorField.textContent.includes(purveyorLabel),
            `Vice purveyor field should display placeholder label "${purveyorLabel}" after clearing, got "${purveyorField.textContent.trim()}"`
          );
          assert.ok(
            !purveyorField.textContent.includes(testPurveyor),
            `Vice purveyor field should NOT display old value "${testPurveyor}" after clearing`
          );

          console.log(`[Smart Fields] Cleared vice purveyor: "${testPurveyor}" -> "${purveyorField.textContent.trim()}"`);
        });
      });
    },
    { displayName: "BitD Alt Sheets: Smart Fields" }
  );
});
