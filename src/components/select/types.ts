import React from "react";
import type { StorageAPI } from "../../storage/index.js";

/**
 * The SelectInput component is required to pass in a type interface that must be included to act as a constraint
 */
export interface Item<T> {
  /**
   * Something that is used to show the user
   */
  label: string;
  /**
   * What is the actual value of the selected item
   */
  value: T;
  /**
   * Key convenient for dynamic addition and deletion
   */
  Key?: string;
}

export interface SelectInputProps<T, I extends Item<T> = Item<T>> {
  /**
   * Array to be passed in for UI display, etc.
   */
  items: I[];
  /**
   * What happens when the user presses Enter
   * Accepts a parameter that represents the currently selected item
   */
  onSelect: (item: I) => void;
  /**
   * UI components for custom rendering
   */
  itemComponent?: React.ComponentType<I & { isSelected: boolean }>;
  /**
   * Custom Indicator UI Component
   */
  indicatorComponent?: React.ComponentType<{ isSelected: boolean }>;
  /**
   * Focus, string type, controls whether this component is active
   * Effectively prevents two SelectInputs from competing with each other
   * Is not a Boolean type Because of the integration of the keyboard system.
   */
  focusId: string;
  /**
  * When the number of items exceeds what?
  * The list will be scrolled
  */
  limit?: number;
  /**
   * Optional persistence instance. When provided, the cursor position
   * (selectedIndex) is automatically saved and restored across sessions.
   */
  storage?: StorageAPI;
  /**
   * Storage key used for persistence. Defaults to `"select:<focusId>"` when
   * not provided.
   */
  storageKey?: string;
}
