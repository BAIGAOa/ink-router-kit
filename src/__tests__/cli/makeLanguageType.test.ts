import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

import {
  flatJSON,
  findCommonKeys,
  findPartialKeys,
  extractParams,
  paramSetsForKey,
  escapeSingleQuote,
  generateTypesContent,
  generateRuntimeContent,
  makeLanguageType,
} from '../../cli/makeLanguageType.js';

/* ─── helpers ──────────────────────────────────────────────────── */

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'ink-kit-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeLocale(file: string, data: Record<string, unknown>): string {
  const fp = path.join(tmpDir, file);
  writeFileSync(fp, JSON.stringify(data), 'utf-8');
  return fp;
}

/* ─── flatJSON ─────────────────────────────────────────────────── */

describe('flatJSON', () => {
  it('flattens shallow keys', () => {
    expect(flatJSON({ a: '1', b: '2' })).toEqual({ a: '1', b: '2' });
  });

  it('flattens nested keys with dot notation', () => {
    expect(flatJSON({ a: { b: 'c', d: 'e' } })).toEqual({ 'a.b': 'c', 'a.d': 'e' });
  });

  it('converts numbers to strings', () => {
    expect(flatJSON({ n: 42 })).toEqual({ n: '42' });
  });

  it('converts booleans to strings', () => {
    expect(flatJSON({ y: true, n: false })).toEqual({ y: 'true', n: 'false' });
  });

  it('converts arrays to comma-separated strings', () => {
    expect(flatJSON({ arr: [1, 'b', true] })).toEqual({ arr: '1, b, true' });
  });

  it('skips null values', () => {
    expect(flatJSON({ a: '1', b: null })).toEqual({ a: '1' });
  });

  it('skips empty objects', () => {
    expect(flatJSON({ a: {}, b: '1' })).toEqual({ b: '1' });
  });

  it('handles deep nesting with all value types', () => {
    const input = {
      menu: {
        title: 'Main',
        count: 5,
        active: true,
        tags: ['fast', 'new'],
        empty: {},
        nested: { x: { y: 'deep' } },
      },
    };
    expect(flatJSON(input)).toEqual({
      'menu.title': 'Main',
      'menu.count': '5',
      'menu.active': 'true',
      'menu.tags': 'fast, new',
      'menu.nested.x.y': 'deep',
    });
  });

  it('returns empty for empty input', () => {
    expect(flatJSON({})).toEqual({});
  });
});

/* ─── findCommonKeys ───────────────────────────────────────────── */

describe('findCommonKeys', () => {
  it('returns keys present in all files sorted', () => {
    const files = [
      { name: 'en', keys: { a: '1', b: '2', c: '3' } },
      { name: 'zh', keys: { a: '1', b: '2', d: '4' } },
    ];
    expect(findCommonKeys(files)).toEqual(['a', 'b']);
  });

  it('returns empty when files have no common keys', () => {
    const files = [
      { name: 'en', keys: { a: '1' } },
      { name: 'zh', keys: { b: '2' } },
    ];
    expect(findCommonKeys(files)).toEqual([]);
  });

  it('returns all keys when only one file', () => {
    const files = [{ name: 'en', keys: { a: '1', b: '2' } }];
    expect(findCommonKeys(files)).toEqual(['a', 'b']);
  });

  it('returns empty for empty file list', () => {
    expect(findCommonKeys([])).toEqual([]);
  });

  it('handles three files with varying overlap', () => {
    const files = [
      { name: 'a', keys: { x: '1', y: '2', z: '3' } },
      { name: 'b', keys: { x: '1', y: '2' } },
      { name: 'c', keys: { x: '1', z: '3' } },
    ];
    expect(findCommonKeys(files)).toEqual(['x']);
  });

  it('handles a file with no keys', () => {
    const files = [
      { name: 'a', keys: { x: '1' } },
      { name: 'b', keys: {} },
    ];
    expect(findCommonKeys(files)).toEqual([]);
  });

  it('returns sorted order regardless of insertion order', () => {
    const files = [
      { name: 'en', keys: { z: '1', a: '2', m: '3' } },
      { name: 'zh', keys: { m: '1', a: '2', z: '3' } },
    ];
    expect(findCommonKeys(files)).toEqual(['a', 'm', 'z']);
  });
});

/* ─── findPartialKeys ──────────────────────────────────────────── */

