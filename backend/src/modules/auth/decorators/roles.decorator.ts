import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Role constants for type safety
export const RoleNames = {
  SALES_STAFF: 'sales_staff',
  MANAGER: 'manager',
  ADMIN: 'admin',
} as const;
