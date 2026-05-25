import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { CurrentScreen } from '../../screen/current-screen.js';
import { KeyboardProvider } from '../../keyboard/provider.js';
import { useKeyboard } from '../../keyboard/hook.js';
import { useScreenSystem } from '../../screen/hook.js';
import { SelectInput } from '../../components/select/SelectInput.js';
import type { Item } from '../../components/select/types.js';

const KEYS = {
  enter: '\r',
  escape: '\x1b',
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
} as const;

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

async function press(
  stdin: { write: (data: string) => void },
  key: string,
) {
  stdin.write(key);
  await new Promise((r) => setTimeout(r, 10));
}

/** 等待 React effects 刷完（focus 注册等） */
async function flush() {
  await new Promise((r) => setTimeout(r, 10));
}

const threeItems: Item<string>[] = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
  { label: 'Cyberpunk', value: 'cyberpunk' },
];

const longItems: Item<string>[] = Array.from({ length: 15 }, (_, i) => ({
  label: `Item ${String(i + 1).padStart(2, '0')}`,
  value: `v${String(i + 1).padStart(2, '0')}`,
}));

function renderSelectInput(props: {
  focusId: string;
  items: Item<string>[];
  onSelect?: (item: Item<string>) => void;
  itemComponent?: React.ComponentType<Item<string> & { isSelected: boolean }>;
  indicatorComponent?: React.ComponentType<{ isSelected: boolean }>;
  limit?: number;
}) {
  const onSelect = props.onSelect ?? vi.fn();

  function HostScreen() {
    return (
      <SelectInput
        focusId={props.focusId}
        items={props.items}
        onSelect={onSelect}
        itemComponent={props.itemComponent}
        indicatorComponent={props.indicatorComponent}
        limit={props.limit}
      />
    );
  }
  HostScreen.displayName = 'HostScreen';

  clearRegistry();
  registerComponent(HostScreen, {});

  const { lastFrame, stdin, unmount } = render(
    <ScenarioManagementProvider defaultScreen={HostScreen}>
      <KeyboardProvider>
        <CurrentScreen />
      </KeyboardProvider>
    </ScenarioManagementProvider>,
  );

  return {
    lastFrame,
    lastFrameClean: () => stripAnsi(lastFrame()),
    stdin,
    unmount,
    onSelect,
  };
}

function renderDualSelectInput(props: { items: Item<string>[] }) {
  const onSelectA = vi.fn();
  const onSelectB = vi.fn();
  const kbRef: { current: ReturnType<typeof useKeyboard> | null } = {
    current: null,
  };

  function HostScreen() {
    const kb = useKeyboard();
    useEffect(() => {
      kbRef.current = kb;
    }, [kb]);

    return (
      <Box flexDirection="column">
        <SelectInput
          focusId="select-a"
          items={props.items}
          onSelect={onSelectA}
        />
        <SelectInput
          focusId="select-b"
          items={props.items}
          onSelect={onSelectB}
        />
      </Box>
    );
  }
  HostScreen.displayName = 'DualHostScreen';

  clearRegistry();
  registerComponent(HostScreen, {});

  const { lastFrame, stdin, unmount } = render(
    <ScenarioManagementProvider defaultScreen={HostScreen}>
      <KeyboardProvider>
        <CurrentScreen />
      </KeyboardProvider>
    </ScenarioManagementProvider>,
  );

  return {
    lastFrame,
    lastFrameClean: () => stripAnsi(lastFrame()),
    stdin,
    unmount,
    onSelectA,
    onSelectB,
    kbRef,
  };
}

function renderNavigableSelectInput(items: Item<string>[]) {
  const onSelect = vi.fn();

  function Menu() {
    const sc = useScreenSystem();
    const { boundKeyboard } = useKeyboard();
    useEffect(() => {
      boundKeyboard(['s'], () => sc.skip(Settings, {}));
    }, []);
    return <Text>Menu - Press S to Settings</Text>;
  }
  Menu.displayName = 'Menu';

  function Settings() {
    const sc = useScreenSystem();
    const { boundKeyboard } = useKeyboard();
    useEffect(() => {
      boundKeyboard(['b'], () => sc.back());
    }, []);
    return (
      <SelectInput
        focusId="settings-select"
        items={items}
        onSelect={onSelect}
      />
    );
  }
  Settings.displayName = 'Settings';

  clearRegistry();
  registerComponent(Menu, {});
  registerComponent(Settings, {}, { parent: Menu });

  const { lastFrame, stdin, unmount } = render(
    <ScenarioManagementProvider defaultScreen={Menu}>
      <KeyboardProvider>
        <CurrentScreen />
      </KeyboardProvider>
    </ScenarioManagementProvider>,
  );

  return {
    lastFrame,
    lastFrameClean: () => stripAnsi(lastFrame()),
    stdin,
    unmount,
    onSelect,
  };
}

