import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Box, Text } from 'ink';
import { useKeyboard, useFocusState } from '../../keyboard/hook.js';
import type { SelectInputProps, Item } from './types.js';

function defaultIndicator({ isSelected }: { isSelected: boolean }) {
  return React.createElement(
    Box,
    { marginRight: 1 },
    isSelected
      ? React.createElement(Text, { color: 'blue' }, '\u276F')
      : React.createElement(Text, null, ' '),
  );
}

function defaultItem<T>(props: Item<T> & { isSelected: boolean }) {
  return React.createElement(
    Text,
    { color: props.isSelected ? 'blue' : undefined },
    props.label,
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max));
}

/**
 * A single-select list component integrated with the ink-kit keyboard and
 * focus system.
 *
 * Each instance registers a focus target identified by {@link SelectInputProps.focusId}
 * on the current screen's keyboard layer. Users navigate between multiple
 * SelectInputs on the same screen with Tab / Shift+Tab. Within the active
 * component, arrow keys (or vim-style j/k) move the highlight, and Enter
 * confirms the selection. Number keys 1-9 directly select an item.
 *
 * When the component is not the active focus target, its items are visually
 * dimmed and no key events are delivered to it.
 *
 * @typeParam T - The type of the value associated with each item.
 * @typeParam I - The extended item type, must extend Item<T>. Defaults to Item<T>.
 */
export function SelectInput<T, I extends Item<T> = Item<T>>({
  items = [],
  onSelect,
  itemComponent,
  indicatorComponent,
  focusId,
  limit = 10,
}: SelectInputProps<T, I>) {
  const isFocused = useFocusState(focusId);
  const { boundKeyboard, focusUnregister } = useKeyboard();

  const IndicatorComp = indicatorComponent ?? defaultIndicator;
  const ItemComp = (itemComponent ??
    (defaultItem as unknown as React.ComponentType<I & { isSelected: boolean }>));

  const hasLimit = items.length > limit;
  const limit = hasLimit ? limit : items.length;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const visibleItems = useMemo(() => {
    if (!hasLimit) return items;
    return items.slice(scrollOffset, scrollOffset + limit);
  }, [items, hasLimit, limit, scrollOffset]);

  const visibleItemsRef = useRef(visibleItems);
  visibleItemsRef.current = visibleItems;

  useEffect(() => {
    if (items.length === 0) {
      setSelectedIndex(0);
      setScrollOffset(0);
      return;
    }
    if (scrollOffset + limit > items.length) {
      setScrollOffset(Math.max(0, items.length - limit));
    }
    if (selectedIndex >= limit || selectedIndex >= visibleItems.length) {
      setSelectedIndex(clamp(items.length > 0 ? items.length - 1 : 0, 0, limit - 1));
    }
  }, [items.length, scrollOffset, limit, selectedIndex, visibleItems.length]);

  const moveHighlight = useCallback(
    (delta: number) => {
      setSelectedIndex((prev) => {
        if (!hasLimit) {
          return clamp(prev + delta, 0, Math.max(0, items.length - 1));
        }
        const absIdx = scrollOffset + prev;
        const newAbs = clamp(absIdx + delta, 0, Math.max(0, items.length - 1));
        if (newAbs < scrollOffset) {
          setScrollOffset(newAbs);
          return 0;
        }
        if (newAbs >= scrollOffset + limit) {
          setScrollOffset(newAbs - limit + 1);
          return limit - 1;
        }
        return newAbs - scrollOffset;
      });
    },
    [hasLimit, items.length, limit, scrollOffset],
  );

  useEffect(() => {
    const fid = focusId;

    const unUp = boundKeyboard(['up', 'k'], () => moveHighlight(-1), { focusId: fid });
    const unDown = boundKeyboard(['down', 'j'], () => moveHighlight(1), { focusId: fid });
    const unReturn = boundKeyboard(['return'], () => {
      const item = visibleItemsRef.current[selectedIndexRef.current];
      if (item) onSelectRef.current(item);
    }, { focusId: fid });

    const numUnbinds: Array<() => void> = [];
    for (let i = 1; i <= Math.min(9, visibleItems.length); i++) {
      const idx = i - 1;
      numUnbinds.push(
        boundKeyboard([String(i)], () => {
          const item = visibleItemsRef.current[idx];
          if (item) onSelectRef.current(item);
        }, { focusId: fid }),
      );
    }

    return () => {
      unUp();
      unDown();
      unReturn();
      numUnbinds.forEach((fn) => fn());
      focusUnregister(fid);
    };
  }, [
    focusId,
    boundKeyboard,
    focusUnregister,
    moveHighlight,
    visibleItems.length,
  ]);

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    ...visibleItems.map((item, index) => {
      const isItemSelected = index === selectedIndex && isFocused;
      return React.createElement(
        Box,
        { key: item.Key ?? String(item.value) },
        React.createElement(IndicatorComp, { isSelected: isItemSelected }),
        React.createElement(ItemComp, { ...item, isSelected: isItemSelected } as any),
      );
    }),
  );
}
