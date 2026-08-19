import { describe, it, expect } from 'vitest';
import { ROOT_DETAIL_FIELD, partitionDetails, zodIssuesToDetails } from './api-error.js';
import { z } from 'zod';

const detail = (field: string, message: string) => ({ field, rule: 'VAL-X', message });

describe('zodIssuesToDetails', () => {
  it('names a pathless issue with the root field', () => {
    const issues = [
      { code: z.ZodIssueCode.custom, path: [], message: 'VAL-EMPTY-UPDATE' },
    ] as z.ZodIssue[];

    expect(zodIssuesToDetails(issues)[0]?.field).toBe(ROOT_DETAIL_FIELD);
  });
});

describe('partitionDetails', () => {
  it('keys details that match a rendered input', () => {
    const { fieldErrors, formErrors } = partitionDetails(
      [detail('startAt', 'VAL-30'), detail('endAt', 'VAL-31')],
      ['startAt', 'endAt'],
    );

    expect(fieldErrors).toEqual({ startAt: 'VAL-30', endAt: 'VAL-31' });
    expect(formErrors).toEqual([]);
  });

  /**
   * The failure this exists to prevent: a form that keys every detail by field
   * writes `(root)` to a key nothing renders, then returns — so the request
   * fails and the employee sees a save that did nothing.
   */
  it('surfaces a root-level detail as a form error instead of dropping it', () => {
    const { fieldErrors, formErrors } = partitionDetails(
      [detail(ROOT_DETAIL_FIELD, 'לא נשלחו שדות לעדכון')],
      ['startAt', 'endAt'],
    );

    expect(fieldErrors).toEqual({});
    expect(formErrors).toEqual(['לא נשלחו שדות לעדכון']);
  });

  it('surfaces a detail for a field the form does not render', () => {
    const { formErrors } = partitionDetails([detail('taskId', 'VAL-33')], ['startAt']);
    expect(formErrors).toEqual(['VAL-33']);
  });

  it('keeps the first error per field, not the last', () => {
    const { fieldErrors } = partitionDetails(
      [detail('startAt', 'VAL-30'), detail('startAt', 'derived')],
      ['startAt'],
    );

    expect(fieldErrors['startAt']).toBe('VAL-30');
  });

  it('tolerates missing details', () => {
    expect(partitionDetails(undefined, ['startAt'])).toEqual({ fieldErrors: {}, formErrors: [] });
  });
});
