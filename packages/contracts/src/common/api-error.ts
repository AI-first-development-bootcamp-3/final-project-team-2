import { z } from 'zod';

export const ApiErrorDetailSchema = z.object({
  field: z.string(),
  rule: z.string(),
  message: z.string(),
});

export const ApiErrorSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
  error: z.string(),
  details: z.array(ApiErrorDetailSchema).optional(),
});

export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;

const FIELD_RULES: Record<string, string> = {
  page: 'VAL-PAGE',
  limit: 'VAL-LIMIT',
  sort: 'VAL-SORT',
  order: 'VAL-ORDER',
  role: 'VAL-ROLE',
  isActive: 'VAL-IS-ACTIVE',
  includeDeleted: 'VAL-INCLUDE-DELETED',
  q: 'VAL-QUERY',
};

function ruleFromIssueMessage(message: string): string | undefined {
  return /^VAL-[A-Z0-9-]+$/i.test(message) ? message : undefined;
}

/**
 * Field name given to an issue that belongs to no single input — an empty
 * PATCH, a rule about the body as a whole.
 *
 * Forms key `details[]` by field, so a detail carrying this name matches no
 * input and is dropped unless the form asks for it. `partitionDetails` is how
 * to ask.
 */
export const ROOT_DETAIL_FIELD = '(root)';

export function zodIssuesToDetails(issues: z.ZodIssue[]): ApiErrorDetail[] {
  return issues.map((issue) => {
    const field = issue.path.map(String).join('.') || ROOT_DETAIL_FIELD;
    const rootField = String(issue.path[0] ?? '');
    return {
      field,
      rule: ruleFromIssueMessage(issue.message) ?? FIELD_RULES[rootField] ?? 'VAL-QUERY',
      message: issue.message,
    };
  });
}

/**
 * Splits `details[]` into the parts a form can render.
 *
 * The established pattern keys every detail into a fixed `FieldErrors` record
 * and returns; a detail whose field is not one of the form's inputs — anything
 * at `(root)`, or a field the form does not show — is written to a key nothing
 * reads, so the request fails and the employee sees nothing happen. Everything
 * unmatched comes back in `formErrors` instead, for the form-level slot.
 *
 * @param knownFields the input names this form actually renders.
 */
export function partitionDetails(
  details: readonly ApiErrorDetail[] | undefined,
  knownFields: readonly string[],
): { fieldErrors: Record<string, string>; formErrors: string[] } {
  const known = new Set(knownFields);
  const fieldErrors: Record<string, string> = {};
  const formErrors: string[] = [];

  for (const detail of details ?? []) {
    if (known.has(detail.field)) {
      // First error per field wins; later ones would overwrite the most
      // specific complaint with a derived one.
      fieldErrors[detail.field] ??= detail.message;
    } else {
      formErrors.push(detail.message);
    }
  }

  return { fieldErrors, formErrors };
}
