import React, { useState, useEffect, useCallback } from 'react';
import { Text } from 'ink';
import chalk from 'chalk';
import { useKeyboard, useFocusState } from '../../keyboard/index.js';
import type { TextInputProps, UncontrolledTextInputProps } from './types.js';

/**
 * 将给定字符重复多次
 */
function repeatChar(char: string, count: number): string {
  return Array(count + 1).join(char);
}

/**
 * 计算光标在可见字符串中的偏移量，并生成带高亮（反色）的渲染结果
 */
function renderWithCursor(
  value: string,
  placeholder: string,
  mask: string | undefined,
  showCursor: boolean,
  isFocused: boolean,
  cursorOffset: number,
  cursorWidth: number,
  highlightPastedText: boolean,
): string {
  // 显示用的值：如果设置了掩码则每个字符替换为掩码字符
  const displayValue = mask ? repeatChar(mask, value.length) : value;

  // 未聚焦或不需要显示光标 → 直接返回纯文本（空时显示占位符）
  if (!showCursor || !isFocused) {
    if (displayValue.length === 0 && placeholder) {
      return chalk.grey(placeholder);
    }
    return displayValue;
  }

  // 聚焦且显示光标时的处理
  // 空值 + 有占位符 → 占位符第一个字符反色，其余灰色
  if (displayValue.length === 0 && placeholder) {
    if (placeholder.length === 0) return chalk.inverse(' ');
    return chalk.inverse(placeholder[0]) + chalk.grey(placeholder.slice(1));
  }

  // 实际高亮宽度（粘贴高亮时可能大于1）
  const actualHighlightWidth = highlightPastedText ? cursorWidth : 0;

  let result = '';
  for (let i = 0; i < displayValue.length; i++) {
    const isInHighlight = highlightPastedText
      ? i >= cursorOffset - actualHighlightWidth && i < cursorOffset
      : i >= cursorOffset - actualHighlightWidth && i <= cursorOffset;
    result += isInHighlight ? chalk.inverse(displayValue[i]) : displayValue[i];
  }

  // 光标在末尾时追加一个反色空格
  if (cursorOffset === displayValue.length) {
    result += chalk.inverse(' ');
  }

  return result;
}

/**
 * Controlled text input component integrated with the keyboard focus system.
 *
 * Supports:
 * - Arrow keys to move cursor
 * - Backspace/Delete to remove characters
 * - Regular character input (via wildcard '*')
 * - Optional mask (password mode)
 * - Paste highlighting (highlight the whole pasted block)
 * - Placeholder
 *
 * @example
 * ```tsx
 * const [name, setName] = useState('');
 * <TextInput
 *   focusId="name-field"
 *   value={name}
 *   onChange={setName}
 *   placeholder="Enter your name"
 *   showCursor
 * />
 * ```
 */
