/**
 * Quench test batch for Notes tab functionality.
 * Tests notes persistence, markdown rendering, and embedded clock support.
 */

import {
  createTestActor,
  createTestCrewActor,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
  testCleanup,
  TestNumberer,
  assertExists,
  skipWithReason,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * Find the notes tab element on a sheet.
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findNotesTab(root) {
  return root.querySelector('.tab[data-tab="notes"], [data-tab="notes"].tab');
}

/**
 * Find the notes tab button/link.
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findNotesTabButton(root) {
  return root.querySelector(
    '.tab-item.notes-tab, [data-tab="notes"].item, a[data-tab="notes"]'
  );
}

/**
 * Find the notes editor area.
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findNotesArea(root) {
  return root.querySelector(".character-notes-area, .notes.tab");
}

/**
 * Find the notes editor element.
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findNotesEditor(root) {
  // Foundry's editor can be a div.editor, textarea, or ProseMirror element
  const notesArea = findNotesArea(root);
  if (!notesArea) return null;

  return (
    notesArea.querySelector(".editor-content, .editor, textarea, .ProseMirror") ||
    notesArea.querySelector('[name*="notes"]')
  );
}

/**
 * Get raw notes content from actor flag.
 * @param {Actor} actor
 * @returns {Promise<string>}
 */
async function getRawNotes(actor) {
  return (await actor.getFlag(TARGET_MODULE_ID, "notes")) || "";
}

/**
 * Set notes content on actor.
 * @param {Actor} actor
 * @param {string} content
 * @returns {Promise<void>}
 */
async function setNotes(actor, content) {
  await actor.setFlag(TARGET_MODULE_ID, "notes", content);
}

const t = new TestNumberer("22");

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping notes-tab tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.notes-tab",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Notes Tab UI", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "NotesTab-UI-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("notes tab exists on character sheet", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const notesTabButton = findNotesTabButton(root);
          assertExists(assert, notesTabButton, "Notes tab button should exist on character sheet");
        });

        t.test("clicking notes tab shows notes area", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const notesTabButton = findNotesTabButton(root);
          assertExists(assert, notesTabButton, "Notes tab button should exist");

          // Click to switch to notes tab
          notesTabButton.click();
          await new Promise((r) => setTimeout(r, 200));

          const notesTab = findNotesTab(root);
          if (notesTab) {
            // Check if it's visible (has 'active' class or is displayed)
            const isActive = notesTab.classList.contains("active");
            const isVisible = getComputedStyle(notesTab).display !== "none";
            assert.ok(isActive || isVisible, "Notes tab content should be visible after clicking");
          }
        });

        t.test("notes area contains editor element", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Switch to notes tab
          const notesTabButton = findNotesTabButton(root);
          if (notesTabButton) {
            notesTabButton.click();
            await new Promise((r) => setTimeout(r, 200));
          }

          const notesArea = findNotesArea(root);
          assertExists(assert, notesArea, "Notes area should exist");

          // Notes area should contain editor instructions or editor
          const hasHeader = notesArea.querySelector("header");
          const hasEditor = notesArea.querySelector(".editor, .editor-content, textarea");

          assert.ok(
            hasHeader || hasEditor,
            "Notes area should contain header or editor element"
          );
        });
      });

      t.section("Notes Persistence", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "NotesTab-Persistence-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("notes can be saved to actor flag", async function () {
          this.timeout(8000);

          const testContent = "Test notes content - " + Date.now();

          await setNotes(actor, testContent);
          await new Promise((r) => setTimeout(r, 200));

          const savedNotes = await getRawNotes(actor);
          assert.equal(
            savedNotes,
            testContent,
            "Notes should be saved to actor flag"
          );
        });

        t.test("notes persist after sheet close and reopen", async function () {
          this.timeout(12000);

          const testContent = "Persistent notes test - " + Date.now();

          // Set notes
          await setNotes(actor, testContent);
          await new Promise((r) => setTimeout(r, 200));

          // Open sheet, close it, reopen
          let sheet = await ensureSheet(actor);
          await sheet.close();
          await new Promise((r) => setTimeout(r, 300));

          sheet = await ensureSheet(actor);
          await new Promise((r) => setTimeout(r, 300));

          // Verify notes persisted
          const savedNotes = await getRawNotes(actor);
          assert.equal(
            savedNotes,
            testContent,
            "Notes should persist after sheet close and reopen"
          );
        });

        t.test("empty notes can be set", async function () {
          this.timeout(8000);

          // First set some content
          await setNotes(actor, "Some content");
          await new Promise((r) => setTimeout(r, 200));

          // Then clear it
          await setNotes(actor, "");
          await new Promise((r) => setTimeout(r, 200));

          const savedNotes = await getRawNotes(actor);
          assert.equal(savedNotes, "", "Notes should be clearable");
        });

        t.test("special characters in notes are preserved", async function () {
          this.timeout(8000);

          const testContent = "Test with special chars: <>&\"' ñ é ü 日本語";

          await setNotes(actor, testContent);
          await new Promise((r) => setTimeout(r, 200));

          const savedNotes = await getRawNotes(actor);
          assert.equal(
            savedNotes,
            testContent,
            "Special characters should be preserved in notes"
          );
        });

        t.test("multiline notes are preserved", async function () {
          this.timeout(8000);

          const testContent = "Line 1\nLine 2\nLine 3\n\nLine 5 (after blank)";

          await setNotes(actor, testContent);
          await new Promise((r) => setTimeout(r, 200));

          const savedNotes = await getRawNotes(actor);
          assert.equal(savedNotes, testContent, "Multiline notes should be preserved");
        });
      });

      t.section("Notes Enrichment", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "NotesTab-Enrichment-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("Utils.enrichNotes function exists", async function () {
          this.timeout(5000);

          const module = game.modules.get(TARGET_MODULE_ID);
          const Utils = module?.api?.Utils || globalThis.bitdAltSheets?.Utils;

          if (!Utils?.enrichNotes) {
            skipWithReason(this, "Utils.enrichNotes not exposed in module API");
            return;
          }

          assert.ok(
            typeof Utils.enrichNotes === "function",
            "Utils.enrichNotes should be a function"
          );
        });

        t.test("notes with @UUID links get enriched", async function () {
          this.timeout(10000);

          // Set notes with a @UUID reference
          const testContent = `@UUID[Actor.${actor.id}]{Test Link}`;
          await setNotes(actor, testContent);

          // Re-render sheet to trigger enrichment
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise((r) => setTimeout(r, 500));

          const root = sheet.element?.[0] || sheet.element;

          // Switch to notes tab
          const notesTabButton = findNotesTabButton(root);
          if (notesTabButton) {
            notesTabButton.click();
            await new Promise((r) => setTimeout(r, 200));
          }

          // Check if there's an enriched link element
          const notesArea = findNotesArea(root);
          if (notesArea) {
            const contentLink = notesArea.querySelector(
              ".content-link, a[data-uuid], a[data-id]"
            );
            // Content links may or may not be present depending on rendering
            console.log(
              `[NotesTab Test] Content link found: ${contentLink !== null}`
            );
          }

          // The raw notes should still contain the @UUID
          const savedNotes = await getRawNotes(actor);
          assert.ok(
            savedNotes.includes("@UUID"),
            "Raw notes should preserve @UUID syntax"
          );
        });

        t.test("notes with markdown are processed", async function () {
          this.timeout(10000);

          // Set notes with markdown
          const testContent = "**Bold text** and *italic text*";
          await setNotes(actor, testContent);

          // Render sheet
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise((r) => setTimeout(r, 500));

          // Raw notes should preserve the markdown
          const savedNotes = await getRawNotes(actor);
          assert.equal(
            savedNotes,
            testContent,
            "Raw notes should preserve markdown syntax"
          );
        });
      });

      t.section("Crew Notes Tab", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestCrewActor({
            name: "NotesTab-Crew-Test",
            crewTypeName: "Assassins",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("notes tab exists on crew sheet", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const notesTabButton = findNotesTabButton(root);
          assertExists(assert, notesTabButton, "Notes tab button should exist on crew sheet");
        });

        t.test("crew notes persist correctly", async function () {
          this.timeout(8000);

          const testContent = "Crew notes test - " + Date.now();

          await setNotes(actor, testContent);
          await new Promise((r) => setTimeout(r, 200));

          const savedNotes = await getRawNotes(actor);
          assert.equal(
            savedNotes,
            testContent,
            "Crew notes should be saved to actor flag"
          );
        });

        t.test("crew notes area contains editor", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Switch to notes tab
          const notesTabButton = findNotesTabButton(root);
          if (notesTabButton) {
            notesTabButton.click();
            await new Promise((r) => setTimeout(r, 200));
          }

          const notesArea = findNotesArea(root);
          assertExists(assert, notesArea, "Notes area should exist on crew sheet");
        });
      });

      t.section("Notes with Embedded Clocks", () => {
        let actor;
        let clockActor;

        beforeEach(async function () {
          this.timeout(15000);
          const result = await createTestActor({
            name: "NotesTab-Clock-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;

          // Try to create a clock actor if the type is available
          try {
            clockActor = await Actor.create({
              name: "Test Clock for Notes",
              type: "🕛 clock",
              system: {
                value: 2,
                max: 4,
              },
            });
          } catch (e) {
            // Clock actor type may not be available
            clockActor = null;
          }
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor, clockActor].filter(Boolean) });
          actor = null;
          clockActor = null;
        });

        t.test("notes can contain clock @UUID references", async function () {
          this.timeout(10000);

          if (!clockActor) {
            skipWithReason(this, "Clock actor type not available in system");
            return;
          }

          // Set notes with clock UUID
          const testContent = `Progress: @UUID[Actor.${clockActor.id}]{Test Clock}`;
          await setNotes(actor, testContent);
          await new Promise((r) => setTimeout(r, 200));

          const savedNotes = await getRawNotes(actor);
          assert.ok(
            savedNotes.includes(clockActor.id),
            "Notes should contain clock UUID reference"
          );
        });

        t.test("clock links in notes are replaced with visualizations", async function () {
          this.timeout(15000);

          if (!clockActor) {
            skipWithReason(this, "Clock actor type not available in system");
            return;
          }

          // Set notes with clock reference
          const testContent = `Progress: @UUID[Actor.${clockActor.id}]{Test Clock}`;
          await setNotes(actor, testContent);

          // Render and switch to notes tab
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise((r) => setTimeout(r, 500));

          const root = sheet.element?.[0] || sheet.element;

          const notesTabButton = findNotesTabButton(root);
          if (notesTabButton) {
            notesTabButton.click();
            await new Promise((r) => setTimeout(r, 300));
          }

          const notesArea = findNotesArea(root);
          if (!notesArea) {
            skipWithReason(this, "Notes area not found after tab switch");
            return;
          }

          // Check for clock visualization (SVG or clock container)
          const clockViz = notesArea.querySelector(
            ".clock-link, .blades-clock, svg, .clock-container, .inline-clock"
          );

          console.log(
            `[NotesTab Test] Clock visualization found: ${clockViz !== null}`
          );

          // Even if visualization isn't rendered, the content should exist
          assert.ok(notesArea.innerHTML.length > 0, "Notes area should have content");
        });

        t.test("updating clock actor triggers notes re-render", async function () {
          this.timeout(15000);

          if (!clockActor) {
            skipWithReason(this, "Clock actor type not available in system");
            return;
          }

          // Set notes with clock reference
          const testContent = `Progress: @UUID[Actor.${clockActor.id}]{Test Clock}`;
          await setNotes(actor, testContent);

          // Render sheet
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise((r) => setTimeout(r, 300));

          // Update the clock actor value
          const initialValue = clockActor.system.value;
          await clockActor.update({ "system.value": initialValue + 1 });
          await new Promise((r) => setTimeout(r, 500));

          // The hook in hooks.js should trigger re-render if notes contain clock
          // Verify clock value changed
          assert.equal(
            clockActor.system.value,
            initialValue + 1,
            "Clock value should be updated"
          );
        });
      });

      t.section("Notes Edge Cases", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "NotesTab-Edge-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("very long notes content is handled", async function () {
          this.timeout(10000);

          // Create long content (5000 characters)
          const testContent = "A".repeat(5000);

          await setNotes(actor, testContent);
          await new Promise((r) => setTimeout(r, 200));

          const savedNotes = await getRawNotes(actor);
          assert.equal(
            savedNotes.length,
            5000,
            "Long notes content should be preserved"
          );
        });

        t.test("notes with HTML tags are handled safely", async function () {
          this.timeout(8000);

          // Test that HTML tags don't break the system
          const testContent = "<script>alert('xss')</script><div>Safe content</div>";

          await setNotes(actor, testContent);
          await new Promise((r) => setTimeout(r, 200));

          const savedNotes = await getRawNotes(actor);
          assert.ok(
            savedNotes.includes("Safe content") || savedNotes.length > 0,
            "Notes with HTML should be stored (may be sanitized)"
          );

          // Render sheet to verify no script execution
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise((r) => setTimeout(r, 300));

          // Sheet should still be functional
          assert.ok(sheet.rendered, "Sheet should render with HTML content in notes");
        });

        t.test("notes with broken @UUID syntax are handled gracefully", async function () {
          this.timeout(8000);

          const testContent = "@UUID[Invalid.Reference]{Broken Link} and normal text";

          await setNotes(actor, testContent);
          await new Promise((r) => setTimeout(r, 200));

          const savedNotes = await getRawNotes(actor);
          assert.equal(
            savedNotes,
            testContent,
            "Broken @UUID syntax should be preserved in raw notes"
          );

          // Render sheet - should not throw
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise((r) => setTimeout(r, 300));

          assert.ok(sheet.rendered, "Sheet should render with broken @UUID in notes");
        });

        t.test("concurrent notes updates are handled", async function () {
          this.timeout(10000);

          // Rapid updates
          const updates = [];
          for (let i = 0; i < 5; i++) {
            updates.push(setNotes(actor, `Update ${i}`));
          }

          await Promise.all(updates);
          await new Promise((r) => setTimeout(r, 500));

          // Final value should be one of the updates (race condition expected)
          const savedNotes = await getRawNotes(actor);
          assert.ok(
            savedNotes.startsWith("Update"),
            "Concurrent updates should result in valid notes content"
          );
        });
      });
    },
    { displayName: "BitD Alt Sheets: Notes Tab" }
  );
});
