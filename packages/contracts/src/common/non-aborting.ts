import { z } from 'zod';

/**
 * Wraps a field schema so its failure reports without aborting the object.
 *
 * Zod stops at the first *aborted* field: a missing or wrong-typed value makes
 * the whole object parse abort, and `.superRefine` on the object never runs.
 * That silently drops every cross-field rule — an entry submitted with
 * backwards times *and* no location is told only about the location, and the
 * employee learns about the times on a second round trip.
 *
 * A field validated through here fails *dirty* instead: the issues are
 * reported, the value passes through, and the object's cross-field rules still
 * run. Rules that consume the value are responsible for re-checking it against
 * its own schema first — see `refineTimeEntryTimes` — because what comes
 * through on failure is whatever the caller sent.
 *
 * **Validation only.** The value is passed through untouched, so this must not
 * wrap a schema that transforms its input (`.trim()`, `.transform()`, a
 * coercion) — the transform would be silently skipped. Chaining one here does
 * not work either: a `.transform()` on top collapses the dirty result back into
 * an aborting one, which is the very behaviour this exists to avoid.
 */
export function nonAborting<TOut>(
  schema: z.ZodType<TOut, z.ZodTypeDef, unknown>,
): z.ZodType<TOut, z.ZodTypeDef, unknown> {
  const wrapped = z.any().superRefine((value, ctx) => {
    const result = schema.safeParse(value);
    if (result.success) {
      return;
    }

    for (const issue of result.error.issues) {
      // `path` here is relative to the field; zod prefixes the field name.
      // `fatal: false` keeps the issue from escalating into an abort.
      ctx.addIssue({ ...issue, fatal: false });
    }
  });

  return wrapped as unknown as z.ZodType<TOut, z.ZodTypeDef, unknown>;
}
