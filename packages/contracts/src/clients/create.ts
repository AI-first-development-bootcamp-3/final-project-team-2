import { z } from 'zod';
import { ClientListItemSchema } from './list.js';

export const CreateClientBodySchema = z.object({
  name: z
    .string({ required_error: 'VAL-20', invalid_type_error: 'VAL-20' })
    .trim()
    .min(1, { message: 'VAL-20' }),
  contactInfo: z.string().trim().optional(),
});

export const ClientCreateSuccessSchema = z.object({
  data: ClientListItemSchema,
});

export type CreateClientBody = z.infer<typeof CreateClientBodySchema>;
export type ClientCreateSuccess = z.infer<typeof ClientCreateSuccessSchema>;
