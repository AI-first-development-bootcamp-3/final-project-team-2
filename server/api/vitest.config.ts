import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import baseTestConfig from '@abra/config/vitest/base';

export default defineConfig({
  test: baseTestConfig,
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
