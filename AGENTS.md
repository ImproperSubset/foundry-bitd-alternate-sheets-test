# Repository Guidelines

This repository is a small Foundry VTT helper module used to drive automated checks for `bitd-alternate-sheets`. Keep changes focused on test harness behavior and Foundry integration. This is local-only support code; do not ship it with the main module.

## Project Structure & Module Organization
- `module.json`: Foundry module manifest, compatibility, and dependency declarations.
- `scripts/module.js`: Main ES module that exposes the test helper API via `game.modules`.
- `README.md`: Usage examples for manual/automated checks.
- No dedicated `tests/` or `assets/` directories are present today.

## Build, Test, and Development Commands
There is no build step or package manager in this repo. Development happens in Foundry:
1. Install this module alongside `bitd-alternate-sheets` and enable it in a test world.
2. Run the harness from the browser console (or automation):
```js
await game.modules.get("bitd-alternate-sheets-test").api.runTeethTest({
  playbookName: "Cutter",
  cleanup: true,
});
```
This returns `{ ok, results }` and removes the temporary actor when `cleanup` is true.

If you add a Playwright runner later, keep it optional and wired to an existing Chrome debug port (no new browser launches).

## Test Helper API
- `createTestActor({ name, playbookName })`: creates a character and applies a class/playbook.
- `runTeethTest({ playbookName, cleanup })`: clicks Insight/Prowess/Resolve XP teeth (values 1 and 3) and asserts updates.

## Coding Style & Naming Conventions
- JavaScript only, ES module syntax, with Foundry globals like `game`, `Hooks`, and `ui`.
- Indentation is 2 spaces; keep semicolons and trailing commas consistent with existing code.
- Use `const` by default and `let` only when reassigning.
- Constants use `UPPER_SNAKE_CASE`; functions and variables use `camelCase`.

## Testing Guidelines
- No automated test framework is configured.
- Validate changes by running the console snippet above and confirming `ok: true`.
- If adding new helpers, include a short example in `README.md`.

## Commit & Pull Request Guidelines
- The git history has no commits yet, so no established commit message convention exists.
- When committing, use a concise, imperative subject (e.g., "Add actor cleanup guard").
- PRs should include: a brief summary, how to reproduce in Foundry, and any module/system version notes.

## Dependencies & Configuration Notes
- Requires Foundry VTT (module compatibility in `module.json`) and the Blades system.
- Depends on the `bitd-alternate-sheets` module being active; warn users if it is inactive.
