import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { useKeyboard, useFocusState } from '../../keyboard/index.js';
import type { TabsProps } from './types.js';

export function Tabs({
  focusId,
  tabs,
  activeTab: controlledActive,
  onChange,
  defaultActiveTab,
  storage,
  storageKey,
}: TabsProps) {
  const isFocused = useFocusState(focusId);
  const { boundKeyboard, focusUnregister } = useKeyboard();

  const isControlled = controlledActive !== undefined;
  const [internalActive, setInternalActive] = useState(
    defaultActiveTab ?? tabs[0]?.id,
  );

  const persistKey = storageKey ?? `tabs:${focusId}`;

  useEffect(() => {
    if (!storage) return;
    let cancelled = false;
    storage.read.str(persistKey, defaultActiveTab ?? tabs[0]?.id ?? '').then((v) => {
      if (!cancelled) setInternalActive(v);
    });
    return () => { cancelled = true; };
  }, [storage, persistKey, defaultActiveTab, tabs]);

  const activeId = isControlled ? controlledActive : internalActive;
  const activeIndex = tabs.findIndex((t) => t.id === activeId);

  const prev = useCallback(() => {
    const nextIdx = activeIndex <= 0 ? tabs.length - 1 : activeIndex - 1;
    const id = tabs[nextIdx].id;
    if (isControlled) {
      onChange?.(id);
    } else {
      setInternalActive(id);
      storage?.write.str(persistKey, id);
    }
  }, [activeIndex, tabs, isControlled, onChange, storage, persistKey]);

  const next = useCallback(() => {
    const nextIdx = (activeIndex + 1) % tabs.length;
    const id = tabs[nextIdx].id;
    if (isControlled) {
      onChange?.(id);
    } else {
      setInternalActive(id);
      storage?.write.str(persistKey, id);
    }
  }, [activeIndex, tabs, isControlled, onChange, storage, persistKey]);

  useEffect(() => {
    const unLeft = boundKeyboard(['left'], () => prev(), { focusId });
    const unRight = boundKeyboard(['right'], () => next(), { focusId });
    return () => {
      unLeft();
      unRight();
      focusUnregister(focusId);
    };
  }, [focusId, boundKeyboard, focusUnregister, prev, next]);

  return (
    <Box flexDirection="column">
      <Box>
        {tabs.map((tab, i) => (
          <Box key={tab.id} marginRight={1} paddingX={1}>
            <Text
              color={i === activeIndex ? 'cyan' : 'grey'}
              bold={i === activeIndex}
              underline={i === activeIndex && isFocused}
            >
              {tab.label}
            </Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        {tabs[activeIndex]?.content}
      </Box>
    </Box>
  );
}
