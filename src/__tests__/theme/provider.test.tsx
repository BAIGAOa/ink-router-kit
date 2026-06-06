import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from '../../theme/provider.js';
import { useTheme } from '../../theme/hook.js';

function wrapper(children: React.ReactNode, props: any = {}) {
  // Need to return a wrapper component for renderHook
  return ({ children: inner }: { children: React.ReactNode }) =>
    React.createElement(ThemeProvider, { ...props }, inner);
}

describe('ThemeProvider — inline themes', () => {
  it('加载 inline themes 后 color() 返回当前主题的值', () => {
    const themes = [
      { id: 'dark', primary: 'cyan', bg: 'black' },
      { id: 'light', primary: 'blue', bg: 'white' },
    ];

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { themes, defaultTheme: 'dark' }, children),
    });

    expect(result.current.themeId).toBe('dark');
    expect(result.current.color('primary')).toBe('cyan');
    expect(result.current.color('bg')).toBe('black');
    expect(result.current.themes).toEqual(['dark', 'light']);
  });

  it('未指定 defaultTheme 时使用第一个主题', () => {
    const themes = [
      { id: 'a', x: 'red' },
      { id: 'b', x: 'green' },
    ];

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { themes }, children),
    });

    expect(result.current.themeId).toBe('a');
    expect(result.current.color('x')).toBe('red');
  });

  it('color() 查询不存在的键返回 undefined', () => {
    const themes = [{ id: 'only', name: 'only-theme' }];

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { themes }, children),
    });

    expect(result.current.color('missing')).toBeUndefined();
  });

  it('themes 为空时使用默认行为（空 themeId）', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { themes: [] }, children),
    });

    expect(result.current.themeId).toBeDefined();
    expect(result.current.color('anything')).toBeUndefined();
  });
});

describe('setTheme', () => {
  it('setTheme 切换到指定主题后 color() 返回新值，所有消费者 re-render', () => {
    const themes = [
      { id: 'dark', primary: 'cyan' },
      { id: 'light', primary: 'yellow' },
    ];

    const { result, rerender } = renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { themes, defaultTheme: 'dark' }, children),
    });

    expect(result.current.themeId).toBe('dark');
    expect(result.current.color('primary')).toBe('cyan');

    // Switch theme
    result.current.setTheme('light');

    // Re-render to pick up the new state
    rerender();

    expect(result.current.themeId).toBe('light');
    expect(result.current.color('primary')).toBe('yellow');
  });

  it('setTheme 切换到不存在的主题抛错', () => {
    const themes = [{ id: 'only', primary: 'green' }];

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { themes }, children),
    });

    expect(() => result.current.setTheme('nonexistent')).toThrow(/nonexistent/);
  });
});

describe('style()', () => {
  it('style() 返回 boolean 类型键的值', () => {
    const themes = [
      { id: 'bold', titleBold: true, cardBold: false },
    ];

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { themes }, children),
    });

    expect(result.current.style('titleBold')).toBe(true);
    expect(result.current.style('cardBold')).toBe(false);
  });

  it('style() 对 string 类型的键返回 undefined（不是 boolean）', () => {
    const themes = [{ id: 't', primary: 'blue' }];

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { themes }, children),
    });

    expect(result.current.style('primary')).toBeUndefined();
  });

  it('style() 对不存在的键返回 undefined', () => {
    const themes = [{ id: 't' }];

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { themes }, children),
    });

    expect(result.current.style('nope')).toBeUndefined();
  });

  it('color() 对 boolean 类型的键返回 undefined（不是 string）', () => {
    const themes = [{ id: 't', isDark: true }];

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { themes }, children),
    });

    expect(result.current.color('isDark')).toBeUndefined();
  });

  it('color() 和 style() 在同一主题中各自取值互不干扰', () => {
    const themes = [
      { id: 't', primary: 'green', titleBold: true, muted: 'gray', dimText: false },
    ];

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { themes }, children),
    });

    expect(result.current.color('primary')).toBe('green');
    expect(result.current.color('muted')).toBe('gray');
    expect(result.current.style('titleBold')).toBe(true);
    expect(result.current.style('dimText')).toBe(false);
  });
});