export function TextInput({
  placeholder = '',
  mask,
  showCursor = true,
  highlightPastedText = false,
  value: originalValue,
  onChange,
  onSubmit,
  focusId,
}: TextInputProps) {
  const isFocused = useFocusState(focusId);
  const { boundKeyboard, focusUnregister } = useKeyboard();

  // 光标位置（字符索引）
  const [cursorOffset, setCursorOffset] = useState(originalValue.length);
  // 粘贴高亮宽度（一次插入的字符数）
  const [cursorWidth, setCursorWidth] = useState(0);

  // 当外部 value 缩短时，修正光标位置避免越界
  useEffect(() => {
    setCursorOffset((prev) => Math.min(prev, originalValue.length));
  }, [originalValue]);

  /**
   * 移动光标（左右箭头调用）
   */
  const moveCursor = useCallback(
    (delta: number) => {
      if (!showCursor) return;
      setCursorOffset((prev) => {
        const next = prev + delta;
        if (next < 0) return 0;
        if (next > originalValue.length) return originalValue.length;
        return next;
      });
      // 光标移动后清除粘贴高亮
      setCursorWidth(0);
    },
    [showCursor, originalValue.length],
  );

  /**
   * 插入文本或删除字符
   * @param insertion 要插入的字符串，undefined 表示执行删除操作
   * @param isForwardDelete true 表示 Delete（删光标右侧），false/undefined 表示 Backspace（删光标左侧）
   */
  const modifyText = useCallback(
    (insertion?: string, isForwardDelete = false) => {
      let newValue = originalValue;
      let newOffset = cursorOffset;

      if (insertion === undefined) {
        // 删除操作
        if (isForwardDelete && cursorOffset < originalValue.length) {
          // Delete：删除光标右侧一个字符
          newValue =
            originalValue.slice(0, cursorOffset) +
            originalValue.slice(cursorOffset + 1);
          // 光标位置不变
        } else if (!isForwardDelete && cursorOffset > 0) {
          // Backspace：删除光标左侧一个字符
          newValue =
            originalValue.slice(0, cursorOffset - 1) +
            originalValue.slice(cursorOffset);
          newOffset = cursorOffset - 1;
        } else {
          return;
        }
      } else {
        // 插入
        newValue =
          originalValue.slice(0, cursorOffset) +
          insertion +
          originalValue.slice(cursorOffset);
        newOffset = cursorOffset + insertion.length;
      }

      // 边界保护
      newOffset = Math.max(0, Math.min(newOffset, newValue.length));

      setCursorOffset(newOffset);
      // 如果一次插入了多个字符且开启高亮，记录高亮宽度
      if (insertion && insertion.length > 1 && highlightPastedText) {
        setCursorWidth(insertion.length);
      } else {
        setCursorWidth(0);
      }

      if (newValue !== originalValue) {
        onChange(newValue);
      }
    },
    [originalValue, cursorOffset, onChange, highlightPastedText],
  );

  // 焦点目标生命周期 — 挂载/卸载时注册/注销，不随值变化重建
  useEffect(() => {
    return () => focusUnregister(focusId);
  }, []);

  // 注册键盘绑定（仅在获得焦点时生效）
  useEffect(() => {
    const fid = focusId;
    const unbindList: Array<() => void> = [];

    // 左右移动光标
    unbindList.push(boundKeyboard(['left'], () => moveCursor(-1), { focusId: fid }));
    unbindList.push(boundKeyboard(['right'], () => moveCursor(1), { focusId: fid }));

    // 退格 / 删除
    unbindList.push(
      boundKeyboard(['backspace'], () => modifyText(), { focusId: fid }),
    );
    unbindList.push(
      boundKeyboard(['delete'], () => modifyText(undefined, true), { focusId: fid }),
    );

    // 回车提交
    if (onSubmit) {
      unbindList.push(
        boundKeyboard(['return'], () => onSubmit(originalValue), { focusId: fid }),
      );
    }

    // 通配符 '*'：捕获所有普通字符输入
    unbindList.push(
      boundKeyboard(['*'], (input) => modifyText(input), { focusId: fid }),
    );

    // 清理：解绑所有键盘回调（焦点目标生命周期由独立 effect 管理）
    return () => {
      unbindList.forEach((fn) => fn());
    };
  }, [
    focusId,
    boundKeyboard,
    moveCursor,
    modifyText,
    onSubmit,
    originalValue,
  ]);

  // 渲染最终显示的文本
  const rendered = renderWithCursor(
    originalValue,
    placeholder,
    mask,
    showCursor,
    isFocused,
    cursorOffset,
    cursorWidth,
    highlightPastedText,
  );

  return React.createElement(Text, null, rendered);
}

/**
 * Uncontrolled text input component that manages its own internal state.
 *
 * @example
 * ```tsx
 * <UncontrolledTextInput
 *   focusId="search"
 *   initialValue="default"
 *   onSubmit={(val) => console.log(val)}
 * />
 * ```
 */
export function UncontrolledTextInput({
  initialValue = '',
  ...props
}: UncontrolledTextInputProps) {
  const [value, setValue] = useState(initialValue);
  return React.createElement(TextInput, {
    ...props,
    value,
    onChange: setValue,
  });
}
