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
import { MultiSelectInput } from '../../components/multi-select/MultiSelectInput.js';
import type { Item } from '../../components/select/types.js';

const KEYS = {
  enter: '\r',
  escape: '\x1b',
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
  space: ' ',
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

// 受控模式 render helper：内部维护 selected state，同时透传所有回调
function renderControlled(props: {
  focusId: string;
  items: Item<string>[];
  selected?: string[];
  onChange?: (selected: string[]) => void;
  onSubmit?: (selected: string[]) => void;
  onSelect?: (item: Item<string>) => void;
  onUnselect?: (item: Item<string>) => void;
  onHighlight?: (item: Item<string>) => void;
  limit?: number;
  defaultSelected?: string[];
  initialIndex?: number;
}) {
  function HostScreen() {
    const [selected, setSelected] = useState<string[]>(
      props.selected ?? props.defaultSelected ?? [],
    );
    const handleChange = (vals: string[]) => {
      setSelected(vals);
      props.onChange?.(vals);
    };
    return React.createElement(MultiSelectInput, {
      focusId: props.focusId,
      items: props.items,
      selected,
      onChange: handleChange,
      onSubmit: props.onSubmit,
      onSelect: props.onSelect,
      onUnselect: props.onUnselect,
      onHighlight: props.onHighlight,
      limit: props.limit,
      initialIndex: props.initialIndex,
    } as any);
  }
  HostScreen.displayName = 'HostScreenControlled';

  clearRegistry();
  registerComponent(HostScreen, {});

  const { lastFrame, stdin, unmount } = render(
    React.createElement(
      ScenarioManagementProvider,
      { defaultScreen: HostScreen },
      React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
    ),
  );

  return {
    lastFrame,
    lastFrameClean: () => stripAnsi(lastFrame()),
    stdin,
    unmount,
  };
}

// 双组件 render helper：用于焦点隔离测试
function renderDualMultiSelectInput(props: { items: Item<string>[] }) {
  const onChangeA = vi.fn();
  const onChangeB = vi.fn();
  const onSubmitA = vi.fn();
  const onSubmitB = vi.fn();
  const kbRef: { current: ReturnType<typeof useKeyboard> | null } = {
    current: null,
  };

  function HostScreen() {
    const kb = useKeyboard();
    useEffect(() => {
      kbRef.current = kb;
    }, [kb]);

    const [selA, setSelA] = useState<string[]>([]);
    const [selB, setSelB] = useState<string[]>([]);

    return React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(MultiSelectInput, {
        focusId: 'select-a',
        items: props.items,
        selected: selA,
        onChange: (vals: string[]) => {
          setSelA(vals);
          onChangeA(vals);
        },
        onSubmit: onSubmitA,
      } as any),
      React.createElement(MultiSelectInput, {
        focusId: 'select-b',
        items: props.items,
        selected: selB,
        onChange: (vals: string[]) => {
          setSelB(vals);
          onChangeB(vals);
        },
        onSubmit: onSubmitB,
      } as any),
    );
  }
  HostScreen.displayName = 'DualHostScreen';

  clearRegistry();
  registerComponent(HostScreen, {});

  const { lastFrame, stdin, unmount } = render(
    React.createElement(
      ScenarioManagementProvider,
      { defaultScreen: HostScreen },
      React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
    ),
  );

  return {
    lastFrame,
    lastFrameClean: () => stripAnsi(lastFrame()),
    stdin,
    unmount,
    onChangeA,
    onChangeB,
    onSubmitA,
    onSubmitB,
    kbRef,
  };
}

// 可导航屏幕 render helper：用于组件卸载清理测试
function renderNavigableMultiSelect(items: Item<string>[]) {
  const onChange = vi.fn();
  const onSubmit = vi.fn();

  function Menu() {
    const sc = useScreenSystem();
    const { boundKeyboard } = useKeyboard();
    useEffect(() => {
      boundKeyboard(['s'], () => sc.skip(Settings, {}));
    }, []);
    return React.createElement(Text, null, 'Menu - Press S to Settings');
  }
  Menu.displayName = 'Menu';

  function Settings() {
    const sc = useScreenSystem();
    const { boundKeyboard } = useKeyboard();
    const [sel, setSel] = useState<string[]>([]);
    useEffect(() => {
      boundKeyboard(['b'], () => sc.back());
    }, []);
    return React.createElement(MultiSelectInput, {
      focusId: 'settings-select',
      items,
      selected: sel,
      onChange: (vals: string[]) => {
        setSel(vals);
        onChange(vals);
      },
      onSubmit,
    } as any);
  }
  Settings.displayName = 'Settings';

  clearRegistry();
  registerComponent(Menu, {});
  registerComponent(Settings, {}, { parent: Menu });

  const { lastFrame, stdin, unmount } = render(
    React.createElement(
      ScenarioManagementProvider,
      { defaultScreen: Menu },
      React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
    ),
  );

  return {
    lastFrame,
    lastFrameClean: () => stripAnsi(lastFrame()),
    stdin,
    unmount,
    onChange,
    onSubmit,
  };
}

