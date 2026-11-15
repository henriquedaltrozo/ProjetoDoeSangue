import { SetMetadata } from '@nestjs/common';
import { Role } from '../../domain/enums';

export const ROLES_KEY = 'roles';

/** Uso: @Roles(Role.ADMIN) acima de um handler ou controller, junto com RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
