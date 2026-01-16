/**
 * Test utilities for bitd-alternate-sheets testing.
 * Provides helpers for actor creation, sheet manipulation, and DOM interaction.
 */

const TARGET_MODULE_ID = "bitd-alternate-sheets";

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
  // Close V1 apps in ui.windows (but not actor sheets - those are handled separately)
  for (const app of Object.values(ui.windows)) {
    if (app.rendered && !(app instanceof ActorSheet) && !(app instanceof ItemSheet)) {
      try {
        await app.close();
      } catch {
        // Ignore errors
      }
    }
  }

  // Close V2 DialogV2 elements (native <dialog> in DOM)
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
