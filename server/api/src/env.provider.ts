import type { Provider } from '@nestjs/common';
import { parseEnv, type Env } from './env';

// Injection token so modules receive the parsed, validated env instead of
// reading process.env ad hoc — tests override it with fixed values.
export const ENV = Symbol('ENV');

export const envProvider: Provider = {
  provide: ENV,
  useFactory: (): Env => parseEnv(),
};
