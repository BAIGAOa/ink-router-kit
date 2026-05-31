import React, { useReducer, useMemo, useEffect, ReactNode } from 'react';
import { ScreenSystemContext } from './context.js';
import {
  ScreenState,
  ScreenAction,
  SkipOptions,
  SkipFn,
  BackFn,
  GotoScreenFn,
  OverlayFn,
  CloseOverlayFn,
} from './types.js';
import {
  getTemplate,
  hasComponent,
  isChildOf,
  getParent,
} from './registry.js';



const _dispatchers = new Set<React.Dispatch<ScreenAction>>();

/**
 * Clear all registered provider dispatchers.
 * Intended for test cleanup — prevents stale dispatch references
 * from leaking between test runs when providers are not properly
 * unmounted.
 */
export function clearDispatchers(): void {
  _dispatchers.clear();
}

function getDispatch(): React.Dispatch<ScreenAction> {
  if (_dispatchers.size === 0) {
    throw new Error(
      '[Ink-Router-Kit] Navigation function called before Provider is mounted. Please ensure <ScenarioManagementProvider> is mounted in the component tree.',
    );
  }
  // Set 按插入顺序迭代，取最后一个（最近挂载的 Provider）
  return [..._dispatchers][_dispatchers.size - 1];
}

/**
 * Navigate down the tree to a direct child of the current screen.
 *
 * @param component  The target child component (must be a registered child
 *                   of the current screen).
 * @param params     Props to merge with the component's registered template.
 * @param options    Optional navigation options.
 *
 * @throws If the provider is not mounted or the target is not a child of
 *         the current screen.
 */
export function skip<C extends React.ComponentType<any>>(
  component: C,
  params: React.ComponentProps<C>,
  options?: SkipOptions,
): void {
  if (!hasComponent(component)) {
    throw new Error(
      `[Ink-Router-Kit] Component "${component.displayName || component.name || 'anonymous'}" is not registered. Please call registerComponent() first.`,
    );
  }
  // 模块级 skip 不做编译时树校验，运行时 reducer 中校验
  getDispatch()({
    type: 'skip',
    component,
    params: params as Record<string, unknown>,
    onlyAttribute: options?.onlyAttribute ?? false,
  });
}

/**
 * Navigate up the tree to the parent of the current screen.
 *
 * @throws If the provider is not mounted or the current screen is the root.
 */
export function back(): void {
  getDispatch()({ type: 'back' });
}

/**
 * Jump to any registered screen across branches of the tree.
 *
 * The path is rebuilt by finding the closest common ancestor between the
 * current screen and the target, then walking down from that ancestor.
 *
 * @param component  The target component (must be registered).
 * @param params     Props to merge with the component's registered template.
 *
 * @throws If the provider is not mounted or the component is not registered.
 */
export function gotoScreen<C extends React.ComponentType<any>>(
  component: C,
  params: React.ComponentProps<C>,
): void {
  if (!hasComponent(component)) {
    throw new Error(
      `[Ink-Router-Kit] Component "${component.displayName || component.name || 'anonymous'}" is not registered. Please call registerComponent() first.`,
    );
  }
  getDispatch()({
    type: 'gotoScreen',
    component,
    params: params as Record<string, unknown>,
  });
}

/**
 * Open a floating overlay on top of the current screen stack.
 *
 * The overlay renders independently of the tree navigation. Only one overlay
 * may be active at a time. Opening a new overlay replaces the previous one.
 *
 * @param component  The overlay component (must be registered).
 * @param params     Props to merge with the component's registered template.
 *
 * @throws If the provider is not mounted or the component is not registered.
 */
export function overlay<C extends React.ComponentType<any>>(
  component: C,
  params: React.ComponentProps<C>,
): void {
  if (!hasComponent(component)) {
    throw new Error(
      `[Ink-Router-Kit] Component "${component.displayName || component.name || 'anonymous'}" is not registered. Please call registerComponent() first.`,
    );
  }
  getDispatch()({
    type: 'overlay',
    component,
    params: params as Record<string, unknown>,
  });
}

/**
 * Close the currently active overlay.
 *
 * @throws If the provider is not mounted.
 */
export function closeOverlay(): void {
  getDispatch()({ type: 'closeOverlay' });
}



/**
 * 从树中查找共同祖先
 * 从 currentPath 栈底向上找到第一个在 targetAncestors 中的节点
 */
