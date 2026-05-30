# Form + Field

A React Context‑powered form system built on top of ink‑kit's keyboard and focus architecture.

## Install

```bash
npm install @baigao_h/ink-kit
```

## Quick Start

```tsx
import React, { useState } from 'react';
import { Box, Text, render } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  KeyboardProvider,
  Form,
  Field,
  TextInput,
} from '@baigao_h/ink-kit';

// Validation rule: returns error message or undefined
function required(value: any, values: Record<string, any>): string | undefined {
  return value ? undefined : 'This field is required';
}

function isEmail(value: any): string | undefined {
  return value && String(value).includes('@') ? undefined : 'Invalid email';
}

function App() {
  return (
    <Box flexDirection="column">
      <Form
        initialValues={{ email: '', password: '' }}
        onSubmit={(values) => console.log('Submitted:', values)}
        onError={(errors) => console.log('Errors:', errors)}
      >
        <Field name="email" rules={[required, isEmail]} defaultValue="">
          {({ value, onChange, error, focusId }) => (
            <Box flexDirection="column">
              <Text>Email</Text>
              <TextInput
                focusId={focusId}
                value={value}
                onChange={onChange}
                placeholder="user@example.com"
              />
              {error && <Text color="red">{error}</Text>}
            </Box>
          )}
        </Field>

        <Field name="password" rules={[required]} defaultValue="">
          {({ value, onChange, error, focusId }) => (
            <Box flexDirection="column">
              <Text>Password</Text>
              <TextInput
                focusId={focusId}
                value={value}
                onChange={onChange}
                mask="*"
              />
              {error && <Text color="red">{error}</Text>}
            </Box>
          )}
        </Field>
      </Form>
    </Box>
  );
}

registerComponent(App, {});

render(
  <ScenarioManagementProvider defaultScreen={App}>
    <KeyboardProvider>
      <CurrentScreen />
    </KeyboardProvider>
  </ScenarioManagementProvider>
);
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  <Form>                                  (state owner)│
│  ┌─ FormContext.Provider ──────────────────────────┐    │
│  │  values:  { email: 'a@b.c', password: '…' }    │    │
│  │  errors:  { email: undefined, password: 'Req' } │    │
│  │  setFieldValue(name, value)                     │    │
│  │  registerField(name, default, rules, focusId)   │    │
│  │  submitForm()                                   │    │
│  │                                                 │    │
│  │  <Field name="email" rules={[req]}>             │    │
│  │    { value, error, onChange, focusId } →   │    │
│  │      <TextInput ... />                         │    │
│  │  </Field>                                       │    │
│  │                                                 │    │
│  │  <Field name="password" rules={[req]}>          │    │
│  │    { value, error, onChange, focusId } →   │    │
│  │      <TextInput ... mask="*" />                │    │
│  │  </Field>                                       │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Data flow:**

1. User types → `TextInput.onChange(value)` 
2. → `Field.onChange(value)` → `Form.setFieldValue(name, value)`
3. → Form updates `values` state → re‑render
4. → Field reads new `values[name]` from Context → passes to TextInput
5. On submit → Form runs all rules → if errors, `focusSet()` to first error field

---

## API

### `Form` Props

| Prop | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `children` | `React.ReactNode` | ✅ | — | Form body. Typically contains `<Field>` components. |
| `onSubmit` | `(values) => void` | ✅ | — | Called when **all** fields pass validation. Receives `{ fieldName: value }`. |
| `onError` | `(errors) => void` | ❌ | — | Called when validation fails. Receives `{ fieldName: errorMsg }`. |
| `initialValues` | `Record<string, any>` | ❌ | `{}` | Pre‑populated values. Overrides each Field's `defaultValue`. |
| `submitRef` | `MutableRefObject` | ❌ | — | Receives the `submitForm` function after mount for programmatic submission. |

### `Field` Props

| Prop | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `name` | `string` | ✅ | — | Unique field identifier. Used as key in `values` and `errors`. |
| `children` | `(FieldRenderProps) => ReactNode` | ✅ | — | Render function receiving `{ value, error, onChange, focusId }`. |
| `rules` | `Validator[]` | ❌ | — | Validation rules, evaluated **in order** on submit. First match wins. |
| `defaultValue` | `any` | ❌ | — | Used as initial value only if Form has no value for this name yet. |
| `focusId` | `string` | ❌ | `{name}-field` | Override the auto‑generated focus target ID. |

### `FieldRenderProps` (passed to render function)

| Prop | Type | Description |
|------|------|-------------|
| `value` | `any` | Current value from Form state. Falls back to `defaultValue` before Field registers. |
| `error` | `string \| undefined` | Validation error message. `undefined` = valid. |
| `onChange` | `(value) => void` | Call when user changes input. Updates Form state and clears the field's error. |
| `focusId` | `string` | The focus target ID for this field's input. Pass to the component's `focusId` prop. |

### `Validator`

```typescript
type Validator = (value: any, values: Record<string, any>) => string | undefined;

