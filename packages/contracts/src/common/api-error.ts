import { z } from 'zod';
import { VAL_MESSAGES, type ValCode } from './val-messages.js';

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

/**
 * `zodIssuesToDetails` with each rule's Hebrew message substituted.
 *
 * Every endpoint that validates a body needs exactly this, and until now every
 * one of them carried its own copy — six controllers plus two more inlined in
 * the time-entries service. A change to the fallback made in one of them did
 * not reach the others, so a single endpoint could start answering the RTL
 * clients with a raw rule code while the rest stayed translated. One
 * definition, next to the envelope it builds.
 */
export function zodIssuesToHebrewDetails(issues: z.ZodIssue[]): ApiErrorDetail[] {
  return zodIssuesToDetails(issues).map((detail) => ({
    ...detail,
    message: detail.rule in VAL_MESSAGES ? VAL_MESSAGES[detail.rule as ValCode] : detail.message,
  }));
}

/**
 * The single-rule detail that a guard rejection carries — VAL-33 on a task,
 * VAL-34 on a month, VAL-32 on a clash.
 *
 * The HTTP envelope around it stays in the API, which owns the framework's
 * exception types; this is only the part both layers must agree on.
 */
export function valDetail(field: string, rule: ValCode): ApiErrorDetail {
  return { field, rule, message: VAL_MESSAGES[rule] };
}