function findCommonAncestor(
  currentPath: React.ComponentType<any>[],
  target: React.ComponentType<any>,
): React.ComponentType<any> {
  // 收集目标及其所有祖先
  const targetAncestors = new Set<React.ComponentType<any>>();
  let node: React.ComponentType<any> | null | undefined = target;
  while (node) {
    targetAncestors.add(node);
    node = getParent(node);
  }

  // 从 path 底部向上查找第一个共同祖先
  for (let i = currentPath.length - 1; i >= 0; i--) {
    if (targetAncestors.has(currentPath[i])) {
      return currentPath[i];
    }
  }

  throw new Error(
    `[Ink-Router-Kit] Cannot find common ancestor. The target component may not be in the same tree.`,
  );
}

/**
 * 构建从祖先到目标节点的路径（不含祖先本身）
 */
function buildPathFrom(
  ancestor: React.ComponentType<any>,
  target: React.ComponentType<any>,
): React.ComponentType<any>[] {
  const path: React.ComponentType<any>[] = [];
  let node: React.ComponentType<any> | null | undefined = target;
  while (node && node !== ancestor) {
    path.push(node);
    node = getParent(node);
  }
  if (!node) {
    throw new Error(
      `[Ink-Router-Kit] Target component is not a descendant of the ancestor.`,
    );
  }
  // 现在 path 是 [target, ..., ancestor.child]，反转得到 [ancestor.child, ..., target]
  path.reverse();
  return path;
}

function screenReducer(state: ScreenState, action: ScreenAction): ScreenState {
  switch (action.type) {

    case 'skip': {
      const current = state.path[state.path.length - 1];

      // 校验：目标组件必须是当前节点的子节点
      if (!isChildOf(action.component, current)) {
        throw new Error(
          `[Ink-Router-Kit] "${action.component.displayName || action.component.name || 'anonymous'}" is not a child of "${current.displayName || current.name || 'anonymous'}". Use skip to navigate down the tree, or gotoScreen to jump across branches.`,
        );
      }

      const sameComponent = action.component === current;
      const counter = sameComponent && action.onlyAttribute
        ? state.counter
        : state.counter + 1;

      const template = getTemplate(action.component) ?? {};
      const mergedParams = { ...template, ...action.params };

      return {
        path: [...state.path, action.component],
        pathParams: [...state.pathParams, mergedParams],
        overlay: null,
        counter,
      };
    }

    case 'back': {
      if (state.path.length <= 1) {
        throw new Error(
          '[Ink-Router-Kit] back() failed: already at the root node, cannot go back.',
        );
      }

      return {
        path: state.path.slice(0, -1),
        pathParams: state.pathParams.slice(0, -1),
        overlay: null,
        counter: state.counter + 1,
      };
    }

    case 'gotoScreen': {
      const commonAncestor = findCommonAncestor(state.path, action.component);
      const ancestorIndex = state.path.indexOf(commonAncestor);

      if (ancestorIndex === -1) {
        throw new Error(
          `[Ink-Router-Kit] gotoScreen failed: cannot locate common ancestor.`,
        );
      }

      const suffix = buildPathFrom(commonAncestor, action.component);
      const newPath = [
        ...state.path.slice(0, ancestorIndex + 1),
        ...suffix,
      ];

      const template = getTemplate(action.component) ?? {};
      const mergedParams = { ...template, ...action.params };

      // 为新路径的每个新节点生成参数（使用模板兜底）
      const newPathParams = [
        ...state.pathParams.slice(0, ancestorIndex + 1),
        ...suffix.map((comp) => {
          const tpl = getTemplate(comp) ?? {};
          return comp === action.component ? mergedParams : tpl;
        }),
      ];

      return {
        path: newPath,
        pathParams: newPathParams,
        overlay: null,
        counter: state.counter + 1,
      };
    }

    case 'overlay': {
      const template = getTemplate(action.component) ?? {};
      const mergedParams = { ...template, ...action.params };

      return {
        ...state,
        overlay: {
          component: action.component,
          params: mergedParams,
        },
        counter: state.counter,
      };
    }

    case 'closeOverlay': {
      return {
        ...state,
        overlay: null,
        counter: state.counter,
      };
    }

    default:
      return state;
  }
}



