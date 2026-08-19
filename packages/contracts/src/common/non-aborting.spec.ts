import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { nonAborting } from './non-aborting.js';

const Colour = z.enum(['red', 'green'], { errorMap: () => ({ message: 'VAL-COLOUR' }) });

describe('nonAborting', () => {
  it('passes a valid value through unchanged', () => {
    const result = nonAborting(Colour).safeParse('red');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toBe('red');
  });

  it('reports the wrapped schema own message', () => {
    const result = nonAborting(Colour).safeParse('blue');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toEqual(['VAL-COLOUR']);
  });

  it('reports a missing value rather than passing it', () => {
    expect(nonAborting(Colour).safeParse(undefined).success).toBe(false);
  });

  /**
   * The whole point: zod skips an object's `.superRefine` when any field
   * aborts, which silently drops every cross-field rule.
   */
  it('lets the surrounding object cross-field rules still run', () => {
    let refinementRan = false;
    const schema = z
      .object({ name: z.string(), colour: nonAborting(Colour) })
      .superRefine(() => {
        refinementRan = true;
      });

    schema.safeParse({ name: 'x' });

    expect(refinementRan).toBe(true);
  });

  it('does not run them when the field is left unwrapped — the behaviour it fixes', () => {
    let refinementRan = false;
    const schema = z.object({ name: z.string(), colour: Colour }).superRefine(() => {
      refinementRan = true;
    });

    schema.safeParse({ name: 'x' });

    expect(refinementRan).toBe(false);
  });

  it('keeps the failing value reachable so rules can re-check it', () => {
    const schema = z.object({ colour: nonAborting(Colour) }).superRefine((value, ctx) => {
      // Widened deliberately: on failure the *raw* value comes through, which
      // is the whole reason cross-field rules must re-check what they read.
      if ((value.colour as string) === 'blue') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['colour'], message: 'SEEN-RAW' });
      }
    });

    const result = schema.safeParse({ colour: 'blue' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain('SEEN-RAW');
  });
});
