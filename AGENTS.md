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

JSX over React.createElement

New components MUST use JSX. Existing React.createElement in SelectInput and MultiSelectInput defaults is legacy — do NOT use it for new code.

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

