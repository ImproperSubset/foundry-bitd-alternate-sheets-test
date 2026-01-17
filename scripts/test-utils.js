/**
 * Test utilities for bitd-alternate-sheets testing.
 * Provides helpers for actor creation, sheet manipulation, and DOM interaction.
 */

const TARGET_MODULE_ID = "bitd-alternate-sheets";

// ============================================================================
// Auto-Numbering Test Helper
// ============================================================================

/**
 * Auto-numbering helper for test suites.
 * Generates unique test/section IDs based on hierarchy using a unified counter.
 * Tests and sections share the same counter at each level, ensuring no duplicates.
 *
 * @example
 * const t = new TestNumberer("1");
 *
 * t.section("Crew sheet basics", () => {      // "1.1 Crew sheet basics"
 *   t.test("creates crew actor", fn);          // "1.1.1 creates crew actor"
 *   t.test("crew has expected type", fn);      // "1.1.2 crew has expected type"
 * });
 *
 * t.section("Playbook assignment", () => {    // "1.2 Playbook assignment"
 *   t.test("can assign playbook", fn);         // "1.2.1 can assign playbook"
 *   t.test("playbook updates sheet", fn);      // "1.2.2 playbook updates sheet"
 *
 *   t.section("Advanced playbook", () => {    // "1.2.3 Advanced playbook" (unified counter!)
 *     t.test("nested test", fn);               // "1.2.3.1 nested test"
 *   });
 *
 *   t.test("continues after nested", fn);      // "1.2.4 continues after nested"
 * });
 *
 * // Note: t.test() outside t.section() throws an error to prevent collisions
 */
export class TestNumberer {
  /**
   * Create a new TestNumberer for a batch.
   * @param {string} batchId - The batch identifier (e.g., "1", "11")
   */
  constructor(batchId) {
    this.batchId = batchId;
    this.numberStack = [];        // Stack of assigned numbers for current path
    this._counterAtDepth = [0];   // Unified counter at each depth (tests + sections share)
  }

  /**
   * Get the next number at the current depth and increment the counter.
   * @returns {number} The next available number
   * @private
   */
  _getNextNumber() {
    const depth = this.numberStack.length;

    // Ensure counter exists for this depth
    while (this._counterAtDepth.length <= depth) {
      this._counterAtDepth.push(0);
    }

    // Increment and return
    this._counterAtDepth[depth]++;
    return this._counterAtDepth[depth];
  }

  /**
   * Wrap a describe block with auto-numbered section.
   * @param {string} name - Section name (without number prefix)
   * @param {Function} fn - Test suite callback function
   */
  section(name, fn) {
    // Get next number at current depth (shared with tests)
    const num = this._getNextNumber();

    // Push to stack
    this.numberStack.push(num);

    // Build full number string
    const numberStr = this.numberStack.join(".");
    const fullNumber = `${this.batchId}.${numberStr}`;

    // Reset counter for the next depth level (inside this section)
    const depth = this.numberStack.length;
    if (this._counterAtDepth.length > depth) {
      this._counterAtDepth[depth] = 0;
    }

    describe(`${fullNumber} ${name}`, () => {
      fn();
    });

    // Pop from stack when section completes
    this.numberStack.pop();
  }

  /**
   * Wrap an it block with auto-numbered test.
   * Must be called inside a section() block.
   * @param {string} name - Test name (without number prefix)
   * @param {Function} fn - Test function (can be async)
   * @throws {Error} If called outside of a section
   */
  test(name, fn) {
    if (this.numberStack.length === 0) {
      throw new Error(
        `TestNumberer: t.test("${name}") must be called inside t.section(). ` +
        "Root-level tests would collide with section numbers."
      );
    }

    // Get next number at current depth (shared with sections)
    const num = this._getNextNumber();
    const numberStr = this.numberStack.join(".");
    const fullNumber = `${this.batchId}.${numberStr}.${num}`;

    it(`${fullNumber} ${name}`, fn);
  }

  /**
   * Wrap an it.skip block with auto-numbered skipped test.
   * Must be called inside a section() block.
   * @param {string} name - Test name (without number prefix)
   * @param {Function} fn - Test function (can be async)
   */
  skip(name, fn) {
    if (this.numberStack.length === 0) {
      throw new Error(
        `TestNumberer: t.skip("${name}") must be called inside t.section().`
      );
    }

    // Get next number at current depth (shared with sections)
    const num = this._getNextNumber();
    const numberStr = this.numberStack.join(".");
    const fullNumber = `${this.batchId}.${numberStr}.${num}`;

    it.skip(`${fullNumber} ${name}`, fn);
  }

  /**
   * Get the current section number string (for debugging/logging).
   * @returns {string} Current section number (e.g., "1.2.3")
   */
  getCurrentSection() {
    const numberStr = this.numberStack.join(".");
    return numberStr ? `${this.batchId}.${numberStr}` : this.batchId;
  }

