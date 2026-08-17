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

export function zodIssuesToDetails(issues: z.ZodIssue[]): ApiErrorDetail[] {
  return issues.map((issue) => {
    const field = issue.path.map(String).join('.') || '(root)';
    const rootField = String(issue.path[0] ?? '');
    return {
      field,
      rule: ruleFromIssueMessage(issue.message) ?? FIELD_RULES[rootField] ?? 'VAL-QUERY',
      message: issue.message,
    };
  });
}
