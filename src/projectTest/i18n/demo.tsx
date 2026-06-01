import React, { useState } from 'react';
import { render, Box, Text, useInput } from 'ink';
import { LanguageProvider, useI18n } from '../../index.js';

function I18nDemo() {
  const { t, setLanguage, getLanguages, currentLanguage } = useI18n();
  const [langIdx, setLangIdx] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === 'q') process.exit(0);
    if (input === 'l') {
      const langs = getLanguages();
      const next = (langIdx + 1) % langs.length;
      setLangIdx(next);
      setLanguage(langs[next]);
    }
  });

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text bold color="cyan">
        {t('title')}
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text>  {t('game.info', { level: 3, score: 4200 })}</Text>
        <Text>  {t('player', { age: 25 })}</Text>
        <Text>  {t('inventory', { count: 7 })}</Text>
      </Box>
      <Box marginTop={2}>
        <Text dimColor>
          Language: {currentLanguage}  [L] Switch ({getLanguages().join(', ')})  [Q] Quit
        </Text>
      </Box>
    </Box>
  );
}

render(
  <LanguageProvider
    path="./src/projectTest/i18n/locales"
    defaultLanguage="en-US"
  >
    <I18nDemo />
  </LanguageProvider>,
);
