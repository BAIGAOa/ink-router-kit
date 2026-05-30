/**
 * Validation function.
 * Takes the field's current value and all form values, returns an error
 * message string if invalid, or `undefined` if valid.
 *
 * @param value   The current value of the field being validated.
 * @param values  All form values (useful for cross-field validation).
 * @returns Error message, or undefined if valid.
 */
export type Validator = (value: any, values: Record<string, any>) => string | undefined;

/**
 * Value provided by {@link Form} via {@link FormContext}.
 */
export interface FormContextValue {
  /** Current values of all registered fields. */
  values: Record<string, any>;
  /** Current validation errors. `undefined` means the field is valid. */
  errors: Record<string, string | undefined>;
  /**
   * Update a single field's value and clear its error.
   * Called by {@link Field} when the user changes input.
   */
  setFieldValue: (name: string, value: any) => void;
  /**
   * Register a field with the form.
   * Called by {@link Field} on mount.
   *
   * @param name         Field name (unique within the form).
   * @param defaultValue Initial value if the form has no value for this name yet.
   * @param rules        Validation rules applied on submit.
   * @param focusId      The focus target ID for this field's input, used by Form
   *                     to focus the first error field on submit failure.
   */
  registerField: (name: string, defaultValue?: any, rules?: Validator[], focusId?: string) => void;
  /** Unregister a field on unmount. */
  unregisterField: (name: string) => void;
  /** Trigger validation and submit. Bound to Enter key by Form. */
  submitForm: () => void;
}

/**
 * Props for the {@link Form} component.
 */
export interface FormProps {
  /** Form body containing {@link Field} components. */
  children: React.ReactNode;
  /**
   * Called when validation passes and the form is submitted.
   * Receives all field values as a record.
   */
  onSubmit: (values: Record<string, any>) => void;
  /**
   * Called when validation fails on submit.
   * Receives the errors record (field name → error message).
   */
  onError?: (errors: Record<string, string | undefined>) => void;
  /** Initial values for fields. Overrides Field-level `defaultValue`. */
  initialValues?: Record<string, any>;
  /**
   * Mutable ref that receives the `submitForm` function after mount.
   * Useful for programmatic submission in tests or non-keyboard flows.
   */
  submitRef?: React.MutableRefObject<(() => void) | undefined>;
}

/**
 * Props passed to the render child of {@link Field}.
 */
export interface FieldRenderProps {
  /** Current value of this field (from Form state). */
  value: any;
  /** Current validation error for this field, or undefined. */
  error: string | undefined;
  /**
   * Call this when the user changes input.
   * Handles calling Form's `setFieldValue` and clearing errors.
   */
  onChange: (value: any) => void;
  /**
   * The focus target ID for this field's input component.
   * Pass to the child component's `focusId` prop.
   */
  focusId: string;
}

/**
 * Props for the {@link Field} component.
 */
export interface FieldProps {
  /** Unique field name. Used as the key in Form's `values` and `errors`. */
  name: string;
  /**
   * Render function receiving {@link FieldRenderProps}.
   * Returns the actual input component (TextInput, NumberInput, etc.).
   *
   * @example
   * ```tsx
   * <Field name="email" rules={[required]}>
   *   {({ value, onChange, error, focusId }) => (
   *     <TextInput focusId={focusId} value={value} onChange={onChange} />
   *   )}
   * </Field>
   * ```
   */
  children: (fieldProps: FieldRenderProps) => React.ReactNode;
  /** Validation rules evaluated on submit, in order. First match wins. */
  rules?: Validator[];
  /**
   * Default value for this field, used only on initial mount if not
   * already set via Form's `initialValues`.
   */
  defaultValue?: any;
  /**
   * Override the auto-generated focusId (`${name}-field`).
   * Useful when the same input name is used on different screens.
   */
  focusId?: string;
}
