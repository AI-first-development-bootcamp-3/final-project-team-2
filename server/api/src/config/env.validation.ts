import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().startsWith('postgres', {
    message: 'DATABASE_URL must be a PostgreSQL connection string',
  }),
});

export function validateEnv(
  env: Record<string, unknown> = process.env,
): void {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
  }
}