beforeEach(() => {
  clearRegistry();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('基础渲染', () => {
  it('渲染所有 item 的 label', () => {
    const { lastFrameClean } = renderControlled({
      focusId: 'test',
      items: threeItems,
    });

    const output = lastFrameClean();
    expect(output).toContain('Dark');
    expect(output).toContain('Light');
    expect(output).toContain('Cyberpunk');
  });

  it('初始状态下所有复选框显示为 ○（未选中）', () => {
    const { lastFrameClean } = renderControlled({
      focusId: 'test',
      items: threeItems,
    });

    const output = lastFrameClean();
    expect(output).toContain('\u25CB');
    expect(output).not.toContain('\u25C9');
  });

  it('空列表正常渲染不抛错', () => {
    expect(() => {
      renderControlled({ focusId: 'test', items: [] });
    }).not.toThrow();
  });
});

describe('键盘导航', () => {
  it('↓ 将高亮移动到下一项', async () => {
    const onHighlight = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onHighlight,
    });

    await press(stdin, KEYS.down);
    expect(onHighlight).toHaveBeenCalledWith(threeItems[1]);
  });

  it('↑ 将高亮移动到上一项', async () => {
    const onHighlight = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onHighlight,
    });

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.up);
    expect(onHighlight).toHaveBeenLastCalledWith(threeItems[1]);
  });

  it('在顶部按 ↑ 不越界', async () => {
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
    });

    await press(stdin, KEYS.up);
    await press(stdin, KEYS.up);
    await expect(press(stdin, KEYS.up)).resolves.not.toThrow();
  });

  it('在底部按 ↓ 不越界', async () => {
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
    });

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await expect(press(stdin, KEYS.down)).resolves.not.toThrow();
  });

  it('j / k 分别对应 ↓ / ↑', async () => {
    const onHighlight = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onHighlight,
    });

    await press(stdin, 'j');
    expect(onHighlight).toHaveBeenCalledWith(threeItems[1]);

    await press(stdin, 'k');
    expect(onHighlight).toHaveBeenCalledWith(threeItems[0]);
  });
});

describe('空格切换选中', () => {
  it('Space 选中当前高亮项，复选框变为 ◉', async () => {
    const onChange = vi.fn();
    const { stdin, lastFrameClean } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onChange,
    });

    await press(stdin, KEYS.space);

    expect(onChange).toHaveBeenCalledWith(['dark']);

    const output = lastFrameClean();
    expect(output).toContain('\u25C9');
  });

  it('Space 再次触发取消选中，复选框变回 ○', async () => {
    const onChange = vi.fn();
    const { stdin, lastFrameClean } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onChange,
    });

    await press(stdin, KEYS.space);
    expect(onChange).toHaveBeenLastCalledWith(['dark']);

    await press(stdin, KEYS.space);
    expect(onChange).toHaveBeenLastCalledWith([]);

    const output = stripAnsi(lastFrameClean());
    expect(output).not.toContain('\u25C9');
  });

  it('可以同时选中多项', async () => {
    const onChange = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onChange,
    });

    await press(stdin, KEYS.space);
    expect(onChange).toHaveBeenLastCalledWith(['dark']);

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.space);
    expect(onChange).toHaveBeenLastCalledWith(['dark', 'light']);

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.space);
    expect(onChange).toHaveBeenLastCalledWith(['dark', 'light', 'cyberpunk']);
  });

  it('onSelect / onUnselect 分别在选中/取消时触发', async () => {
    const onSelect = vi.fn();
    const onUnselect = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onSelect,
      onUnselect,
    });

    await press(stdin, KEYS.space);
    expect(onSelect).toHaveBeenCalledWith(threeItems[0]);
    expect(onUnselect).not.toHaveBeenCalled();

    await press(stdin, KEYS.space);
    expect(onUnselect).toHaveBeenCalledWith(threeItems[0]);
  });
});

