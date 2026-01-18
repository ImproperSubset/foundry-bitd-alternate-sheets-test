# BitD Alternate Sheets Test Suite

Quench-based test harness for validating the Blades in the Dark Alternate Sheets module functionality.

## Table of Contents

- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Writing New Tests](#writing-new-tests)
- [Common Patterns](#common-patterns)
- [Skipping Tests](#skipping-tests)
- [Test Utilities](#test-utilities)
- [DOM Selectors](#dom-selectors)
- [Break-to-Verify Methodology](#break-to-verify-methodology)

## Running Tests

### Via Quench UI

1. Launch Foundry VTT with both modules active:
   - `bitd-alternate-sheets` (the module being tested)
   - `bitd-alternate-sheets-test` (this test module)
2. Open Quench test runner from the sidebar
3. Select batch(es) to run

### Via Console

```javascript
// Run all BitD Alternate Sheets tests
quench.runBatches(/^bitd-alternate-sheets\./)

// Run specific batch
quench.runBatches("bitd-alternate-sheets.edit-mode")
quench.runBatches("bitd-alternate-sheets.crew-sheet")
quench.runBatches("bitd-alternate-sheets.xp-teeth")

// Run multiple specific batches
quench.runBatches([
  "bitd-alternate-sheets.edit-mode",
  "bitd-alternate-sheets.drag-drop"
])
```

### Available Test Batches

| Batch ID | Description |
|----------|-------------|
| `bitd-alternate-sheets.acquaintances` | Acquaintance standing cycling |
| `bitd-alternate-sheets.binary-checkboxes` | Binary checkbox interactions |
| `bitd-alternate-sheets.crew-link` | Crew-character linking |
| `bitd-alternate-sheets.crew-member-rerender` | Crew member rerender behavior |
| `bitd-alternate-sheets.crew-sheet` | Crew sheet functionality |
| `bitd-alternate-sheets.drag-drop` | Drag-drop interactions |
| `bitd-alternate-sheets.edit-mode` | Edit mode & mini mode |
| `bitd-alternate-sheets.error-handling` | Error handling & resilience |
| `bitd-alternate-sheets.global-clocks` | Global clock functionality |
| `bitd-alternate-sheets.handlebars-helpers` | Handlebars helper functions |
| `bitd-alternate-sheets.healing-clock` | Healing clock UI |
| `bitd-alternate-sheets.i18n` | Internationalization |
| `bitd-alternate-sheets.notes-tab` | Notes tab functionality |
| `bitd-alternate-sheets.npc-integration` | NPC integration |
| `bitd-alternate-sheets.patches` | System patches |
| `bitd-alternate-sheets.settings` | Module settings |
| `bitd-alternate-sheets.sheet-popups` | Popup dialogs (coins, harm, load) |
| `bitd-alternate-sheets.update-queue` | Update queue behavior |
| `bitd-alternate-sheets.utils-core` | Core utility functions |
| `bitd-alternate-sheets.xp-teeth` | XP teeth interactions |

## Test Structure

### File Organization

```
scripts/
├── test-utils.js        # Shared test utilities
├── test-selectors.js    # Centralized DOM selectors
└── tests/
    ├── README.md        # This file
    ├── edit-mode.test.js
    ├── crew-sheet.test.js
    └── ...
```

### Test File Template

```javascript
/**
 * Quench test batch for [feature description].
 * Tests [what is being tested].
 */

import {
  createTestActor,
  ensureSheet,
  testCleanup,
  TestNumberer,
  skipWithReason,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

const t = new TestNumberer("XX"); // Unique batch number

Hooks.on("quenchReady", (quench) => {
  quench.registerBatch(
    "bitd-alternate-sheets.batch-name",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Section Name", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "Test-Actor-Name",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("test description", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Test implementation
          assert.ok(true, "Assertion message");
        });
      });
    },
    { displayName: "BitD Alt Sheets: Batch Display Name" }
  );
});
```

### TestNumberer

The `TestNumberer` class auto-numbers sections and tests for consistent ordering:

```javascript
const t = new TestNumberer("15"); // Batch prefix

t.section("First Section", () => {
  t.test("first test", ...);  // 15.01.01
  t.test("second test", ...); // 15.01.02
});

t.section("Second Section", () => {
  t.test("another test", ...); // 15.02.01
});
```

## Writing New Tests

### 1. Choose a Unique Batch Number

Check existing test files and pick the next available number:

```javascript
const t = new TestNumberer("24"); // Next available
```

### 2. Use Proper Setup/Teardown

Always use `beforeEach`/`afterEach` with cleanup:

```javascript
beforeEach(async function () {
  this.timeout(10000);
  const result = await createTestActor({ ... });
  actor = result.actor;
});

afterEach(async function () {
  this.timeout(5000);
  await testCleanup({ actors: [actor] });
  actor = null;
});
```

### 3. Set Appropriate Timeouts

- Simple assertions: `5000`ms
- DOM interactions: `8000-10000`ms
- Complex async operations: `15000`ms

### 4. Get the Sheet Root Element

```javascript
const sheet = await ensureSheet(actor);
const root = sheet.element?.[0] || sheet.element;
```

### 5. Wait for Updates

```javascript
import { waitForActorUpdate } from "../test-utils.js";

await waitForActorUpdate(actor, { timeoutMs: 2000 });
```

## Common Patterns

### Testing Click Interactions

```javascript
const button = root.querySelector(".my-button");
assert.ok(button, "Button should exist");

const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 });
button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
await updatePromise;
```

### Testing Radio/Tooth Controls

```javascript
import { applyToothClick, runTeethTest } from "../test-utils.js";

// Direct approach
const result = await applyToothClick({
  actor,
  attribute: "insight",
  value: 3,
});
assert.equal(result.exp, 3, "Exp should update");

// Parameterized helper
await runTeethTest({
  actor,
  attribute: "prowess",
  initialValue: 0,
  clickValue: 2,
  expectedValue: 2,
  expectedLit: [1, 2],
  assert,
});
```

### Testing Popup Dialogs

```javascript
const coinsBox = root.querySelector(".coins-box");
coinsBox.click();
await new Promise(resolve => setTimeout(resolve, 300));

const fullView = coinsBox.querySelector(".full-view");
assert.ok(fullView, "Popup should open");
```

### Testing With Test Abilities

```javascript
import { createTestAbility, createTestAbilities } from "../test-utils.js";

// Single ability
const ability = await createTestAbility({
  actor,
  overrides: {
    name: "Test Ability",
    system: { purchased: true },
  },
});

// Multiple abilities
const abilities = await createTestAbilities({
  actor,
  abilities: [
    { name: "Ability 1", system: { purchased: true } },
    { name: "Ability 2", system: { purchased: false } },
  ],
});
```

### XSS Security Testing

```javascript
import { COMMON_XSS_PAYLOADS } from "../test-utils.js";

for (const payload of COMMON_XSS_PAYLOADS) {
  await actor.update({ "system.notes": payload });
  await sheet.render(true);

  const scripts = root.querySelectorAll("script");
  assert.equal(scripts.length, 0, `XSS payload should not execute: ${payload}`);
}
```

## Skipping Tests

### When to Skip

Only skip tests for **Foundry version-dependent features**:

```javascript
// ✅ Good - Version-specific API
if (!foundry.applications?.api?.DialogV2) {
  skipWithReason(this, "Requires Foundry V13+ (DialogV2 API)");
  return;
}

// ❌ Bad - Fixable setup issue
if (!actor.items.size) {
  this.skip(); // Don't do this - create the items instead
}
```

### Skip Helper

```javascript
import { skipWithReason } from "../test-utils.js";

t.test("V13 feature test", async function () {
  if (!foundry.applications?.api?.DialogV2) {
    skipWithReason(this, "Requires Foundry V13+ (DialogV2 API)");
    return;
  }
  // Test implementation
});
```

The helper logs `[SKIP] TestName: Reason` to the console for easy filtering.

## Test Utilities

### Core Utilities (`test-utils.js`)

| Function | Description |
|----------|-------------|
| `createTestActor(options)` | Create character actor with playbook |
| `createTestCrewActor(options)` | Create crew actor with crew type |
| `createTestAbility(options)` | Create ability item on actor |
| `ensureSheet(actor)` | Open and return actor sheet |
| `waitForActorUpdate(actor, opts)` | Wait for actor update hook |
| `testCleanup(options)` | Clean up actors, dialogs, settings |
| `skipWithReason(context, reason)` | Skip test with console logging |
| `TestNumberer` | Auto-number sections/tests |

### Assertion Helpers

| Function | Description |
|----------|-------------|
| `assertExists(assert, value, msg)` | Assert value is not null/undefined |
| `assertNotEmpty(assert, array, msg)` | Assert array has elements |

### Parameterized Test Helpers

| Function | Description |
|----------|-------------|
| `runTeethTest(options)` | Run character XP teeth test |
| `runCrewTeethTest(options)` | Run crew stat teeth test |
| `runClockClickTest(options)` | Run clock click test |
| `runClockRightClickTest(options)` | Run clock right-click test |

### Constants

| Constant | Description |
|----------|-------------|
| `COMMON_XSS_PAYLOADS` | Array of XSS test strings |
| `DEFAULT_ABILITY_DATA` | Template for test abilities |

## DOM Selectors

Import from `test-selectors.js`:

```javascript
import { SHEET, EDIT_MODE, POPUP, CLOCKS } from "../test-selectors.js";

const wrapper = root.querySelector(SHEET.WRAPPER);
const editToggle = root.querySelector(EDIT_MODE.TOGGLE);
const coinsBox = root.querySelector(POPUP.COINS.BOX);
```

### Available Selector Groups

- `SHEET` - Sheet structure (wrapper, window-content)
- `EDIT_MODE` - Edit mode toggle and states
- `MINI_MODE` - Mini mode elements
- `POPUP` - Coins, Harm, Load popup selectors
- `TABS` - Tab navigation
- `NOTES` - Notes tab elements
- `ACQUAINTANCES` - Contact/acquaintance elements
- `ITEMS` - Item and ability elements
- `CREW` - Crew sheet specific elements
- `CLOCKS` - Clock elements
- `TEETH` - XP teeth/radio toggles
- `DIALOGS` - Dialog elements
- `SECURITY` - Security testing selectors
- `DRAG_DROP` - Drag and drop elements

### Utility Functions

```javascript
import { dataAttr, inputByName, labelFor } from "../test-selectors.js";

dataAttr("tab", "notes")     // '[data-tab="notes"]'
inputByName("system.coins")  // 'input[name="system.coins"]'
labelFor("my-input-id")      // 'label[for="my-input-id"]'
```

## Break-to-Verify Methodology

Every new test should be verified using this process:

1. **Run tests** → Confirm all pass
2. **Break source code** → Make a targeted change that should fail
3. **Confirm test catches** → Test should now fail
4. **Restore source** → Undo the break

### Example

```javascript
// Testing that clicking tooth 3 sets exp to 3

// 1. Test passes normally
// 2. Break: Change source to always set exp to 0
// 3. Test fails: "Expected 3 but got 0"
// 4. Restore: Undo the change
// 5. Test passes again
```

This ensures the test is actually testing what you think it's testing.

---

## Contributing

When adding new tests:

1. Follow the file template structure
2. Use `TestNumberer` for consistent ordering
3. Import utilities from `test-utils.js`
4. Use selectors from `test-selectors.js`
5. Only skip for version-dependent features
6. Verify with break-to-verify methodology
7. Run the full suite before submitting
