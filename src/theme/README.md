# Theme System

`ink-kit` provides a lightweight theming system via `ThemeProvider` and the `useTheme` hook. Supports JSON theme files or inline objects, multi-theme switching, and hot-reloading via `mergeTheme`. Combine with `ink-kit makeThemeType` CLI for compile-time type-safe theme keys.

---

## Quick Start

```tsx
import React, { useState } from 'react';
import { Box, Text, render, useInput } from 'ink';
import { ThemeProvider, useTheme } from '@baigao_h/ink-kit';

function MyApp() {
  const { color, style, themeId, themes, setTheme } = useTheme();
  const [idx, setIdx] = useState(themes.indexOf(themeId));

  useInput((input, key) => {
    if (key.escape || input === 'q') process.exit(0);
    if (input === 't') {
      const next = (idx + 1) % themes.length;
      setIdx(next);
      setTheme(themes[next]);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={color('primary') ?? 'white'}>
        {themeId} theme
      </Text>
      <Text color={color('muted')}>
        Press T to switch theme
        ({themes.join(', ')})
      </Text>
    </Box>
  );
}

render(
  <ThemeProvider path="./themes" defaultTheme="dark">
    <MyApp />
  </ThemeProvider>,
);
```

---

## Installation

No additional dependencies — built into `@baigao_h/ink-kit`.

---

## Theme File Format

JSON files named by theme id (e.g. `dark.json`, `light.json`):

```json
{
  "id": "dark",
  "primary": "cyan",
  "bg": "black",
  "muted": "gray",
  "danger": "red",
  "success": "green",
  "titleBold": true,
  "textDim": false
}
```