describe('全选/取消全选', () => {
  it('a 选中所有项', async () => {
    const onChange = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onChange,
    });

    await press(stdin, 'a');
    expect(onChange).toHaveBeenCalledWith(['dark', 'light', 'cyberpunk']);
  });

  it('a 触发每个未选中项的 onSelect', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onSelect,
    });

    await press(stdin, 'a');
    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(onSelect).toHaveBeenCalledWith(threeItems[0]);
    expect(onSelect).toHaveBeenCalledWith(threeItems[1]);
    expect(onSelect).toHaveBeenCalledWith(threeItems[2]);
  });

  it('q 取消所有选中', async () => {
    const onChange = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onChange,
    });

    await press(stdin, 'a');
    onChange.mockClear();

    await press(stdin, 'q');
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('q 触发每个已选项的 onUnselect', async () => {
    const onUnselect = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onUnselect,
    });

    // 先全选，再取消全选
    await press(stdin, 'a');
    await press(stdin, 'q');

    expect(onUnselect).toHaveBeenCalledTimes(3);
    expect(onUnselect).toHaveBeenCalledWith(threeItems[0]);
    expect(onUnselect).toHaveBeenCalledWith(threeItems[1]);
    expect(onUnselect).toHaveBeenCalledWith(threeItems[2]);
  });

  it('空列表时 a/q 不报错', async () => {
    const onChange = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: [],
      onChange,
    });

    await expect(press(stdin, 'a')).resolves.not.toThrow();
    await expect(press(stdin, 'q')).resolves.not.toThrow();
    // a 触发 onChange([])，q 再次触发 onChange([])
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('a 后 q 然后 Space 选中正常', async () => {
    const onChange = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onChange,
    });

    await press(stdin, 'a');
    onChange.mockClear();

    await press(stdin, 'q');
    onChange.mockClear();

    await press(stdin, KEYS.space);
    expect(onChange).toHaveBeenCalledWith(['dark']);
  });
});

describe('回车提交', () => {
  it('Enter 触发 onSubmit，传递当前已选 values', async () => {
    const onSubmit = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onSubmit,
    });

    await press(stdin, KEYS.space);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.space);

    await press(stdin, KEYS.enter);
    expect(onSubmit).toHaveBeenCalledWith(['dark', 'light']);
  });

  it('未选中任何项时提交空数组', async () => {
    const onSubmit = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onSubmit,
    });

    await press(stdin, KEYS.enter);
    expect(onSubmit).toHaveBeenCalledWith([]);
  });

  it('未传 onSubmit 时按 Enter 不抛错', async () => {
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
    });

    await expect(press(stdin, KEYS.enter)).resolves.not.toThrow();
  });
});

describe('数字快捷键', () => {
  it('按 1 切换第 1 个可见项', async () => {
    const onChange = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onChange,
    });

    await press(stdin, '1');
    expect(onChange).toHaveBeenCalledWith(['dark']);

    await press(stdin, '1');
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('按 2 切换第 2 个可见项', async () => {
    const onChange = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onChange,
    });

    await press(stdin, '2');
    expect(onChange).toHaveBeenCalledWith(['light']);
  });

  it('超过可见项数量的数字键不触发 onChange', async () => {
    const onChange = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      onChange,
    });

    await press(stdin, '4');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('滚动（items > limit）', () => {
  it('items 超过默认 limit=10 时只渲染最多 10 项', async () => {
    const { lastFrameClean } = renderControlled({
      focusId: 'test',
      items: longItems,
    });

    await flush();

    const output = lastFrameClean();
    expect(output).toContain('Item 01');
    expect(output).toContain('Item 10');
    expect(output).not.toContain('Item 11');
  });

  it('高亮向下超出窗口时自动滚动，新项出现旧项消失', async () => {
    const { lastFrameClean, stdin } = renderControlled({
      focusId: 'test',
      items: longItems,
    });

    for (let i = 0; i < 10; i++) {
      await press(stdin, KEYS.down);
    }

    const output = lastFrameClean();
    expect(output).not.toContain('Item 01');
    expect(output).toContain('Item 11');
  });

  it('高亮向上回滚，旧项重新出现', async () => {
    const { lastFrameClean, stdin } = renderControlled({
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

  it('滚动后数字键切换窗口内的第 N 项', async () => {
    const onChange = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: longItems,
      onChange,
    });

    for (let i = 0; i < 10; i++) {
      await press(stdin, KEYS.down);
    }

    await press(stdin, '1');
    const firstCall = onChange.mock.calls[0][0] as string[];
    // 滚动后窗口内的第 1 项不再是全局第 1 项
    expect(firstCall).not.toContain('v01');
  });

  it('滚动后 Space 选中当前高亮项', async () => {
    const onChange = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: longItems,
      onChange,
    });

    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.space);

    expect(onChange).toHaveBeenCalledWith(['v04']);
  });
});

