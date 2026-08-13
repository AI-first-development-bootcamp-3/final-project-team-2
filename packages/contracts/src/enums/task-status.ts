import { z } from 'zod';

export const TaskStatus = z.enum(['open', 'closed']);
export type TaskStatus = z.infer<typeof TaskStatus>;