  /**
   * Get what the next number would be at current depth (for debugging/logging).
   * @returns {string} Next number (e.g., "1.2.4")
   */
  peekNextNumber() {
    const depth = this.numberStack.length;
    const nextNum = (this._counterAtDepth[depth] || 0) + 1;
    const numberStr = this.numberStack.join(".");
    return numberStr
      ? `${this.batchId}.${numberStr}.${nextNum}`
      : `${this.batchId}.${nextNum}`;
  }
}

/**
 * Prefix for expected test errors. Use this when throwing errors that are
 * intentionally generated as part of a test, so they don't appear alarming in console.
 * @example throw new Error(expectedTestError("update failure"));
 */
export const EXPECTED_TEST_ERROR_PREFIX = "[EXPECTED TEST ERROR]";

/**
 * Create an error message with the expected test error prefix.
 * @param {string} message - The error message
 * @returns {string} Prefixed error message
 */
export function expectedTestError(message) {
  return `${EXPECTED_TEST_ERROR_PREFIX} ${message}`;
}

// ============================================================================
// V13+ Compatibility Helpers
// ============================================================================

/**
 * Get the ActorSheet class, preferring the V13+ namespaced version.
 * @returns {typeof ActorSheet}
 */
function getActorSheetClass() {
  return foundry?.appv1?.sheets?.ActorSheet ?? ActorSheet;
}

/**
 * Get the ItemSheet class, preferring the V13+ namespaced version.
 * @returns {typeof ItemSheet}
 */
function getItemSheetClass() {
  return foundry?.appv1?.sheets?.ItemSheet ?? ItemSheet;
}

/**
 * Wait for an actor update via Hooks.
 * @param {Actor} actor - The actor to watch
 * @param {object} options - Options
 * @param {number} options.timeoutMs - Timeout in milliseconds (default 2000)
 * @returns {Promise<void>}
 */
export async function waitForActorUpdate(actor, { timeoutMs = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    let timer;
    const hookFn = (doc) => {
      if (doc.id !== actor.id) return;
      Hooks.off("updateActor", hookFn);
      clearTimeout(timer);
      resolve();
    };

    timer = setTimeout(() => {
      Hooks.off("updateActor", hookFn);
      reject(new Error(`Timed out waiting for actor update (${actor.id})`));
    }, timeoutMs);

    Hooks.on("updateActor", hookFn);
  });
}

/**
 * Wait for a condition to become true by polling.
 * @param {Function} checkFn - Function that returns true when condition is met
 * @param {object} options - Options
 * @param {number} options.timeoutMs - Timeout in milliseconds (default 2000)
 * @param {number} options.intervalMs - Polling interval in milliseconds (default 50)
 * @returns {Promise<void>}
 */
export async function waitForActorCondition(
  checkFn,
  { timeoutMs = 2000, intervalMs = 50 } = {}
) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        if (checkFn()) {
          resolve();
          return;
        }
      } catch (err) {
        reject(err);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error("Timed out waiting for actor state update"));
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

/**
 * Ensure an actor's sheet is rendered and return it.
 * Waits for the element to be populated after render.
 * @param {Actor} actor - The actor
 * @returns {Promise<ActorSheet>}
 */
