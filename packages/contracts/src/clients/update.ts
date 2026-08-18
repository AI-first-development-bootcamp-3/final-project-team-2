import { z } from 'zod';

export const UpdateClientBodySchema = z.object({
  name: z.string().trim().min(1, { message: 'VAL-20' }).optional(),
  contactInfo: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateClientBody = z.infer<typeof UpdateClientBodySchema>;
