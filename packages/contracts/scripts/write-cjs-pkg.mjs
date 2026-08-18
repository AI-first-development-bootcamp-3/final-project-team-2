// Marks dist/cjs as CommonJS. The package itself is "type": "module", so
// without this Node would read dist/cjs/*.js as ESM and throw ERR_REQUIRE_ESM.
import { writeFileSync } from 'node:fs';

writeFileSync(
  new URL('../dist/cjs/package.json', import.meta.url),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
);
