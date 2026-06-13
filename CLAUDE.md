# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm run build        # Compile TypeScript (tsc --locale zh-CN)
npm run watch        # Watch mode compilation
npm run clean        # Remove dist/
npm test             # Run all tests (vitest run)
npm run test:watch   # Watch mode tests (vitest)
```

### Test Conventions

- **`*.test.tsx`** — uses jsdom environment via `@testing-library/react`. Ink's `useInput` is mocked so tests dispatch synthetic key events through a captured handler.
- **`*.ink.test.ts` / `*.ink.test.tsx`** — uses node environment via `ink-testing-library` for real Ink rendering tests.
- Tests live in `src/__tests__/` mirroring the source structure.
- Screen system tests call `clearRegistry()` in `beforeEach` and `clearDispatchers()` (if module-level navigation is used) to isolate test runs.
- Keyboard provider tests should clear captured `useInput` handlers and reset vi mocks in `afterEach`.

### Key Test Patterns

```tsx
// Mock useInput to capture the handler
vi.mock('ink', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useInput: (handler) => { capturedInputHandler = handler; } };
});

// Dispatch a key press
act(() => pressKey('s', {}));

// Register components before each test
registerComponent(Menu, {});
registerComponent(Game, {}, { parent: Menu });
```

## Architecture Overview

This is `@baigao_h/ink-kit` — a React Ink component kit for building terminal UIs. Built with **no third-party state management library** — all state is React context + `useReducer`/`useRef`.

### Core Systems (3 pillars)

**1. Screen System** (`src/screen/`)
- Tree-based screen navigation using a component registry.
- `registerComponent(Component, template, { parent })` builds a navigation tree.
- Navigation: `skip()` (down to child), `back()` (up to parent, supports `levels` param), `gotoScreen()` (jump across branches via LCA), `overlay()` / `closeOverlay()` (floating dialogs on top of stack).
- All navigation functions work both as React hooks (`useScreenSystem()`) and as **module-level imports** — module-level functions dispatch through a shared `_dispatchers` Set (supports multi-instance scenarios).
- `ScenarioManagementProvider` wraps the app with a `useReducer`-based state machine.
- `CurrentScreen` renders the active screen component (and overlay if open).
- Registry (`src/screen/registry.ts`) is a module-level `Map<Component, RegistryEntry>` with parent/child tracking.

**2. Keyboard System** (`src/keyboard/`)
- Per-screen-layer key bindings stored in `useRef<Map<Component, ScreenKeyboardLayer>>`.
- Event priority chain: `globalKeys(affectOverlay:true)` → overlay layer → `globalKeys(affectOverlay:false)` → screen stack (top to bottom).
- Key mechanisms:
  - `blockedKey()` (called `penetration` internally) — marks keys as transparent, allowing them to pass through the current layer.
  - `stop()` — prevents matching keys from propagating to lower layers. Supports `stopAction` mode to block by shortcut action ID.
  - `globalKeys()` — register shortcuts independent of the screen stack, with `cover`, `category`, and `affectOverlay` options.
  - `boundKeyboard()` — register per-screen key bindings. Supports `focusId`, `onlyThis`, `once`, and `times` options.
- Focus system: `useFocusState(focusId)`, `focusSet()`, `focusNext()`, `focusPrev()`, `focusCurrent()`, `focusUnregister()`. Tab/Shift+Tab cycle through focus targets within a layer.
- Shortcut actions via `defineShortcutAction()` / `addAction()` / `hasAction()` / `removeAction()` / `modifyAction()` — decouple operation definition from key binding.
- **Key constraint**: `KeyboardProvider` must be nested inside `ScenarioManagementProvider`.

**3. Component Library** (`src/components/`)
- Independent components, each in its own folder with a `README.md`.
- All interactive components (SelectInput, TextInput, etc.) integrate with the keyboard focus system via `focusId`.
- Form system (`Form` + `Field`) uses React context for validation state, supports Ctrl+Enter submit.
- `ConfirmDialog` is designed for the overlay system.

### Supporting Systems

- **Theme System** (`src/theme/`): `ThemeProvider` + `useTheme` hook, with CLI codegen for type-safe themes.
- **I18n System** (`src/language/`): `LanguageProvider` + `useI18n` hook, with `t()` translation, interpolation, and CLI codegen for type-safe translation keys.
- **CLI** (`src/cli/`): `ink-kit init` (scaffold), `initTheme`, `makeLanguageType`, `makeThemeType`.

### Output Structure

- TypeScript source in `src/`, compiled to `dist/` via `tsc`.
- `src/index.ts` is the package entry point, re-exporting all public APIs.

### CI/CD

- GitHub CI runs `npm ci` → `npm run build` → `npm test` on Node 22 & 24 for pushes/PRs to `main` and tags.
- On GitHub release publish: builds and publishes to npm (with idempotency check to skip already-published versions).
# AGENTS.md

## Stack
- TypeScript 5.9, strict mode, Node16 modules, ES2022 target, JSX (`"jsx": "react"`)
- React 19 + Ink 7 (terminal UI framework)
- vitest 4.x with `@testing-library/react` + `ink-testing-library`
- No third-party state management — all React context + `useReducer`/`useRef`

## Commands
```bash
npm run build       # tsc --locale zh-CN
npm run watch       # tsc --watch --locale zh-CN
npm run test        # vitest run
npm run test:watch  # vitest
npm run clean       # rm -rf dist
```

Layout

· src/screen/ — tree-based screen navigation: register, skip, back, gotoScreen, overlay
· src/keyboard/ — layered keyboard events with focus management and shortcut actions
· src/components/ — SelectInput, MultiSelectInput, TextInput, NumberInput, SearchInput, ConfirmDialog, Spinner, ProgressBar, Divider, Badge, KeyHint, Tabs, Fold, Form (Field + context)
· src/storage/ — typed JSON key-value persistence (createStorage)
· src/binary-storage/ — sequential binary FIFO persistence (createBinaryStorage)
· src/cli/ — ink-kit CLI (init, initTheme, makeLanguageType, makeThemeType)
· src/language/ — i18n: LanguageProvider + useI18n hook
· src/theme/ — theming: ThemeProvider + useTheme hook
· src/index.ts — public API barrel export
· src/__tests__/ — tests organized by subsystem
· dist/ — build output (.gitignored)

Architecture

Screen System (src/screen/)

· Tree-based navigation via registerComponent(Component, template, { parent }).
· Navigation: skip() (down to child), back() (up to parent, supports levels), gotoScreen() (jump via LCA), overlay() / closeOverlay() (floating dialogs).
· All nav functions work as React hooks and as module-level imports (_dispatchers Set).
· ScenarioManagementProvider wraps the app; CurrentScreen renders the active screen.

Keyboard System (src/keyboard/)

· KeyboardProvider MUST be nested inside ScenarioManagementProvider.
· Priority chain: globalKeys(affectOverlay:true) → overlay → globalKeys(affectOverlay:false) → screen stack (top to bottom).
· Key mechanisms: boundKeyboard() (per-screen), blockedKey() (pass-through, confusingly named), stop(), globalKeys().
· Focus: useFocusState(focusId), Tab/Shift+Tab cycling, focusSet/focusNext/focusPrev/focusUnregister.
· Shortcut actions: defineShortcutAction/addAction/hasAction/removeAction/modifyAction.

Component Library (src/components/)

· 14 components, each in its own folder. All interactive ones use focusId.
· Form system (Form + Field + useFormContext) with validation context, Ctrl+Enter submit.

Test Conventions

Core principles

· No “happy path only” tests. Every test must exercise a behaviour that could realistically break: edge cases, failure modes, state transitions, or regressions. A test that never fails is worse than no test — it creates false confidence.
· Coverage must be comprehensive. For every feature, include:
  · Normal behaviour (the primary use case)
  · Edge cases (empty lists, null/undefined, max/min values, overflow, zero, negative numbers)
  · Error paths (invalid inputs, precondition failures, thrown exceptions)
  · Boundary conditions (off‑by‑one neighbours, first/last element, scroll boundaries)
  · Concurrency / race conditions (when applicable)
  · Resource cleanup (unmount, cancellation, abort signals)
· No “test the framework” — do not test that React, Ink, or Node built‑ins work. Test your logic.
· Each test must have a clear reason to exist. If you cannot describe what behaviour the test locks down and why that behaviour matters, delete the test.

Test file conventions

· *.test.tsx — jsdom via @testing-library/react; mock useInput to capture+dispatch synthetic keys.
· *.ink.test.ts(x) — node environment via ink-testing-library for real Ink rendering (no DOM emulation).
· clearRegistry() in beforeEach; clearDispatchers() for module-level navigation isolation.
· Test configuration in vitest.config.ts — default jsdom, with environmentMatchGlobs mapping *.ink.test.* to node.

Good test example (covers edge cases and failures)

```ts
describe('NumberInput', () => {
  it('does not go below min', async () => {
    const onChange = vi.fn();
    renderNumberInput({ value: 0, min: 0, onChange });
    await pressKey('down');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('handles NaN value gracefully', async () => {
    const onChange = vi.fn();
    renderNumberInput({ value: NaN, onChange });
    await pressKey('up');
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
```

Bad test example (happy only, useless)

```ts
test('increments value', () => {
  const { result } = renderHook(() => useState(0));
  act(() => result.current[1](1));
  expect(result.current[0]).toBe(1);
});
// This tests nothing about the component, just that useState works.
```

TDD Workflow

This project follows test‑driven development (TDD) for implementing new features and fixing bugs.

· Before writing any implementation code, write a failing test that describes the desired behaviour.
· Then write the minimal code to make that test pass.
· Refactor only after the test passes, and only with the test suite still green.
· The .reasonix/skills/tdd/ directory contains detailed TDD skills (deep modules, interface design, mocking, refactoring, tests). Load these skills when starting a TDD cycle.

When to load TDD skills

· Starting a new feature or component → load tdd skill to guide the red‑green‑refactor loop.
· Refactoring existing code → load tdd/refactoring.md and tdd/tests.md.
· Designing a public interface → load tdd/interface-design.md and tdd/deep-modules.md.

Planning & Communication

Before executing any plan

When you (the agent) are about to implement a plan proposed by the user, restate your understanding of the plan back to the user. This ensures there is no misalignment.

Use the following pattern:

“I understand the plan as: [concise summary of what we will do, in what order, and what the expected outcome is]. Is this correct, or is there any deviation?”

If the user’s description is unclear, ambiguous, or missing details, load the grill-me skill from .reasonix/skills/grill-me/. This skill will interview the user with one question at a time until the plan is fully clarified.

Coding Conventions

JSX is mandatory; React.createElement is forbidden

All new code MUST use JSX syntax. The legacy React.createElement calls that exist in a few components (e.g., SelectInput, MultiSelectInput defaults) are historical and will not be rewritten, but do not introduce new createElement usages.

✅ Correct (JSX)

```tsx
return (
  <Box flexDirection="column">
    <Text>Hello</Text>
  </Box>
);
```

❌ Wrong (React.createElement)

```tsx
return React.createElement(Box, { flexDirection: 'column' },
  React.createElement(Text, null, 'Hello')
);
```

Type safety

· Avoid any at all costs. If you must use any, add a comment explaining why no safer alternative exists and which invariants you are asserting.
· Avoid type assertions (as). If you must use as, add a comment explaining why the assertion is safe (e.g., “we just checked typeof value === 'string', so this cast is safe”).
· Prefer unknown over any for values with truly unknown shapes, then narrow via type guards.
· If you cannot find a way to make the type safe (e.g., due to complex generics or third‑party untyped data), ask the user before writing unsafe code. Propose a design that could be type‑safe and get approval.

✅ Correct (safe, no assertion)

```ts
if (typeof value === 'string') {
  // value is now `string` – no assertion needed
  processString(value);
}
```

✅ Acceptable (assertion with explanation)

```ts
// This assertion is safe because we validated the object shape with `isValidTheme` above.
const theme = data as ThemeDefinition;
```

❌ Wrong (unsafe any without comment)

```ts
const result: any = apiResponse;
```

No over‑engineering / premature optimisation

· Do not add abstractions, design patterns, or performance optimisations “just in case”. Write the simplest code that makes the tests pass.
· Avoid creating generic utilities, hooks, or components until the same pattern appears at least three times. Two similar usages may be coincidental; wait for the third to justify extraction.
· Do not optimise for hypothetical future requirements. Only optimise based on measured performance issues.
· If you believe a refactor or optimisation is genuinely needed (e.g., a component has become too large, a repeated pattern now appears three times, or a performance issue is identified), you MUST ask the user for permission first. Do not assume the user wants it, even if it seems obvious.

How to ask:
“I noticed that [describe the issue]. I think we could [proposed refactor/optimisation]. This would [benefit]. Should I proceed with this change?”

Wait for explicit approval (e.g., “yes”, “go ahead”, “do it”) before making any non‑trivial structural change or optimisation.

Error handling

· All asynchronous operations must handle errors. Use try/catch with .catch() or proper catch blocks.
· Provide meaningful error messages that help the user understand what went wrong and, if possible, how to fix it.
· Use a consistent error prefix: [ink-router-kit] (note: the project name is ink-router-kit, not ink-kit – align with existing error prefixes in the codebase).
· For edge‑case errors where the correct behaviour is ambiguous (e.g., should we throw, log, or silently recover?), ask the user which behaviour they prefer before writing the error handling code.

✅ Correct (caught and reported)

```ts
try {
  await riskyOperation();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  throw new Error(`[ink-router-kit] Failed to load config: ${message}`);
}
```

❌ Wrong (silent failure)

```ts
await riskyOperation(); // unhandled rejection
```

React performance guidelines

· Follow React’s rules of hooks: call hooks only at the top level, only inside React function components or custom hooks.
· Dependency arrays must be complete and correct. Include every value that the effect/callback/memo refers to from the component scope. Do not lie about dependencies.
· Use useCallback and useMemo when necessary:
  · Functions passed as props to child components that rely on referential equality (e.g., inside useEffect dependencies) should be memoised with useCallback.
  · Expensive computations should be memoised with useMemo.
  · Do not wrap every function in useCallback — only when it provides a measurable benefit or stabilises a dependency chain.
· Avoid stale closures. Be especially careful with useEffect that references state or props — include them in the dependency array, or use refs if you intentionally want the latest value without re‑running the effect.

✅ Correct (complete dependencies)

```ts
useEffect(() => {
  console.log(value);
}, [value]); // value is declared as a dependency
```

❌ Wrong (missing dependency)

```ts
useEffect(() => {
  console.log(value);
}, []); // value changes but effect never re-runs
```

Focus target lifecycle

Separate focusUnregister from the keyboard binding useEffect. The binding effect may re-run on value changes; focusUnregister only on unmount.

```tsx
const focusIdRef = useRef(focusId);
focusIdRef.current = focusId;
useEffect(() => {
  return () => focusUnregister(focusIdRef.current);
}, []); // mount/unmount only

useEffect(() => {
  // boundKeyboard(...)
  return () => { /* unbind keyboard handlers only */ };
}, [value]);
```

Callback refs in empty-deps effects

```tsx
const onCancelRef = useRef(onCancel);
onCancelRef.current = onCancel;
useEffect(() => {
  return boundKeyboard(['escape'], () => onCancelRef.current());
}, []);
```

Defaults for prop accessors

All props accessed via .length / .map() must have runtime defaults:

```tsx
function KeyHint({ keys = [] }: Props) { ... }
function TextInput({ value = '' }: Props) { ... }
```

globalKeys mode

Use { mode: 'add' } when registering alongside other consumers. Default (replace) silently deletes entries from other components.

Mount guard for async operations

```tsx
const mountedRef = useRef(true);
useEffect(() => { return () => { mountedRef.current = false; }; }, []);
```

Hook encapsulation rule

When the same useEffect + useRef pattern appears in 3+ components, extract it into a custom hook. (Note: the focusUnregister pattern exists in 8+ components but hasn't been extracted yet — a candidate for useFocusLifecycle.)

File naming conventions

· Component files (those that export a React component) use PascalCase.tsx – e.g., SelectInput.tsx, ConfirmDialog.tsx.
· Non‑component files (utilities, types, contexts, hooks, test helpers) use camelCase.ts – e.g., registry.ts, binaryStorage.ts, makeLanguageType.ts.
· Test files follow the same naming as the file they test, plus .test.ts or .ink.test.tsx.

Documentation must stay in sync

· When you change a public API (function signature, component prop, type export, class method), you must update the corresponding README.md or relevant documentation file.
· Do not leave documentation outdated – a user (or another agent) reading the docs should always see the current behaviour.
· For components, update the component’s README.md in its folder (e.g., src/components/select/README.md).
· For top‑level APIs, update README.md in the project root.
· If a change does not affect any existing documentation (e.g., fixing a bug that was never documented), no doc update is required.

Comment conventions

1. No decorative comments or separators

Do not use any comments that serve only visual decoration or code sectioning. This includes but is not limited to:

· // ==================
· // ---------------------
· // ── or // ══
· Any line consisting of repeated characters intended as a visual divider.

Comments must explain why the code is written a certain way, not restate what the code does (the code itself already says “what”).

✅ Correct (explains why)

```ts
// We use a ref here because the callback must be stable across re-renders,
// but the actual value may change. Storing it in a ref prevents unnecessary
// re-binding of the keyboard handler.
const onCancelRef = useRef(onCancel);
```

❌ Wrong (decorative separator)

```ts
// ─────────────────────────────────────────────
// Component rendering
// ─────────────────────────────────────────────
```

❌ Wrong (states “what”)

```ts
// Set the value to 42
setValue(42);
```

2. Comments must explain “why”, not “what”

When the intent of the code is not obvious or involves non‑trivial design decisions, add a comment explaining why it is implemented that way. If the code is already self‑explanatory (through good naming and structure), the comment can be omitted.

✅ Correct (explains design decision)

```ts
// We cannot use the regular `focusSet` here because the overlay may not
// be mounted yet. Instead, we defer focus via a ref.
deferredFocusRef.current = focusId;
```

❌ Wrong (repeats code information)

```ts
// Increment the counter
counter++;
```

3. Internal implementation details must have clear, useful comments

For complex logic, non‑obvious edge cases, performance optimisations, or concurrency controls, always add comments explaining the underlying principles and important caveats.

✅ Correct (explains internal complexity)

```ts
// The write queue is a promise chain. We use `.then(task, task)` so that
// even if a previous write rejects, the next write still executes.
// Without the second argument, a rejection would break the chain forever.
this.pending = this.pending.then(task, task);
```

4. Public API must have English JSDoc comments

Every public function, component, type, or constant exported from src/index.ts must have an English JSDoc comment that includes:

· A short description of what the API does
· Parameter descriptions (@param)
· Return value description (@returns)
· Possible errors thrown (@throws)
· Usage example (@example, when necessary)
· Boundary behaviour (e.g., behaviour when a certain parameter is undefined)

✅ Correct (complete public API JSDoc)

```ts
/**
 * Register a component as a screen in the navigation tree.
 *
 * @param component - The React component (used as the unique token).
 * @param template  - Default props for the component.
 * @param options   - Optional registration options (e.g. `parent`).
 * @throws {Error} If the component has already been registered.
 * @example
 * ```tsx
 * registerComponent(Menu, {});
 * registerComponent(Game, { level: 1 }, { parent: Menu });
* ```
*/
export function registerComponent<C extends React.ComponentType<any>>(
component: C,
template: React.ComponentProps<C>,
options?: RegisterOptions,
): void;

```

❌ **Wrong (missing or one‑line comment)**
```ts
// Register a component
export function registerComponent(...) { ... }
```

5. Timestamp large comment blocks

Any comment block (// or /* */) spanning **more than 5 lines** MUST end with a timestamp line showing the date (day precision) and the project version from `package.json`.  Single‑line and short (≤ 5‑line) comments are exempt.

Format:
```
// @2026-06-14 v3.1.0
```
or, inside a JSDoc block:
```
 * @2026-06-14 v3.1.0
 */
```

✅ Correct (6‑line // block with timestamp)

```ts
// The write queue is a promise chain. We use `.then(task, task)` so
// that even if a previous write rejects, the next write still executes.
// Without the second argument, a rejection would break the chain forever.
// This is critical because the queue is shared across all writers and
// one failing writer must not block subsequent writes.
// @2026-06-14 v3.1.0
this.pending = this.pending.then(task, task);
```

✅ Correct (multi‑line JSDoc with timestamp)

```ts
/**
 * Handle a keyboard event against a single layer.
 *
 * Evaluates tab navigation, blocked keys, sequence matching,
 * focus-target bindings, layer-level bindings, and stopped keys
 * — in that order.
 *
 * @returns true if the event was consumed by this layer.
 * @2026-06-14 v3.1.0
 */
function handleLayer(...): boolean { ... }
```

❌ Wrong (8‑line comment block, missing timestamp)

```ts
// We need to iterate in reverse order because the keyboard event
// must be offered to the topmost layer first. If the top layer
// does not handle the key, we try the next one below it and so
// on until someone consumes it or we run out of layers.
// The reverse loop also correctly handles the case where a layer
// is removed mid-iteration.
for (let i = path.length - 1; i >= 0; i--) { ... }
```

Watch out for

· blockedKey means pass-through (penetration), NOT "block". Makes keys transparent to lower layers.
· _dispatch is set in useEffect — unavailable during componentDidCatch. Error boundaries calling overlay() will find _dispatch is null.
· clearShortcutOperations is a no-op at module level — keyboard state is per-instance via useRef.
· ScenarioManagementProvider nested first, then KeyboardProvider inside it. Reversed silently breaks keyboard.
· Overlay auto-closes on skip/back/gotoScreen (handled in reducer).
· Double < in TSX generics: useRef<<T> is parsed as JSX — must be useRef<T> (single).

CI/CD

· GitHub CI: npm ci → npm run build → npm test on Node 22 & 24 for pushes/PRs to main and tags.
· On GitHub release publish: idempotency check → npm publish --access public.

