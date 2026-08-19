import { z } from 'zod';
import { TaskStatus } from '../enums.js';

export const UpdateTaskBodySchema = z.object({
  name: z.string().trim().min(1, { message: 'VAL-24' }).optional(),
  projectId: z.string().uuid({ message: 'VAL-25' }).optional(),
  status: TaskStatus.optional(),
  // Nullable so the edit modal can clear a previously set description.
  description: z.string().trim().nullable().optional(),
});

export type UpdateTaskBody = z.infer<typeof UpdateTaskBodySchema>;