describe('焦点系统', () => {
  it('两个 MultiSelectInput 中，第一个注册的自动获得焦点', async () => {
    const { kbRef } = renderDualMultiSelectInput({ items: threeItems });
    await flush();
    expect(kbRef.current!.focusCurrent()).toBe('select-a');
  });

  it('只有获焦的 MultiSelectInput 响应 Space', async () => {
    const { stdin, onChangeA, onChangeB } =
      renderDualMultiSelectInput({ items: threeItems });

    await press(stdin, KEYS.space);
    expect(onChangeA).toHaveBeenCalledTimes(1);
    expect(onChangeB).not.toHaveBeenCalled();
  });

  it('focusSet 切换焦点后，按键影响新的获焦组件', async () => {
    const { stdin, onChangeA, onChangeB, kbRef } =
      renderDualMultiSelectInput({ items: threeItems });

    kbRef.current!.focusSet('select-b');
    expect(kbRef.current!.focusCurrent()).toBe('select-b');

    await press(stdin, KEYS.space);
    expect(onChangeB).toHaveBeenCalledTimes(1);
    expect(onChangeA).not.toHaveBeenCalled();
  });

  it('焦点切换后，原获焦组件不再响应按键', async () => {
    const { stdin, onChangeA, onChangeB, kbRef } =
      renderDualMultiSelectInput({ items: threeItems });

    await press(stdin, KEYS.space);
    expect(onChangeA).toHaveBeenCalledWith(['dark']);

    kbRef.current!.focusSet('select-b');

    onChangeA.mockClear();
    onChangeB.mockClear();

    await press(stdin, KEYS.space);
    expect(onChangeA).not.toHaveBeenCalled();
    expect(onChangeB).toHaveBeenCalledWith(['dark']);
  });

  it('两个 MultiSelectInput 各自的选中状态独立', async () => {
    const { stdin, onChangeA, onChangeB, kbRef } =
      renderDualMultiSelectInput({ items: threeItems });

    await press(stdin, KEYS.space);
    expect(onChangeA).toHaveBeenCalledWith(['dark']);

    kbRef.current!.focusSet('select-b');
    await press(stdin, KEYS.space);
    expect(onChangeB).toHaveBeenCalledWith(['dark']);

    kbRef.current!.focusSet('select-a');
    onChangeA.mockClear();
    await press(stdin, KEYS.space);
    expect(onChangeA).toHaveBeenCalledWith([]);
  });
});

describe('受控模式（selected prop）', () => {
  it('传入 selected 时复选框反映选中状态', async () => {
    const { lastFrameClean } = renderControlled({
      focusId: 'test',
      items: threeItems,
      selected: ['dark', 'cyberpunk'],
    });

    const output = lastFrameClean();
    const filled = (output.match(/\u25C9/g) || []).length;
    expect(filled).toBe(2);
  });

  it('传入空数组时所有项未选中', async () => {
    const { lastFrameClean } = renderControlled({
      focusId: 'test',
      items: threeItems,
      selected: [],
    });

    const output = lastFrameClean();
    expect(output).not.toContain('\u25C9');
  });
});

describe('defaultSelected', () => {
  it('defaultSelected 设置初始选中值', () => {
    const { lastFrameClean } = renderControlled({
      focusId: 'test',
      items: threeItems,
      defaultSelected: ['light'],
    });

    const output = lastFrameClean();
    const filled = (output.match(/\u25C9/g) || []).length;
    expect(filled).toBe(1);
  });
});

