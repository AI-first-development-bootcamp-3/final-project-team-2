import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(join(process.cwd(), 'package.json'));

describe('@abra/contracts CJS interop', () => {
  it('can be required by the Nest CommonJS runtime', () => {
    const contracts = require('@abra/contracts') as {
      UsersListQuerySchema: { parse: (v: unknown) => unknown };
      zodIssuesToDetails: (issues: unknown[]) => unknown;
    };
    expect(contracts.UsersListQuerySchema.parse({})).toMatchObject({
      page: 1,
      limit: 20,
    });
    expect(typeof contracts.zodIssuesToDetails).toBe('function');
  });
});
