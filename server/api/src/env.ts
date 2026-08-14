import { z } from 'zod';

// Server-private env schema — request/response schemas belong in
// packages/contracts, this shape must not leak to the frontends.
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:5174')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  // Optional until consumed: the Prisma change flips this to required.
  DATABASE_URL: z
    .string()
    .url()
    .startsWith('postgresql://', 'must be a postgresql:// connection string')
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    console.error('Invalid environment configuration — refusing to start:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}
