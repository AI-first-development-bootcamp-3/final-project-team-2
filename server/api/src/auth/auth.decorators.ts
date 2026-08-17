import { SetMetadata, applyDecorators } from '@nestjs/common';
import type { UserRole } from '@abra/contracts';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Opts a route out of authentication — login, refresh, and health only. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Any authenticated user (EMPLOYEE or ADMIN). Explicit marker for readability. */
export const Auth = () => applyDecorators(SetMetadata(ROLES_KEY, undefined));

/** Restricts a route to the given roles (ADR-26: admin-console routes use @Roles('admin')). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
