import type { UserConfig } from 'vitest/config';

declare const baseTestConfig: NonNullable<UserConfig['test']>;
export default baseTestConfig;
