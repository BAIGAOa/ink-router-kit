import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Text } from 'ink';
import { LanguageProvider, useI18n } from '../../language/index.js';

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function T({ k, params }: { k: string; params?: Record<string, string | number> }) {
  const { t } = useI18n();
  return <Text>{t(k, params)}</Text>;
}

function CurrentLang() {
  const { currentLanguage } = useI18n();
  return <Text>{currentLanguage}</Text>;
}

describe('LanguageProvider', () => {
  it('resources 基本翻译', () => {
    const { lastFrame } = render(
      <LanguageProvider
        resources={{ 'en-US': { hello: 'Hello' } }}
        defaultLanguage="en-US"
      >
        <T k="hello" />
      </LanguageProvider>,
    );
    expect(stripAnsi(lastFrame())).toContain('Hello');
  });

  it('参数插值', () => {
    const { lastFrame } = render(
      <LanguageProvider
        resources={{ 'en-US': { level: 'Level {n}' } }}
        defaultLanguage="en-US"
      >
        <T k="level" params={{ n: 5 }} />
      </LanguageProvider>,
    );
    expect(stripAnsi(lastFrame())).toContain('Level 5');
  });

  it('缺失 key 返回 key 本身', () => {
    const { lastFrame } = render(
      <LanguageProvider
        resources={{ 'en-US': { a: 'A' } }}
        defaultLanguage="en-US"
      >
        <T k="missing" />
      </LanguageProvider>,
    );
    expect(stripAnsi(lastFrame())).toContain('missing');
  });

  it('setLanguage 切换语言后 t() 返回新语言的翻译', async () => {
    const { lastFrame } = render(
      <LanguageProvider
        resources={{ 'en-US': { hello: 'Hello' }, 'zh-CN': { hello: '你好' } }}
        defaultLanguage="en-US"
      >
        <SwitchLang />
      </LanguageProvider>,
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(stripAnsi(lastFrame())).toContain('你好');
  });

  it('getLanguages 返回所有可用语言', () => {
    const { lastFrame } = render(
      <LanguageProvider
        resources={{ 'en-US': { a: 'A' }, 'zh-CN': { a: '啊' }, 'ja-JP': { a: 'あ' } }}
        defaultLanguage="en-US"
      >
        <LangList />
      </LanguageProvider>,
    );
    const out = stripAnsi(lastFrame());
    expect(out).toContain('en-US');
    expect(out).toContain('zh-CN');
    expect(out).toContain('ja-JP');
  });

  it('currentLanguage 返回当前语言', () => {
    const { lastFrame } = render(
      <LanguageProvider
        resources={{ 'en-US': { a: 'A' } }}
        defaultLanguage="en-US"
      >
        <CurrentLang />
      </LanguageProvider>,
    );
    expect(stripAnsi(lastFrame())).toContain('en-US');
  });
});

function SwitchLang() {
  const { t, setLanguage } = useI18n();
  React.useEffect(() => { setLanguage('zh-CN'); }, []);
  return <Text>{t('hello')}</Text>;
}

function LangList() {
  const { getLanguages } = useI18n();
  return <Text>{getLanguages().join(',')}</Text>;
}
