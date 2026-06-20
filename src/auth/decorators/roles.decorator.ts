import { SetMetadata } from '@nestjs/common';
import { RoleTitle } from '../../common/enums/index';

export const ROLES_KEY = 'roles';

/**
 * يحدّد الأدوار المسموح لها بالوصول لـ endpoint.
 * الاستخدام: @Roles(RoleTitle.MANAGER, RoleTitle.ACCOUNTANT)
 *
 * يخزّن قائمة الأدوار كـ metadata، والـ RolesGuard بيقرأها وقت التنفيذ.
 */
export const Roles = (...roles: RoleTitle[]) => SetMetadata(ROLES_KEY, roles);
