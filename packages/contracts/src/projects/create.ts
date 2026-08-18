import { z } from 'zod';
import { ProjectListItemSchema } from './list.js';

export const CreateProjectBodySchema = z.object({
  name: z
    .string({ required_error: 'VAL-22', invalid_type_error: 'VAL-22' })
    .trim()
    .min(1, { message: 'VAL-22' }),
  clientId: z
    .string({ required_error: 'VAL-23', invalid_type_error: 'VAL-23' })
    .uuid({ message: 'VAL-23' }),
});

export const ProjectCreateSuccessSchema = z.object({
  data: ProjectListItemSchema,
});

export type CreateProjectBody = z.infer<typeof CreateProjectBodySchema>;
export type ProjectCreateSuccess = z.infer<typeof ProjectCreateSuccessSchema>;
