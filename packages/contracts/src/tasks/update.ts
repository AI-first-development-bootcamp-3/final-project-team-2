import { z } from 'zod';
import { TaskStatus } from '../enums.js';

export const UpdateTaskBodySchema = z.object({
  name: z.string().trim().min(1, { message: 'VAL-24' }).optional(),
  projectId: z.string().uuid({ message: 'VAL-25' }).optional(),
  status: TaskStatus.optional(),
  description: z.string().trim().optional(),
});

export type UpdateTaskBody = z.infer<typeof UpdateTaskBodySchema>;
