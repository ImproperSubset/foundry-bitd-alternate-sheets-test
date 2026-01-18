/**
 * Centralized DOM selectors for BitD Alternate Sheets tests.
 * Use these constants instead of hardcoding selectors in test files.
 *
 * Benefits:
 * - Single source of truth for selectors
 * - Easy to update when DOM structure changes
 * - Better autocomplete and discoverability
 * - Consistent selector usage across test files
 *
 * @example
 * import { SHEET, EDIT_MODE, POPUP } from "../test-selectors.js";
 *
 * const wrapper = root.querySelector(SHEET.WRAPPER);
 * const editToggle = root.querySelector(EDIT_MODE.TOGGLE);
 * const coinsBox = root.querySelector(POPUP.COINS.BOX);
 */

// ============================================================================
// Sheet Structure Selectors
// ============================================================================

/**
 * Core sheet structure selectors.
 */
export const SHEET = {
  /** Main sheet wrapper element */
  WRAPPER: ".sheet-wrapper",
  /** Window content area */
  WINDOW_CONTENT: ".window-content",
  /** Sheet body/form container */
  BODY: ".sheet-body, form",
  /** Generic form element */
  FORM: "form",
};

// ============================================================================
// Edit Mode Selectors
// ============================================================================

/**
 * Edit mode (allow-edit) related selectors.
 */
export const EDIT_MODE = {
  /** Edit mode toggle button */
  TOGGLE: ".toggle-allow-edit",
  /** Sheet wrapper with edit mode active */
  WRAPPER_ACTIVE: ".sheet-wrapper.allow-edit",
  /** Sheet wrapper without edit mode */
  WRAPPER_INACTIVE: ".sheet-wrapper:not(.allow-edit)",
};

// ============================================================================
// Mini Mode Selectors
// ============================================================================

/**
 * Mini mode (expand/collapse) related selectors.
 */
export const MINI_MODE = {
  /** Mini mode toggle button */
  TOGGLE: ".toggle-expand",
  /** Minimized view container */
  MINIMIZED_VIEW: ".minimized-view",
  /** Class added when sheet can expand */
  CAN_EXPAND_CLASS: "can-expand",
  /** Portrait in minimized view */
  PORTRAIT: ".portrait, .character-portrait",
  /** Coins row (visible in mini mode) */
  COINS_ROW: ".coins-row",
};

// ============================================================================
// Popup Selectors
// ============================================================================

/**
 * Coins popup related selectors.
 */
export const POPUP = {
  COINS: {
    /** Coins box trigger */
    BOX: ".coins-box",
    /** Expanded full view */
    FULL_VIEW: ".full-view",
    /** Coin inputs */
    INPUTS: 'input[name="system.coins"]',
    /** Stash inputs */
    STASH_INPUTS: 'input[name="system.coins_stashed"]',
    /**
     * Get coin label selector for specific denomination.
     * @param {number} value - Coin value (1-4)
     * @returns {string} Selector
     */
    coinLabel: (value) => `label[for*="coins"][for*="hands-${value}"]`,
    /**
     * Get stash label selector for specific value.
     * @param {number} value - Stash value
     * @returns {string} Selector
     */
    stashLabel: (value) => `label[for*="stashed-${value}"]`,
  },
  HARM: {
    /** Harm box trigger */
    BOX: ".harm-box",
    /** Expanded full view */
    FULL_VIEW: ".full-view",
    /** Healing clock element */
    HEALING_CLOCK: ".healing-clock, .clocks",
    /** Light harm inputs */
    LIGHT_HARM: 'input[name*="harm.light"]',
    /** Medium harm inputs */
    MEDIUM_HARM: 'input[name*="harm.medium"]',
    /** Heavy harm inputs */
    HEAVY_HARM: 'input[name*="harm.heavy"]',
    /** Armor checkbox */
    ARMOR: 'input[name="system.armor-uses.armor"]',
    /** Heavy armor checkbox */
    HEAVY_ARMOR: 'input[name="system.armor-uses.heavy"]',
    /** Special armor checkbox */
    SPECIAL_ARMOR: 'input[name="system.armor-uses.special"]',
  },
  LOAD: {
    /** Load box trigger */
    BOX: ".load-box",
    /** Expanded full view */
    FULL_VIEW: ".full-view",
    /** Load level selector dropdown */
    LEVEL_SELECT: 'select[name="system.selected_load_level"]',
    /** Clear load button */
    CLEAR_BUTTON: "button.clearLoad",
    /** Debug toggle */
    DEBUG_TOGGLE: ".debug-toggle",
  },
};