beforeEach(() => {
  clearRegistry();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════
// 1. 基础渲染
// ═══════════════════════════════════════════════════════════

describe('基础渲染', () => {
  it('渲染所有 item 的 label', () => {
    const { lastFrameClean } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
    });

    const output = lastFrameClean();
    expect(output).toContain('Dark');
    expect(output).toContain('Light');
    expect(output).toContain('Cyberpunk');
  });

  it('聚焦时，选中项（第 0 项）显示 ▶ 指示器', async () => {
    const { lastFrameClean } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
    });

    await flush();

    const output = lastFrameClean();
    expect(output).toContain('\u276F');
  });

  it('非选中项不显示 ▶，而是空格占位', async () => {
    const { lastFrameClean } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
    });

    await flush();

    const output = lastFrameClean();
    const count = (output.match(/\u276F/g) || []).length;
    expect(count).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════
// 2. 键盘导航
// ═══════════════════════════════════════════════════════════

describe('键盘导航', () => {
  it('↓ 将高亮移动到下一项，Enter 选择正确的项', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      onSelect,
    });

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.enter);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(threeItems[1]);
  });

  it('↑ 将高亮移动到上一项', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      onSelect,
    });

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.up);
    await press(stdin, KEYS.enter);

    expect(onSelect).toHaveBeenCalledWith(threeItems[1]);
  });

  it('在顶部按 ↑ 不越界，选中项保持第 0 项', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      onSelect,
    });

    await press(stdin, KEYS.up);
    await press(stdin, KEYS.up);
    await press(stdin, KEYS.up);
    await press(stdin, KEYS.enter);

    expect(onSelect).toHaveBeenCalledWith(threeItems[0]);
  });

  it('在底部按 ↓ 不越界，选中项保持最后一项', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      onSelect,
    });

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.enter);

    expect(onSelect).toHaveBeenCalledWith(threeItems[2]);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. 选择确认
// ═══════════════════════════════════════════════════════════

describe('选择确认', () => {
  it('初始状态下按 Enter 选择第 0 项', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      onSelect,
    });

    await press(stdin, KEYS.enter);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(threeItems[0]);
  });

  it('导航到第 3 项后 Enter 正确传递 item', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      onSelect,
    });

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.enter);

    expect(onSelect).toHaveBeenCalledWith(threeItems[2]);
  });

  it('onSelect 接收完整 Item 对象（含 label、value）', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      onSelect,
    });

    await press(stdin, KEYS.enter);

    const received = onSelect.mock.calls[0][0];
    expect(received).toEqual({ label: 'Dark', value: 'dark' });
  });
});

// ═══════════════════════════════════════════════════════════
// 4. 数字快捷键
// ═══════════════════════════════════════════════════════════

describe('数字快捷键', () => {
  it('按 1 选择第 1 个可见项（初始即第 0 项）', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      onSelect,
    });

    await press(stdin, '1');
    expect(onSelect).toHaveBeenCalledWith(threeItems[0]);
  });

  it('按 2 选择第 2 个可见项', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      onSelect,
    });

    await press(stdin, '2');
    expect(onSelect).toHaveBeenCalledWith(threeItems[1]);
  });

  it('按 3 选择第 3 个可见项', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      onSelect,
    });

    await press(stdin, '3');
    expect(onSelect).toHaveBeenCalledWith(threeItems[2]);
  });

  it('超过可见项数量的数字键不触发 onSelect', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      onSelect,
    });

    await press(stdin, '4');
    expect(onSelect).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════
// 5. 滚动
// ═══════════════════════════════════════════════════════════

