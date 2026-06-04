# Internationalization (i18n)

`ink-kit` provides a lightweight i18n system via `LanguageProvider` and the `useI18n` hook. Supports JSON resource files or inline objects, parameter interpolation, nested keys, and real-time language switching.

---

## Quick Start

```tsx
import React from 'react';
import { Box, Text, render } from 'ink';
import { LanguageProvider, useI18n } from '@baigao_h/ink-kit';

function MyApp() {
  const { t, setLanguage, currentLanguage } = useI18n();
  return (
    <Box flexDirection="column">
      <Text>{t('title')}</Text>
      <Text>{t('game.info', { level: 3, score: 4200 })}</Text>
      <Text>Current: {currentLanguage}</Text>
    </Box>
  );
}

render(
  <LanguageProvider path="./locales" defaultLanguage="en-US">
    <MyApp />
  </LanguageProvider>,
);
```

---

## Installation

No additional dependencies — built into `@baigao_h/ink-kit`.

---

## Language File Format

JSON files named by locale code (e.g. `en-US.json`, `zh-CN.json`):

```json
{
  "title": "Main Menu",
  "game": {
    "info": "Level {level} - Score: {score}",
    "back": "Back"
  },
  "player": "Player aged {age}",
  "inventory": "You have {count} items"
}
```

Keys are flattened at load time, so `game.info` and `game.back` become accessible via dot notation.

### Interpolation

Use `{paramName}` placeholders in translation values:

```json
{ "welcome": "Hello {name}, you are {age} years old" }
```

```tsx
t('welcome', { name: 'Alice', age: 30 })
// → "Hello Alice, you are 30 years old"
```

---

## API Reference

### LanguageProvider

```tsx
<LanguageProvider
  path="./locales"
  resources={{ 'en-US': { hello: 'Hello' } }}
  defaultLanguage="en-US"
  fallbackLanguage="en-US"
>
  {children}
</LanguageProvider>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| path | `string` | — | Directory path containing `{locale}.json` files. Read synchronously at mount |
| resources | `Record<string, Record<string, string>>` | — | Inline translation object. Alternative to `path` |
| defaultLanguage | `string` | first available locale | Initial language |
| fallbackLanguage | `string` | — | Fallback when a key is missing in the current language |
| defaultContext | `string` | — | Default context for all `t()` calls. See [defaultContext](#defaultcontext) |

At least one of `path` or `resources` must be provided.

### useI18n

```tsx
const {
  t,
  setLanguage,
  getLanguages,
  mergeLanguage,
  currentLanguage,
  setDefaultContext,
} = useI18n();
```

**Must be used inside `<LanguageProvider>`**, otherwise throws an error.

---

#### t

```tsx
t(key: string, options?: { params?: Record<string, string | number>; context?: string }): string
```

Translate a key. Supports dot-separated nested keys, context-based lookups,
and interpolation.

```tsx
t('title')                                      // Basic
t('game.info', { params: { level: 3 } })       // With interpolation
t('nonexistent')                                // Returns 'nonexistent' if missing
t('greeting', { context: 'male' })             // Context-based lookup
t('greeting')                                   // Uses defaultContext if set
```

When a `defaultContext` (or explicit `context`) is active, the resolution
order becomes:
1. `key.<context>` — context-specific translation in current language
2. `key` — base translation in current language
3. `key.<context>` — context-specific translation in `fallbackLanguage` (if set)
4. `key` — base translation in `fallbackLanguage` (if set)
5. Returns the key itself

---

#### setLanguage

```tsx
setLanguage(lang: string): void
```

Switch to a different language. All components using `t()` re-render automatically.

```tsx
setLanguage('zh-CN');
```

No-op if the requested language is not available.

---

#### getLanguages

```tsx
getLanguages(): string[]
```

Returns the list of all available locale codes.

```tsx
getLanguages() // ['en-US', 'zh-CN', 'ja-JP']
```

---

#### mergeLanguage

```tsx
mergeLanguage(paths: string[]): void
```

Merge translation files from one or more directory paths into current resources. Later paths override earlier paths when the same key exists in multiple sources. Triggers re-render of all consumers.

```tsx
mergeLanguage(['./mod-a', './mod-b']);
```

- Only languages whose JSON files exist in the provided paths are merged; other languages are unaffected.
- Works with both `path`-mode and `resources`-mode providers.
- Useful for game modding, where mods can overlay their own translations on top of base game translations.

#### setDefaultContext

```tsx
setDefaultContext(context?: string): void
```

Dynamically update or clear the default context for all `t()` calls. When
a default context is set, every `t('key')` call first looks up
`'key.<defaultContext>'` before falling back to the bare key. An explicit
`context` option passed to `t()` still takes precedence over the default
context.

```tsx
// Assume resources: { greeting: 'Hello', 'greeting.man': 'Hello, sir' }

setDefaultContext('man');
t('greeting')  // → 'Hello, sir' (uses 'greeting.man')

t('greeting', { context: undefined })  // → 'Hello' (explicit override)

setDefaultContext(undefined);          // Clear default context
t('greeting')  // → 'Hello'
```

Pass `undefined` to clear the default context and restore bare-key-only
lookup.

---

#### currentLanguage

```tsx
currentLanguage: string
```

The currently active locale code.

---

## Examples

### Inline Resources

```tsx
<LanguageProvider
  resources={{
    'en-US': { hello: 'Hello', 'game.start': 'Start' },
    'zh-CN': { hello: '你好', 'game.start': '开始' },
  }}
  defaultLanguage="en-US"
>
  <App />
