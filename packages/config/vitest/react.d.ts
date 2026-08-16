import type { UserConfig } from 'vitest/config';

declare const reactTestConfig: NonNullable<UserConfig['test']>;
export default reactTestConfig;