// ============================================================================
// Tab Selectors
// ============================================================================

/**
 * Tab navigation selectors.
 */
export const TABS = {
  /** Notes tab content */
  NOTES: '.tab[data-tab="notes"], [data-tab="notes"].tab',
  /** Notes tab button/link */
  NOTES_BUTTON: 'a[data-tab="notes"], [data-tab="notes"]',
  /** Contacts tab */
  CONTACTS: '[data-tab="contacts"]',
  /** Contacts tab button */
  CONTACTS_BUTTON: 'a[data-tab="contacts"]',
  /** Generic tab selector function */
  tab: (name) => `.tab[data-tab="${name}"], [data-tab="${name}"].tab`,
  /** Generic tab button selector function */
  tabButton: (name) => `a[data-tab="${name}"], [data-tab="${name}"]`,
};

// ============================================================================
// Notes Tab Selectors
// ============================================================================

/**
 * Notes tab related selectors.
 */
export const NOTES = {
  /** Notes content area */
  AREA: ".character-notes-area, .notes.tab",
  /** Editor content (various formats) */
  EDITOR: ".editor-content, .editor, textarea, .ProseMirror",
  /** Notes input by name */
  INPUT: '[name*="notes"]',
  /** Header element */
  HEADER: "header",
};

// ============================================================================
// Acquaintances/Contacts Selectors
// ============================================================================

/**
 * Acquaintances and contacts related selectors.
 */
export const ACQUAINTANCES = {
  /** Friends/rivals section */
  SECTION: ".friends-rivals, [data-tab='contacts'], [data-section-key='acquaintances']",
  /** Standing toggle icon */
  STANDING_TOGGLE: ".standing-toggle, i[data-acquaintance]",
  /** Standing toggle icon (icon-specific) */
  STANDING_ICON: "i.standing-toggle, i[data-acquaintance]",
  /** Crew contacts list */
  CREW_CONTACTS: ".crew-contacts, .contacts, .npc-list",
  /** Contact data attribute */
  CONTACT_DATA: "[data-contact]",
};

// ============================================================================
// Items & Abilities Selectors
// ============================================================================

/**
 * Item and ability related selectors.
 */
export const ITEMS = {
  /** Item checkbox */
  CHECKBOX: "input[type='checkbox']",
  /** Ability block container */
  ABILITY_BLOCK: ".ability-block, .ability-item",
  /** Virtual items */
  VIRTUAL: ".item-virtual, [data-virtual='true']",
  /** Smart field value display */
  SMART_FIELD: ".smart-field-value",
  /** Smart edit action */
  SMART_EDIT: '[data-action="smart-edit"]',
  /** Inline input fields */
  INLINE_INPUT: ".inline-input",
};

// ============================================================================
// Crew Sheet Selectors
// ============================================================================

/**
 * Crew sheet specific selectors.
 */
export const CREW = {
  /** Crew ability checkbox */
  ABILITY_CHECKBOX: ".crew-ability-checkbox",
  /** Unchecked crew ability */
  ABILITY_UNCHECKED: ".crew-ability-checkbox:not(:checked)",
  /** Crew upgrade checkbox */
  UPGRADE_CHECKBOX: ".crew-upgrade-checkbox",
  /** Unchecked crew upgrade */
  UPGRADE_UNCHECKED: ".crew-upgrade-checkbox:not(:checked)",
  /** Crew choice container */
  CHOICE_CONTAINER: ".crew-choice",
  /** Turf selection checkbox */
  TURF_CHECKBOX: ".turf-select",
  /** Unchecked turf */
  TURF_UNCHECKED: ".turf-select:not(:checked)",
};

// ============================================================================
// Clock Selectors
// ============================================================================

/**
 * Clock related selectors.
 */
export const CLOCKS = {
  /** Blades clock element */
  CLOCK: ".blades-clock",
  /** Linked clock container */
  LINKED: ".linkedClock .blades-clock",
  /** Clock in container */
  CONTAINER: ".blades-clock-container .blades-clock",
  /** Radio toggle labels */
  RADIO_LABELS: "label.radio-toggle",
  /** Clock segment by value */
  segment: (value) => `label.radio-toggle[for*="-${value}"]`,
};

// ============================================================================
// XP/Teeth Selectors
// ============================================================================

/**
 * XP teeth (radio toggle) selectors.
 */
