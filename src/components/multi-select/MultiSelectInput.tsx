import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { Box, Text } from 'ink';
import { useKeyboard, useFocusState } from '../../keyboard/hook.js';
import type { MultiSelectInputProps, Item } from './types.js';

/**
 * Default indicator: shows a blue ❯ pointer when highlighted,
 * otherwise a blank space.
 */
function defaultIndicator({ isHighlighted }: { isHighlighted: boolean }) {
  return React.createElement(
    Box,
    { marginRight: 1 },
    isHighlighted
      ? React.createElement(Text, { color: 'blue' }, '\u276F')
      : React.createElement(Text, null, ' '),
  );
}

/**
 * Default checkbox: shows a green ◉ when selected,
 * otherwise a plain ○.
 */
function defaultCheckbox({ isSelected }: { isSelected: boolean }) {
  return React.createElement(
    Box,
    { marginRight: 1 },
    React.createElement(
      Text,
      { color: 'green' },
      isSelected ? '\u25C9' : '\u25CB',
    ),
  );
}

/**
 * Default item renderer: blue label when highlighted,
 * default color otherwise.
 */
function defaultItem<T>(props: Item<T> & { isHighlighted: boolean }) {
  return React.createElement(
    Text,
    { color: props.isHighlighted ? 'blue' : undefined },
    props.label,
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max));
}

/**
 * Multi-select list component integrated with the ink-kit keyboard and
 * focus system.
 *
 * Users navigate with arrow keys (or vim-style j/k), toggle items with
 * Space, and confirm with Enter. Number keys 1-9 toggle the corresponding
 * visible item directly.
 *
 * When the component is not the active focus target, its highlight is
 * hidden but selection checkboxes remain visible.
 *
 * Supports both **controlled** (`selected` prop) and **uncontrolled**
 * (`defaultSelected` prop) usage.
 *
 * @typeParam T - The type of the value associated with each item.
 * @typeParam I - The extended item type, must extend Item<T>.
 *                 Defaults to Item<T>.
 *
 * @example
 * ```tsx
 * // Uncontrolled
 * <MultiSelectInput
 *   focusId="colors"
 *   items={[
 *     { label: 'Red',  value: 'red' },
 *     { label: 'Blue', value: 'blue' },
 *   ]}
 *   defaultSelected={['red']}
 *   onSubmit={(vals) => console.log('Confirmed:', vals)}
 * />
 *
 * // Controlled
 * const [sel, setSel] = useState<string[]>([]);
 * <MultiSelectInput
 *   focusId="colors"
 *   items={items}
 *   selected={sel}
 *   onChange={setSel}
 * />
 * ```
 */
