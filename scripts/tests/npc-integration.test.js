/**
 * Quench test batch for NPC integration.
 * Tests vice purveyors via smart field dialogs.
 */

import {
  createTestActor,
  ensureSheet,
  isTargetModuleActive,
  testCleanup,
  cleanupTestActors,
  closeAllDialogs,
  TestNumberer,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * Create an NPC actor for testing.
 * @param {object} options
 * @param {string} options.name - NPC name
 * @param {string} options.associatedClass - Associated class (e.g., "Vice Purveyor")
 * @returns {Promise<Actor>}
 */
async function createTestNPC({ name, associatedClass } = {}) {
  const npcName = name || `Test NPC ${Date.now()}`;
  const actor = await Actor.create({
    name: npcName,
    type: "npc",
    system: {
      associated_class: associatedClass || "",
    },
  });
  return actor;
}

/**
 * Find the vice purveyor smart field element.
 * In edit mode: span.smart-field-label with data-action="smart-edit" and data-field containing vice_purveyor
 * In locked mode: span.smart-field-value (not clickable)
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findVicePurveyorSmartField(root) {
  if (!root) {
    console.log("[NPC Test] findVicePurveyorSmartField: root is null/undefined");
    return null;
  }

  // Edit mode: clickable smart field
  const editModeEl = root.querySelector(
    '[data-action="smart-edit"][data-field="flags.bitd-alternate-sheets.vice_purveyor"]'
  );
  if (editModeEl) return editModeEl;

  // Also try partial match
  const partialMatch = root.querySelector(
    '[data-action="smart-edit"][data-field*="vice_purveyor"]'
  );
  if (partialMatch) return partialMatch;

  // Debug: Log what smart-edit fields exist
  const allSmartEdits = root.querySelectorAll('[data-action="smart-edit"]');
  console.log(`[NPC Test] findVicePurveyorSmartField: Found ${allSmartEdits.length} smart-edit elements`);
  if (allSmartEdits.length > 0) {
    const fields = Array.from(allSmartEdits).map(el => el.dataset.field);
    console.log(`[NPC Test] Smart-edit fields: ${fields.join(", ")}`);
  }

  // Debug: Check if we're in edit mode by looking for edit indicators
  const editIndicator = root.querySelector('.toggle-allow-edit.allowed, .sheet-body.allow-edit');
  console.log(`[NPC Test] Edit mode indicator found: ${!!editIndicator}`);

  return null;
}

/**
 * Find the vice purveyor read-only display (locked mode).
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findVicePurveyorDisplay(root) {
  // In locked mode, look for smart-field-value elements in the heritage-background section
  const heritageBg = root.querySelector(".heritage-background");
  if (heritageBg) {
    const smartFields = heritageBg.querySelectorAll(".smart-field-value");
    // Vice purveyor is the last smart field in heritage-background (heritage, background, vice, vice_purveyor)
    if (smartFields.length > 0) return smartFields[smartFields.length - 1];
  }
  return null;
}

/**
 * Find the card selection dialog (V1 or V2).
 * Enhanced with debug logging per Codex recommendations.
 * @returns {HTMLElement|null}
 */
function findSelectionDialog() {
  // V2: native <dialog> element with our selection-dialog form
  const v2Dialog = document.querySelector("dialog[open] form.selection-dialog");
  if (v2Dialog) {
    console.log("[NPC Test] findSelectionDialog: Found V2 dialog");
    return v2Dialog.closest("dialog");
  }

  // V2 alternate: bitd-alt class on form
  const v2AltDialog = document.querySelector("dialog[open] form.bitd-alt");
  if (v2AltDialog) {
    console.log("[NPC Test] findSelectionDialog: Found V2 dialog (bitd-alt form)");
    return v2AltDialog.closest("dialog");
  }

  // V2 alternate: dialog with custom text input (for custom text entry)
  const v2CustomTextDialog = document.querySelector("dialog[open] input[name='customTextValue']");
  if (v2CustomTextDialog) {
    console.log("[NPC Test] findSelectionDialog: Found V2 dialog (customTextValue input)");
    return v2CustomTextDialog.closest("dialog");
  }

  // V1: Foundry Dialog application
  const v1Dialog = document.querySelector(".dialog .selection-dialog");
  if (v1Dialog) {
    console.log("[NPC Test] findSelectionDialog: Found V1 dialog");
    return v1Dialog.closest(".dialog");
  }

  // V1 alternate: look for dialog.app with selection content
  const v1AppDialog = document.querySelector(".dialog.app .selection-dialog, .dialog.app .bitd-alt");
  if (v1AppDialog) {
    console.log("[NPC Test] findSelectionDialog: Found V1 app dialog");
    return v1AppDialog.closest(".dialog.app");
  }

  // Alternative: look for any open dialog with selection content
  const anyDialog = document.querySelector("dialog[open], .dialog.app");
  if (anyDialog?.querySelector(".selection-dialog, .card-content, input[name='selectionId']")) {
    console.log("[NPC Test] findSelectionDialog: Found dialog via fallback selector");
    return anyDialog;
  }

  return null;
}

/**
 * Poll for the selection dialog to appear.
 * @param {number} timeoutMs - Maximum time to wait
 * @returns {Promise<HTMLElement|null>}
 */
async function waitForSelectionDialog(timeoutMs = 3000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const dialog = findSelectionDialog();
      if (dialog) {
        resolve(dialog);
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
 * Get dialog choice elements.
 * @param {HTMLElement} dialog
 * @returns {HTMLElement[]}
 */
function getDialogChoices(dialog) {
  // Choices are labels containing radio inputs
  const radios = dialog.querySelectorAll('input[type="radio"][name="selectionId"]');
  return Array.from(radios).map((r) => r.closest("label")).filter(Boolean);
}

/**
 * Click the OK/confirm button in a dialog.
 * @param {HTMLElement} dialog
 * @returns {HTMLElement|null}
 */
function findDialogOkButton(dialog) {
  // V2: button with data-action="ok"
  const v2Button = dialog.querySelector('button[data-action="ok"]');
  if (v2Button) return v2Button;

  // V1: button.dialog-button with confirm class or label
  const v1Button = dialog.querySelector(".dialog-button.confirm, button:has(.fa-check)");
  if (v1Button) return v1Button;

  // Fallback: first button that looks like confirm
  return dialog.querySelector("button.confirm, button[type='submit']");
}

/**
 * Find text input dialog (fallback when no chooser items available).
 * Enhanced with debug logging per Codex recommendations.
 * @returns {HTMLElement|null}
 */
function findTextInputDialog() {
  // V1 Dialog with text input
  const v1Dialog = document.querySelector(".dialog.app form input[type='text'][name='value']");
  if (v1Dialog) {
    console.log("[NPC Test] findTextInputDialog: Found V1 text input dialog");
    return v1Dialog.closest(".dialog.app");
  }

  // V2: native <dialog> with text input
  const v2Dialog = document.querySelector("dialog[open] form input[type='text'][name='value']");
  if (v2Dialog) {
    console.log("[NPC Test] findTextInputDialog: Found V2 text input dialog");
    return v2Dialog.closest("dialog");
  }

  // Debug: Log what dialogs exist if not found
  const openDialogs = document.querySelectorAll("dialog[open]");
  const v1Dialogs = document.querySelectorAll(".dialog.app");
  console.log(`[NPC Test] findTextInputDialog: Not found. Open dialogs: ${openDialogs.length}, V1 dialogs: ${v1Dialogs.length}`);

  return null;
}

/**
 * Check if this is a card selection dialog (has radio buttons).
 * @param {HTMLElement} dialog
 * @returns {boolean}
 */
function isCardSelectionDialog(dialog) {
  return dialog?.querySelector('input[type="radio"][name="selectionId"]') !== null;
}

/**
 * Check if this is a text input dialog (has text input, no radio buttons).
 * @param {HTMLElement} dialog
 * @returns {boolean}
 */
function isTextInputDialog(dialog) {
  const hasTextInput = dialog?.querySelector('input[type="text"][name="value"]') !== null;
  const hasRadios = dialog?.querySelector('input[type="radio"][name="selectionId"]') !== null;
  return hasTextInput && !hasRadios;
}

const t = new TestNumberer("9");

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping NPC integration tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.npc-integration",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("NPC Vice Purveyors", () => {
        let actor;
        let npcActors = [];
        let originalPopulateFromWorld;
        let originalPopulateFromCompendia;

        beforeEach(async function () {
          this.timeout(10000);

          // Save original settings
          originalPopulateFromWorld = game.settings.get(TARGET_MODULE_ID, "populateFromWorld");
          originalPopulateFromCompendia = game.settings.get(TARGET_MODULE_ID, "populateFromCompendia");

          // Enable world objects so test-created NPCs are found
          await game.settings.set(TARGET_MODULE_ID, "populateFromWorld", true);
          // Disable compendium objects so only test-created world NPCs appear
          // This is critical for test 9.1.4 which tests the "no NPCs" text fallback
          await game.settings.set(TARGET_MODULE_ID, "populateFromCompendia", false);

          // Wait for settings change to trigger cache invalidation (tested in 8.1.4)
          // Using 500ms per Codex recommendation for reliability on slower systems
          await new Promise((resolve) => setTimeout(resolve, 500));

          const result = await createTestActor({
            name: "NpcIntegration-Test",
            playbookName: "Cutter"
          });
          actor = result.actor;
          npcActors = [];
        });

        afterEach(async function () {
          this.timeout(8000);

          // Clean up NPCs first (they may have sheets open)
          await cleanupTestActors(npcActors);
          npcActors = [];

          // Use unified cleanup helper for main actor and settings
          await testCleanup({
            actors: [actor],
            settings: {
              moduleId: TARGET_MODULE_ID,
              values: {
                populateFromWorld: originalPopulateFromWorld,
                populateFromCompendia: originalPopulateFromCompendia,
              },
            },
          });
          actor = null;
        });

        t.test("vice purveyor smart field exists on character sheet", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode to see the smart field
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Look for vice purveyor smart field (in edit mode)
          const smartField = findVicePurveyorSmartField(root);
          // Or the read-only display (in locked mode)
          const readOnlyDisplay = findVicePurveyorDisplay(root);

          assert.ok(
            smartField || readOnlyDisplay,
            "Vice purveyor smart field or display should exist on character sheet"
          );

          if (smartField) {
            console.log(`[NPC Test] Found vice purveyor smart field: ${smartField.dataset.field}`);
          }
        });

        t.test("NPCs with associated_class='Vice Purveyor' appear in dialog", async function () {
          this.timeout(15000);

          // Create an NPC with associated_class = "Vice Purveyor" (the filter value used by the smart field)
          const npc = await createTestNPC({
            name: "Test Vice Purveyor NPC",
            associatedClass: "Vice Purveyor",
          });
          npcActors.push(npc);
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Open character sheet and enable edit mode
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Find and click the vice purveyor smart field to open dialog
          const smartField = findVicePurveyorSmartField(root);
          assert.ok(smartField, "Vice purveyor smart field should exist in edit mode");

          smartField.click();

          // From here on, a dialog might be open - use try/finally to ensure cleanup
          try {
            // Find the selection dialog
            const dialog = await waitForSelectionDialog(3000);
            assert.ok(dialog, "Selection dialog should open after clicking vice purveyor smart field");

            // Get the choices from the dialog
            const choices = getDialogChoices(dialog);
            console.log(`[NPC Test] Found ${choices.length} choices in dialog`);

            // Should have at least one choice (the NPC we created)
            assert.ok(
              choices.length > 0,
              `Vice purveyor dialog should have choices (found: ${choices.length})`
            );

            // Check if our test NPC is in the choices
            const choiceTexts = choices.map((c) => c.textContent?.trim() || "");
            const hasTestNpc = choiceTexts.some((t) => t.includes("Test Vice Purveyor NPC"));
            console.log(`[NPC Test] Dialog choices: ${choiceTexts.join(", ")}`);

            assert.ok(
              hasTestNpc,
              `Dialog should include our test NPC "Test Vice Purveyor NPC" (found: ${choiceTexts.join(", ")})`
            );
          } finally {
            // Always close any open dialogs
            await closeAllDialogs();
          }
        });

        t.test("selecting vice purveyor via dialog updates actor flag", async function () {
          this.timeout(15000);

          // Create an NPC with the correct associated_class
          const npc = await createTestNPC({
            name: "Selectable Vice Purveyor",
            associatedClass: "Vice Purveyor",
          });
          npcActors.push(npc);
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Open character sheet and enable edit mode
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // CRITICAL: Capture initial value from actor flag
          const initialPurveyor = actor.getFlag(TARGET_MODULE_ID, "vice_purveyor") || "";

          // Find and click the vice purveyor smart field
          const smartField = findVicePurveyorSmartField(root);
          assert.ok(smartField, "Vice purveyor smart field should exist in edit mode");

          smartField.click();

          // From here on, a dialog might be open - use try/finally to ensure cleanup
          try {
            // Find the selection dialog
            const dialog = await waitForSelectionDialog(3000);
            assert.ok(dialog, "Selection dialog should open after clicking vice purveyor smart field");

            // Get choices and select the first one (or the one matching our test NPC)
            const choices = getDialogChoices(dialog);
            assert.ok(choices.length > 0, "Selection dialog should have at least one choice (the test NPC)");

            // Find the radio input and select it
            const targetChoice = choices.find((c) => c.textContent?.includes("Selectable Vice Purveyor")) || choices[0];
            const radio = targetChoice.querySelector('input[type="radio"]');
            if (radio) {
              radio.checked = true;
              radio.dispatchEvent(new Event("change", { bubbles: true }));
            } else {
              targetChoice.click();
            }
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Click the OK button
            const okButton = findDialogOkButton(dialog);
            assert.ok(okButton, "OK button should exist in selection dialog");

            okButton.click();
            await new Promise((resolve) => setTimeout(resolve, 500));

            // CRITICAL: Verify actor flag was updated
            const updatedPurveyor = actor.getFlag(TARGET_MODULE_ID, "vice_purveyor");

            console.log(`[NPC Test] Vice purveyor flag updated: "${initialPurveyor}" → "${updatedPurveyor}"`);

            assert.ok(
              updatedPurveyor !== undefined && updatedPurveyor !== null,
              `Actor flag should be set after selection (got: ${updatedPurveyor})`
            );

            assert.ok(
              updatedPurveyor !== initialPurveyor,
              `Actor flag should change after selection (was "${initialPurveyor}", now "${updatedPurveyor}")`
            );
          } finally {
            // Always close any open dialogs
            await closeAllDialogs();
          }
        });

        t.test("vice purveyor display shows selected NPC name", async function () {
          this.timeout(15000);

          // Create an NPC and set it as the vice purveyor
          const npc = await createTestNPC({
            name: "Display Test Purveyor",
            associatedClass: "Vice Purveyor",
          });
          npcActors.push(npc);

          // Set the vice purveyor flag directly
          await actor.setFlag(TARGET_MODULE_ID, "vice_purveyor", npc.name);
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Open the sheet
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 500));

          const root = sheet.element?.[0] || sheet.element;

          // Debug: Log what elements we find
          const heritageBg = root?.querySelector?.(".heritage-background");
          const smartFieldValues = heritageBg?.querySelectorAll?.(".smart-field-value");
          console.log(`[NPC Test 9.1.3] heritage-background found: ${!!heritageBg}, smart-field-value count: ${smartFieldValues?.length || 0}`);

          // In locked mode, check the display shows the NPC name
          // In edit mode, the smart field label should show the value
          const smartField = findVicePurveyorSmartField(root);
          const display = findVicePurveyorDisplay(root);
          const targetElement = smartField || display;

          console.log(`[NPC Test 9.1.3] smartField: ${!!smartField}, display: ${!!display}`);
          assert.ok(targetElement, "Vice purveyor element (smart field or display) should exist on sheet");

          const displayText = targetElement.textContent?.trim() || targetElement.dataset?.value || "";

          assert.ok(
            displayText.includes("Display Test Purveyor") || displayText === "Display Test Purveyor",
            `Vice purveyor display should show selected NPC name (got: "${displayText}")`
          );

          console.log(`[NPC Test] Vice purveyor displays: "${displayText}"`);
        });

        t.test("no Vice Purveyor NPCs → custom text entry in dialog", async function () {
          this.timeout(15000);

          // Ensure NO NPCs with associated_class="Vice Purveyor" exist
          // (We don't create any NPCs in this test)

          // Open character sheet and enable edit mode
          const sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            // Wait for re-render after edit mode toggle
            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          // Force re-render and re-fetch root to ensure fresh state
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 300));
          root = sheet.element?.[0] || sheet.element;

          // CRITICAL: Capture initial value
          const initialPurveyor = actor.getFlag(TARGET_MODULE_ID, "vice_purveyor") || "";

          // Find and click the vice purveyor smart field
          const smartField = findVicePurveyorSmartField(root);
          assert.ok(smartField, "Vice purveyor smart field should exist in edit mode");

          smartField.click();

          // From here on, a dialog might be open - use try/finally to ensure cleanup
          try {
            // With the combined dialog, we always get a card selection dialog
            // that includes a text input field for custom values
            const dialog = await waitForSelectionDialog(5000);
            assert.ok(dialog, "Selection dialog should open");

            // Verify there are no NPC choices (cards) in the dialog
            const choices = getDialogChoices(dialog);
            assert.strictEqual(
              choices.length,
              0,
              "Dialog should have no NPC choices when no Vice Purveyor NPCs exist"
            );

            // The dialog should have a text input for custom values
            const textInput = dialog.querySelector('input[name="customTextValue"]');
            assert.ok(textInput, "Custom text input should exist in dialog");

            // Enter a custom value
            const customValue = "Custom Vice Purveyor Name";
            textInput.value = customValue;
            textInput.dispatchEvent(new Event("input", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Click OK/Save button
            const okButton = findDialogOkButton(dialog);
            assert.ok(okButton, "OK button should exist in dialog");

            okButton.click();
            await new Promise((resolve) => setTimeout(resolve, 500));

            // CRITICAL: Verify actor flag was updated with the custom text
            const updatedPurveyor = actor.getFlag(TARGET_MODULE_ID, "vice_purveyor");

            console.log(`[NPC Test] Custom text entry: "${initialPurveyor}" → "${updatedPurveyor}"`);

            assert.strictEqual(
              updatedPurveyor,
              customValue,
              `Actor flag should be set to custom text "${customValue}" (got: "${updatedPurveyor}")`
            );
          } finally {
            // Always close any open dialogs
            await closeAllDialogs();
          }
        });
      });
    },
    { displayName: "BitD Alt Sheets: NPC Integration" }
  );
});