describe('滚动（items > limit）', () => {
  it('items 超过默认 limit=10 时，只渲染最多 10 项', async () => {
    const { lastFrameClean } = renderSelectInput({
      focusId: 'test',
      items: longItems,
    });

    await flush();

    const output = lastFrameClean();
    expect(output).toContain('Item 01');
    expect(output).toContain('Item 10');
    expect(output).not.toContain('Item 11');
    expect(output).not.toContain('Item 15');
  });

  it('高亮向下移动超出窗口时自动滚动，新项出现旧项消失', async () => {
    const { lastFrameClean, stdin } = renderSelectInput({
      focusId: 'test',
      items: longItems,
    });

    for (let i = 0; i < 10; i++) {
      await press(stdin, KEYS.down);
    }

    const output = lastFrameClean();
    expect(output).not.toContain('Item 01');
    expect(output).toContain('Item 11');
    expect(output).toContain('Item 02');
    expect(output).toContain('Item 10');
  });

  it('高亮向上移动超出窗口时自动回滚，旧项重新出现', async () => {
    const { lastFrameClean, stdin } = renderSelectInput({
      focusId: 'test',
      items: longItems,
    });

    for (let i = 0; i < 10; i++) {
      await press(stdin, KEYS.down);
    }
    for (let i = 0; i < 10; i++) {
      await press(stdin, KEYS.up);
    }

    const output = lastFrameClean();
    expect(output).toContain('Item 01');
    expect(output).not.toContain('Item 11');
  });

  it('滚动后数字键选择的是窗口内的第 N 项，而非全局第 N 项', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: longItems,
      onSelect,
    });

    for (let i = 0; i < 10; i++) {
      await press(stdin, KEYS.down);
    }

    await press(stdin, '1');

    const calledWith = onSelect.mock.calls[0][0] as Item<string>;
    expect(calledWith).not.toEqual(longItems[0]);
  });

  it('滚动后 Enter 选择当前高亮项，而非固定第 0 项', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: longItems,
      onSelect,
    });

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.enter);

    expect(onSelect).toHaveBeenCalledWith(longItems[3]);
  });
});

// ═══════════════════════════════════════════════════════════
// 6. 焦点系统
// ═══════════════════════════════════════════════════════════

describe('焦点系统', () => {
  it('两个 SelectInput 中，第一个注册的自动获得焦点', async () => {
    const { kbRef } = renderDualSelectInput({ items: threeItems });

    await flush();

    expect(kbRef.current!.focusCurrent()).toBe('select-a');
  });

  it('只有获焦的 SelectInput 响应按键', async () => {
    const { stdin, onSelectA, onSelectB } = renderDualSelectInput({
      items: threeItems,
    });

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.enter);

    expect(onSelectA).toHaveBeenCalledTimes(1);
    expect(onSelectB).not.toHaveBeenCalled();
  });

  it('focusSet 切换焦点后，按键影响新的获焦组件', async () => {
    const { stdin, onSelectA, onSelectB, kbRef } = renderDualSelectInput({
      items: threeItems,
    });

    kbRef.current!.focusSet('select-b');
    expect(kbRef.current!.focusCurrent()).toBe('select-b');

    await press(stdin, KEYS.enter);
    expect(onSelectB).toHaveBeenCalledTimes(1);
    expect(onSelectA).not.toHaveBeenCalled();
    expect(onSelectB).toHaveBeenCalledWith(threeItems[0]);
  });

  it('焦点切换后，原获焦组件不再响应按键', async () => {
    const { stdin, onSelectA, onSelectB, kbRef } = renderDualSelectInput({
      items: threeItems,
    });

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.enter);
    expect(onSelectA).toHaveBeenCalledWith(threeItems[1]);

    kbRef.current!.focusSet('select-b');

    onSelectA.mockClear();
    onSelectB.mockClear();
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.enter);
    expect(onSelectA).not.toHaveBeenCalled();
    expect(onSelectB).toHaveBeenCalledTimes(1);
  });

  it('两个 SelectInput 各自的选中状态独立', async () => {
    const { stdin, onSelectA, onSelectB, kbRef } = renderDualSelectInput({
      items: threeItems,
    });

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.enter);
    expect(onSelectA).toHaveBeenCalledWith(threeItems[2]);

    onSelectA.mockClear();
    kbRef.current!.focusSet('select-b');
    await press(stdin, KEYS.enter);
    expect(onSelectB).toHaveBeenCalledWith(threeItems[0]);
  });
});