export function MultiSelectInput<T, I extends Item<T> = Item<T>>({
  items = [],
  selected: controlledSelected,
  defaultSelected = [],
  onChange,
  onSubmit,
  onSelect,
  onUnselect,
  onHighlight,
  indicatorComponent,
  checkboxComponent,
  itemComponent,
  focusId,
  limit: limitProp = 10,
  initialIndex = 0,
}: MultiSelectInputProps<T, I>) {
  const isFocused = useFocusState(focusId);
  const { boundKeyboard, focusUnregister } = useKeyboard();

  const IndicatorComp = indicatorComponent ?? defaultIndicator;
  const CheckboxComp = checkboxComponent ?? defaultCheckbox;
  const ItemComp = (
    itemComponent ??
    (defaultItem as unknown as React.ComponentType<
      I & { isHighlighted: boolean }
    >)
  );

  const isControlled = controlledSelected !== undefined;

  const [internalSelected, setInternalSelected] =
    useState<T[]>(defaultSelected);

  const selectedValues: T[] = isControlled
    ? (controlledSelected as T[])
    : internalSelected;

  const selectedSet = useMemo(
    () => new Set(selectedValues),
    [selectedValues],
  );

  const hasLimit = items.length > limitProp;
  const limit = hasLimit ? limitProp : items.length;

  const [highlightedIndex, setHighlightedIndex] =
    useState(initialIndex);
  const [scrollOffset, setScrollOffset] = useState(0);

  const visibleItems = useMemo(() => {
    if (!hasLimit) return items;
    return items.slice(scrollOffset, scrollOffset + limit);
  }, [items, hasLimit, limit, scrollOffset]);

  // 用 ref 保存最新值，避免键盘回调中的闭包过期
  const highlightedIndexRef = useRef(highlightedIndex);
  highlightedIndexRef.current = highlightedIndex;

  const selectedValuesRef = useRef(selectedValues);
  selectedValuesRef.current = selectedValues;

  const selectedSetRef = useRef(selectedSet);
  selectedSetRef.current = selectedSet;

  const visibleItemsRef = useRef(visibleItems);
  visibleItemsRef.current = visibleItems;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const onUnselectRef = useRef(onUnselect);
  onUnselectRef.current = onUnselect;

  const onHighlightRef = useRef(onHighlight);
  onHighlightRef.current = onHighlight;

  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;

  // items 变化时修正 scroll / highlight 溢出
  useEffect(() => {
    if (items.length === 0) {
      setHighlightedIndex(0);
      setScrollOffset(0);
      return;
    }
    if (scrollOffset + limit > items.length) {
      setScrollOffset(Math.max(0, items.length - limit));
    }
    if (
      highlightedIndex >= limit ||
      highlightedIndex >= visibleItems.length
    ) {
      setHighlightedIndex(
        clamp(
          items.length > 0 ? items.length - 1 : 0,
          0,
          limit - 1,
        ),
      );
    }
  }, [
    items.length,
    scrollOffset,
    limit,
    highlightedIndex,
    visibleItems.length,
  ]);

  // 高亮变化时通知外部
  useEffect(() => {
    const item = visibleItems[highlightedIndex];
    if (item && onHighlightRef.current) {
      onHighlightRef.current(item);
    }
  }, [highlightedIndex, visibleItems]);

  // 移动高亮光标
  const moveHighlight = useCallback(
    (delta: number) => {
      setHighlightedIndex((prev) => {
        if (!hasLimit) {
          return clamp(
            prev + delta,
            0,
            Math.max(0, items.length - 1),
          );
        }

        const absIdx = scrollOffset + prev;
        const newAbs = clamp(
          absIdx + delta,
          0,
          Math.max(0, items.length - 1),
        );

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

  // 切换选中状态
  const toggleItem = useCallback(
    (item: I) => {
      const isCurrentlySelected = selectedSetRef.current.has(
        item.value,
      );

      let newSelected: T[];
      if (isCurrentlySelected) {
        newSelected = selectedValuesRef.current.filter(
          (v) => v !== item.value,
        );
        onUnselectRef.current?.(item);
      } else {
        newSelected = [
          ...selectedValuesRef.current,
          item.value,
        ];
        onSelectRef.current?.(item);
      }

      onChangeRef.current?.(newSelected);

      if (!isControlledRef.current) {
        setInternalSelected(newSelected);
      }
    },
    [], // 所有依赖都是 ref，引用稳定
  );

  // 提交
  const handleSubmit = useCallback(() => {
    onSubmitRef.current?.(selectedValuesRef.current);
  }, []);

  // 注册键盘绑定
  useEffect(() => {
    const fid = focusId;

    const unUp = boundKeyboard(
      ['up', 'k'],
      () => moveHighlight(-1),
      { focusId: fid },
    );
    const unDown = boundKeyboard(
      ['down', 'j'],
      () => moveHighlight(1),
      { focusId: fid },
    );

    // 空格键在 Ink 中规范化后是 ' '（非 'space'）
    const unSpace = boundKeyboard(
      [' '],
      () => {
        const item =
          visibleItemsRef.current[highlightedIndexRef.current];
        if (item) toggleItem(item);
      },
      { focusId: fid },
    );

    const unReturn = boundKeyboard(
      ['return'],
      () => handleSubmit(),
      { focusId: fid },
    );

    // 数字键 1-9 直接切换对应可见项
    const numUnbinds: Array<() => void> = [];
    for (
      let i = 1;
      i <= Math.min(9, visibleItems.length);
      i++
    ) {
      const idx = i - 1;
      numUnbinds.push(
        boundKeyboard(
          [String(i)],
          () => {
            const item = visibleItemsRef.current[idx];
            if (item) toggleItem(item);
          },
          { focusId: fid },
        ),
      );
    }

    return () => {
      unUp();
      unDown();
      unSpace();
      unReturn();
      numUnbinds.forEach((fn) => fn());
      focusUnregister(fid);
    };
  }, [
    focusId,
    boundKeyboard,
    focusUnregister,
    moveHighlight,
    toggleItem,
    handleSubmit,
    visibleItems.length,
  ]);

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    ...visibleItems.map((item, index) => {
      const isItemHighlighted =
        index === highlightedIndex && isFocused;
      const isItemSelected = selectedSet.has(item.value);

      return React.createElement(
        Box,
        { key: item.Key ?? String(item.value) },
        React.createElement(IndicatorComp, {
          isHighlighted: isItemHighlighted,
        }),
        React.createElement(CheckboxComp, {
          isSelected: isItemSelected,
        }),
        React.createElement(ItemComp, {
          ...item,
          isHighlighted: isItemHighlighted,
        } as any),
      );
    }),
  );
}
