import { defineConfig, mergeConfig } from 'vitest/config';
import reactTestConfig from '@abra/config/vitest/react';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: reactTestConfig,
  }),
);