</LanguageProvider>
```

### Default Context

When your app knows the current user context (e.g. gender), use
`defaultContext` to avoid repeating `{ context: '...' }` on every call.

```tsx
<LanguageProvider
  resources={{
    'en-US': {
      greeting: 'Hello',
      'greeting.male': 'Hello, sir',
      'greeting.female': 'Hello, madam',
      'welcome.male': 'Welcome, Mr. {name}',
      'welcome.female': 'Welcome, Ms. {name}',
    },
  }}
  defaultLanguage="en-US"
  defaultContext="male"
>
  <MyApp />
</LanguageProvider>
```

Switch context dynamically with `setDefaultContext`:

```tsx
function Profile() {
  const { t, setDefaultContext } = useI18n();

  return (
    <Box flexDirection="column">
      <Text>{t('greeting')}</Text>
      <Text>{t('welcome', { params: { name: 'Bob' } })}</Text>
      <Text>  </Text>
      <Text>{t('greeting', { context: 'female' })}</Text>
      {/* ↑ explicit context overrides the default */}
    </Box>
  );
}
```

### Switching Language via Keybinding

```tsx
import { useInput } from 'ink';

function Settings() {
  const { t, setLanguage, getLanguages, currentLanguage } = useI18n();

  useInput((input) => {
    if (input === 'c') {
      const langs = getLanguages();
      const idx = langs.indexOf(currentLanguage);
      setLanguage(langs[(idx + 1) % langs.length]);
    }
  });

  return <Text>{t('settings.language')}: {currentLanguage}</Text>;
}
```

### Using with Screen System

```tsx
<LanguageProvider path="./locales" defaultLanguage="en-US">
  <ScenarioManagementProvider defaultScreen={Menu}>
    <KeyboardProvider>
      <CurrentScreen />
    </KeyboardProvider>
  </ScenarioManagementProvider>
</LanguageProvider>
```

---

## Typed i18n Bindings

> Requires `@baigao_h/ink-kit` v2.8+

The raw `t()` accepts any string key, so typos and missing params are only caught at runtime.  
Use the `ink-kit makeLanguageType` CLI to generate **compile-time type safety** for your translation keys.

### Quick Start

```bash
# Generate typed bindings from your locale files
npx ink-kit makeLanguageType ./locales ./i18n-types
```

This produces two files in `./i18n-types/`:

| File | Purpose |
|------|---------|
| `i18n-types.d.ts` | `TranslationKey` union type + `TranslationParams` map |
| `i18n.ts` | Typed `t()` function and typed `useI18n()` hook |

Import the typed versions — they share the same runtime as the originals:

```tsx
// ❌ Raw (no type safety)
import { t } from '@baigao_h/ink-kit';
t('title');                          // Any string accepted
t('game.info', { params: { wrong: 1 }}); // No param validation

// ✅ Typed (compile-time errors)
import { t } from './i18n-types/i18n.js';
t('title');                          // ✅ OK — 'title' is in TranslationKey
t('titl');                           // ❌ Compile error — typo caught!
t('game.info', { params: { level: 3 } });
// ❌ Compile error — missing required param 'score'
```

### CLI Usage

```bash
ink-kit makeLanguageType <source-dir> <output-dir> [options]
```

| Argument | Description |
|----------|-------------|
| `source-dir` | Directory containing `{locale}.json` files |
| `output-dir` | Directory where `i18n-types.d.ts` and `i18n.ts` are written |

#### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--watch` | — | Re-generate when a `.json` file changes |
| `--debounce <ms>` | `500` | Debounce delay in watch mode |
| `--from <pkg>` | `@baigao_h/ink-kit` | Package to import the original `t` / `useI18n` from |

### How It Works

1. Scans all `.json` files in `source-dir`
2. Flattens nested keys (e.g. `game.info` → `game.info`)
3. Computes the **strict intersection** — only keys present in **every** language file are included
4. Extracts `{param}` placeholders from each key's templates across all files and takes the **union** of all params
5. Generates `i18n-types.d.ts` with:
   - `type TranslationKey = 'title' | 'game.info' | …` — autocompletion-ready union
   - `type TranslationParams = { 'title': undefined; 'game.info': { level: string | number; score: string | number }; … }`
6. Generates `i18n.ts` with a generic `t<K extends TranslationKey>()` and a typed `useI18n()` hook

#### Watch Mode

```bash
# Re-generate on every locale file change (e.g. while translating)
npx ink-kit makeLanguageType ./locales ./i18n-types --watch --debounce 300
```

TypeScript picks up the updated `.d.ts` file immediately, so you get instant feedback on new keys.

### Partial Keys Warning

If a key exists in only some language files, it is **excluded** from the generated type
and a warning is printed:

```
[ink-kit] Warning: key "extra.key" is missing in [en-US, zh-CN] — excluded from type
```

This prevents runtime `undefined` errors from missing translations.

### Example: Full Workflow

```
my-project/
├── locales/
│   ├── en-US.json
│   ├── zh-CN.json
│   └── ja-JP.json
├── src/
│   ├── i18n-types/          ← generated by makeLanguageType
│   │   ├── i18n-types.d.ts
│   │   └── i18n.ts
│   └── App.tsx
└── package.json
```

```bash
# Generate once
npx ink-kit makeLanguageType ./locales ./src/i18n-types

# Or watch during development
npx ink-kit makeLanguageType ./locales ./src/i18n-types --watch
```

```tsx
// src/App.tsx
import { LanguageProvider } from '@baigao_h/ink-kit';
import { t, useI18n } from './i18n-types/i18n.js';

function Greeting() {
  const { currentLanguage } = useI18n();
  return <Text>{t('welcome', { params: { name: 'Alice' } })}</Text>;
}
```
