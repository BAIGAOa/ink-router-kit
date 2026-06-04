#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeLanguageType } from './makeLanguageType.js';

const args = process.argv.slice(2);
const subcommand = args[0];

function printHelp(): void {
  console.log('');
  console.log('  ink-kit init <project-name>              Scaffold a new project');
  console.log('  ink-kit makeLanguageType <source> <out>   Generate typed i18n bindings');
  console.log('');
  console.log('Options for makeLanguageType:');
  console.log('  --watch          Re-generate on every file change');
  console.log('  --debounce <ms>  Debounce delay (default 500)');
  console.log('  --from <pkg>     Package name to import from (default @baigao_h/ink-kit)');
  console.log('');
}

if (!subcommand || subcommand === '--help' || subcommand === '-h') {
  printHelp();
  process.exit(subcommand ? 0 : 1);
}

if (subcommand === 'init') {

const projectName = args[1];
if (!projectName) {
  console.error('Error: project name is required');
  process.exit(1);
}

const root = path.resolve(projectName);

if (fs.existsSync(root)) {
  console.error(`Error: directory "${projectName}" already exists`);
  process.exit(1);
}

console.log(`Creating ink-kit project: ${projectName}`);

fs.mkdirSync(path.join(root, 'src'), { recursive: true });

const pkg = {
  name: projectName,
  version: '1.0.0',
  private: true,
  type: 'module',
  scripts: {
    start: 'tsx src/index.tsx',
    dev: 'tsx watch src/index.tsx',
    build: 'tsc',
    test: 'echo "No tests yet"',
  },
  dependencies: {
    '@baigao_h/ink-kit': 'latest',
    ink: '^7.0.1',
    react: '^19.2.4',
  },
  devDependencies: {
    '@types/node': '^20.19.39',
    '@types/react': '^19.2.14',
    tsx: '^4',
    typescript: '^5.9.3',
  },
};

fs.writeFileSync(
  path.join(root, 'package.json'),
  JSON.stringify(pkg, null, 2) + '\n',
);

const tsconfig = {
  compilerOptions: {
    target: 'ES2022',
    module: 'Node16',
    lib: ['ES2022'],
    outDir: './dist',
    rootDir: './src',
    strict: true,
    moduleResolution: 'Node16',
    esModuleInterop: true,
    skipLibCheck: true,
    jsx: 'react',
    types: ['node'],
  },
  include: ['src/**/*'],
  exclude: ['node_modules', 'dist'],
};

fs.writeFileSync(
  path.join(root, 'tsconfig.json'),
  JSON.stringify(tsconfig, null, 2) + '\n',
);

const entry = `import React from 'react';
import { Box, Text, render } from 'ink';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  useScreenSystem,
  KeyboardProvider,
  useKeyboard,
} from '@baigao_h/ink-kit';

function Menu() {
  const { skip } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();

  React.useEffect(() => {
    boundKeyboard(['s'], () => skip(Game));
    boundKeyboard(['q'], () => process.exit(0));
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>ink-kit Demo</Text>
      <Text>[S] Start  [Q] Quit</Text>
    </Box>
  );
}
registerComponent(Menu, {});

function Game() {
  const { back } = useScreenSystem();
  const { boundKeyboard } = useKeyboard();

  React.useEffect(() => {
    boundKeyboard(['b'], () => back());
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Game Screen</Text>
      <Text>[B] Back to Menu</Text>
    </Box>
  );
}
registerComponent(Game, {}, { parent: Menu });

function App() {
  return (
    <KeyboardProvider>
      <CurrentScreen />
    </KeyboardProvider>
  );
}

render(
  <ScenarioManagementProvider defaultScreen={Menu}>
    <App />
  </ScenarioManagementProvider>,
);
`;

fs.writeFileSync(path.join(root, 'src', 'index.tsx'), entry);

console.log('Installing dependencies...');
const result = spawnSync('npm', ['install'], { cwd: root, stdio: 'inherit' });

if (result.status !== 0) {
  console.error('npm install failed. Run npm install manually.');
  process.exit(1);
}

console.log('\nDone! Run:');
console.log(`  cd ${projectName}`);
console.log('  npm start');
}

/* ── makeLanguageType ── */

if (subcommand === 'makeLanguageType') {
  const sourceDir = args[1];
  const outputDir = args[2];

  if (!sourceDir || !outputDir) {
    console.error('Error: ink-kit makeLanguageType <source-dir> <output-dir> [options]');
    process.exit(1);
  }

  const watch = args.includes('--watch');
  const debounceIndex = args.indexOf('--debounce');
  const debounceMs = debounceIndex !== -1 ? parseInt(args[debounceIndex + 1], 10) : 500;
  const fromIndex = args.indexOf('--from');
  const packageName = fromIndex !== -1 ? args[fromIndex + 1] : '@baigao_h/ink-kit';

  if (isNaN(debounceMs) || debounceMs < 0) {
    console.error('Error: --debounce must be a non-negative number');
    process.exit(1);
  }

  makeLanguageType({
    sourceDir: path.resolve(sourceDir),
    outputDir: path.resolve(outputDir),
    watch,
    debounceMs,
    packageName,
  });
  process.exit(0);
}

/* ── unknown subcommand ── */

console.error(`Error: unknown subcommand "${subcommand}"`);
printHelp();
process.exit(1);
