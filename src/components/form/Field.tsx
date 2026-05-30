import React, { useEffect, useCallback, useMemo } from 'react';
import { useFormContext } from './context.js';
import type { FieldProps } from './types.js';

/**
 * A single field in a {@link Form}.
 *
 * Uses the **render prop pattern** — children receives
 * `{ value, error, onChange, focusId }` and returns the input component.
 *
 * Responsibilities:
 * - Registers itself (name + rules + defaultValue + focusId) with Form on mount
 * - Reads current value and error from Form context
 * - Wraps `onChange` to call Form's `setFieldValue` (updates value + clears error)
 * - Auto-generates `focusId` from `name` if not explicitly provided
 * - Unregisters on unmount
 *
 * @example
 * ```tsx
 * <Field name="email" rules={[required]} defaultValue="">
 *   {({ value, error, onChange, focusId }) => (
 *     <TextInput
 *       focusId={focusId}
 *       value={value}
 *       onChange={onChange}
 *       placeholder="Email"
 *     />
 *   )}
 * </Field>
 * ```
 */
export function Field({ name, children, rules, defaultValue, focusId }: FieldProps) {
  const { values, errors, setFieldValue, registerField, unregisterField } = useFormContext();

  /** Auto-generate focusId from field name if not explicitly provided. */
  const effectiveFocusId = focusId ?? `${name}-field`;

  /** Register field with Form on mount, unregister on unmount. */
  useEffect(() => {
    registerField(name, defaultValue, rules, effectiveFocusId);
    return () => unregisterField(name);
  }, [name, registerField, unregisterField]);

  /**
   * Stable onChange handler — calls Form's setFieldValue,
   * which updates the value and clears any validation error.
   */
  const onChange = useCallback(
    (value: any) => setFieldValue(name, value),
    [name, setFieldValue],
  );

  /**
   * Resolve the field value. If the Form has no value for this name yet
   * (e.g. before the first render's registerField effect), fall back to
   * the Field's own defaultValue. This avoids passing undefined to input
   * components on the initial render.
   */
  const resolvedValue = values[name] !== undefined ? values[name] : defaultValue;

  /** Memoize the render props to avoid unnecessary re-renders. */
  const fieldProps = useMemo(
    () => ({
      value: resolvedValue,
      error: errors[name],
      onChange,
      focusId: effectiveFocusId,
    }),
    [resolvedValue, errors[name], onChange, effectiveFocusId],
  );

  return <>{children(fieldProps)}</>;
}