export const TEETH = {
  /** Tooth/radio toggle */
  TOOTH: ".tooth",
  /** Stress teeth */
  STRESS: "[data-stat='stress'] .tooth, .stress-section .tooth, .stress .tooth",
  /**
   * Get character tooth input selector.
   * @param {string} actorId - Actor ID
   * @param {string} attribute - Attribute name
   * @param {number} value - Tooth value
   * @returns {string} Selector
   */
  input: (actorId, attribute, value) =>
    `#character-${actorId}-${attribute}-${value}`,
  /**
   * Get character tooth label selector.
   * @param {string} actorId - Actor ID
   * @param {string} attribute - Attribute name
   * @param {number} value - Tooth value
   * @returns {string} Selector
   */
  label: (actorId, attribute, value) =>
    `label[for="character-${actorId}-${attribute}-${value}"]`,
  /**
   * Get crew tooth input selector.
   * @param {string} actorId - Actor ID
   * @param {string} stat - Stat name (tier, heat, wanted)
   * @param {number} value - Tooth value
   * @returns {string} Selector
   */
  crewInput: (actorId, stat, value) => {
    const idPrefix = stat === "wanted" ? "wanted-counter" : stat;
    return `#crew-${actorId}-${idPrefix}-${value}`;
  },
  /**
   * Get crew tooth label selector.
   * @param {string} actorId - Actor ID
   * @param {string} stat - Stat name
   * @param {number} value - Tooth value
   * @returns {string} Selector
   */
  crewLabel: (actorId, stat, value) => {
    const idPrefix = stat === "wanted" ? "wanted-counter" : stat;
    return `label.radio-toggle[for="crew-${actorId}-${idPrefix}-${value}"]`;
  },
};

// ============================================================================
// Dialog Selectors
// ============================================================================

/**
 * Dialog related selectors.
 */
export const DIALOGS = {
  /** V2 open dialogs */
  V2_OPEN: "dialog[open]",
  /** V1 dialog apps */
  V1_APP: ".dialog.app",
  /** Radio selection inputs */
  SELECTION_RADIOS: 'input[type="radio"][name="selectionId"]',
};

// ============================================================================
// Security Testing Selectors
// ============================================================================

/**
 * Selectors for security testing (XSS detection, etc.).
 */
export const SECURITY = {
  /** Script elements (should not exist from user input) */
  SCRIPTS: "script",
  /** Images with onerror handlers (XSS vector) */
  DANGEROUS_IMAGES: "img[onerror]",
  /** SVG with onload handlers */
  DANGEROUS_SVG: "svg[onload]",
  /** Elements with onclick handlers from user input */
  ONCLICK_HANDLERS: "[onclick]",
};

// ============================================================================
// Drag and Drop Selectors
// ============================================================================

/**
 * Drag and drop related selectors.
 */
export const DRAG_DROP = {
  /** Generic drop zone (window content or root) */
  DROP_ZONE: ".window-content",
  /** Draggable item */
  DRAGGABLE: "[draggable='true']",
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Build a selector for an element with a specific data attribute.
 * @param {string} attr - Data attribute name (without 'data-' prefix)
 * @param {string} [value] - Optional value to match
 * @returns {string} Selector
 *
 * @example
 * dataAttr("tab", "notes") // returns '[data-tab="notes"]'
 * dataAttr("item-id") // returns '[data-item-id]'
 */
export function dataAttr(attr, value) {
  if (value !== undefined) {
    return `[data-${attr}="${value}"]`;
  }
  return `[data-${attr}]`;
}

/**
 * Build a selector for an input with a specific name.
 * @param {string} name - Input name
 * @param {string} [type] - Optional input type
 * @returns {string} Selector
 *
 * @example
 * inputByName("system.coins") // returns 'input[name="system.coins"]'
 * inputByName("system.coins", "radio") // returns 'input[type="radio"][name="system.coins"]'
 */
export function inputByName(name, type) {
  if (type) {
    return `input[type="${type}"][name="${name}"]`;
  }
  return `input[name="${name}"]`;
}

/**
 * Build a selector for a label targeting a specific input ID.
 * @param {string} id - Input ID
 * @returns {string} Selector
 *
 * @example
 * labelFor("character-abc123-insight-1") // returns 'label[for="character-abc123-insight-1"]'
 */
export function labelFor(id) {
  return `label[for="${id}"]`;
}

/**
 * Build a selector for a label with a partial ID match.
 * @param {string} partial - Partial ID to match
 * @returns {string} Selector
 *
 * @example
 * labelForPartial("insight-1") // returns 'label[for*="insight-1"]'
 */
export function labelForPartial(partial) {
  return `label[for*="${partial}"]`;
}
