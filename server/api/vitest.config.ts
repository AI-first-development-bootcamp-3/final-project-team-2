import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import baseTestConfig from '@abra/config/vitest/base';

export default defineConfig({
  test: {
    ...baseTestConfig,
    // The first test in each spec file pays for compiling the Nest module
    // graph, which on a cold cache runs well past vitest's 5s default before a
    // single assertion executes. Several controller specs boot Nest in
    // parallel, so they contend and the slowest ones time out on what is
    // really startup cost, not test cost. Warm runs finish in milliseconds.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
