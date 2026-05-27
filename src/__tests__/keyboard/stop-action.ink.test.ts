import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React, { useEffect } from 'react';
import { Text } from 'ink';
import { registerComponent, clearRegistry } from '../../screen/registry.js';
import { ScenarioManagementProvider } from '../../screen/provider.js';
import { CurrentScreen } from '../../screen/current-screen.js';
import { KeyboardProvider, clearShortcutOperations } from '../../keyboard/provider.js';
import { useKeyboard } from '../../keyboard/hook.js';
import { useScreenSystem } from '../../screen/hook.js';

async function press(
  stdin: { write: (data: string) => void },
  key: string,
) {
  stdin.write(key);
  await new Promise((r) => setTimeout(r, 10));
}

async function flush() {
  await new Promise((r) => setTimeout(r, 10));
}

beforeEach(() => {
  clearRegistry();
  clearShortcutOperations();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('stopAction — 阻断 action 对应的键向下传播', () => {
  it('子屏幕 stopAction 后，父屏幕的同名键绑定不触发', async () => {
    const parentHandler = vi.fn();
    const childAction = vi.fn();

    function Parent() {
      const sc = useScreenSystem();
      const { boundKeyboard } = useKeyboard();
      useEffect(() => {
        boundKeyboard(['s'], () => sc.skip(Child, {}));
        boundKeyboard(['x'], parentHandler);
      }, []);
      return React.createElement(Text, null, 'Parent - press S to Child');
    }
    Parent.displayName = 'Parent';

    function Child() {
      const sc = useScreenSystem();
      const { boundKeyboard, stop, defineShortcutAction } = useKeyboard();
      useEffect(() => {
        defineShortcutAction([{ actionId: 'childX', action: childAction }]);
        boundKeyboard(['x'], 'childX', { focusId: 'child-focus' });
        stop(['childX'], { stopAction: true, focusId: 'child-focus' });
        boundKeyboard(['b'], () => sc.back());
      }, []);
      return React.createElement(Text, null, 'Child - press B to go back');
    }
    Child.displayName = 'Child';

    clearRegistry();
    registerComponent(Parent, {});
    registerComponent(Child, {}, { parent: Parent });

    const { stdin } = render(
      React.createElement(
        ScenarioManagementProvider,
        { defaultScreen: Parent },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );

    await press(stdin, 's');
    await flush();

    await press(stdin, 'x');
    await flush();

    expect(childAction).toHaveBeenCalledTimes(1);
    expect(parentHandler).not.toHaveBeenCalled();
  });

  it('stopAction 对未注册的 action ID 不抛错', async () => {
    function Parent() {
      const sc = useScreenSystem();
      const { boundKeyboard } = useKeyboard();
      useEffect(() => {
        boundKeyboard(['s'], () => sc.skip(Child, {}));
      }, []);
      return React.createElement(Text, null, 'Parent');
    }
    Parent.displayName = 'Parent';

    function Child() {
      const sc = useScreenSystem();
      const { stop } = useKeyboard();
      useEffect(() => {
        stop(['nonexistent-action'], { stopAction: true, focusId: 'child-focus' });
        boundKeyboard(['b'], () => sc.back());
      }, []);
      return React.createElement(Text, null, 'Child');
    }
    Child.displayName = 'Child';

    clearRegistry();
    registerComponent(Parent, {});
    registerComponent(Child, {}, { parent: Parent });

    const { stdin } = render(
      React.createElement(
        ScenarioManagementProvider,
        { defaultScreen: Parent },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );

    await press(stdin, 's');
    await flush();

    await expect(press(stdin, 'x')).resolves.not.toThrow();
  });

  it('unstop 后解绑子层绑定，键可传播到父层', async () => {
    // stop 的语义：不影响本层绑定，只阻断向下传播。
    // 因此 unstop 后，只要子层仍有绑定，键就会被子层消费，不会到达父层。
    // 要验证 unstop 真的清掉了 stoppedKeys，必须同时解绑子层的绑定。
    const parentHandler = vi.fn();
    const childAction = vi.fn();

    function Parent() {
      const sc = useScreenSystem();
      const { boundKeyboard } = useKeyboard();
      useEffect(() => {
        boundKeyboard(['s'], () => sc.skip(Child, {}));
        boundKeyboard(['x'], parentHandler);
      }, []);
      return React.createElement(Text, null, 'Parent');
    }
    Parent.displayName = 'Parent';

    function Child() {
      const sc = useScreenSystem();
      const { boundKeyboard, stop, defineShortcutAction } = useKeyboard();
      useEffect(() => {
        defineShortcutAction([{ actionId: 'childX', action: childAction }]);
        const unbindChild = boundKeyboard(['x'], 'childX', { focusId: 'child-focus' });
        const unstop = stop(['childX'], { stopAction: true, focusId: 'child-focus' });

        // 解绑 + 取消阻断：恢复干净状态，键应传播到父层
        unbindChild();
        unstop();

        boundKeyboard(['b'], () => sc.back());
      }, []);
      return React.createElement(Text, null, 'Child');
    }
    Child.displayName = 'Child';

    clearRegistry();
    registerComponent(Parent, {});
    registerComponent(Child, {}, { parent: Parent });

    const { stdin } = render(
      React.createElement(
        ScenarioManagementProvider,
        { defaultScreen: Parent },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );

    await press(stdin, 's');
    await flush();

    // 解绑且 unstop 后，子层既无绑定也无阻断，键应到达父层
    await press(stdin, 'x');
    await flush();

    expect(childAction).not.toHaveBeenCalled();
    expect(parentHandler).toHaveBeenCalledTimes(1);
  });

  it('stopAction 在屏幕级别（无 focusId）也可阻断', async () => {
    const parentHandler = vi.fn();
    const childAction = vi.fn();

    function Parent() {
      const sc = useScreenSystem();
      const { boundKeyboard } = useKeyboard();
      useEffect(() => {
        boundKeyboard(['z'], () => sc.skip(Child, {}));
        boundKeyboard(['y'], parentHandler);
      }, []);
      return React.createElement(Text, null, 'Parent');
    }
    Parent.displayName = 'Parent';

    function Child() {
      const sc = useScreenSystem();
      const { boundKeyboard, stop, defineShortcutAction } = useKeyboard();
      useEffect(() => {
        defineShortcutAction([{ actionId: 'screenAction', action: childAction }]);
        boundKeyboard(['y'], 'screenAction');
        stop(['screenAction'], { stopAction: true });
        boundKeyboard(['b'], () => sc.back());
      }, []);
      return React.createElement(Text, null, 'Child');
    }
    Child.displayName = 'Child';

    clearRegistry();
    registerComponent(Parent, {});
    registerComponent(Child, {}, { parent: Parent });

    const { stdin } = render(
      React.createElement(
        ScenarioManagementProvider,
        { defaultScreen: Parent },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );

    await press(stdin, 'z');
    await flush();

    await press(stdin, 'y');
    await flush();

    expect(childAction).toHaveBeenCalledTimes(1);
    expect(parentHandler).not.toHaveBeenCalled();
  });

  it('解绑 action 后 stoppedKeys 仍然存在，键继续被阻断', async () => {
    const parentHandler = vi.fn();
    const childAction = vi.fn();

    function Parent() {
      const sc = useScreenSystem();
      const { boundKeyboard } = useKeyboard();
      useEffect(() => {
        boundKeyboard(['s'], () => sc.skip(Child, {}));
        boundKeyboard(['m'], parentHandler);
      }, []);
      return React.createElement(Text, null, 'Parent');
    }
    Parent.displayName = 'Parent';

    function Child() {
      const sc = useScreenSystem();
      const { boundKeyboard, stop, defineShortcutAction } = useKeyboard();
      useEffect(() => {
        defineShortcutAction([{ actionId: 'tempAction', action: childAction }]);
        const unbind = boundKeyboard(['m'], 'tempAction', { focusId: 'child-focus' });
        stop(['tempAction'], { stopAction: true, focusId: 'child-focus' });
        unbind();
        boundKeyboard(['b'], () => sc.back());
      }, []);
      return React.createElement(Text, null, 'Child');
    }
    Child.displayName = 'Child';

    clearRegistry();
    registerComponent(Parent, {});
    registerComponent(Child, {}, { parent: Parent });

    const { stdin } = render(
      React.createElement(
        ScenarioManagementProvider,
        { defaultScreen: Parent },
        React.createElement(KeyboardProvider, null, React.createElement(CurrentScreen)),
      ),
    );

    await press(stdin, 's');
    await flush();

    await press(stdin, 'm');
    await flush();

    expect(childAction).not.toHaveBeenCalled();
    expect(parentHandler).not.toHaveBeenCalled();
  });
});