- The **`id`** field is required and must be a string — it becomes the theme identifier used with `setTheme()`.
- All other keys are **flat** key-value pairs where values are either a **color name** (string) or a **style flag** (boolean). Ink color names like `cyan`, `greenBright`, `gray` are valid; see the [Ink color docs](https://github.com/vadimdemedes/ink#colors).
- **All theme files must have identical keys** (excluding `id`). If `dark.json` has a key `accent` but `light.json` does not, `ThemeProvider` throws a runtime error at mount. This guarantees that every key is always defined in every theme.

---

## API Reference

### ThemeProvider

```tsx
<ThemeProvider
  path="./themes"
  themes={[{ id: 'dark', primary: 'cyan' }]}
  defaultTheme="dark"
>
  {children}
</ThemeProvider>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| path | `string` | — | Directory path containing `{id}.json` files. Read synchronously at mount |
| themes | `ThemeDefinition[]` | — | Inline theme definitions. Alternative to `path` |
| defaultTheme | `string` | first available id | Theme to activate on mount |

At least one of `path` or `themes` must be provided.

### useTheme

```tsx
const {
  color,
  style,
  themeId,
  themes,
  setTheme,
  mergeTheme,
  addThemes,
} = useTheme();
```

**Must be used inside `<ThemeProvider>`**, otherwise throws an error.

---

#### color

```tsx
color(key: string): string | undefined
```

Get a color value from the current theme. Returns the raw string value (e.g. `'cyan'`, `'greenBright'`) if the key exists and its value is a string, otherwise returns `undefined`.

```tsx
color('primary')  // → 'cyan'    (set in theme JSON)
color('missing')  // → undefined (key doesn't exist)
color('titleBold')// → undefined (it's a boolean, not a color)
```

Use with Ink's `color` prop:

```tsx
<Text color={color('primary') ?? 'white'}>Hello</Text>
```

The `??` fallback is recommended to satisfy TypeScript when the key may not exist.

---

#### style

```tsx
style(key: string): boolean | undefined
```

Get a boolean style value from the current theme. Returns `true` or `false` if the key exists and its value is a boolean, otherwise returns `undefined`.

```tsx
style('titleBold')  // → true      (set in theme JSON)
style('nope')       // → undefined (key doesn't exist)
style('primary')    // → undefined (it's a string, not a boolean)
```

Use with Ink's style props:

```tsx
<Text bold={style('titleBold') ?? false}>Title</Text>
```

---

#### setTheme

```tsx
setTheme(id: string): void
```

Switch to a different theme by its id. All components consuming `useTheme()` re-render automatically.

```tsx
setTheme('light');
```

Throws if the requested theme id is not available.

---

#### mergeTheme

```tsx
mergeTheme(paths: string[]): void
```

Merge additional theme files from one or more directory paths into the current themes. Later paths override earlier paths when the same key exists in multiple sources for the same theme id.

```tsx
mergeTheme(['./mod-a', './mod-b']);
```

- Only themes whose id **already exists** in the current set are merged; new ids are ignored.
- Useful for game modding, where mods can overlay their own theme values on top of base themes.
- Triggers re-render of all consumers.
- Works with both `path`-mode and `themes`-mode providers.

#### addThemes

```tsx
addThemes(paths: string[]): void
```

Add new themes from one or more directory paths. Unlike `mergeTheme`, this adds **brand new** themes to the pool rather than updating existing ones.

```tsx
addThemes(['./expansion', './dlc-themes']);
```

**Edge case behavior:**

| Scenario | Behavior |
|----------|----------|
| Same filename in multiple paths | Later path overwrites earlier (filename-based dedup) |
| Same id as an existing base theme | Throws immediately — use `mergeTheme` to update existing themes |
| Different filenames with the same id within the batch | Throws — theme ids must be unique |
| Missing keys vs. existing themes | Throws — all themes must have identical key sets |
| Extra keys vs. existing themes | Throws — all themes must have identical key sets |
| Empty base (no themes loaded yet) | All keys accepted; the first added theme defines the key set |

- Triggers re-render of all consumers.
- Works with both `path`-mode and `themes`-mode providers.
- Added themes can later be merged via `mergeTheme` like any base theme.
- No theme is auto-selected when adding into an empty provider; call `setTheme()` explicitly.

**Example: adding a DLC theme pack**

```tsx
function Game() {
  const { addThemes, setTheme, themes } = useTheme();

  useEffect(() => {
    // DLC pack provides brand new themes that don't exist in base
    addThemes(['./dlc/cyberpunk-themes']);
  }, []);

  return (
    <Box>
      {themes.map(id => (
        <Text key={id} onPress={() => setTheme(id)}>{id}</Text>
      ))}
    </Box>
  );
}
```

The DLC pack directory might contain:

```
./dlc/cyberpunk-themes/
├── neon.json        → { "id": "neon", "primary": "magenta", "bg": "#0a0a2e", "titleBold": true }
└── matrix.json      → { "id": "matrix", "primary": "green", "bg": "black", "titleBold": false }
```

Both must have keys identical to the base themes (`primary`, `bg`, `titleBold`).

#### themeId

```tsx
themeId: string
```

The currently active theme id.

#### themes

```tsx
themes: string[]
```

List of all available theme ids.

---

## Examples

### Inline Themes

```tsx
<ThemeProvider
  themes={[
    { id: 'dark', primary: 'cyan', bg: 'black', titleBold: true },
    { id: 'light', primary: 'blue', bg: 'white', titleBold: false },
  ]}
  defaultTheme="dark"
>
  <App />
</ThemeProvider>
```

### Switching Theme via Keybinding

```tsx
function ThemeSwitcher() {
  const { themeId, themes, setTheme } = useTheme();
  const [idx, setIdx] = useState(themes.indexOf(themeId));

  useInput((input) => {
    if (input === 't') {
      const next = (idx + 1) % themes.length;
      setIdx(next);
      setTheme(themes[next]);
    }
  });

  return <Text>Theme: {themeId}</Text>;
}
```

### Merging Mod Themes

```tsx
function Game() {
  const { mergeTheme } = useTheme();

  useEffect(() => {
    // Load a mod that overrides primary and bg colors for the dark theme
    mergeTheme(['./mods/cyberpunk-theme']);
  }, []);

  return <App />;
}
```

Mod file `./mods/cyberpunk-theme/dark.json`:

```json
{
  "id": "dark",
  "primary": "magenta",
  "bg": "#1a0033"
}
```

Only `primary` and `bg` are overridden; all other keys from the base dark theme remain intact.

### Using with Screen System

```tsx
<ThemeProvider path="./themes" defaultTheme="dark">
  <ScenarioManagementProvider defaultScreen={Menu}>
    <KeyboardProvider>
      <CurrentScreen />
    </KeyboardProvider>
  </ScenarioManagementProvider>
</ThemeProvider>
```

---

## Typed Theme Bindings

> Requires `@baigao_h/ink-kit` v2.8+

The raw `useTheme()` accepts any string key for `color()` and `style()`, so typos are only caught at runtime.
Use the `ink-kit makeThemeType` CLI to generate **compile-time type safety** for your theme keys.

### Quick Start

```bash
# Generate typed bindings from your theme files
npx ink-kit makeThemeType ./themes ./theme-types
```

This produces two files in `./theme-types/`:

| File | Purpose |
|------|---------|
| `theme-types.d.ts` | `ThemeColorKey`, `ThemeStyleKey`, and `ThemeKey` union types |
| `theme.ts` | Typed `useTheme()` hook — `color()` only accepts `ThemeColorKey`, `style()` only accepts `ThemeStyleKey` |

Import the typed version — it shares the same runtime as the original:

```tsx
// ❌ Raw (no type safety)
import { useTheme } from '@baigao_h/ink-kit';
color('primry');  // Typo not caught — returns undefined at runtime

// ✅ Typed (compile-time errors)
import { useTheme } from './theme-types/theme.js';
color('primry');  // ❌ Compile error — 'primry' is not in ThemeColorKey
color('primary'); // ✅ OK
style('primary'); // ❌ Compile error — 'primary' is a color key, not a style key
```

### CLI Usage

```bash
ink-kit makeThemeType <source-dir> <output-dir> [options]
```

| Argument | Description |
|----------|-------------|
| `source-dir` | Directory containing `{id}.json` files |
| `output-dir` | Directory where `theme-types.d.ts` and `theme.ts` are written |

#### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--watch` | — | Re-generate when a `.json` file changes |
| `--debounce <ms>` | `500` | Debounce delay in watch mode |
| `--from <pkg>` | `@baigao_h/ink-kit` | Package to import the original `useTheme` from |

### How It Works

1. Scans all `.json` files in `source-dir`
2. Computes the **strict intersection** — only keys present in **every** theme file are included
3. Classifies keys by their value type: string → `ThemeColorKey`, boolean → `ThemeStyleKey`
4. Generates `theme-types.d.ts` with autocompletion-ready type unions
5. Generates `theme.ts` with a typed `useTheme()` hook where `color()` and `style()` only accept their respective key types

#### Watch Mode

```bash
# Re-generate on every theme file change (e.g. while designing themes)
npx ink-kit makeThemeType ./themes ./theme-types --watch --debounce 300
```

### Interactive Theme Scaffold

Create theme files interactively:

```bash
npx ink-kit initTheme --output ./themes
```

This prompts for:

1. **Theme ids** — comma-separated list (e.g. `dark,light,retro`), at least 2 required
2. **Keys** — one at a time with kind (`color` or `style`), e.g. `primary color`, `titleBold style`. Empty line to finish
3. **Per-theme values** — for each key, prompt the value for each theme

All generated `.json` files have identical key sets, satisfying the key consistency requirement.

### Example: Full Workflow

```
my-project/
├── themes/
│   ├── dark.json
│   ├── light.json
│   └── retro.json
├── src/
│   ├── theme-types/          ← generated by makeThemeType
│   │   ├── theme-types.d.ts
│   │   └── theme.ts
│   └── App.tsx
└── package.json
```

```bash
# Generate once
npx ink-kit makeThemeType ./themes ./src/theme-types

# Or watch during development
npx ink-kit makeThemeType ./themes ./src/theme-types --watch
```

```tsx
// src/App.tsx
import { ThemeProvider } from '@baigao_h/ink-kit';
import { useTheme } from './theme-types/theme.js';

function Greeting() {
  const { color, style, themeId } = useTheme();
  return (
    <Text bold={style('titleBold') ?? false} color={color('primary') ?? 'white'}>
      Hello from {themeId}!
    </Text>
  );
}
```
