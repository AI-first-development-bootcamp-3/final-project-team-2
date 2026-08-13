import { z } from 'zod';

export const AbsenceType = z.enum(['vacation', 'sick', 'military', 'other']);
export type AbsenceType = z.infer<typeof AbsenceType>;