export async function ensureSheet(actor) {
  const sheet = actor.sheet;
  if (!sheet) {
    throw new Error("Actor has no sheet instance");
  }
  if (!sheet.rendered) {
    await sheet.render(true);
  }

  // Wait for the element to be populated (up to 2 seconds)
  const maxWait = 2000;
  const interval = 50;
  let waited = 0;
  while (waited < maxWait) {
    const el = sheet.element?.[0] || sheet.element;
    if (el && typeof el.querySelector === "function") {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
    waited += interval;
  }

  // Final delay to ensure DOM is fully settled
  await new Promise((resolve) => setTimeout(resolve, 100));
  return sheet;
}

/**
 * Get the root element of a rendered journal sheet.
 * Handles V12 (Application) and V13 (ApplicationV2) differences.
 * @param {JournalEntry} journal - The journal entry
 * @returns {Promise<HTMLElement|null>}
 */
export async function getJournalSheetElement(journal) {
  if (!journal?.sheet) return null;

  // Render if not already rendered
  if (!journal.sheet.rendered) {
    await journal.sheet.render(true);
  }

  // Wait for DOM to settle
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Helper to validate an element is usable (not a button, has querySelector)
  const isValidElement = (el) => {
    return el && typeof el.querySelector === "function" && el.tagName !== "BUTTON";
  };

  // Try standard element access (V12 style)
  let root = journal.sheet.element?.[0] || journal.sheet.element;
  if (isValidElement(root)) {
    return root;
  }

  // V13 ApplicationV2: find window in ui.windows by document ID
  for (const app of Object.values(ui.windows)) {
    if (app.document?.id === journal.id || app.object?.id === journal.id) {
      // Try app.element (may be jQuery-wrapped or raw HTMLElement)
      const el = app.element?.[0] || app.element;
      if (isValidElement(el)) {
        return el;
      }

      // V13 ApplicationV2 may expose element differently
      // Try _element (internal property some V13 apps use)
      const internalEl = app._element?.[0] || app._element;
      if (isValidElement(internalEl)) {
        return internalEl;
      }

      // Try finding by app ID in DOM (V13 uses data-appid attribute)
      const appId = app.appId ?? app.id;
      const domEl = document.getElementById(`app-${appId}`) ||
                    document.querySelector(`[data-appid="${appId}"]`) ||
                    document.querySelector(`#${app.id}`) ||
                    document.querySelector(`[id="${app.id}"]`);
      if (domEl) return domEl;
    }
  }

  // V13 specific: look for journal windows by class patterns
  const v13JournalPatterns = [
    '.journal-sheet.application',
    '.journal-entry.application',
    'journal-sheet', // Custom element name in V13
    'journal-entry-page-sheet',
    '.window-app.journal-sheet',
    '.app.window-app[data-document-id]'
  ];

  for (const pattern of v13JournalPatterns) {
    const el = document.querySelector(pattern);
    if (el) {
      // Verify this is our journal by checking document ID if available
      const docId = el.dataset?.documentId;
      if (!docId || docId === journal.id) {
        return el;
      }
    }
  }

  // Fallback: search DOM for journal window by document ID
  const byDocId = document.querySelector(`.journal-sheet[data-document-id="${journal.id}"]`) ||
                  document.querySelector(`.journal-entry[data-document-id="${journal.id}"]`) ||
                  document.querySelector(`[data-document-id="${journal.id}"]`);
  if (byDocId) return byDocId;

  // Fallback: search for any journal sheet window
  const anyJournal = document.querySelector('.journal-sheet.app.window-app') ||
                     document.querySelector('.journal-entry-sheet');
  if (anyJournal) return anyJournal;

  return null;
}

/**
 * Wait for a clock element to appear in a container (handles async enrichment).
 * Uses exponential backoff for reliability on slower systems (Codex recommendation).
 * Based on debugging insights: V13 @UUID enrichment is async, and replaceClockLinks
 * runs after enrichment. This polls until the clock appears or timeout.
 * @param {HTMLElement} container - The container to search
 * @param {object} options - Options
 * @param {number} options.timeoutMs - Timeout in milliseconds (default 5000)
 * @returns {Promise<HTMLElement|null>} - The clock element or null if not found
 */
export async function waitForClockElement(container, { timeoutMs = 5000 } = {}) {
  if (!container) return null;

  const start = Date.now();
  let interval = 100; // Start with 100ms, will increase exponentially

  while (Date.now() - start < timeoutMs) {
    // Look for clock elements (may be wrapped in container or direct)
    const clock = container.querySelector('.blades-clock') ||
                  container.querySelector('.linkedClock .blades-clock') ||
                  container.querySelector('.blades-clock-container .blades-clock');
    if (clock) {
      console.log(`[Test Utils] Clock element found after ${Date.now() - start}ms`);
      return clock;
    }

    // Also check if the @UUID content-link still exists (enrichment not done)
    const contentLink = container.querySelector('a.content-link[data-type="Actor"]');
    if (!contentLink) {
      // No content-link found - enrichment might have failed or clock replaced it
      // Give one more check for the clock
      await new Promise((resolve) => setTimeout(resolve, 50));
      const finalCheck = container.querySelector('.blades-clock');
      if (finalCheck) {
        console.log(`[Test Utils] Clock element found after ${Date.now() - start}ms (final check)`);
        return finalCheck;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
    interval = Math.min(interval * 1.5, 500); // Exponential backoff, cap at 500ms
  }

  console.log(`[Test Utils] Clock element not found after ${timeoutMs}ms timeout`);
  return null;
}

/**
 * Find a clock element within a chat message.
 * @param {ChatMessage} message - The chat message to search in
 * @returns {HTMLElement|null} - The clock element or null if not found
 */
export function findClockInChat(message) {
  // Try multiple selectors for chat log - Foundry VTT versions vary
  const chatLog = document.getElementById("chat-log") ||
                  document.querySelector("#chat-log") ||
                  document.querySelector(".chat-log") ||
                  document.querySelector("#chat .message-list");

  if (!chatLog) {
    console.log("[Test Utils] Chat log element not found");
    return null;
  }

  // Try multiple selectors for message element
  const messageEl = chatLog.querySelector(`[data-message-id="${message.id}"]`) ||
                    chatLog.querySelector(`li.message[data-message-id="${message.id}"]`) ||
                    chatLog.querySelector(`article[data-message-id="${message.id}"]`);

  if (!messageEl) {
    console.log(`[Test Utils] Message element not found for id: ${message.id}`);
    return null;
  }

  // Try multiple clock selectors - the module may use different class names
  const clockEl = messageEl.querySelector(".blades-clock, .linkedClock, .clock, .clock-container, [data-clock-uuid]");

  if (!clockEl) {
    console.log(`[Test Utils] Clock element not found in message ${message.id}`);
    return null;
  }

  return clockEl;
}

/**
 * Wait for a clock element to appear in a chat message.
 * Uses exponential backoff for reliability.
 * @param {ChatMessage} message - The chat message to search in
 * @param {number} maxWaitMs - Maximum wait time in milliseconds (default 5000)
 * @returns {Promise<HTMLElement|null>} - The clock element or null if not found
 */
export async function waitForClockInChat(message, maxWaitMs = 5000) {
  let waited = 0;
  let interval = 100; // Start with 100ms, will increase exponentially
  const startTime = Date.now();

  while (waited < maxWaitMs) {
    const clockEl = findClockInChat(message);
    if (clockEl) {
      console.log(`[Test Utils] Clock found in chat after ${Date.now() - startTime}ms`);
      return clockEl;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
    waited += interval;
    interval = Math.min(interval * 1.5, 500); // Exponential backoff, cap at 500ms
  }
  console.log(`[Test Utils] Clock not found in chat after ${maxWaitMs}ms timeout`);
  return null;
}

/**
 * Find a class/playbook item in compendia.
 * @param {string} playbookName - Optional playbook name to find specifically
 * @returns {Promise<Item|null>}
 */
export async function findClassItem(playbookName) {
  const packs = Array.from(game.packs.values()).filter(
    (pack) => pack.documentName === "Item"
  );
  const normalized = playbookName?.toLowerCase?.() || null;
  let fallback = null;
  let fallbackPriority = -1;

  for (const pack of packs) {
    const index = await pack.getIndex({ fields: ["type", "name"] });
    if (normalized) {
      const exact = index.find(
        (doc) =>
          doc.type === "class" && doc.name?.toLowerCase?.() === normalized
      );
      if (exact) {
        return pack.getDocument(exact._id);
      }
    }

    const entry = index.find((doc) => doc.type === "class");
    if (entry) {
      const isSystemClass = pack.collection === "blades-in-the-dark.class";
      const label = pack.metadata?.label?.toLowerCase?.() || "";
      const priority = isSystemClass ? 2 : label.includes("class") ? 1 : 0;
      if (priority > fallbackPriority) {
        fallback = { pack, entry };
        fallbackPriority = priority;
      }
    }
  }

  if (fallback) {
    return fallback.pack.getDocument(fallback.entry._id);
  }

  return null;
}

/**
 * Create a test actor with a playbook.
 * @param {object} options - Options
 * @param {string} options.name - Actor name (default: auto-generated)
 * @param {string} options.playbookName - Playbook to assign
 * @returns {Promise<{actor: Actor, playbookItem: Item}>}
 */
export async function createTestActor({ name, playbookName } = {}) {
  const actorName = name || `Alt Sheets Test ${Date.now()}`;
  const actor = await Actor.create({ name: actorName, type: "character" });
  if (!actor) {
    throw new Error("Failed to create test actor");
  }

  const playbook = await findClassItem(playbookName);
  if (!playbook) {
    throw new Error("No class/playbook item found in compendia");
  }

  const playbookData = playbook.toObject();
  delete playbookData._id;
  const [createdPlaybook] = await actor.createEmbeddedDocuments("Item", [
    playbookData,
  ]);
  if (!createdPlaybook) {
    throw new Error("Failed to create embedded playbook item");
  }
  await actor.update({ "system.playbook": createdPlaybook.name });

  const sheet = await ensureSheet(actor);
  await sheet.switchPlaybook(createdPlaybook);
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { actor, playbookItem: createdPlaybook };
}

/**
 * Get the exp_max value for an attribute.
 * @param {Actor} actor - The actor
 * @param {string} attribute - Attribute name (insight, prowess, resolve)
 * @returns {number}
 */
export function getAttributeExpMax(actor, attribute) {
  const raw = foundry.utils.getProperty(
    actor.system,
    `attributes.${attribute}.exp_max`
  );
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Get the current exp value for an attribute.
 * @param {Actor} actor - The actor
 * @param {string} attribute - Attribute name
 * @returns {number}
 */
export function getAttributeExp(actor, attribute) {
  const raw = foundry.utils.getProperty(
    actor.system,
    `attributes.${attribute}.exp`
  );
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Get the lit/unlit state of XP teeth from the DOM.
 * @param {HTMLElement} root - Sheet root element
 * @param {string} actorId - Actor ID
 * @param {string} attribute - Attribute name
 * @param {number} max - Maximum number of teeth
 * @returns {Array<{value: number, lit: boolean}>}
 */
export function getTeethState(root, actorId, attribute, max) {
  const teeth = [];
  for (let value = 1; value <= max; value += 1) {
    const label = root.querySelector(
      `label[for="character-${actorId}-${attribute}-${value}"]`
    );
    teeth.push({ value, lit: Boolean(label?.classList?.contains("on")) });
  }
  return teeth;
}

/**
 * Get array of lit tooth values.
 * @param {Array<{value: number, lit: boolean}>} teeth - Teeth state array
 * @returns {number[]}
 */
export function getLitValues(teeth) {
  return teeth.filter((tooth) => tooth.lit).map((tooth) => tooth.value);
}

/**
 * Click a tooth and wait for the update.
 * @param {object} options - Options
 * @param {Actor} options.actor - The actor
 * @param {string} options.attribute - Attribute name
 * @param {number} options.value - Tooth value to click
 * @param {number} options.timeoutMs - Timeout for update (default 1000)
 * @returns {Promise<{exp: number, teeth: Array, updateTimedOut: boolean}>}
 */
export async function applyToothClick({ actor, attribute, value, timeoutMs = 1000 }) {
  const sheet = await ensureSheet(actor);
  const root = sheet.element?.[0] || sheet.element;
  if (!root) {
    throw new Error("Sheet DOM not available");
  }

  const id = `character-${actor.id}-${attribute}-${value}`;
  const input = root.querySelector(`#${id}`);
  if (!input) {
    throw new Error(`Missing tooth input for ${attribute} ${value}`);
  }

  let updateTimedOut = false;
  const updatePromise = waitForActorUpdate(actor, { timeoutMs }).catch(() => {
    updateTimedOut = true;
  });

  input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  await updatePromise;
  await sheet.render(false);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const exp = foundry.utils.getProperty(
    actor.system,
    `attributes.${attribute}.exp`
  );
  const max = getAttributeExpMax(actor, attribute);
  const teeth = getTeethState(root, actor.id, attribute, max);

  return { exp, teeth, updateTimedOut };
}

/**
 * Set an attribute's exp value directly.
 * @param {Actor} actor - The actor
 * @param {string} attribute - Attribute name
 * @param {number} value - Value to set
 */
export async function setAttributeExp(actor, attribute, value) {
  await actor.update({ [`system.attributes.${attribute}.exp`]: String(value) });
  const sheet = await ensureSheet(actor);
  await sheet.render(false);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Check if the target module is active.
 * @returns {boolean}
 */
export function isTargetModuleActive() {
  return game?.modules?.get(TARGET_MODULE_ID)?.active ?? false;
}

/**
 * Close all open dialogs and applications.
 * Handles both V1 apps in ui.windows and V2 DialogV2 native <dialog> elements.
 */
export async function closeAllDialogs() {
  // Get V13+ namespaced classes to avoid deprecation warnings
  const ActorSheetClass = getActorSheetClass();
  const ItemSheetClass = getItemSheetClass();

  // Close V1 apps in ui.windows (but not actor sheets - those are handled separately)
  for (const app of Object.values(ui.windows)) {
    if (app.rendered && !(app instanceof ActorSheetClass) && !(app instanceof ItemSheetClass)) {
      try {
        await app.close();
      } catch {
        // Ignore errors
      }
    }
  }

  // Close V2 DialogV2 instances (V13+ registry)
  // Only close actual dialogs, not other ApplicationV2 apps (like Quench reporter)
  const appInstances = foundry?.applications?.instances;
  const DialogV2Class = foundry?.applications?.api?.DialogV2;
  if (appInstances instanceof Map && DialogV2Class) {
    // Convert to array first - closing apps modifies the Map during iteration
    const apps = Array.from(appInstances.values());
    for (const app of apps) {
      // Only close DialogV2 instances
      if (!(app instanceof DialogV2Class)) continue;
      try {
        await app.close();
      } catch {
        // Ignore errors
      }
    }
  }

  // Fallback: Close any remaining V2 DialogV2 elements (native <dialog> in DOM)
  const v2Dialogs = document.querySelectorAll("dialog[open]");
  for (const dialog of v2Dialogs) {
    try {
      dialog.close();
    } catch {
      // Ignore errors
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 100));
}

// ============================================================================
// Crew Actor Utilities
// ============================================================================

/**
 * Find a crew_type item in compendia.
 * @param {string} crewTypeName - Optional crew type name to find specifically
 * @returns {Promise<Item|null>}
 */
export async function findCrewTypeItem(crewTypeName) {
  const packs = Array.from(game.packs.values()).filter(
    (pack) => pack.documentName === "Item"
  );
  const normalized = crewTypeName?.toLowerCase?.() || null;
  let fallback = null;

  for (const pack of packs) {
    const index = await pack.getIndex({ fields: ["type", "name"] });
    if (normalized) {
      const exact = index.find(
        (doc) =>
          doc.type === "crew_type" && doc.name?.toLowerCase?.() === normalized
      );
      if (exact) {
        return pack.getDocument(exact._id);
      }
    }

    const entry = index.find((doc) => doc.type === "crew_type");
    if (entry && !fallback) {
      fallback = { pack, entry };
    }
  }

  if (fallback) {
    return fallback.pack.getDocument(fallback.entry._id);
  }

  return null;
}

/**
 * Create a test crew actor with optional crew type.
 * @param {object} options - Options
 * @param {string} options.name - Actor name (default: auto-generated)
 * @param {string} options.crewTypeName - Crew type to assign
 * @returns {Promise<{actor: Actor, crewTypeItem: Item|null}>}
 */
export async function createTestCrewActor({ name, crewTypeName } = {}) {
  const actorName = name || `Alt Sheets Test Crew ${Date.now()}`;
  const actor = await Actor.create({ name: actorName, type: "crew" });
  if (!actor) {
    throw new Error("Failed to create test crew actor");
  }

  let crewTypeItem = null;
  if (crewTypeName) {
    const crewType = await findCrewTypeItem(crewTypeName);
    if (crewType) {
      const crewTypeData = crewType.toObject();
      delete crewTypeData._id;
      const [createdCrewType] = await actor.createEmbeddedDocuments("Item", [
        crewTypeData,
      ]);
      crewTypeItem = createdCrewType;
    }
  }

  await ensureSheet(actor);
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { actor, crewTypeItem };
}

/**
 * Get the max value for a crew stat (tier, heat, wanted, rep).
 * @param {Actor} actor - The crew actor
 * @param {string} stat - Stat name (tier, heat, wanted, rep)
 * @returns {number}
 */
export function getCrewStatMax(actor, stat) {
  const raw = foundry.utils.getProperty(actor.system, `max.${stat}`);
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Get the current value for a crew stat.
 * @param {Actor} actor - The crew actor
 * @param {string} stat - Stat name (tier, heat, wanted, reputation)
 * @returns {number}
 */
export function getCrewStat(actor, stat) {
  const raw = foundry.utils.getProperty(actor.system, stat);
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Set a crew stat value directly.
 * @param {Actor} actor - The crew actor
 * @param {string} stat - Stat name (tier, heat, wanted, reputation)
 * @param {number} value - Value to set
 */
export async function setCrewStat(actor, stat, value) {
  await actor.update({ [`system.${stat}`]: value });
  const sheet = await ensureSheet(actor);
  await sheet.render(false);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Get the lit/unlit state of crew stat teeth from the DOM.
 * Uses the input's checked state since CSS uses input:checked ~ label selectors.
 * @param {HTMLElement} root - Sheet root element
 * @param {string} actorId - Actor ID
 * @param {string} stat - Stat name (tier, heat, wanted)
 * @param {number} max - Maximum number of teeth
 * @returns {Array<{value: number, lit: boolean}>}
 */
export function getCrewTeethState(root, actorId, stat, max) {
  const teeth = [];

  // Find the checked input to determine current value
  // Radio inputs with same name - the checked one determines current value
  const checkedInput = root.querySelector(
    `input[name="system.${stat}"]:checked`
  );
  const currentValue = checkedInput ? parseInt(checkedInput.value) || 0 : 0;

  for (let value = 1; value <= max; value += 1) {
    // A tooth is "lit" if its value is <= the current checked value
    teeth.push({ value, lit: value <= currentValue });
  }
  return teeth;
}

/**
 * Click a crew stat tooth and wait for the update.
 * Dispatches mousedown on the label element since that's where the handler is attached.
 * @param {object} options - Options
 * @param {Actor} options.actor - The crew actor
 * @param {string} options.stat - Stat name (tier, heat, wanted)
 * @param {number} options.value - Tooth value to click
 * @param {number} options.timeoutMs - Timeout for update (default 1000)
 * @returns {Promise<{statValue: number, teeth: Array, updateTimedOut: boolean}>}
 */
export async function applyCrewToothClick({ actor, stat, value, timeoutMs = 1000 }) {
  const sheet = await ensureSheet(actor);
  const root = sheet.element?.[0] || sheet.element;
  if (!root) {
    throw new Error("Sheet DOM not available");
  }

  // wanted uses "wanted-counter" in the ID, others use the stat name directly
  const idPrefix = stat === "wanted" ? "wanted-counter" : stat;
  const id = `crew-${actor.id}-${idPrefix}-${value}`;

  // Find the label that targets this input - the mousedown handler is on label.radio-toggle
  const label = root.querySelector(`label.radio-toggle[for="${id}"]`);
  if (!label) {
    throw new Error(`Missing crew tooth label for ${stat} ${value} (for: ${id})`);
  }

  let updateTimedOut = false;
  const updatePromise = waitForActorUpdate(actor, { timeoutMs }).catch(() => {
    updateTimedOut = true;
  });

  // Dispatch mousedown on the label - this is what the handler listens for
  label.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  await updatePromise;
  await sheet.render(false);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const statValue = foundry.utils.getProperty(actor.system, stat);
  const max = getCrewStatMax(actor, stat);
  const teeth = getCrewTeethState(root, actor.id, stat, max);

  return { statValue, teeth, updateTimedOut };
}

// ============================================================================
// Parameterized Radio Toggle Test Helpers
// ============================================================================

/**
 * Run a parameterized teeth/radio toggle test.
 * Reduces boilerplate for common click-and-verify test patterns.
 *
 * @param {object} options - Test configuration
 * @param {Actor} options.actor - The actor to test
 * @param {string} options.attribute - Attribute name (insight, prowess, resolve)
 * @param {number} options.initialValue - Value to set before clicking
 * @param {number} options.clickValue - Tooth value to click
 * @param {number} [options.expectedValue] - Expected value after click (asserted if provided)
 * @param {number[]} [options.expectedLit] - Expected lit teeth array (asserted if provided)
 * @param {Function} options.assert - Chai assert function from test context
 * @param {string} [options.message] - Custom assertion message prefix
 * @returns {Promise<{exp: number, teeth: Array}>}
 *
 * @example
 * // Simple value test
 * await runTeethTest({
 *   actor, attribute: "insight", initialValue: 0, clickValue: 1,
 *   expectedValue: 1, assert
 * });
 *
 * @example
 * // Value and lit state test
 * await runTeethTest({
 *   actor, attribute: "prowess", initialValue: 1, clickValue: 3,
 *   expectedValue: 3, expectedLit: [1, 2, 3], assert
 * });
 */
export async function runTeethTest({
  actor,
  attribute,
  initialValue,
  clickValue,
  expectedValue,
  expectedLit,
  assert,
  message = "",
}) {
  await setAttributeExp(actor, attribute, initialValue);
  const result = await applyToothClick({ actor, attribute, value: clickValue });

  const prefix = message ? `${message}: ` : "";

  if (expectedValue !== undefined) {
    assert.equal(
      String(result.exp),
      String(expectedValue),
      `${prefix}${attribute} exp should be ${expectedValue} after clicking tooth ${clickValue}`
    );
  }

  if (expectedLit !== undefined) {
    const lit = getLitValues(result.teeth);
    assert.deepEqual(
      lit,
      expectedLit,
      `${prefix}${attribute} should have teeth ${expectedLit.join(", ")} lit`
    );
  }

  return result;
}

/**
 * Run a parameterized crew stat teeth test.
 *
 * @param {object} options - Test configuration
 * @param {Actor} options.actor - The crew actor to test
 * @param {string} options.stat - Stat name (tier, heat, wanted, reputation)
 * @param {number} options.initialValue - Value to set before clicking
 * @param {number} options.clickValue - Tooth value to click
 * @param {number} [options.expectedValue] - Expected value after click
 * @param {number[]} [options.expectedLit] - Expected lit teeth array
 * @param {Function} options.assert - Chai assert function
 * @param {string} [options.message] - Custom assertion message prefix
 * @returns {Promise<{statValue: number, teeth: Array}>}
 */
export async function runCrewTeethTest({
  actor,
  stat,
  initialValue,
  clickValue,
  expectedValue,
  expectedLit,
  assert,
  message = "",
}) {
  await setCrewStat(actor, stat, initialValue);
  const result = await applyCrewToothClick({ actor, stat, value: clickValue });

  const prefix = message ? `${message}: ` : "";

  if (expectedValue !== undefined) {
    assert.equal(
      Number(result.statValue),
      expectedValue,
      `${prefix}${stat} should be ${expectedValue} after clicking tooth ${clickValue}`
    );
  }

  if (expectedLit !== undefined) {
    const lit = getLitValues(result.teeth);
    assert.deepEqual(
      lit,
      expectedLit,
      `${prefix}${stat} should have teeth ${expectedLit.join(", ")} lit`
    );
  }

  return result;
}

// ============================================================================
// Test Cleanup Helpers
// ============================================================================

/**
 * Clean up a test actor by closing its sheet and deleting it.
 * Handles V12/V13 differences and ApplicationV2 edge cases.
 * @param {Actor|null} actor - The actor to clean up (can be null)
 * @param {object} options - Options
 * @param {number} options.closeDelay - Delay after closing sheet (default 100)
 * @returns {Promise<void>}
 */
export async function cleanupTestActor(actor, { closeDelay = 100 } = {}) {
  if (!actor) return;

  // Try to close the sheet (don't rely on rendered flag - V13 can be inconsistent)
  try {
    if (actor.sheet) {
      await actor.sheet.close();
      await new Promise((resolve) => setTimeout(resolve, closeDelay));
    }
  } catch {
    // Ignore close errors
  }

  // Force close any Application windows associated with this actor
  try {
    const actorId = actor.id;
    for (const [, app] of Object.entries(ui.windows)) {
      if (app.actor?.id === actorId || app.document?.id === actorId) {
        await app.close();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  } catch {
    // Ignore window close errors
  }

  // Delete the actor
  try {
    await actor.delete();
  } catch {
    // Ignore delete errors
  }
}

/**
 * Clean up multiple test actors.
 * @param {Array<Actor|null>} actors - Array of actors to clean up
 * @param {object} options - Options passed to cleanupTestActor
 * @returns {Promise<void>}
 */
export async function cleanupTestActors(actors, options = {}) {
  for (const actor of actors) {
    await cleanupTestActor(actor, options);
  }
}

/**
 * Full test cleanup routine for afterEach blocks.
 * Closes dialogs, cleans up actors, and optionally restores settings.
 * @param {object} options - Cleanup options
 * @param {Array<Actor|null>} options.actors - Actors to clean up
 * @param {object} options.settings - Settings to restore: { moduleId, settings: { key: originalValue } }
 * @returns {Promise<void>}
 */
export async function testCleanup({ actors = [], settings = null } = {}) {
  // Close all dialogs first - they may be blocking sheet cleanup
  await closeAllDialogs();
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Close dialogs again in case new ones appeared during first close
  await closeAllDialogs();
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Clean up all actors
  await cleanupTestActors(actors);

  // Final dialog sweep
  await closeAllDialogs();

  // Clear any notifications that accumulated during tests
  clearNotifications();

  // Restore settings if provided
  if (settings?.moduleId && settings?.values) {
    for (const [key, value] of Object.entries(settings.values)) {
      if (value !== undefined) {
        try {
          await game.settings.set(settings.moduleId, key, value);
        } catch {
          // Ignore settings errors
        }
      }
    }
  }
}

/**
 * Clear all active notifications from the UI.
 * Useful for cleaning up error notifications generated during tests.
 */
export function clearNotifications() {
  try {
    // Clear the notification queue
    if (ui.notifications?.queue) {
      ui.notifications.queue.length = 0;
    }
    // Remove active notification elements from the DOM
    const container = document.getElementById("notifications");
    if (container) {
      container.querySelectorAll(".notification").forEach((el) => el.remove());
    }
  } catch {
    // Ignore errors during notification cleanup
  }
}

// ============================================================================
// Clock Test Helpers
// ============================================================================

/**
 * Run a parameterized clock click test.
 *
 * @param {object} options - Test configuration
 * @param {Actor} options.actor - The actor to test
 * @param {number} options.initialValue - Value to set before clicking
 * @param {number} options.clickSegment - Segment number to click (1-based)
 * @param {number} options.expectedValue - Expected value after click
 * @param {Function} options.setValue - Function to set clock value: (actor, value) => Promise
 * @param {Function} options.getValue - Function to get clock value: (actor) => number
 * @param {Function} options.clickFn - Function to click segment: (root, segment) => void
 * @param {Function} options.assert - Chai assert function
 * @param {string} [options.message] - Custom assertion message
 * @returns {Promise<number>} - The new value after click
 */
export async function runClockClickTest({
  actor,
  initialValue,
  clickSegment,
  expectedValue,
  setValue,
  getValue,
  clickFn,
  assert,
  message = "",
}) {
  await setValue(actor, initialValue);
  const sheet = await ensureSheet(actor);
  const root = sheet.element?.[0] || sheet.element;

  const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
  clickFn(root, clickSegment);
  await updatePromise;
  await new Promise((resolve) => setTimeout(resolve, 100));

  const newValue = getValue(actor);
  const prefix = message ? `${message}: ` : "";

  assert.equal(
    newValue,
    expectedValue,
    `${prefix}Clock should be ${expectedValue} after clicking segment ${clickSegment}`
  );

  return newValue;
}

/**
 * Run a parameterized clock right-click (decrement) test.
 *
 * @param {object} options - Test configuration
 * @param {Actor} options.actor - The actor to test
 * @param {number} options.initialValue - Value to set before right-clicking
 * @param {number} options.expectedValue - Expected value after right-click
 * @param {Function} options.setValue - Function to set clock value
 * @param {Function} options.getValue - Function to get clock value
 * @param {Function} options.rightClickFn - Function to right-click: (root) => void
 * @param {Function} options.assert - Chai assert function
 * @param {string} [options.message] - Custom assertion message
 * @returns {Promise<number>} - The new value after right-click
 */
export async function runClockRightClickTest({
  actor,
  initialValue,
  expectedValue,
  setValue,
  getValue,
  rightClickFn,
  assert,
  message = "",
}) {
  await setValue(actor, initialValue);
  const sheet = await ensureSheet(actor);
  const root = sheet.element?.[0] || sheet.element;

  const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
  rightClickFn(root);
  await updatePromise;
  await new Promise((resolve) => setTimeout(resolve, 100));

  const newValue = getValue(actor);
  const prefix = message ? `${message}: ` : "";

  assert.equal(
    newValue,
    expectedValue,
    `${prefix}Clock should be ${expectedValue} after right-click (was ${initialValue})`
  );

  return newValue;
}
