import { useContext } from 'react';
import { LanguageContext } from './context.js';
import type { I18nContextValue } from './types.js';

export function useI18n(): I18nContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error(
      '[Ink-Router-Kit] useI18n() must be called inside a <LanguageProvider>.',
    );
  }
  return ctx;
}
