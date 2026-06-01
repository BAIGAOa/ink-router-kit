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

At least one of `path` or `resources` must be provided.

### useI18n

```tsx
const {
  t,
  setLanguage,
  getLanguages,
  currentLanguage,
} = useI18n();
```

**Must be used inside `<LanguageProvider>`**, otherwise throws an error.

---

#### t

```tsx
t(key: string, params?: Record<string, string | number>): string
```

Translate a key. Supports dot-separated nested keys.

```tsx
t('title')                      // Basic
t('game.info', { level: 3 })   // With interpolation
t('nonexistent')                // Returns 'nonexistent' if missing
```

Resolution order:
1. Current language's resources
2. `fallbackLanguage` resources (if set)
3. Returns the key itself

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
