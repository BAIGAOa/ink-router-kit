import { createContext, useContext } from 'react';
import type { FormContextValue } from './types.js';

/**
 * React Context that carries form state ({@link FormContextValue}).
 * Provided by {@link Form} and consumed by {@link Field}.
 *
 * @internal
 */
export const FormContext = createContext<FormContextValue | null>(null);

/**
 * Access the form context from within a {@link Field} component.
 *
 * @throws If called outside of a {@link Form} provider.
 */
export function useFormContext(): FormContextValue {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error(
      '[Ink-Kit] useFormContext() must be used inside a <Form> component.',
    );
  }
  return ctx;
}