describe('findPartialKeys', () => {
  it('returns keys missing in some files with file names', () => {
    const files = [
      { name: 'en', keys: { a: '1', b: '2' } },
      { name: 'zh', keys: { a: '1', c: '3' } },
    ];
    const result = findPartialKeys(files);
    expect([...result.keys()].sort()).toEqual(['b', 'c']);
    expect(result.get('b')).toEqual(['zh']);
    expect(result.get('c')).toEqual(['en']);
  });

  it('returns empty when all keys are shared', () => {
    const files = [
      { name: 'en', keys: { a: '1', b: '2' } },
      { name: 'zh', keys: { a: '1', b: '2' } },
    ];
    expect(findPartialKeys(files).size).toBe(0);
  });

  it('returns empty for empty file list', () => {
    expect(findPartialKeys([]).size).toBe(0);
  });

  it('identifies missing files for a key across 3+ files', () => {
    const files = [
      { name: 'a', keys: { x: '1', y: '2' } },
      { name: 'b', keys: { x: '1' } },
      { name: 'c', keys: { x: '1', y: '2' } },
      { name: 'd', keys: { y: '2' } },
    ];
    const result = findPartialKeys(files);
    expect(result.get('x')).toEqual(['d']);
    expect(result.get('y')).toEqual(['b']);
  });
});

/* ─── extractParams ────────────────────────────────────────────── */