// ═══════════════════════════════════════════════════════════
// 7. 自定义渲染
// ═══════════════════════════════════════════════════════════

describe('自定义渲染', () => {
  const StarIndicator = ({ isSelected }: { isSelected: boolean }) => (
    <Box marginRight={1}>
      {isSelected ? <Text color="yellow">*</Text> : <Text> </Text>}
    </Box>
  );

  const CustomItem = ({
    label,
    isSelected,
  }: Item<string> & { isSelected: boolean }) => (
    <Text color={isSelected ? 'greenBright' : 'grey'}>
      {isSelected ? `[>] ${label}` : `[ ] ${label}`}
    </Text>
  );

  it('自定义 indicator 渲染成功', async () => {
    const { lastFrameClean } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      indicatorComponent: StarIndicator,
    });

    await flush();

    const output = lastFrameClean();
    expect(output).toContain('*');
    expect(output).not.toContain('\u276F');
  });

  it('自定义 item 渲染成功', async () => {
    const { lastFrameClean } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      itemComponent: CustomItem,
    });

    await flush();

    const output = lastFrameClean();
    expect(output).toContain('[>]');
  });

  it('自定义 indicator + item 同时生效', async () => {
    const { lastFrameClean } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      indicatorComponent: StarIndicator,
      itemComponent: CustomItem,
    });

    await flush();

    const output = lastFrameClean();
    expect(output).toContain('*');
    expect(output).toContain('[>]');
    expect(output).not.toContain('\u276F');
  });

  it('选中项与未选中项样式不同', async () => {
    const { lastFrameClean } = renderSelectInput({
      focusId: 'test',
      items: threeItems,
      itemComponent: CustomItem,
    });

    await flush();

    const output = lastFrameClean();
    expect(output).toContain('[>]');
    expect(output).toContain('[ ]');
  });
});

// ═══════════════════════════════════════════════════════════
// 8. 空列表
// ═══════════════════════════════════════════════════════════

describe('空列表', () => {
  it('items=[] 时不抛错且正常渲染', () => {
    expect(() => {
      renderSelectInput({ focusId: 'test', items: [] });
    }).not.toThrow();
  });

  it('空列表时按方向键不抛错', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: [],
      onSelect,
    });

    await expect(press(stdin, KEYS.down)).resolves.not.toThrow();
    await expect(press(stdin, KEYS.up)).resolves.not.toThrow();
    await expect(press(stdin, KEYS.enter)).resolves.not.toThrow();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('空列表时数字键不抛错', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: [],
      onSelect,
    });

    await expect(press(stdin, '1')).resolves.not.toThrow();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════
// 9. limit 自定义值
// ═══════════════════════════════════════════════════════════

describe('limit 自定义值', () => {
  it('limit=3 时只显示 3 项', async () => {
    const { lastFrameClean } = renderSelectInput({
      focusId: 'test',
      items: longItems,
      limit: 3,
    });

    await flush();

    const output = lastFrameClean();
    expect(output).toContain('Item 01');
    expect(output).toContain('Item 02');
    expect(output).toContain('Item 03');
    expect(output).not.toContain('Item 04');
  });

  it('limit=3 时数字键只绑定 1-3', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderSelectInput({
      focusId: 'test',
      items: longItems,
      limit: 3,
      onSelect,
    });

    await press(stdin, '3');
    expect(onSelect).toHaveBeenCalledWith(longItems[2]);

    onSelect.mockClear();
    await press(stdin, '4');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('limit=3 时向下滚动，窗口移动', async () => {
    const { lastFrameClean, stdin } = renderSelectInput({
      focusId: 'test',
      items: longItems,
      limit: 3,
    });

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);

    const output = lastFrameClean();
    expect(output).not.toContain('Item 01');
    expect(output).toContain('Item 04');
  });
});

// ═══════════════════════════════════════════════════════════
// 10. items 动态变化
// ═══════════════════════════════════════════════════════════

