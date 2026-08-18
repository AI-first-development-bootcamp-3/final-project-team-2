import { z } from 'zod';
import { TaskListItemSchema } from './list.js';

export const CreateTaskBodySchema = z.object({
  name: z
    .string({ required_error: 'VAL-24', invalid_type_error: 'VAL-24' })
    .trim()
    .min(1, { message: 'VAL-24' }),
  projectId: z
    .string({ required_error: 'VAL-25', invalid_type_error: 'VAL-25' })
    .uuid({ message: 'VAL-25' }),
  description: z.string().trim().optional(),
});

export const TaskCreateSuccessSchema = z.object({
  data: TaskListItemSchema,
});

export type CreateTaskBody = z.infer<typeof CreateTaskBodySchema>;
export type TaskCreateSuccess = z.infer<typeof TaskCreateSuccessSchema>;
