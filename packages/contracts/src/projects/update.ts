import { z } from 'zod';

export const UpdateProjectBodySchema = z.object({
  name: z.string().trim().min(1, { message: 'VAL-22' }).optional(),
  clientId: z.string().uuid({ message: 'VAL-23' }).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateProjectBody = z.infer<typeof UpdateProjectBodySchema>;
