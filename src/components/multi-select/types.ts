import React from 'react';
import type { Item } from '../select/types.js';

export type { Item };

/**
 * Props for the MultiSelectInput component.
 *
 * @typeParam T - The type of the value associated with each item.
 * @typeParam I - The extended item type, must extend Item<T>. Defaults to Item<T>.
 */
export interface MultiSelectInputProps<T, I extends Item<T> = Item<T>> {
  /**
   * Items to display in the list.
   * Each item must have `label` and `value`, and optionally a `Key` for React key.
   */
  readonly items: I[];

  /**
   * Controlled mode: currently selected values.
   * When provided, the component defers selection state to the parent.
   * When `undefined`, the component manages its own state (uncontrolled).
   */
  readonly selected?: T[];

  /**
   * Uncontrolled mode: initially selected values.
   * Only used when `selected` is `undefined`.
   *
   * @default []
   */
  readonly defaultSelected?: T[];

  /**
   * Called whenever the set of selected values changes.
   * Receives the full array of currently selected values.
   */
  readonly onChange?: (selected: T[]) => void;

  /**
   * Called when the user presses Enter to confirm their selection.
   * Receives the full array of currently selected values.
   */
  readonly onSubmit?: (selected: T[]) => void;

  /**
   * Called when an individual item is selected (toggled on).
   */
  readonly onSelect?: (item: I) => void;

  /**
   * Called when an individual item is unselected (toggled off).
   */
  readonly onUnselect?: (item: I) => void;

  /**
   * Called when the highlight cursor moves to a different item.
   */
  readonly onHighlight?: (item: I) => void;

  /**
   * Custom indicator component rendered before the checkbox.
   * Receives `isHighlighted` to show which item the cursor is on.
   */
  readonly indicatorComponent?: React.ComponentType<{
    isHighlighted: boolean;
  }>;

  /**
   * Custom checkbox component rendered between indicator and item.
   * Receives `isSelected` to show whether the item is checked.
   */
  readonly checkboxComponent?: React.ComponentType<{
    isSelected: boolean;
  }>;

  /**
   * Custom item renderer.
   * Receives all item properties plus `isHighlighted`.
   */
  readonly itemComponent?: React.ComponentType<
    I & { isHighlighted: boolean }
  >;

  /**
   * Focus identifier used by the keyboard system.
   * Must be unique on the current screen.
   */
  readonly focusId: string;

  /**
   * Maximum number of visible items before enabling scroll.
   *
   * @default 10
   */
  readonly limit?: number;

  /**
   * Index of the initially highlighted item (0-based).
   *
   * @default 0
   */
  readonly initialIndex?: number;
}
