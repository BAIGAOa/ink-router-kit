
import type { StorageAPI } from "../../storage/index.js";

/**
 * Props for the controlled TextInput component.
 * @template T - The type of the value (typically string).
 */
export type TextInputProps = {
  /**
   * Placeholder text shown when value is empty.
   */
  readonly placeholder?: string;

  /**
   * Replace all characters with this mask string (e.g. '*' for passwords).
   */
  readonly mask?: string;

  /**
   * Whether to show a visual cursor and allow arrow key navigation.
   * @default true
   */
  readonly showCursor?: boolean;

  /**
   * Highlight the last pasted text block (multiple characters inserted at once).
   * @default false
   */
  readonly highlightPastedText?: boolean;

  /**
   * Current value of the input (controlled).
   */
  readonly value: string;

  /**
   * Called when the value changes.
   */
  readonly onChange: (value: string) => void;

  /**
   * Called when the Enter key is pressed.
   */
  readonly onSubmit?: (value: string) => void;

  /**
   * Focus identifier used by the keyboard system.
   * Must be unique on the current screen.
   */
  readonly focusId: string;
};

/**
 * Props for the uncontrolled TextInput component.
 */
export type UncontrolledTextInputProps = {
  /**
   * Initial value when the component mounts.
   * @default ''
   */
  readonly initialValue?: string;
  /**
   * Optional persistence instance. When provided, the text value is
   * automatically saved and restored across sessions.
   */
  readonly storage?: StorageAPI;
  /**
   * Storage key used for persistence. Defaults to `"text:<focusId>"` when
   * not provided.
   */
  readonly storageKey?: string;
} & Omit<TextInputProps, 'value' | 'onChange'>;