// Return a string (error message) if invalid
// Return undefined if valid
```

- `value` — the current value of the field being validated
- `values` — all form values (useful for cross‑field validation, e.g. password match)

---

## Validation

### How it works

1. When user presses **Ctrl+Enter**, `Form.submitForm()` runs
2. All registered rules are evaluated in **registration order** (Field mount order)
3. For each field, rules run **in array order** — the first rule returning a string wins
4. Errors are stored in `errors[name]` and passed to `onError`
5. `focusSet(focusId)` is called for the first field that has an error

### Common validators

```tsx
// Required
const required: Validator = (v) => v ? undefined : 'Required';

// Min length
const minLength = (n: number): Validator =>
  (v) => v && String(v).length >= n ? undefined : `Min ${n} chars`;

// Exact length
const exactLength = (n: number): Validator =>
  (v) => v && String(v).length === n ? undefined : `Must be ${n} chars`;

// Email pattern
const isEmail: Validator = (v) =>
  v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)) ? undefined : 'Invalid email';

// Numeric range
const between = (min: number, max: number): Validator =>
  (v) => {
    const n = Number(v);
    return isNaN(n) ? 'Not a number'
      : n < min ? `Min ${min}`
      : n > max ? `Max ${max}`
      : undefined;
  };

// Cross-field: password match
const matches = (fieldName: string, label: string): Validator =>
  (v, allValues) => v === allValues[fieldName] ? undefined : `Does not match ${label}`;
```

### Usage

```tsx
<Field name="age" rules={[required, between(0, 150)]} defaultValue="">
  {({ value, onChange, error, focusId }) => (
    <Box flexDirection="column">
      <NumberInput focusId={focusId} value={Number(value)} onChange={(v) => onChange(String(v))} />
      {error && <Text color="red">{error}</Text>}
    </Box>
  )}
</Field>
```

---

## Edge Cases & Boundary Behavior

### Empty form, no fields

```tsx
<Form onSubmit={() => {}}>
  {/* nothing */}
</Form>
```
Submit runs immediately — `onSubmit({})` is called. No error.

### Empty list of rules

```tsx
<Field name="tags" rules={[]}>
```
Field passes validation unconditionally. Useful for read‑only fields.

### Validation passes, then another rule also passes

```tsx
// Rules: [required, isEmail]
// Value: "a@b.c"
// required → returns undefined (pass)
// isEmail → returns undefined (pass)
// → onSubmit called
```
All rules must return `undefined` for the field to pass.

### First rule fails, remaining rules not evaluated

```tsx
// Rules: [required, isEmail]
// Value: ""
// required → returns "Required" (fail)
// isEmail → NOT evaluated (short‑circuit)
```
**Per‑field** short‑circuit on the first error. Rules are evaluated left to right.

### initialValues vs defaultValue

```tsx
<Form initialValues={{ email: 'a@b.c' }}>
  <Field name="email" defaultValue="fallback@x.com" rules={[required]}>
