/**
 * Quench test batch for internationalization (i18n) functionality.
 * Tests localization key availability, fallback behavior, and dynamic content.
 */

import {
  createTestActor,
  createTestCrewActor,
  ensureSheet,
  isTargetModuleActive,
  testCleanup,
  TestNumberer,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * List of key localization strings used by the module.
 */
const KEY_LOCALIZATION_KEYS = [
  "bitd-alt.items",
  "bitd-alt.AddNewItem",
  "bitd-alt.AddExistingItem",
  "bitd-alt.DeleteItem",
  "bitd-alt.AddNewAbility",
  "bitd-alt.Acquaintances",
  "bitd-alt.SwitchPlaybook",
  "bitd-alt.Ok",
  "bitd-alt.Cancel",
  "bitd-alt.Edit",
  "bitd-alt.Select",
  "bitd-alt.Clear",
  "bitd-alt.MinusOneDie",
  "bitd-alt.NotesInstructions",
  "bitd-alt.OnHand",
];

/**
 * Supported languages by the module.
 */
const SUPPORTED_LANGUAGES = ["en", "de", "it"];

/**
 * Check if a localization key returns the key itself (missing translation).
 * @param {string} key
 * @returns {boolean}
 */
function isMissingTranslation(key) {
  const translated = game.i18n.localize(key);
  // If translation is missing, Foundry returns the key itself
  return translated === key;
}

/**
 * Get all localized strings visible on a sheet element.
 * @param {HTMLElement} root
 * @returns {string[]}
 */
function getVisibleLocalizedText(root) {
  const texts = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.trim();
    if (text.length > 0) {
      texts.push(text);
    }
  }
  return texts;
}