export interface ScenarioManagementProviderProps {
  children: ReactNode;
  /** 默认屏幕组件（必填，需先 registerComponent） */
  defaultScreen: React.ComponentType<any>;
  /** 默认参数（可选，未传则使用注册时的模板参数） */
  defaultParams?: Record<string, unknown>;
}

/**
 * Screen-management context provider.
 *
 * Wraps the application and enables tree-based screen navigation, overlays,
 * and module-level navigation functions (`skip`, `back`, `gotoScreen`,
 * `overlay`, `closeOverlay`).
 *
 * @param defaultScreen  The root screen component (must be registered).
 * @param defaultParams  Optional initial props for the root screen.
 *
 * @throws If `defaultScreen` has not been registered via
 *         {@link registerComponent}.
 */
export function ScenarioManagementProvider({
  children,
  defaultScreen,
  defaultParams,
}: ScenarioManagementProviderProps) {
  if (!hasComponent(defaultScreen)) {
    throw new Error(
      `[Ink-Router-Kit] defaultScreen "${defaultScreen.displayName || defaultScreen.name || 'anonymous'}" is not registered. Please call registerComponent() first.`,
    );
  }

  const initialParams =
    defaultParams ?? getTemplate(defaultScreen) ?? {};

  const [state, dispatch] = useReducer(screenReducer, {
    path: [defaultScreen],
    pathParams: [initialParams],
    overlay: null,
    counter: 0,
  });

  // 注入模块级 dispatch（支持多实例共存）
  useEffect(() => {
    _dispatchers.add(dispatch);
    return () => {
      _dispatchers.delete(dispatch);
    };
  }, []);

  // 当前栈顶组件 & 参数
  const topComponent = state.path[state.path.length - 1];
  const topParams = state.pathParams[state.pathParams.length - 1];

  // 渲染当前屏幕元素
  const currentScreen = useMemo(
    () =>
      React.createElement(topComponent, {
        ...topParams,
        key: state.counter,
      }),
    [topComponent, topParams, state.counter],
  );

  // 渲染 overlay 元素
  const currentOverlay = useMemo(
    () =>
      state.overlay
        ? React.createElement(state.overlay.component, {
          ...state.overlay.params,
          key: `overlay-${state.counter}`,
        })
        : null,
    [state.overlay, state.counter],
  );

  // Context 内的导航方法
  const skipInContext: SkipFn = useMemo(
    () => (component, params, options) => {
      if (!hasComponent(component)) {
        throw new Error(
          `[Ink-Router-Kit] Component "${component.displayName || component.name || 'anonymous'}" is not registered.`,
        );
      }
      dispatch({
        type: 'skip',
        component,
        params: params as Record<string, unknown>,
        onlyAttribute: options?.onlyAttribute ?? false,
      });
    },
    [],
  );

  const backInContext: BackFn = useMemo(
    () => () => dispatch({ type: 'back' }),
    [],
  );

  const gotoScreenInContext: GotoScreenFn = useMemo(
    () => (component, params) => {
      if (!hasComponent(component)) {
        throw new Error(
          `[Ink-Router-Kit] Component "${component.displayName || component.name || 'anonymous'}" is not registered.`,
        );
      }
      dispatch({
        type: 'gotoScreen',
        component,
        params: params as Record<string, unknown>,
      });
    },
    [],
  );

  const overlayInContext: OverlayFn = useMemo(
    () => (component, params) => {
      if (!hasComponent(component)) {
        throw new Error(
          `[Ink-Router-Kit] Component "${component.displayName || component.name || 'anonymous'}" is not registered.`,
        );
      }
      dispatch({
        type: 'overlay',
        component,
        params: params as Record<string, unknown>,
      });
    },
    [],
  );

  const closeOverlayInContext: CloseOverlayFn = useMemo(
    () => () => dispatch({ type: 'closeOverlay' }),
    [],
  );

  const value = useMemo(
    () => ({
      currentScreen,
      currentOverlay,
      currentPath: state.path,
      skip: skipInContext,
      back: backInContext,
      gotoScreen: gotoScreenInContext,
      overlay: overlayInContext,
      closeOverlay: closeOverlayInContext,
    }),
    [
      currentScreen,
      currentOverlay,
      state.path,
      skipInContext,
      backInContext,
      gotoScreenInContext,
      overlayInContext,
      closeOverlayInContext,
    ],
  );

  return (
    <ScreenSystemContext.Provider value={value}>
      {children}
    </ScreenSystemContext.Provider>
  );
}
