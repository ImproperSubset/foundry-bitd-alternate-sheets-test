# Blades Alternate Sheets Test Harness

Local-only helper module for automated checks against `bitd-alternate-sheets`.

## Usage

1. Install this module alongside `bitd-alternate-sheets` and enable it in your test world.
2. In the browser console (or via automation), run:

```js
await game.modules.get("bitd-alternate-sheets-test").api.runTeethTest({
  playbookName: "Cutter",
  cleanup: true,
});
```

Returns `{ ok, assertions, classCheck, ... }` and deletes the test actor by default.

3. Or run with console reporting:

```js
await game.modules.get("bitd-alternate-sheets-test").api.runTeethTestWithReport({
  playbookName: "Cutter",
  cleanup: true,
});
```

This logs a summary + assertion table to the console and shows a UI notification.

## UI Button

A GM-only "Run BitD Alt Teeth Test" button (vial icon) is added to the Token controls.

## Notes

- This module depends on `bitd-alternate-sheets` and the Blades system.
- It creates a temporary actor and uses the alternate sheet UI to drive tests.