describe('items 动态变化', () => {
  it('items 数量减少后 selectedIndex 自动修正，不越界', async () => {
    let setItems!: (items: Item<string>[]) => void;

    function HostScreen() {
      const [items, _setItems] = useState(threeItems);
      setItems = _setItems;
      return (
        <SelectInput focusId="test" items={items} onSelect={vi.fn()} />
      );
    }
    HostScreen.displayName = 'DynamicHost';

    clearRegistry();
    registerComponent(HostScreen, {});

    const { lastFrame, stdin } = render(
      <ScenarioManagementProvider defaultScreen={HostScreen}>
        <KeyboardProvider>
          <CurrentScreen />
        </KeyboardProvider>
      </ScenarioManagementProvider>,
    );

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);

    expect(() => setItems([{ label: 'Only', value: 'only' }])).not.toThrow();

    await flush();

    const output = stripAnsi(lastFrame());
    expect(output).toContain('Only');
    expect(output).not.toContain('Dark');
    expect(output).not.toContain('Light');
    expect(output).not.toContain('Cyberpunk');
  });

  it('items 动态增长后正常渲染新增项', async () => {
    let setItems!: (items: Item<string>[]) => void;

    const initialItems: Item<string>[] = [{ label: 'A', value: 'a' }];

    function HostScreen() {
      const [items, _setItems] = useState(initialItems);
      setItems = _setItems;
      return (
        <SelectInput focusId="test" items={items} onSelect={vi.fn()} />
      );
    }
    HostScreen.displayName = 'GrowHost';

    clearRegistry();
    registerComponent(HostScreen, {});

    const { lastFrame, stdin } = render(
      <ScenarioManagementProvider defaultScreen={HostScreen}>
        <KeyboardProvider>
          <CurrentScreen />
        </KeyboardProvider>
      </ScenarioManagementProvider>,
    );

    // 等 effect 跑完、focus 注册
    await flush();

    setItems([
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ]);

    // 发送一个按键确保渲染周期完成
    await press(stdin, KEYS.down);

    const output = stripAnsi(lastFrame());
    expect(output).toContain('A');
    expect(output).toContain('B');
    expect(output).toContain('C');
  });
});

// ═══════════════════════════════════════════════════════════
// 11. 组件卸载清理
// ═══════════════════════════════════════════════════════════

describe('组件卸载清理', () => {
  it('离开屏幕后按键不再触发 onSelect', async () => {
    const { stdin, onSelect, lastFrameClean } =
      renderNavigableSelectInput(threeItems);

    expect(lastFrameClean()).toContain('Menu');

    await press(stdin, 's');
    expect(lastFrameClean()).toContain('Dark');

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.enter);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(threeItems[1]);

    onSelect.mockClear();
    await press(stdin, 'b');
    expect(lastFrameClean()).toContain('Menu');

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.up);
    await press(stdin, KEYS.enter);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('返回后重新进入，SelectInput 重新初始化并正常工作', async () => {
    const { stdin, onSelect, lastFrameClean } =
      renderNavigableSelectInput(threeItems);

    await press(stdin, 's');
    await press(stdin, KEYS.enter);
    expect(onSelect).toHaveBeenCalledWith(threeItems[0]);

    await press(stdin, 'b');
    await press(stdin, 's');

    onSelect.mockClear();
    await press(stdin, KEYS.enter);
    expect(onSelect).toHaveBeenCalledWith(threeItems[0]);
  });
});

// ═══════════════════════════════════════════════════════════
// 12. 非聚焦渲染
// ═══════════════════════════════════════════════════════════

describe('非聚焦渲染（isFocused=false）', () => {
  it('未获焦的 SelectInput 不显示 ▶ 指示器', async () => {
    const { lastFrameClean, kbRef } = renderDualSelectInput({
      items: threeItems,
    });

    await flush();

    const output = lastFrameClean();
    const count = (output.match(/\u276F/g) || []).length;
    expect(count).toBe(1);

    kbRef.current!.focusSet('select-b');

    await flush();

    const output2 = lastFrameClean();
    const count2 = (output2.match(/\u276F/g) || []).length;
    expect(count2).toBe(1);
  });

  it('焦点切换后，新获焦组件显示 ▶，原组件不再显示 ▶', async () => {
    const { lastFrameClean, kbRef } = renderDualSelectInput({
      items: threeItems,
    });

    await flush();

    const before = lastFrameClean();
    const beforeCount = (before.match(/\u276F/g) || []).length;
    expect(beforeCount).toBe(1);

    kbRef.current!.focusSet('select-b');

    await flush();

    const after = lastFrameClean();
    const afterCount = (after.match(/\u276F/g) || []).length;
    expect(afterCount).toBe(1);
  });
});