```

| Scenario | Result |
|----------|--------|
| Form has `email` in `initialValues` | `values.email = 'a@b.c'`. `defaultValue` ignored. |
| Form has no `email` in `initialValues` | `values.email` is `undefined` initially. Field renders `defaultValue` as fallback. After `useEffect` → `registerField` → `setValues({ email: 'fallback@x.com' })`. |
| User clears the field to `''` | `''` is intentionally set by the user. Not overwritten by `defaultValue`. |

### First‑render value resolution (prevents `undefined`)

On the very first render, the Field's `useEffect` has not yet run, so `registerField` has not yet set the value in Form state. If `initialValues` doesn't contain this field, `values[name]` is `undefined`. **Field automatically falls back to `defaultValue`** during render to avoid passing `undefined` to input components (which would crash TextInput's `value.length`).

```tsx
// Field.tsx internal logic:
const resolvedValue = values[name] !== undefined ? values[name] : defaultValue;
```

### Multiple fields with the same name

```tsx
<Field name="x">...</Field>
<Field name="x">...</Field>
```
The second Field's `registerField` overwrites the first. Both share the same `values.x` and `errors.x`. This is **undefined behavior** — use unique names.

### Field unmounts and re‑mounts

```tsx
{showField && <Field name="dynamic">...</Field>}
```
On unmount → `unregisterField` cleans up rules and focusId.  
On re‑mount → `registerField` sets rules again. If the field had a value in Form state, it persists.

### onSubmit receives all values, not just changed ones

```tsx
<Form initialValues={{ a: 'x', b: 'y' }} onSubmit={(v) => {}}>
  <Field name="a">...</Field>
  {/* Note: no Field for "b" */}
</Form>
```
`onSubmit({ a: 'x', b: 'y' })` — values for unregistered fields are still passed through.

### Ctrl+Enter submit key conflict

Form uses **`ctrl+return`** for submission, not `return`. This avoids conflict with `TextInput`'s focus‑target Enter binding. If the parent screen has its own `ctrl+return` binding, Form's binding takes precedence at the screen level (last registered wins).

---

## Integration with Other Components

### NumberInput

```tsx
<Field name="age" rules={[required]} defaultValue="">
  {({ value, onChange, error, focusId }) => (
    <NumberInput
      focusId={focusId}
      value={Number(value || 0)}
      onChange={(v) => onChange(String(v))}
      min={0}
      max={150}
    />
  )}
</Field>
```

### SelectInput

```tsx
<Field name="country" rules={[required]} defaultValue="">
  {({ value, onChange, error, focusId }) => (
    <SelectInput
      focusId={focusId}
      items={countries}
      onSelect={(item) => onChange(item.value)}
    />
  )}
</Field>
```

### MultiSelectInput

```tsx
<Field name="colors" defaultValue={[]}>
  {({ value, onChange, error, focusId }) => (
    <MultiSelectInput
      focusId={focusId}
      items={colorItems}
      selected={value || []}
      onChange={onChange}
    />
  )}
</Field>
```

### SearchInput

```tsx
<Field name="query" rules={[required]}>
  {({ value, onChange, error, focusId }) => (
    <SearchInput
      focusId={focusId}
      value={value || ''}
      onChange={onChange}
      placeholder="Search..."
    />
  )}
</Field>
```

---

## Keyboard

| Key | Action | Context |
|-----|--------|---------|
| **Ctrl+Enter** | Submit form | Screen‑level binding in Form |
| **Tab** / **Shift+Tab** | Cycle field focus | KeyboardProvider (built‑in) |
| **Enter** | Confirm TextInput / SelectInput selection | Per‑field focus target (built‑in) |

**Note:** Regular `Enter` does **not** submit the form. Use **Ctrl+Enter** instead. This avoids a conflict where TextInput's focus‑target Enter binding (which triggers `onSubmit` on the input) would consume the event before Form's screen‑level binding could fire.

---

## Notes

- `<Form>` must be used inside a `<KeyboardProvider>` (for `boundKeyboard` and `focusSet`).
- `<Field>` must be used inside a `<Form>`.
- Validation rules receive all form values for cross‑field validation (e.g. password confirmation).
- The `onError` callback fires **before** `focusSet`, so you can inspect errors before the cursor jumps.
- `submitRef` is set in a `useEffect` — available after mount. Use it for programmatic submission (tests, timers, external events).

## License

MIT
