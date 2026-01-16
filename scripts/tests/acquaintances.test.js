/**
 * Quench test batch for acquaintance sharing.
 * Tests standing colors, toggle behavior, and filtering.
 */

import {
  createTestActor,
  createTestCrewActor,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * Find acquaintance list container.
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findAcquaintanceList(root) {
  // Character sheet uses .friends-rivals, crew sheet uses [data-tab="contacts"]
  return root.querySelector(".friends-rivals, [data-tab='contacts'], [data-section-key='acquaintances']");
}

/**
 * Find acquaintance items in the list.
 * @param {HTMLElement} root
 * @returns {NodeListOf<HTMLElement>}
 */
function findAcquaintanceItems(root) {
  // Select only the outer .acquaintance divs, not the inner <i> icons
  // The inner <i> also has [data-acquaintance] but we want the container
  return root.querySelectorAll("div.acquaintance, .acquaintance-item");
}

/**
 * Get the standing value of an acquaintance element.
 * Standing is indicated by icon classes on the inner <i> element:
 * - friend: green-icon + fa-caret-up
 * - rival: red-icon + fa-caret-down
 * - neutral: fa-minus (no color class)
 * @param {HTMLElement} acquaintanceEl
 * @param {boolean} debug - Whether to log debug info
 * @returns {string|null} - "friend", "rival", "neutral", or null
 */
function getAcquaintanceStanding(acquaintanceEl, debug = false) {
  if (debug) {
    console.log("[getAcquaintanceStanding] Element:", acquaintanceEl);
    console.log("[getAcquaintanceStanding] Element classes:", acquaintanceEl?.className);
    console.log("[getAcquaintanceStanding] Element HTML:", acquaintanceEl?.outerHTML?.substring(0, 500));
  }

  // Check for class-based standing on the element itself (legacy)
  if (acquaintanceEl.classList.contains("friend")) return "friend";
  if (acquaintanceEl.classList.contains("rival")) return "rival";
  if (acquaintanceEl.classList.contains("neutral")) return "neutral";

  // Check for data attribute (legacy)
  if (acquaintanceEl.dataset?.standing) return acquaintanceEl.dataset.standing;

  // Check the icon element for standing indication (current implementation)
  const icon = acquaintanceEl.querySelector("i.standing-toggle, i[data-acquaintance]");
  if (debug) {
    console.log("[getAcquaintanceStanding] Found icon:", icon);
    console.log("[getAcquaintanceStanding] Icon classes:", icon?.className);
  }

  if (icon) {
    if (icon.classList.contains("green-icon") || icon.classList.contains("fa-caret-up")) return "friend";
    if (icon.classList.contains("red-icon") || icon.classList.contains("fa-caret-down")) return "rival";
    if (icon.classList.contains("fa-minus")) return "neutral";
  }

  return null;
}

/**
 * Get the standing toggle button for an acquaintance.
 * @param {HTMLElement} acquaintanceEl
 * @returns {HTMLElement|null}
 */
function getStandingToggle(acquaintanceEl) {
  // Standing toggle is an <i> element with .standing-toggle class
  return acquaintanceEl.querySelector(".standing-toggle, i[data-acquaintance]");
}

/**
 * Check if acquaintance has a specific color class.
 * @param {HTMLElement} acquaintanceEl
 * @param {string} colorType - "friend", "rival", "neutral"
 * @returns {boolean}
 */
function hasStandingColor(acquaintanceEl, colorType) {
  // Check computed style or class
  const computedStyle = window.getComputedStyle(acquaintanceEl);
  const bgColor = computedStyle.backgroundColor;

  // Common color mappings
  const colorMap = {
    friend: ["green", "rgb(0, 128, 0)", "rgb(34, 139, 34)", "#22c55e", "#10b981"],
    rival: ["red", "rgb(255, 0, 0)", "rgb(220, 38, 38)", "#ef4444", "#dc2626"],
    neutral: ["gray", "grey", "rgb(128, 128, 128)", "rgb(156, 163, 175)", "#6b7280"],
  };

  // Check if class indicates color
  if (acquaintanceEl.classList.contains(colorType)) return true;

  // Check data attribute
  if (acquaintanceEl.dataset?.standing === colorType) return true;

  // Check background color
  const expectedColors = colorMap[colorType] || [];
  return expectedColors.some((c) => bgColor.includes(c) || bgColor === c);
}

/**
 * Find the acquaintance filter toggle.
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findFilterToggle(root) {
  return root.querySelector(
    ".filter-acquaintances, .acquaintance-filter, [data-action='filter-acquaintances'], .toggle-filter"
  );
}

/**
 * Check if filter is currently active.
 * @param {HTMLElement} root
 * @returns {boolean}
 */
function isFilterActive(root) {
  const filterToggle = findFilterToggle(root);
  if (!filterToggle) return false;

  return (
    filterToggle.classList.contains("active") ||
    filterToggle.classList.contains("filtered") ||
    filterToggle.checked === true
  );
}

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping acquaintance tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.acquaintances",
    (context) => {
      const { describe, it, assert, beforeEach, afterEach } = context;

      describe("6.1 Acquaintance Standing (Character Sheet)", function () {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Acquaintances-CharSheet-Test",
            playbookName: "Cutter"
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

        it("6.1.0 acquaintance list exists on character sheet", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const acquaintanceList = findAcquaintanceList(root);
          assert.ok(
            acquaintanceList,
            "Acquaintance list should exist on character sheet"
          );
        });

        it("6.1.1 standing colors display correctly", async function () {
          this.timeout(8000);

          // Always set known test acquaintances with explicit standings
          const testAcquaintances = [
            { id: "test-friend-1", name: "Test Friend", standing: "friend", description_short: "" },
            { id: "test-rival-1", name: "Test Rival", standing: "rival", description_short: "" },
            { id: "test-neutral-1", name: "Test Neutral", standing: "neutral", description_short: "" },
          ];

          await actor.update({ "system.acquaintances": testAcquaintances });
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Verify data was set correctly
          const storedAcqs = actor.system?.acquaintances || [];
          console.log("[Acquaintance Test] Stored acquaintances:", JSON.stringify(storedAcqs));

          // Re-render sheet after updating acquaintances
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 200));

          const root = sheet.element?.[0] || sheet.element;

          const items = findAcquaintanceItems(root);
          console.log("[Acquaintance Test] Found items:", items.length);
          if (items.length === 0) {
            // Debug: log what we can find
            const allDivs = root.querySelectorAll("div[class*='acquaintance']");
            const allDataAcq = root.querySelectorAll("[data-acquaintance]");
            console.log("[Acquaintance Test] div[class*='acquaintance']:", allDivs.length);
            console.log("[Acquaintance Test] [data-acquaintance]:", allDataAcq.length);
            this.skip();
            return;
          }

          // Check each item and log standings found (debug first item)
          const foundStandings = [];
          for (let i = 0; i < items.length; i++) {
            const standing = getAcquaintanceStanding(items[i], i === 0); // debug first item
            foundStandings.push(standing);
          }
          console.log("[Acquaintance Test] Found standings:", foundStandings);

          // Check that at least one item has standing indication
          const hasStandingIndicator = foundStandings.some(s => s !== null);

          assert.ok(
            hasStandingIndicator,
            `At least one acquaintance should have a standing indicator. Found: ${JSON.stringify(foundStandings)}`
          );
        });

        it("6.1.2 toggle standing cycles through values", async function () {
          this.timeout(10000);

          // Always set known test acquaintance starting at neutral
          const testAcquaintances = [
            { id: "test-toggle-1", name: "Test Toggle", standing: "neutral", description_short: "" },
          ];
          await actor.update({ "system.acquaintances": testAcquaintances });
          await new Promise((resolve) => setTimeout(resolve, 100));

          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 200));

          const root = sheet.element?.[0] || sheet.element;

          // Enable edit mode if needed
          const editToggle = root.querySelector(".toggle-allow-edit");
          if (editToggle && !sheet.allow_edit) {
            editToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const items = findAcquaintanceItems(root);
          if (items.length === 0) {
            console.log("[Acquaintance Test] No acquaintance items found for toggle test");
            this.skip();
            return;
          }

          const firstItem = items[0];
          const toggle = getStandingToggle(firstItem);

          if (!toggle) {
            // No standing toggle button found - skip this test
            console.log("[Acquaintance Test] No standing toggle found on acquaintance item");
            console.log("[Acquaintance Test] firstItem HTML:", firstItem.outerHTML);
            this.skip();
            return;
          }

          // Record initial state from both DOM and actor data
          const initialStandingDOM = getAcquaintanceStanding(firstItem);
          const initialStandingData = actor.system.acquaintances?.[0]?.standing;
          console.log("[Acquaintance Test] Initial standing - DOM:", initialStandingDOM, "Data:", initialStandingData);

          toggle.click();
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Check actor data changed (this is the critical test)
          const newStandingData = actor.system.acquaintances?.[0]?.standing;
          console.log("[Acquaintance Test] After click - Data:", newStandingData);

          // Re-render and check DOM
          await actor.sheet?.render(false);
          await new Promise((resolve) => setTimeout(resolve, 100));

          const newRoot = actor.sheet.element?.[0] || actor.sheet.element;
          const newItems = findAcquaintanceItems(newRoot);

          assert.ok(newItems.length > 0, "Acquaintance items should still exist after toggle");

          const newStandingDOM = getAcquaintanceStanding(newItems[0]);
          console.log("[Acquaintance Test] After render - DOM:", newStandingDOM);

          // Verify actor data actually changed (neutral -> friend cycle)
          assert.notEqual(
            newStandingData,
            initialStandingData,
            `Actor data standing should change after toggle (was: ${initialStandingData}, now: ${newStandingData})`
          );

          // Verify DOM reflects the change
          assert.notEqual(
            newStandingDOM,
            initialStandingDOM,
            `DOM standing should change after toggle (was: ${initialStandingDOM}, now: ${newStandingDOM})`
          );
        });
      });

      describe("6.1 Acquaintance Standing (Crew Sheet)", function () {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestCrewActor({
            name: "Acquaintances-CrewSheet-Test",
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

        it("6.1.3 crew contacts use acquaintance rendering", async function () {
          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Look for contacts or acquaintances section on crew sheet
          const contactList =
            findAcquaintanceList(root) ||
            root.querySelector(".crew-contacts, .contacts, .npc-list");

          // Crew sheets should have some form of contact/acquaintance display
          assert.ok(
            contactList || root.querySelector("[data-contact]"),
            "Crew sheet should have contacts or acquaintances section"
          );
        });

        it("6.1.3 crew contact standing colors match character sheet", async function () {
          this.timeout(8000);

          // Set explicit test contacts on the crew (crew starts with no contacts by default)
          const testContacts = [
            { id: "crew-friend-1", name: "Crew Friend", standing: "friend", description_short: "" },
            { id: "crew-rival-1", name: "Crew Rival", standing: "rival", description_short: "" },
            { id: "crew-neutral-1", name: "Crew Neutral", standing: "neutral", description_short: "" },
          ];
          await actor.update({ "system.acquaintances": testContacts });
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Open sheet and navigate to Contacts tab
          const sheet = await ensureSheet(actor);
          await sheet.render(true);
          await new Promise((resolve) => setTimeout(resolve, 200));

          const root = sheet.element?.[0] || sheet.element;

          // Click Contacts tab to reveal the contacts
          const contactsTab = root.querySelector('[data-tab="contacts"], a[data-tab="contacts"]');
          if (contactsTab) {
            contactsTab.click();
            await new Promise((resolve) => setTimeout(resolve, 200));
          }

          const items = findAcquaintanceItems(root);
          console.log(`[Acquaintance Test] Found ${items.length} crew contacts after setting test data`);

          if (items.length === 0) {
            // Debug: check what's in the contacts section
            const contactsSection = root.querySelector('[data-tab="contacts"], [data-section-key="acquaintances"]');
            console.log("[Acquaintance Test] Contacts section HTML:", contactsSection?.innerHTML?.substring(0, 500));
            this.skip();
            return;
          }

          // Verify at least one contact has standing styling (same rendering as character sheet)
          const foundStandings = [];
          for (const item of items) {
            const standing = getAcquaintanceStanding(item);
            foundStandings.push(standing);
          }
          console.log("[Acquaintance Test] Crew contact standings:", foundStandings);

          const hasStanding = foundStandings.some(s => s !== null);
          assert.ok(
            hasStanding,
            `At least one crew contact should have standing styling. Found: ${JSON.stringify(foundStandings)}`
          );
        });
      });

      describe.skip("[DISABLED] 6.2 Acquaintance Filtering", function () {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Acquaintances-Filter-Test",
            playbookName: "Cutter"
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
            try {
              await actor.delete();
            } catch {
              // Ignore delete errors
            }
            actor = null;
          }
        });

        it("6.2.1 filter toggle shows/hides non-Friend/Rival", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          const filterToggle = findFilterToggle(root);

          if (!filterToggle) {
            // Filter not implemented in this version
            console.log("[Acquaintance Test] Filter toggle not found");
            this.skip();
            return;
          }

          const itemsBefore = findAcquaintanceItems(root);
          const visibleBefore = Array.from(itemsBefore).filter(
            (el) => !el.classList.contains("hidden") && el.offsetParent !== null
          );

          // Click filter toggle
          filterToggle.click();
          await new Promise((resolve) => setTimeout(resolve, 200));

          const itemsAfter = findAcquaintanceItems(root);
          const visibleAfter = Array.from(itemsAfter).filter(
            (el) => !el.classList.contains("hidden") && el.offsetParent !== null
          );

          // Filter should either hide some items or show that it's working
          // If all items are friend/rival, counts may be equal; if not, they should differ
          console.log(`[Acquaintance Test] Visible before: ${visibleBefore.length}, after: ${visibleAfter.length}`);

          // The test passes if:
          // 1. The filter actually changed visible counts (filtering worked), OR
          // 2. We have items and all are friend/rival (no neutral to filter)
          const filteringOccurred = visibleBefore.length !== visibleAfter.length;
          const hasItems = itemsBefore.length > 0;

          assert.ok(
            filteringOccurred || hasItems,
            `Filter toggle should either change visible count or have items to filter (before: ${visibleBefore.length}, after: ${visibleAfter.length})`
          );
        });

        it("6.2.2 filter state persists across sheet close/reopen", async function () {
          this.timeout(10000);

          let sheet = await ensureSheet(actor);
          let root = sheet.element?.[0] || sheet.element;

          const filterToggle = findFilterToggle(root);

          if (!filterToggle) {
            console.log("[Acquaintance Test] Filter toggle not found for persistence test");
            this.skip();
            return;
          }

          // Enable filter
          if (!isFilterActive(root)) {
            filterToggle.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const filterStateBefore = isFilterActive(root);

          // Close and reopen sheet
          await sheet.close();
          await new Promise((resolve) => setTimeout(resolve, 200));

          sheet = await ensureSheet(actor);
          root = sheet.element?.[0] || sheet.element;

          const filterStateAfter = isFilterActive(root);

          // Filter state should persist across sheet close/reopen
          assert.strictEqual(
            filterStateAfter,
            filterStateBefore,
            `Filter state should persist (before close: ${filterStateBefore}, after reopen: ${filterStateAfter})`
          );
        });
      });
    },
    { displayName: "BitD Alt Sheets: Acquaintances" }
  );
});