describe('extractParams', () => {
  it('extracts simple params', () => {
    expect(extractParams('Hello {name}')).toEqual(['name']);
  });

  it('extracts multiple params', () => {
    expect(extractParams('{a} and {b} and {c}')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty for no params', () => {
    expect(extractParams('Just a string')).toEqual([]);
  });

  it('extracts params with duplicate names once', () => {
    expect(extractParams('{x} and {x} again')).toEqual(['x']);
  });

  it('handles empty string', () => {
    expect(extractParams('')).toEqual([]);
  });

  it('handles params with underscores', () => {
    expect(extractParams('{my_param} and {my_param_2}')).toEqual(['my_param', 'my_param_2']);
  });

  it('extracts params even inside double-braces {{x}}', () => {
    expect(extractParams('{{x}} and {y}')).toEqual(['x', 'y']);
  });
});

/* ─── paramSetsForKey ──────────────────────────────────────────── */

describe('paramSetsForKey', () => {
  it('returns union of params across files', () => {
    const files = [
      { name: 'en', keys: { greeting: 'Hello {name}' } },
      { name: 'zh', keys: { greeting: '你好{name}{title}' } },
    ];
    const result = paramSetsForKey('greeting', files);
    expect(result).toEqual([['name'], ['name', 'title']]);
  });

  it('returns empty arrays for missing keys', () => {
    const files = [
      { name: 'en', keys: { other: 'v' } },
    ];
    expect(paramSetsForKey('missing', files)).toEqual([[]]);
  });

  it('handles keys with no params', () => {
    const files = [
      { name: 'en', keys: { plain: 'Hello' } },
      { name: 'zh', keys: { plain: '你好' } },
    ];
    expect(paramSetsForKey('plain', files)).toEqual([[], []]);
  });
});

/* ─── escapeSingleQuote ────────────────────────────────────────── */

describe('escapeSingleQuote', () => {
  it('passes through strings without quotes', () => {
    expect(escapeSingleQuote('hello')).toBe('hello');
  });

  it('escapes single quotes', () => {
    expect(escapeSingleQuote("it's")).toBe("it\\'s");
  });

  it('handles multiple single quotes', () => {
    expect(escapeSingleQuote("'a' 'b'")).toBe("\\'a\\' \\'b\\'");
  });

  it('handles empty string', () => {
    expect(escapeSingleQuote('')).toBe('');
  });
});

/* ─── generateTypesContent ─────────────────────────────────────── */

describe('generateTypesContent', () => {
  it('generates TranslationKey union for common keys', () => {
    const output = generateTypesContent(['a.b', 'c'], {});
    expect(output).toContain("export type TranslationKey =");
    expect(output).toContain("| 'a.b'");
    expect(output).toContain("| 'c'");
  });

  it('generates never when no common keys', () => {
    const output = generateTypesContent([], {});
    expect(output).toContain('never;');
    expect(output).toContain('Record<string, never>');
  });

  it('generates TranslationParams with undefined for param-less keys', () => {
    const output = generateTypesContent(['simple'], {});
    expect(output).toContain("'simple': undefined;");
  });

  it('generates TranslationParams with union types for params', () => {
    const output = generateTypesContent(['greeting'], { greeting: ['name', 'age'] });
    expect(output).toContain('name: string | number;');
    expect(output).toContain('age: string | number;');
  });

  it('handles mixed keys with and without params', () => {
    const output = generateTypesContent(['a', 'b'], { b: ['x'] });
    expect(output).toContain("'a': undefined;");
    expect(output).toContain("'b': {");
    expect(output).toContain('x: string | number;');
  });

  it('generates valid TypeScript syntax (closing semicolons)', () => {
    const output = generateTypesContent(['k1', 'k2'], {});
    // Last union line should end with semicolon
    expect(output).toMatch(/'k2';/);
  });
});

/* ─── generateRuntimeContent ───────────────────────────────────── */

describe('generateRuntimeContent', () => {
  it('imports from the given package', () => {
    const output = generateRuntimeContent('@baigao_h/ink-kit');
    expect(output).toContain("import { t as rawT, useI18n as rawUseI18n } from '@baigao_h/ink-kit'");
  });

  it('imports from custom package', () => {
    const output = generateRuntimeContent('my-own-i18n');
    expect(output).toContain("from 'my-own-i18n'");
  });

  it('imports i18n-types from relative path', () => {
    const output = generateRuntimeContent('@baigao_h/ink-kit');
    expect(output).toContain("from './i18n-types.js'");
  });

  it('exports typed t function with generic K', () => {
    const output = generateRuntimeContent('@baigao_h/ink-kit');
    expect(output).toContain('export function t<K extends TranslationKey>');
  });

  it('exports typed useI18n hook', () => {
    const output = generateRuntimeContent('@baigao_h/ink-kit');
    expect(output).toContain('export function useI18n()');
  });

  it('handles package name with single quotes escaping', () => {
    const output = generateRuntimeContent("it's-pkg");
    expect(output).toContain("from 'it");
  });
});

/* ─── Integration: disk-based .json scanning & generation ──────── */

describe('makeLanguageType integration', () => {
  it('generates type files from locale JSON files', () => {
    writeLocale('en-US.json', { title: 'Hello', items: 3 });
    writeLocale('zh-CN.json', { title: '你好', items: 5 });

    // Spy on stderr to avoid noise
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const outDir = path.join(tmpDir, 'out');
    makeLanguageType({
      sourceDir: tmpDir,
      outputDir: outDir,
      watch: false,
      debounceMs: 500,
      packageName: '@baigao_h/ink-kit',
    });

    stderrSpy.mockRestore();

    expect(existsSync(path.join(outDir, 'i18n-types.d.ts'))).toBe(true);
    expect(existsSync(path.join(outDir, 'i18n.ts'))).toBe(true);

    const typesContent = fs.readFileSync(path.join(outDir, 'i18n-types.d.ts'), 'utf-8');
    expect(typesContent).toContain("| 'items'");
    expect(typesContent).toContain("| 'title'");
  });

  it('warms about partial keys', () => {
    writeLocale('en-US.json', { shared: 'v', onlyEn: 'e' });
    writeLocale('zh-CN.json', { shared: 'v', onlyZh: 'c' });

    const stderrChunks: string[] = [];
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string) => {
      stderrChunks.push(String(chunk));
      return true;
    });

    const outDir = path.join(tmpDir, 'out2');
    makeLanguageType({
      sourceDir: tmpDir,
      outputDir: outDir,
      watch: false,
      debounceMs: 500,
      packageName: '@baigao_h/ink-kit',
    });

    stderrSpy.mockRestore();

    expect(stderrChunks.some(c => c.includes('Warning'))).toBe(true);
    expect(stderrChunks.some(c => c.includes('onlyEn'))).toBe(true);
    expect(stderrChunks.some(c => c.includes('onlyZh'))).toBe(true);

    const typesContent = fs.readFileSync(path.join(outDir, 'i18n-types.d.ts'), 'utf-8');
    // Partial keys should NOT be in the type
    expect(typesContent).not.toContain('onlyEn');
    expect(typesContent).not.toContain('onlyZh');
    expect(typesContent).toContain('shared');
  });

  it('handles empty directory with warning and generates never type', () => {
    const stderrChunks: string[] = [];
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string) => {
      stderrChunks.push(String(chunk));
      return true;
    });

    const emptyDir = path.join(tmpDir, 'empty');
    mkdirSync(emptyDir, { recursive: true });

    const outDir = path.join(tmpDir, 'out3');
    makeLanguageType({
      sourceDir: emptyDir,
      outputDir: outDir,
      watch: false,
      debounceMs: 500,
      packageName: '@baigao_h/ink-kit',
    });

    stderrSpy.mockRestore();

    expect(stderrChunks.some(c => c.includes('Warning'))).toBe(true);
    expect(stderrChunks.some(c => c.includes('no .json files'))).toBe(true);

    const typesContent = fs.readFileSync(path.join(outDir, 'i18n-types.d.ts'), 'utf-8');
    expect(typesContent).toContain('never');
  });

  it('handles non-existent source directory with error message', () => {
    const stderrChunks: string[] = [];
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string) => {
      stderrChunks.push(String(chunk));
      return true;
    });
    // In jsdom, process.exit may not be mockable, so we catch the actual exit
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('FAKE_EXIT');
    }) as any);

    const fakeDir = '/tmp/nonexistent-' + Date.now();
    expect(() => {
      makeLanguageType({
        sourceDir: fakeDir,
        outputDir: path.join(tmpDir, 'out4'),
        watch: false,
        debounceMs: 500,
        packageName: '@baigao_h/ink-kit',
      });
    }).toThrow('FAKE_EXIT');

    stderrSpy.mockRestore();
    exitSpy.mockRestore();

    expect(stderrChunks.some(c => c.includes('Error'))).toBe(true);
    expect(stderrChunks.some(c => c.includes(fakeDir))).toBe(true);
  });

  it('generates params from union of all file params', () => {
    writeLocale('en-US.json', { greeting: 'Hello {name}' });
    writeLocale('zh-CN.json', { greeting: '你好{name}{title}' });

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const outDir = path.join(tmpDir, 'out5');
    makeLanguageType({
      sourceDir: tmpDir,
      outputDir: outDir,
      watch: false,
      debounceMs: 500,
      packageName: '@baigao_h/ink-kit',
    });

    stderrSpy.mockRestore();

    const typesContent = fs.readFileSync(path.join(outDir, 'i18n-types.d.ts'), 'utf-8');
    // Both params from en and zh should be present (union)
    expect(typesContent).toContain('name: string | number;');
    expect(typesContent).toContain('title: string | number;');
  });

  it('generates runtime file with custom package name', () => {
    writeLocale('en-US.json', { a: '1' });

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const outDir = path.join(tmpDir, 'out6');
    makeLanguageType({
      sourceDir: tmpDir,
      outputDir: outDir,
      watch: false,
      debounceMs: 500,
      packageName: '@my/custom-i18n',
    });

    stderrSpy.mockRestore();

    const runtimeContent = fs.readFileSync(path.join(outDir, 'i18n.ts'), 'utf-8');
    expect(runtimeContent).toContain("from '@my/custom-i18n'");
  });

  it('handles JSON parse failure gracefully', () => {
    // Write invalid JSON
    const fp = path.join(tmpDir, 'bad.json');
    writeFileSync(fp, '{ invalid json }', 'utf-8');

    const stderrChunks: string[] = [];
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string) => {
      stderrChunks.push(String(chunk));
      return true;
    });

    const outDir = path.join(tmpDir, 'out7');
    makeLanguageType({
      sourceDir: tmpDir,
      outputDir: outDir,
      watch: false,
      debounceMs: 500,
      packageName: '@baigao_h/ink-kit',
    });

    stderrSpy.mockRestore();

    expect(stderrChunks.some(c => c.includes('Warning'))).toBe(true);
    expect(stderrChunks.some(c => c.includes('bad.json'))).toBe(true);
  });

  it('ignores non-.json files in source directory', () => {
    writeLocale('en-US.json', { a: '1' });
    writeFileSync(path.join(tmpDir, 'ignore.txt'), 'not json', 'utf-8');
    writeFileSync(path.join(tmpDir, 'config.yaml'), 'a: b', 'utf-8');

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const outDir = path.join(tmpDir, 'out8');
    makeLanguageType({
      sourceDir: tmpDir,
      outputDir: outDir,
      watch: false,
      debounceMs: 500,
      packageName: '@baigao_h/ink-kit',
    });

    stderrSpy.mockRestore();

    const typesContent = fs.readFileSync(path.join(outDir, 'i18n-types.d.ts'), 'utf-8');
    expect(typesContent).toContain('a');
    expect(typesContent).not.toContain('ignore');
  });
});
