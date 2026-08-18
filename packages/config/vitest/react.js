import baseTestConfig from './base.js';

/** @type {import('vitest/config').UserConfig['test']} */
const reactTestConfig = {
  ...baseTestConfig,
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
};

export default reactTestConfig;
