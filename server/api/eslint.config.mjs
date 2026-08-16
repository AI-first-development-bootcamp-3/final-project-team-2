import nodeConfig from '@abra/config/eslint/node';

// api/ is Vercel's serverless function build output (also gitignored)
export default [{ ignores: ['api/'] }, ...nodeConfig];