describe('path loading', () => {
  it('从目录加载 {id}.json 文件，color() 可正常取值', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-theme-test-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'dark.json'),
        JSON.stringify({ id: 'dark', primary: 'cyan', bg: 'black' }),
      );
      fs.writeFileSync(
        path.join(dir, 'light.json'),
        JSON.stringify({ id: 'light', primary: 'yellow', bg: 'white' }),
      );

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: dir, defaultTheme: 'dark' }, children),
      });

      expect(result.current.themeId).toBe('dark');
      expect(result.current.themes).toEqual(['dark', 'light']);
      expect(result.current.color('primary')).toBe('cyan');
      expect(result.current.color('bg')).toBe('black');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('path 加载没有 JSON 文件的目录时 themes 为空', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-theme-empty-'));
    try {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: dir }, children),
      });

      expect(result.current.themes).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('key consistency validation', () => {
  it('所有主题键名完全一致时不抛错', () => {
    const themes = [
      { id: 'a', primary: 'red', bg: 'black' },
      { id: 'b', primary: 'blue', bg: 'white' },
    ];

    expect(() => {
      renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { themes }, children),
      });
    }).not.toThrow();
  });

  it('主题键名不一致时抛错（缺少键）', () => {
    const themes = [
      { id: 'a', primary: 'red', bg: 'black', accent: 'green' },
      { id: 'b', primary: 'blue', bg: 'white' }, // missing 'accent'
    ];

    expect(() => {
      renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { themes }, children),
      });
    }).toThrow(/missing from "b": accent/);
  });

  it('主题键名不一致时抛错（多余的键）', () => {
    const themes = [
      { id: 'a', primary: 'red', bg: 'black' },
      { id: 'b', primary: 'blue', bg: 'white', extra: 'pink' }, // extra key
    ];

    expect(() => {
      renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { themes }, children),
      });
    }).toThrow(/extra in "b": extra/);
  });

  it('单个主题不抛错', () => {
    const themes = [{ id: 'only', primary: 'red' }];

    expect(() => {
      renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { themes }, children),
      });
    }).not.toThrow();
  });
});

describe('mergeTheme', () => {
  it('mergeTheme 覆盖已有主题的键值，不创建新主题', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const dir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-theme-base-'));
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-theme-overlay-'));
    try {
      fs.writeFileSync(
        path.join(dir1, 'dark.json'),
        JSON.stringify({ id: 'dark', primary: 'cyan', bg: 'black' }),
      );
      fs.writeFileSync(
        path.join(dir2, 'dark.json'),
        JSON.stringify({ id: 'dark', primary: 'yellow' }),
      );
      // dir2 also has a theme not in dir1 — should be ignored
      fs.writeFileSync(
        path.join(dir2, 'extra.json'),
        JSON.stringify({ id: 'extra', primary: 'red' }),
      );

      const { result, rerender } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: dir1, defaultTheme: 'dark' }, children),
      });

      expect(result.current.color('primary')).toBe('cyan');
      expect(result.current.themes).toEqual(['dark']);

      // Merge overlay — 'extra' from dir2 should be ignored (not in base)
      result.current.mergeTheme([dir2]);
      rerender();

      // After merge, primary should be overridden by dir2
      expect(result.current.color('primary')).toBe('yellow');
      // bg was not in dir2's dark.json, should remain from base
      expect(result.current.color('bg')).toBe('black');
      // extra theme should NOT appear
      expect(result.current.themes).toEqual(['dark']);
    } finally {
      fs.rmSync(dir1, { recursive: true, force: true });
      fs.rmSync(dir2, { recursive: true, force: true });
    }
  });

  it('mergeTheme 多个路径依次覆盖', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const dir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-theme-a-'));
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-theme-b-'));
    const dir3 = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-theme-c-'));
    try {
      fs.writeFileSync(path.join(dir1, 't.json'), JSON.stringify({ id: 't', color: 'red', size: 'small' }));
      fs.writeFileSync(path.join(dir2, 't.json'), JSON.stringify({ id: 't', color: 'green' }));
      fs.writeFileSync(path.join(dir3, 't.json'), JSON.stringify({ id: 't', color: 'blue', size: 'large' }));

      const { result, rerender } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: dir1 }, children),
      });

      expect(result.current.color('color')).toBe('red');
      expect(result.current.color('size')).toBe('small');

      result.current.mergeTheme([dir2, dir3]);
      rerender();

      // dir3 is last, so color='blue' wins
      expect(result.current.color('color')).toBe('blue');
      // size was overridden in dir3 too
      expect(result.current.color('size')).toBe('large');
    } finally {
      fs.rmSync(dir1, { recursive: true, force: true });
      fs.rmSync(dir2, { recursive: true, force: true });
      fs.rmSync(dir3, { recursive: true, force: true });
    }
  });

  it('mergeTheme 对不存在的目录抛错', () => {
    const themes = [{ id: 't', primary: 'red' }];
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { themes }, children),
    });

    expect(() => result.current.mergeTheme(['/nonexistent/path/xyz'])).toThrow();
  });
});

