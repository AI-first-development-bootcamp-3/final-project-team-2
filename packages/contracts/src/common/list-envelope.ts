import { z } from 'zod';

export const ListMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
});

export type ListMeta = z.infer<typeof ListMetaSchema>;

export function listSuccessSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: ListMetaSchema,
  });
}
