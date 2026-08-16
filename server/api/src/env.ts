import { z } from 'zod';

// Server-private env schema — request/response schemas belong in
// packages/contracts, this shape must not leak to the frontends.
// Set-but-empty vars (PORT= in a wrapper script or CI) mean "use the default",
// but zod defaults only fire on undefined — normalize first.
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z.object({
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(3000)),
  CORS_ORIGINS: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .default('http://localhost:5173,http://localhost:5174')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      // A value like ',' would otherwise yield [] and silently block every
      // browser origin — fail loudly instead.
      .refine((origins) => origins.length > 0, 'must contain at least one origin'),
  ),
  // Optional until consumed: the Prisma change flips this to required.
  // Both postgresql:// and postgres:// are valid schemes (Neon issues both).
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
      'must be a postgresql:// or postgres:// connection string',
    )
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(issues: z.ZodIssue[]) {
    const lines = issues.map(
      (issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    super(`Invalid environment configuration — refusing to start:\n${lines.join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }
  return result.data;
}
