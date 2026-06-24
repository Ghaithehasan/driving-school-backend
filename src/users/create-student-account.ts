import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AccountStatus, RoleTitle, StudentStatus } from '../common/enums/index';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';
import { Student } from '../students/student.entity';
import { User } from './user.entity';

export interface CreateStudentAccountData {
  name: string;
  phone: string;
  passwordHash: string;
  mustChangePassword: boolean;
}

/**
 * ينشئ حساب طالب كامل (User + Student + ربطه بدور STUDENT) ضمن transaction معطى.
 * يُستخدم من مسارين: إنشاء الإدارة لطالب، وتسجيل الطالب نفسه من تطبيق الموبايل.
 *
 * دالة خالصة تأخذ EntityManager — حتى نتجنّب الترابط الدائري بين الموديولات،
 * ونضمن إنه الإنشاء يصير ضمن نفس الـ transaction تبع المُستدعي.
 */
export async function createStudentAccount(
  manager: EntityManager,
  data: CreateStudentAccountData,
): Promise<{ user: User; student: Student }> {
  const existing = await manager.findOne(User, { where: { phone: data.phone } });
  if (existing) throw new ConflictException('رقم الهاتف مستخدم مسبقاً');

  const user = await manager.save(
    manager.create(User, {
      name: data.name,
      phone: data.phone,
      passwordHash: data.passwordHash,
      accountStatus: AccountStatus.ACTIVE,
      mustChangePassword: data.mustChangePassword,
    }),
  );

  const student = await manager.save(
    manager.create(Student, {
      user,
      studentStatus: StudentStatus.IN_TRAINING,
    }),
  );

  const role = await manager.findOneOrFail(Role, {
    where: { title: RoleTitle.STUDENT },
  });
  await manager.save(manager.create(UserRole, { user, role }));

  return { user, student };
}