describe('空列表', () => {
  it('空列表时按方向键不抛错', async () => {
    const onChange = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: [],
      onChange,
    });

    await expect(press(stdin, KEYS.down)).resolves.not.toThrow();
    await expect(press(stdin, KEYS.up)).resolves.not.toThrow();
    await expect(press(stdin, KEYS.space)).resolves.not.toThrow();
    await expect(press(stdin, KEYS.enter)).resolves.not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('空列表时数字键不抛错', async () => {
    const onChange = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: [],
      onChange,
    });

    await expect(press(stdin, '1')).resolves.not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('limit 自定义值', () => {
  it('limit=3 时只显示 3 项', async () => {
    const { lastFrameClean } = renderControlled({
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
    const onChange = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: longItems,
      limit: 3,
      onChange,
    });

    await press(stdin, '3');
    expect(onChange).toHaveBeenCalledTimes(1);

    onChange.mockClear();
    await press(stdin, '4');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('limit=3 时向下滚动，窗口移动', async () => {
    const { lastFrameClean, stdin } = renderControlled({
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

describe('initialIndex', () => {
  it('initialIndex=1 时高亮从第 2 项开始', async () => {
    const onHighlight = vi.fn();
    const { stdin } = renderControlled({
      focusId: 'test',
      items: threeItems,
      initialIndex: 1,
      onHighlight,
    });

    expect(onHighlight).toHaveBeenCalledWith(threeItems[1]);

    // 按 Space 确认当前高亮项可操作
    await press(stdin, KEYS.space);
  });
});

describe('items 动态变化', () => {
  it('items 动态增长后正常渲染新增项', async () => {
    let setItems!: (items: Item<string>[]) => void;

    const initialItems: Item<string>[] = [{ label: 'A', value: 'a' }];

    function HostScreen() {
      const [items, _setItems] = useState(initialItems);
      setItems = _setItems;
      const [sel, setSel] = useState<string[]>([]);
      return React.createElement(MultiSelectInput, {
        focusId: 'test',
        items,
        selected: sel,
        onChange: setSel,
      } as any);
    }
    HostScreen.displayName = 'GrowHost';

    clearRegistry();
    registerComponent(HostScreen, {});

    const { lastFrame, stdin } = render(
      React.createElement(
        ScenarioManagementProvider,
        { defaultScreen: HostScreen },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );

    await flush();

    setItems([
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ]);

    await press(stdin, KEYS.down);

    const output = stripAnsi(lastFrame());
    expect(output).toContain('A');
    expect(output).toContain('B');
    expect(output).toContain('C');
  });
});

describe('组件卸载清理', () => {
  it('离开屏幕后按键不再触发 onChange', async () => {
    const { stdin, onChange, lastFrameClean } =
      renderNavigableMultiSelect(threeItems);

    expect(lastFrameClean()).toContain('Menu');

    await press(stdin, 's');
    expect(lastFrameClean()).toContain('Dark');

    await press(stdin, KEYS.space);
    expect(onChange).toHaveBeenCalledWith(['dark']);

    onChange.mockClear();
    await press(stdin, 'b');
    expect(lastFrameClean()).toContain('Menu');

    await press(stdin, KEYS.space);
    await press(stdin, KEYS.down);
    await press(stdin, KEYS.enter);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('返回后重新进入，MultiSelectInput 重新初始化并正常工作', async () => {
    const { stdin, onChange } = renderNavigableMultiSelect(threeItems);

    await press(stdin, 's');
    await press(stdin, KEYS.space);
    expect(onChange).toHaveBeenCalledWith(['dark']);

    await press(stdin, 'b');
    await press(stdin, 's');

    onChange.mockClear();
    await press(stdin, KEYS.space);
    expect(onChange).toHaveBeenCalledWith(['dark']);
  });
});

describe('非聚焦渲染（isFocused=false）', () => {
  it('未获焦的 MultiSelectInput 不显示 ❯ 指示器', async () => {
    const { lastFrameClean, kbRef, stdin } =
      renderDualMultiSelectInput({ items: threeItems });

    await press(stdin, KEYS.down);

    const output = lastFrameClean();
    const count = (output.match(/\u276F/g) || []).length;
    expect(count).toBe(1);

    kbRef.current!.focusSet('select-b');
    await press(stdin, KEYS.down);

    const output2 = lastFrameClean();
    const count2 = (output2.match(/\u276F/g) || []).length;
    expect(count2).toBe(1);
  });

  it('未获焦时复选框仍然显示选中状态', async () => {
    const { lastFrameClean, stdin, kbRef } =
      renderDualMultiSelectInput({ items: threeItems });

    await press(stdin, KEYS.space);

    kbRef.current!.focusSet('select-b');

    const output = lastFrameClean();
    expect(output).toContain('\u25C9');
  });
});
