import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  KeyboardProvider,
  useKeyboard,
  Form,
  Field,
  TextInput,
  NumberInput,
  SelectInput,
  MultiSelectInput,
  Badge,
  Divider,
  KeyHint,
} from '../../index.js';
import type { Validator } from '../../components/form/types.js';
import type { Item } from '../../components/select/types.js';

// ── Validators ────────────────────────────────────────────

const required: Validator = (v) => (v ? undefined : 'Required');

const isEmail: Validator = (v) =>
  v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))
    ? undefined
    : 'Invalid email';

const minLength = (n: number): Validator =>
  (v) => v && String(v).length >= n ? undefined : `At least ${n} characters`;

const between = (min: number, max: number): Validator =>
  (v) => {
    const n = Number(v);
    if (v === '' || isNaN(n)) return 'Not a number';
    if (n < min) return `Min ${min}`;
    if (n > max) return `Max ${max}`;
    return undefined;
  };

// ── Data ──────────────────────────────────────────────────

const countries: Item<string>[] = [
  { label: '🇨🇳 China', value: 'CN' },
  { label: '🇺🇸 United States', value: 'US' },
  { label: '🇯🇵 Japan', value: 'JP' },
  { label: '🇩🇪 Germany', value: 'DE' },
  { label: '🇬🇧 United Kingdom', value: 'UK' },
];

const interests: Item<string>[] = [
  { label: 'Technology', value: 'tech' },
  { label: 'Design', value: 'design' },
  { label: 'Music', value: 'music' },
  { label: 'Sports', value: 'sports' },
  { label: 'Travel', value: 'travel' },
];

// ── Demo Component ───────────────────────────────────────

function FormDemo() {
  const [submitted, setSubmitted] = useState<Record<string, any> | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>Registration Form Demo</Text>
      <Text dimColor>Tab to switch fields · Ctrl+S to submit</Text>

      <Box marginTop={1}>
        <Form
          initialValues={{
            email: '',
            password: '',
            age: '25',
            country: '',
            interests: [],
          }}
          onSubmit={(values) => {
            setSubmitted(values);
            setFormErrors({});
          }}
          onError={(errors) => {
            setFormErrors(errors);
            setSubmitted(null);
          }}
        >
          {/* ── Email ─────────────────────────── */}
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>Email</Text>
            <Field name="email" rules={[required, isEmail]} defaultValue="">
              {({ value, onChange, focusId }) => (
                <TextInput
                  focusId={focusId}
                  value={value}
                  onChange={onChange}
                  placeholder="user@example.com"
                />
              )}
            </Field>
            {formErrors.email && <Text color="red">⚠ {formErrors.email}</Text>}
          </Box>

          {/* ── Password ──────────────────────── */}
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>Password</Text>
            <Field name="password" rules={[required, minLength(6)]} defaultValue="">
              {({ value, onChange, focusId }) => (
                <TextInput
                  focusId={focusId}
                  value={value}
                  onChange={onChange}
                  mask="*"
                  placeholder="Min 6 characters"
                />
              )}
            </Field>
            {formErrors.password && <Text color="red">⚠ {formErrors.password}</Text>}
          </Box>

          {/* ── Age ───────────────────────────── */}
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>Age</Text>
            <Field name="age" rules={[required, between(13, 120)]}>
              {({ value, onChange, focusId }) => (
                <NumberInput
                  focusId={focusId}
                  value={Number(value || 0)}
                  onChange={(v) => onChange(String(v))}
                  min={13}
                  max={120}
                />
              )}
            </Field>
            {formErrors.age && <Text color="red">⚠ {formErrors.age}</Text>}
          </Box>

          {/* ── Country ───────────────────────── */}
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>Country</Text>
            <Field name="country" rules={[required]} defaultValue="">
              {({ onChange, focusId }) => (
                <SelectInput
                  focusId={focusId}
                  items={countries}
                  onSelect={(item) => { onChange(item.value); setSelectedCountry(item.value); }}
                />
              )}
            </Field>
            {selectedCountry
              ? <Text color="green">✓ {countries.find((c) => c.value === selectedCountry)?.label}</Text>
              : null}
            {formErrors.country && !selectedCountry && <Text color="red">⚠ {formErrors.country}</Text>}
          </Box>

          {/* ── Interests ─────────────────────── */}
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>Interests</Text>
            <Field name="interests" defaultValue={[]}>
              {({ value, onChange, focusId }) => (
                <MultiSelectInput
                  focusId={focusId}
                  items={interests}
                  selected={value || []}
                  onChange={(vals: string[]) => { onChange(vals); setSelectedTags(vals); }}
                />
              )}
            </Field>
            {selectedTags.length > 0 && (
              <Box gap={1} marginTop={1}>
                {selectedTags.map((tag: string) => (
                  <Badge key={tag} color="cyan">{tag}</Badge>
                ))}
              </Box>
            )}
          </Box>
        </Form>
      </Box>

      <Divider />

      {/* ── Submission Result ────────────────── */}
      {submitted && (
        <Box flexDirection="column">
          <Text bold color="green">✓ Registration submitted!</Text>
          <Text>Email: {submitted.email}</Text>
          <Text>Age: {submitted.age}</Text>
          <Text>Country: {countries.find((c) => c.value === submitted.country)?.label || submitted.country}</Text>
          <Text>Interests: {(submitted.interests as string[]).join(', ') || 'none'}</Text>
        </Box>
      )}

      {!submitted && Object.keys(formErrors).length === 0 && (
        <Text dimColor>Waiting for submission...</Text>
      )}

      <Divider />

      <KeyHint keys={[
        { key: 'Tab', desc: 'Next field' },
        { key: 'Ctrl+S', desc: 'Submit' },
        { key: 'q', desc: 'Quit' },
      ]} />
    </Box>
  );
}

// ── App / Screen wiring ──────────────────────────────────

registerComponent(FormDemo, {});

function App() {
  const { boundKeyboard } = useKeyboard();

  React.useEffect(() => {
    boundKeyboard(['q'], () => process.exit(0));
  }, [boundKeyboard]);

  return <CurrentScreen />;
}

registerComponent(App, {});

render(
  <ScenarioManagementProvider defaultScreen={FormDemo}>
    <KeyboardProvider>
      <App />
    </KeyboardProvider>
  </ScenarioManagementProvider>,
);
