import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RoleTitle } from '../../common/enums/index';
import { RolePermission } from '../../roles/role-permission.entity';
import { PERMISSIONS_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) throw new ForbiddenException('ليس لديك صلاحية للوصول لهذا المورد');

    const rolePermissions = await this.rolePermissionRepo.find({
      where: { role: { title: In(user.roles as RoleTitle[]) } },
      relations: { permission: true },
    });

    const userPermissions = rolePermissions.map((rp) => rp.permission.code);

    if (!required.every((p) => userPermissions.includes(p))) {
      throw new ForbiddenException('ليس لديك صلاحية للوصول لهذا المورد');
    }

    return true;
  }
}
