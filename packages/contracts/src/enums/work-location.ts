import { z } from 'zod';

export const WorkLocation = z.enum(['office', 'client_site', 'home']);
export type WorkLocation = z.infer<typeof WorkLocation>;
