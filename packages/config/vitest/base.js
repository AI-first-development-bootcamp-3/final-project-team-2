/** @type {import('vitest/config').UserConfig['test']} */
const baseTestConfig = {
  exclude: ['dist/**', 'node_modules/**'],
  coverage: {
    provider: 'v8',
    include: ['src/**'],
    exclude: ['src/main.{ts,tsx}', 'src/**/*.module.ts', 'src/**/*.d.ts', 'src/**/*.css'],
    thresholds: {
      lines: 70,
      branches: 70,
      functions: 70,
      statements: 70,
    },
  },
};

export default baseTestConfig;