describe('addThemes', () => {
  it('addThemes 添加单个新主题后 themes 列表和 color() 均更新', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-base-'));
    const newDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-new-'));
    try {
      fs.writeFileSync(
        path.join(baseDir, 'dark.json'),
        JSON.stringify({ id: 'dark', primary: 'cyan', bg: 'black' }),
      );

      fs.writeFileSync(
        path.join(newDir, 'light.json'),
        JSON.stringify({ id: 'light', primary: 'yellow', bg: 'white' }),
      );

      const { result, rerender } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: baseDir, defaultTheme: 'dark' }, children),
      });

      expect(result.current.themes).toEqual(['dark']);

      result.current.addThemes([newDir]);
      rerender();

      expect(result.current.themes).toEqual(['dark', 'light']);
      // Switch to the new theme and verify values
      result.current.setTheme('light');
      rerender();
      expect(result.current.themeId).toBe('light');
      expect(result.current.color('primary')).toBe('yellow');
      expect(result.current.color('bg')).toBe('white');
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
      fs.rmSync(newDir, { recursive: true, force: true });
    }
  });

  it('addThemes 一次添加多个新主题', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-multi-'));
    const modDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-mod-'));
    try {
      fs.writeFileSync(
        path.join(baseDir, 'dark.json'),
        JSON.stringify({ id: 'dark', primary: 'cyan' }),
      );

      fs.writeFileSync(
        path.join(modDir, 'light.json'),
        JSON.stringify({ id: 'light', primary: 'yellow' }),
      );
      fs.writeFileSync(
        path.join(modDir, 'retro.json'),
        JSON.stringify({ id: 'retro', primary: 'green' }),
      );

      const { result, rerender } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: baseDir }, children),
      });

      expect(result.current.themes).toEqual(['dark']);

      result.current.addThemes([modDir]);
      rerender();

      expect(result.current.themes).toEqual(['dark', 'light', 'retro']);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
      fs.rmSync(modDir, { recursive: true, force: true });
    }
  });

  it('addThemes 多次调用可以陆续添加主题', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-seq-'));
    const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-a-'));
    const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-b-'));
    try {
      fs.writeFileSync(
        path.join(baseDir, 't1.json'),
        JSON.stringify({ id: 't1', color: 'red' }),
      );
      fs.writeFileSync(
        path.join(dirA, 't2.json'),
        JSON.stringify({ id: 't2', color: 'green' }),
      );
      fs.writeFileSync(
        path.join(dirB, 't3.json'),
        JSON.stringify({ id: 't3', color: 'blue' }),
      );

      const { result, rerender } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: baseDir }, children),
      });

      result.current.addThemes([dirA]);
      rerender();
      expect(result.current.themes).toEqual(['t1', 't2']);

      result.current.addThemes([dirB]);
      rerender();
      expect(result.current.themes).toEqual(['t1', 't2', 't3']);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
      fs.rmSync(dirA, { recursive: true, force: true });
      fs.rmSync(dirB, { recursive: true, force: true });
    }
  });

  it('addThemes 文件名重复时后面的路径覆盖前面的（同文件不同路径）', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-override-'));
    const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-oa-'));
    const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-ob-'));
    try {
      fs.writeFileSync(
        path.join(baseDir, 't1.json'),
        JSON.stringify({ id: 't1', color: 'red', size: 'small' }),
      );
      // Same filename "t2.json" in both dirA and dirB, different ids
      fs.writeFileSync(
        path.join(dirA, 't2.json'),
        JSON.stringify({ id: 't2a', color: 'green', size: 'medium' }),
      );
      fs.writeFileSync(
        path.join(dirB, 't2.json'),
        JSON.stringify({ id: 't2b', color: 'blue', size: 'large' }),
      );

      const { result, rerender } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: baseDir }, children),
      });

      // dirB is later, so t2.json from dirB wins → id 't2b' should appear, 't2a' should not
      result.current.addThemes([dirA, dirB]);
      rerender();

      expect(result.current.themes).toEqual(['t1', 't2b']);
      result.current.setTheme('t2b');
      rerender();
      expect(result.current.color('color')).toBe('blue');
      expect(result.current.color('size')).toBe('large');
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
      fs.rmSync(dirA, { recursive: true, force: true });
      fs.rmSync(dirB, { recursive: true, force: true });
    }
  });

  it('addThemes id 与已有主题重复时立即抛错', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-dup-'));
    try {
      fs.writeFileSync(
        path.join(baseDir, 'dark.json'),
        JSON.stringify({ id: 'dark', primary: 'cyan' }),
      );

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: baseDir }, children),
      });

      // Try to add a theme whose id already exists in base
      const newDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-conflict-'));
      try {
        fs.writeFileSync(
          path.join(newDir, 'another.json'),
          JSON.stringify({ id: 'dark', primary: 'yellow' }),
        );
        expect(() => result.current.addThemes([newDir])).toThrow(/dark/);
      } finally {
        fs.rmSync(newDir, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it('addThemes 同批次内不同文件名拥有相同 id 时抛错', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-dup2-'));
    const modDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-mod2-'));
    try {
      fs.writeFileSync(
        path.join(baseDir, 't1.json'),
        JSON.stringify({ id: 't1', color: 'red' }),
      );
      // Two different filenames with the same id inside the same path
      fs.writeFileSync(
        path.join(modDir, 'style-a.json'),
        JSON.stringify({ id: 'clash', color: 'green' }),
      );
      fs.writeFileSync(
        path.join(modDir, 'style-b.json'),
        JSON.stringify({ id: 'clash', color: 'blue' }),
      );

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: baseDir }, children),
      });

      expect(() => result.current.addThemes([modDir])).toThrow(/clash/);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
      fs.rmSync(modDir, { recursive: true, force: true });
    }
  });

  it('addThemes 缺失键时抛错', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-miss-'));
    const modDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-mod3-'));
    try {
      fs.writeFileSync(
        path.join(baseDir, 'dark.json'),
        JSON.stringify({ id: 'dark', primary: 'cyan', bg: 'black', accent: 'green' }),
      );
      // New theme is missing 'accent' key
      fs.writeFileSync(
        path.join(modDir, 'light.json'),
        JSON.stringify({ id: 'light', primary: 'yellow', bg: 'white' }),
      );

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: baseDir }, children),
      });

      expect(() => result.current.addThemes([modDir])).toThrow(/missing.*accent/);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
      fs.rmSync(modDir, { recursive: true, force: true });
    }
  });

  it('addThemes 多余键时抛错', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-extra-'));
    const modDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-mod4-'));
    try {
      fs.writeFileSync(
        path.join(baseDir, 'dark.json'),
        JSON.stringify({ id: 'dark', primary: 'cyan', bg: 'black' }),
      );
      // New theme has an extra 'accent' key
      fs.writeFileSync(
        path.join(modDir, 'light.json'),
        JSON.stringify({ id: 'light', primary: 'yellow', bg: 'white', accent: 'pink' }),
      );

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: baseDir }, children),
      });

      expect(() => result.current.addThemes([modDir])).toThrow(/extra.*accent/);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
      fs.rmSync(modDir, { recursive: true, force: true });
    }
  });

  it('addThemes 同时缺键和多余键时报错指出两者', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-both-'));
    const modDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-mod5-'));
    try {
      fs.writeFileSync(
        path.join(baseDir, 'dark.json'),
        JSON.stringify({ id: 'dark', primary: 'cyan', bg: 'black', accent: 'green' }),
      );
      // Missing 'accent', extra 'border' vs base
      fs.writeFileSync(
        path.join(modDir, 'light.json'),
        JSON.stringify({ id: 'light', primary: 'yellow', bg: 'white', border: 'red' }),
      );

      const { result } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: baseDir }, children),
      });

      expect(() => result.current.addThemes([modDir])).toThrow(/missing.*accent/);
      expect(() => result.current.addThemes([modDir])).toThrow(/extra.*border/);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
      fs.rmSync(modDir, { recursive: true, force: true });
    }
  });

  it('addThemes 对不存在的目录抛错', () => {
    const themes = [{ id: 't', primary: 'red' }];
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, { themes }, children),
    });

    expect(() => result.current.addThemes(['/nonexistent/path/add'])).toThrow();
  });

  it('addThemes 在 base 为空时可以不校验键（首个主题定义键集）', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const modDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-empty-'));
    try {
      fs.writeFileSync(
        path.join(modDir, 'first.json'),
        JSON.stringify({ id: 'first', color: 'red', size: 'small' }),
      );

      const { result, rerender } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { themes: [] }, children),
      });

      // base is empty; addThemes should accept any keys (first theme defines the set)
      result.current.addThemes([modDir]);
      rerender();

      expect(result.current.themes).toEqual(['first']);
      // No theme is auto-selected when base was empty; switch manually
      result.current.setTheme('first');
      rerender();
      expect(result.current.color('color')).toBe('red');
      expect(result.current.color('size')).toBe('small');
    } finally {
      fs.rmSync(modDir, { recursive: true, force: true });
    }
  });

  it('addThemes 与 mergeTheme 联合使用：先添加后合并', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-addmerge-'));
    const addDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-addmerge2-'));
    const mergeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-addmerge3-'));
    try {
      fs.writeFileSync(
        path.join(baseDir, 'dark.json'),
        JSON.stringify({ id: 'dark', primary: 'cyan', bg: 'black' }),
      );
      fs.writeFileSync(
        path.join(addDir, 'light.json'),
        JSON.stringify({ id: 'light', primary: 'yellow', bg: 'white' }),
      );

      const { result, rerender } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: baseDir, defaultTheme: 'dark' }, children),
      });

      // Add the new theme
      result.current.addThemes([addDir]);
      rerender();
      expect(result.current.themes).toEqual(['dark', 'light']);

      // Now merge an update to the newly added theme
      fs.writeFileSync(
        path.join(mergeDir, 'light.json'),
        JSON.stringify({ id: 'light', primary: 'magenta' }),
      );
      result.current.mergeTheme([mergeDir]);
      rerender();

      result.current.setTheme('light');
      rerender();
      expect(result.current.color('primary')).toBe('magenta');
      expect(result.current.color('bg')).toBe('white'); // unchanged
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
      fs.rmSync(addDir, { recursive: true, force: true });
      fs.rmSync(mergeDir, { recursive: true, force: true });
    }
  });

  it('addThemes style() 对新主题的 boolean 键正常工作', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-style-'));
    const modDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-mod6-'));
    try {
      fs.writeFileSync(
        path.join(baseDir, 'dark.json'),
        JSON.stringify({ id: 'dark', primary: 'cyan', titleBold: true }),
      );
      fs.writeFileSync(
        path.join(modDir, 'light.json'),
        JSON.stringify({ id: 'light', primary: 'yellow', titleBold: false }),
      );

      const { result, rerender } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { path: baseDir, defaultTheme: 'dark' }, children),
      });

      result.current.addThemes([modDir]);
      rerender();

      result.current.setTheme('light');
      rerender();
      expect(result.current.style('titleBold')).toBe(false);

      result.current.setTheme('dark');
      rerender();
      expect(result.current.style('titleBold')).toBe(true);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
      fs.rmSync(modDir, { recursive: true, force: true });
    }
  });

  it('addThemes 使用 inline themes 模式也能添加', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const modDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-add-inline-'));
    try {
      fs.writeFileSync(
        path.join(modDir, 'retro.json'),
        JSON.stringify({ id: 'retro', primary: 'magenta', bg: '#1a0033' }),
      );

      const themes = [
        { id: 'dark', primary: 'cyan', bg: 'black' },
        { id: 'light', primary: 'yellow', bg: 'white' },
      ];
      const { result, rerender } = renderHook(() => useTheme(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(ThemeProvider, { themes, defaultTheme: 'dark' }, children),
      });

      result.current.addThemes([modDir]);
      rerender();

      expect(result.current.themes).toEqual(['dark', 'light', 'retro']);
      result.current.setTheme('retro');
      rerender();
      expect(result.current.color('primary')).toBe('magenta');
      expect(result.current.color('bg')).toBe('#1a0033');
    } finally {
      fs.rmSync(modDir, { recursive: true, force: true });
    }
  });
});
