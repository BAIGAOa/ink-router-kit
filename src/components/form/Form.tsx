import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FormContext } from './context.js';
import { useKeyboard } from '../../keyboard/hook.js';
import type { FormProps, Validator } from './types.js';

/**
 * Form container — manages field values, validation, and submission.
 *
 * Integrates with ink-kit's keyboard and focus system:
 * - **Ctrl+Enter** triggers `submitForm()` (avoids conflicting with TextInput's Enter)
 * - On validation failure, calls `focusSet()` on the first error field
 *
 * Must be used inside a `<KeyboardProvider>` for keyboard bindings to work.
 *
 * @example
 * ```tsx
 * <Form
 *   initialValues={{ email: '', password: '' }}
 *   onSubmit={(values) => handleLogin(values)}
 *   onError={(errors) => console.log('Validation failed', errors)}
 * >
 *   <Field name="email" rules={[required, isEmail]}>
 *     {({ value, onChange, error, focusId }) => (
 *       <TextInput focusId={focusId} value={value} onChange={onChange} />
 *     )}
 *   </Field>
 *   <Field name="password" rules={[required]}>
 *     {({ value, onChange, error, focusId }) => (
 *       <TextInput focusId={focusId} value={value} onChange={onChange} mask="*" />
 *     )}
 *   </Field>
 * </Form>
 * ```
 */
export function Form({ children, onSubmit, onError, initialValues = {}, submitRef }: FormProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  // Holds the focusId of the first error field; consumed by useEffect to
  // call focusSet() outside of render.
  const [focusedErrorField, setFocusedErrorField] = useState<string | null>(null);

  // Refs to avoid stale closures in callbacks
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const rulesRef = useRef<Record<string, Validator[]>>({});
  const focusIdRef = useRef<Record<string, string>>({});

  const { focusSet, globalKeys } = useKeyboard();

  /**
   * Register a field's validation rules and default value.
   *
   * Does NOT set the default if the field already has a value
   * (e.g. set via `initialValues`).
   */
  const registerField = useCallback(
    (name: string, defaultValue?: any, rules?: Validator[]) => {
      if (rules) rulesRef.current[name] = rules;
      if (defaultValue !== undefined && !(name in valuesRef.current)) {
        setValues((prev) => {
          if (name in prev) return prev;
          return { ...prev, [name]: defaultValue };
        });
      }
    },
    [],
  );

  /** Unregister a field's rules and focusId mapping on unmount. */
  const unregisterField = useCallback((name: string) => {
    delete rulesRef.current[name];
    delete focusIdRef.current[name];
  }, []);

  /**
   * Update a single field's value and clear its validation error.
   *
   * Errors are cleared optimistically so the user sees immediate
   * feedback that the error is being addressed.
   */
  const setFieldValue = useCallback((name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (prev[name] === undefined) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  /**
   * Run all registered validation rules and return the errors record.
   * For each field, rules are evaluated in order — the first error wins.
   */
  const validate = useCallback(
    (): Record<string, string | undefined> => {
      const currentValues = valuesRef.current;
      const newErrors: Record<string, string | undefined> = {};

      for (const [name, validators] of Object.entries(rulesRef.current)) {
        for (const fn of validators) {
          const error = fn(currentValues[name], currentValues);
          if (error) {
            newErrors[name] = error;
            break;
          }
        }
      }

      return newErrors;
    },
    [],
  );

  /**
   * Validate all fields, then either:
   * 1. On error — persist errors, call `onError`, focus first error field
   * 2. On success — call `onSubmit` with current values
   */
  const submitForm = useCallback(() => {
    const validationErrors = validate();
    setErrors(validationErrors);

    const hasErrors = Object.values(validationErrors).some(Boolean);
    if (hasErrors) {
      onError?.(validationErrors);
      const firstError = Object.keys(validationErrors)[0];
      const targetFocusId = focusIdRef.current[firstError];
      if (targetFocusId) {
        setFocusedErrorField(targetFocusId);
      }
      return;
    }

    onSubmit(valuesRef.current);
  }, [validate, onSubmit, onError]);

  // Stable ref so globalKeys effect doesn't re-add on every render
  const submitFormRef = useRef(submitForm);
  submitFormRef.current = submitForm;
  // Prevent calling submitForm on an unmounted Form
  const mountedRef = useRef(true);

  // Defer focusSet to avoid calling it inside render
  useEffect(() => {
    if (focusedErrorField) {
      focusSet(focusedErrorField);
      setFocusedErrorField(null);
    }
  }, [focusedErrorField, focusSet]);

  // Expose submitForm via submitRef prop
  useEffect(() => {
    if (submitRef) submitRef.current = submitForm;
  }, [submitForm, submitRef]);

  // Bind Ctrl+S to submit via globalKeys so it fires before
  // focus-target bindings (avoiding SelectInput/MultiSelectInput's
  // 'return' binding from consuming the event first).
  // Uses refs so the entry is added once and the latest submitForm
  // is always called; mountedRef prevents calling after unmount.
  useEffect(() => {
    globalKeys([
      { key: 'ctrl+s', operate: () => { if (mountedRef.current) submitFormRef.current(); }, cover: false, affectOverlay: false },
    ], { mode: 'add' });
    return () => { mountedRef.current = false; };
  }, []);

  /**
   * Wrapper around registerField that also stores the field's focusId
   * for error focus navigation.
   */
  const registerFieldWithFocus = useCallback(
    (name: string, defaultValue?: any, rules?: Validator[], focusId?: string) => {
      registerField(name, defaultValue, rules);
      if (focusId) {
        focusIdRef.current[name] = focusId;
      }
    },
    [registerField],
  );

  const contextValue = {
    values,
    errors,
    setFieldValue,
    registerField: registerFieldWithFocus,
    unregisterField,
    submitForm,
  };

  return (
    <FormContext.Provider value={contextValue}>
      {children}
    </FormContext.Provider>
  );
}
