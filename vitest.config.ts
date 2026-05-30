import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom', // Due to legacy issues, jsdom is used incorrectly, but existing tests cannot be separated from it, so backward compatibility is used here.
    include: ['src/__tests__/**/*.test.{ts,tsx}'], 
    globals: true,
    testTimeout: 15_000,
    environmentMatchGlobs: [
      // 为 .ink.test.ts 和 .ink.test.tsx 文件使用 node 环境 
      // These suffixes all mean that they automatically use the node environment.
      ['src/__tests__/**/*.ink.test.ts', 'node'],
      ['src/__tests__/**/*.ink.test.tsx', 'node'],
    ],
  },
});
