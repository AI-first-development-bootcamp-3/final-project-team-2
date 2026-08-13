import { z } from 'zod';

export const HalfDayPeriod = z.enum(['morning', 'afternoon']);
export type HalfDayPeriod = z.infer<typeof HalfDayPeriod>;
