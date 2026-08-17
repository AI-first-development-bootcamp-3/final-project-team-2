import { z } from 'zod';

export const DeactivateUserResponseSchema = z.object({
  id: z.string().uuid(),
  isActive: z.literal(false),
  deletedAt: z.string(),
});

export type DeactivateUserResponse = z.infer<typeof DeactivateUserResponseSchema>;

export const RestoreUserResponseSchema = z.object({
  id: z.string().uuid(),
  isActive: z.literal(true),
  deletedAt: z.null(),
});

export type RestoreUserResponse = z.infer<typeof RestoreUserResponseSchema>;
