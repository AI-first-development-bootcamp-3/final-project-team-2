import { z } from 'zod';
import { AssignmentListItemSchema } from './list.js';

export const CreateAssignmentBodySchema = z.object({
  userId: z
    .string({ required_error: 'VAL-26', invalid_type_error: 'VAL-26' })
    .uuid({ message: 'VAL-26' }),
  taskId: z
    .string({ required_error: 'VAL-26', invalid_type_error: 'VAL-26' })
    .uuid({ message: 'VAL-26' }),
});

export const AssignmentCreateSuccessSchema = z.object({
  data: AssignmentListItemSchema,
});

export type CreateAssignmentBody = z.infer<typeof CreateAssignmentBodySchema>;
export type AssignmentCreateSuccess = z.infer<typeof AssignmentCreateSuccessSchema>;
