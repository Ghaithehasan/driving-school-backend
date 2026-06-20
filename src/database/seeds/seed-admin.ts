import 'reflect-metadata';
import * as argon2 from 'argon2';
import { AccountStatus, RoleTitle } from '../../common/enums/index';
import { Role } from '../../roles/role.entity';
import { UserRole } from '../../roles/user-role.entity';
import { User } from '../../users/user.entity';
import { AppDataSource } from '../data-source';

/**
 * Seed أولي: ينشئ الأدوار الأساسية + حساب مدير (MANAGER) واحد لتجربة الدخول.
 * idempotent: لو الحساب موجود ما بيعمل شي. شغّله بـ: npm run seed:admin
 */

const ADMIN_PHONE = '0999111222';
const ADMIN_PASSWORD = 'Admin@12345';
const ADMIN_NAME = 'مدير النظام';

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ الاتصال بقاعدة البيانات نجح');

  await AppDataSource.transaction(async (manager) => {
    const roleRepo = manager.getRepository(Role);
    const userRepo = manager.getRepository(User);
    const userRoleRepo = manager.getRepository(UserRole);

    // 1) أنشئ الأدوار الخمسة الأساسية إذا مش موجودة.
    for (const title of Object.values(RoleTitle)) {
      const exists = await roleRepo.findOne({ where: { title } });
      if (!exists) {
        await roleRepo.save(roleRepo.create({ title }));
        console.log(`➕ أُنشئ الدور: ${title}`);
      }
    }

    // 2) تأكد إنه حساب المدير مش موجود مسبقاً.
    const existingAdmin = await userRepo.findOne({
      where: { phone: ADMIN_PHONE },
    });
    if (existingAdmin) {
      console.log('ℹ️  حساب المدير موجود مسبقاً — لا حاجة لإنشائه.');
      return;
    }

    // 3) أنشئ المستخدم مع كلمة سر مشفّرة بـ argon2.
    const passwordHash = await argon2.hash(ADMIN_PASSWORD);
    const admin = await userRepo.save(
      userRepo.create({
        name: ADMIN_NAME,
        phone: ADMIN_PHONE,
        passwordHash,
        accountStatus: AccountStatus.ACTIVE,
        mustChangePassword: false,
      }),
    );

    // 4) اربط المستخدم بدور MANAGER (قاعدة RBAC: ما في مستخدم بدون دور).
    const managerRole = await roleRepo.findOneOrFail({
      where: { title: RoleTitle.MANAGER },
    });
    await userRoleRepo.save(
      userRoleRepo.create({ user: admin, role: managerRole }),
    );

    console.log('✅ أُنشئ حساب المدير ورُبط بدور MANAGER');
  });

  console.log('\n========== بيانات الدخول للتجربة ==========');
  console.log(`📱 الهاتف:      ${ADMIN_PHONE}`);
  console.log(`🔑 كلمة المرور: ${ADMIN_PASSWORD}`);
  console.log('===========================================\n');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ فشل الـ seed:', err);
  process.exit(1);
});
