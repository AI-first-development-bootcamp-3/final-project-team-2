import type { ApiErrorDetail, ValCode } from '@abra/contracts';
import { VAL_MESSAGES } from '@abra/contracts';

export type EntryField = 'taskId' | 'startTime' | 'endTime' | 'location' | 'date' | 'description';

const DETAIL_TO_FIELD: Record<string, EntryField> = {
  taskId: 'taskId',
  startAt: 'startTime',
  startTime: 'startTime',
  endAt: 'endTime',
  endTime: 'endTime',
  location: 'location',
  date: 'date',
  description: 'description',
};

export function messageForRule(rule: string, fallback: string): string {
  return rule in VAL_MESSAGES ? VAL_MESSAGES[rule as ValCode] : fallback;
}

/**
 * Maps API `details[]` onto form fields. Unmatched fields — including
 * `VAL-EMPTY-UPDATE` at `(root)` — become a form-level message so they are
 * not dropped the way the admin create forms drop unknown keys.
 */
export function partitionDetails(details: ApiErrorDetail[]): {
  fieldErrors: Partial<Record<EntryField, string>>;
  formError: string | null;
} {
  const fieldErrors: Partial<Record<EntryField, string>> = {};
  const unmatched: string[] = [];

  for (const detail of details) {
    const message = messageForRule(detail.rule, detail.message);
    const field = DETAIL_TO_FIELD[detail.field];
    if (field) {
      fieldErrors[field] = message;
    } else {
      unmatched.push(message);
    }
  }

  return {
    fieldErrors,
    formError: unmatched[0] ?? null,
  };
}