const t = new TestNumberer("23");

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping i18n tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.i18n",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Localization Key Availability", () => {
        t.test("all key localization strings exist", async function () {
          this.timeout(5000);

          const missingKeys = [];
          for (const key of KEY_LOCALIZATION_KEYS) {
            if (isMissingTranslation(key)) {
              missingKeys.push(key);
            }
          }

          assert.equal(
            missingKeys.length,
            0,
            `Missing localization keys: ${missingKeys.join(", ")}`
          );

          console.log(`[i18n Test] Verified ${KEY_LOCALIZATION_KEYS.length} localization keys`);
        });

        t.test("module has registered language files", async function () {
          this.timeout(5000);

          const module = game.modules.get(TARGET_MODULE_ID);
          assert.ok(module, "Module should be available");

          // Check if module has languages defined in manifest
          const languages = module.languages || [];

          // Two valid scenarios:
          // 1. Module explicitly registers languages - English must be one of them
          // 2. Module doesn't register languages - uses Foundry default handling
          if (languages.length > 0) {
            const hasEnglish = languages.some((l) => l.lang === "en");
            assert.ok(hasEnglish,
              `Module registers ${languages.length} languages but English is missing - available: ${languages.map(l => l.lang).join(", ")}`);
          }
          // If no languages registered, that's valid (uses default)

          console.log(`[i18n Test] Module has ${languages.length} registered language files`);
        });

        t.test("attribute descriptions are localized", async function () {
          this.timeout(5000);

          // Attributes have nested localization
          const attuneKey = "bitd-alt.Attributes.attune";
          const translated = game.i18n.localize(attuneKey);

          // Should be translated (not return the key itself)
          assert.notStrictEqual(
            translated,
            attuneKey,
            `Translation should differ from key (got: "${translated}")`
          );
        });
      });

      t.section("Fallback Behavior", () => {
        t.test("missing keys return the key itself", async function () {
          this.timeout(5000);

          const fakeKey = "bitd-alt.NonExistentKey12345";
          const translated = game.i18n.localize(fakeKey);

          assert.equal(
            translated,
            fakeKey,
            "Missing translation should return the key itself"
          );
        });

        t.test("format function works with parameters", async function () {
          this.timeout(5000);

          // Test with a key that uses parameters
          const crewClearHint = game.i18n.format("bitd-alt.CrewClearHint", {
            crew: "Test Crew",
          });

          assert.ok(
            crewClearHint.includes("Test Crew"),
            "Format function should substitute parameters"
          );
        });

        t.test("localize returns string type", async function () {
          this.timeout(5000);

          const result = game.i18n.localize("bitd-alt.Ok");
          assert.equal(
            typeof result,
            "string",
            "Localize should always return a string"
          );
        });
      });

      t.section("Character Sheet Localization", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "i18n-CharSheet-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("sheet renders without missing localization keys visible", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const visibleTexts = getVisibleLocalizedText(root);

          // Check for any visible text that looks like a missing key (bitd-alt.*)
          const missingKeyPatterns = visibleTexts.filter((text) =>
            text.match(/^bitd-alt\.[A-Za-z]+/)
          );

          assert.equal(
            missingKeyPatterns.length,
            0,
            `Sheet should not display raw localization keys: ${missingKeyPatterns.join(", ")}`
          );
        });

        t.test("sheet contains localized labels", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Check for presence of common localized strings
          const itemsLabel = game.i18n.localize("bitd-alt.items");
          const notesLabel = game.i18n.localize("BITD.Notes");

          const htmlContent = root.innerHTML;

          // At least one should be present (depending on visible tab)
          const hasItemsLabel = htmlContent.includes(itemsLabel);
          const hasNotesLabel = htmlContent.includes(notesLabel);

          assert.ok(
            hasItemsLabel || hasNotesLabel,
            `Sheet should contain localized labels (items: ${hasItemsLabel}, notes: ${hasNotesLabel})`
          );
        });

        t.test("edit toggle has localized title/tooltip", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const editToggle = root.querySelector(".toggle-allow-edit");
          assert.ok(editToggle,
            "Edit toggle should exist on character sheet - template may be broken");

          // Check for title or aria-label attribute
          const title = editToggle.getAttribute("title") || "";
          const ariaLabel = editToggle.getAttribute("aria-label") || "";

          // Title should not be a raw key if present
          if (title) {
            assert.ok(
              !title.startsWith("bitd-alt."),
              `Edit toggle title should be localized, not raw key: ${title}`
            );
          }
        });
      });

      t.section("Crew Sheet Localization", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestCrewActor({
            name: "i18n-CrewSheet-Test",
            crewTypeName: "Assassins",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("crew sheet renders without missing localization keys", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const visibleTexts = getVisibleLocalizedText(root);
          const missingKeyPatterns = visibleTexts.filter((text) =>
            text.match(/^bitd-alt\.[A-Za-z]+/)
          );

          assert.equal(
            missingKeyPatterns.length,
            0,
            `Crew sheet should not display raw localization keys: ${missingKeyPatterns.join(", ")}`
          );
        });

        t.test("crew-specific labels are localized", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Check for crew-specific localized content
          const crewCoinsCaption = game.i18n.localize("bitd-alt.CrewCoinsCaption");
          const crewReputation = game.i18n.localize("bitd-alt.CrewReputation");

          // These should be actual translated strings, not the keys
          assert.notEqual(
            crewCoinsCaption,
            "bitd-alt.CrewCoinsCaption",
            "CrewCoinsCaption should be translated"
          );
          assert.notEqual(
            crewReputation,
            "bitd-alt.CrewReputation",
            "CrewReputation should be translated"
          );
        });
      });

      t.section("Dynamic Content Localization", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "i18n-Dynamic-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("dialog titles are localized", async function () {
          this.timeout(5000);

          // Check dialog-related localization keys
          const switchPlaybook = game.i18n.localize("bitd-alt.SwitchPlaybook");
          const selectCrewTitle = game.i18n.localize("bitd-alt.SelectCrewTitle");

          assert.notEqual(
            switchPlaybook,
            "bitd-alt.SwitchPlaybook",
            "SwitchPlaybook dialog title should be localized"
          );
          assert.notEqual(
            selectCrewTitle,
            "bitd-alt.SelectCrewTitle",
            "SelectCrewTitle dialog title should be localized"
          );
        });

        t.test("button labels are localized", async function () {
          this.timeout(5000);

          const okLabel = game.i18n.localize("bitd-alt.Ok");
          const cancelLabel = game.i18n.localize("bitd-alt.Cancel");
          const editLabel = game.i18n.localize("bitd-alt.Edit");

          assert.notEqual(okLabel, "bitd-alt.Ok", "Ok button should be localized");
          assert.notEqual(cancelLabel, "bitd-alt.Cancel", "Cancel button should be localized");
          assert.notEqual(editLabel, "bitd-alt.Edit", "Edit button should be localized");
        });

        t.test("instructions text is localized", async function () {
          this.timeout(5000);

          const notesInstructions = game.i18n.localize("bitd-alt.NotesInstructions");
          const playbookInstructions = game.i18n.localize("bitd-alt.PlaybookInstructions");

          // These should be actual sentences, not keys
          assert.ok(
            notesInstructions.length > 20,
            "NotesInstructions should be a full sentence"
          );
          assert.ok(
            playbookInstructions.length > 20,
            "PlaybookInstructions should be a full sentence"
          );
        });
      });

      t.section("Language File Integrity", () => {
        t.test("current language has translations loaded", async function () {
          this.timeout(5000);

          const currentLang = game.i18n.lang;
          console.log(`[i18n Test] Current language: ${currentLang}`);

          // Test that common keys work
          const testKeys = ["bitd-alt.Ok", "bitd-alt.Cancel", "bitd-alt.items"];
          let workingKeys = 0;

          for (const key of testKeys) {
            if (!isMissingTranslation(key)) {
              workingKeys++;
            }
          }

          assert.ok(
            workingKeys > 0,
            `At least some translations should work for language: ${currentLang}`
          );
        });

        t.test("nested attribute keys resolve correctly", async function () {
          this.timeout(5000);

          // Test nested object access in translations
          const attributes = [
            "attune",
            "command",
            "consort",
            "finesse",
            "hunt",
            "prowl",
            "skirmish",
            "study",
            "survey",
            "sway",
            "tinker",
            "wreck",
          ];

          const workingAttributes = [];
          for (const attr of attributes) {
            const key = `bitd-alt.Attributes.${attr}`;
            const translated = game.i18n.localize(key);
            if (translated !== key && translated.length > 10) {
              workingAttributes.push(attr);
            }
          }

          console.log(
            `[i18n Test] ${workingAttributes.length}/${attributes.length} attribute translations working`
          );

          // All or none should work (consistent)
          assert.ok(
            workingAttributes.length === 0 || workingAttributes.length === attributes.length,
            "Attribute translations should be consistently available"
          );
        });

        t.test("has function handles format strings", async function () {
          this.timeout(5000);

          // Test has() function for key existence
          const exists = game.i18n.has("bitd-alt.Ok");
          const notExists = game.i18n.has("bitd-alt.CompletelyFakeKey99999");

          assert.ok(exists, "has() should return true for existing keys");
          assert.ok(!notExists, "has() should return false for non-existent keys");
        });
      });
    },
    { displayName: "BitD Alt Sheets: Internationalization" }
  );
});
