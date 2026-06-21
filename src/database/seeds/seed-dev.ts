import 'reflect-metadata';
import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';
dotenv.config();

import {
  AccountStatus,
  Gender,
  InstructorType,
  RoleTitle,
  StudentStatus,
} from '../../common/enums/index';
import { Employee } from '../../employees/employee.entity';
import { Instructor } from '../../instructors/instructor.entity';
import { Permission } from '../../roles/permission.entity';
import { RolePermission } from '../../roles/role-permission.entity';
import { Role } from '../../roles/role.entity';
import { UserRole } from '../../roles/user-role.entity';
import { Student } from '../../students/student.entity';
import { User } from '../../users/user.entity';
import { AppDataSource } from '../data-source';

// ─── الصلاحيات ────────────────────────────────────────────────────────────────

const PERMISSIONS: { code: string; module: string; description: string }[] = [
  { code: 'users.create',         module: 'users',         description: 'إنشاء مستخدم' },
  { code: 'users.read',           module: 'users',         description: 'عرض المستخدمين' },
  { code: 'users.update',         module: 'users',         description: 'تعديل مستخدم' },
  { code: 'users.block',          module: 'users',         description: 'حظر مستخدم' },

  { code: 'students.create',      module: 'students',      description: 'إنشاء طالب' },
  { code: 'students.read',        module: 'students',      description: 'عرض الطلاب' },
  { code: 'students.update',      module: 'students',      description: 'تعديل طالب' },

  { code: 'instructors.create',   module: 'instructors',   description: 'إنشاء مدرس' },
  { code: 'instructors.read',     module: 'instructors',   description: 'عرض المدرسين' },
  { code: 'instructors.update',   module: 'instructors',   description: 'تعديل مدرس' },

  { code: 'employees.create',     module: 'employees',     description: 'إنشاء موظف' },
  { code: 'employees.read',       module: 'employees',     description: 'عرض الموظفين' },
  { code: 'employees.update',     module: 'employees',     description: 'تعديل موظف' },

  { code: 'vehicles.create',      module: 'vehicles',      description: 'إضافة سيارة' },
  { code: 'vehicles.read',        module: 'vehicles',      description: 'عرض السيارات' },
  { code: 'vehicles.update',      module: 'vehicles',      description: 'تعديل سيارة' },
  { code: 'vehicles.delete',      module: 'vehicles',      description: 'حذف سيارة' },

  { code: 'bookings.create',      module: 'bookings',      description: 'إنشاء حجز' },
  { code: 'bookings.read',        module: 'bookings',      description: 'عرض الحجوزات' },
  { code: 'bookings.cancel',      module: 'bookings',      description: 'إلغاء حجز' },
  { code: 'bookings.complete',    module: 'bookings',      description: 'إتمام حجز' },
  { code: 'bookings.no-show',     module: 'bookings',      description: 'تسجيل غياب' },

  { code: 'payments.create',      module: 'payments',      description: 'إضافة دفعة' },
  { code: 'payments.read',        module: 'payments',      description: 'عرض المدفوعات' },
  { code: 'payments.verify',      module: 'payments',      description: 'التحقق من الدفع' },

  { code: 'certificates.create',  module: 'certificates',  description: 'إنشاء شهادة' },
  { code: 'certificates.read',    module: 'certificates',  description: 'عرض الشهادات' },
  { code: 'certificates.update',  module: 'certificates',  description: 'تعديل شهادة' },
  { code: 'certificates.cancel',  module: 'certificates',  description: 'إلغاء شهادة' },

  { code: 'expenses.create',      module: 'expenses',      description: 'إضافة مصروف' },
  { code: 'expenses.read',        module: 'expenses',      description: 'عرض المصروفات' },
  { code: 'expenses.update',      module: 'expenses',      description: 'تعديل مصروف' },

  { code: 'settings.read',        module: 'settings',      description: 'عرض الإعدادات' },
  { code: 'settings.update',      module: 'settings',      description: 'تعديل الإعدادات' },

  { code: 'roles.manage',         module: 'roles',         description: 'إدارة الأدوار والصلاحيات' },

  { code: 'notifications.read',   module: 'notifications', description: 'عرض الإشعارات' },
];

// ─── توزيع الصلاحيات على الأدوار ─────────────────────────────────────────────

const ALL = PERMISSIONS.map((p) => p.code);

const ROLE_PERMISSIONS: Record<RoleTitle, string[]> = {
  [RoleTitle.MANAGER]: ALL,

  [RoleTitle.RECEPTIONIST]: [
    'students.create', 'students.read',
    'instructors.read',
    'vehicles.read',
    'bookings.create', 'bookings.read', 'bookings.cancel', 'bookings.complete', 'bookings.no-show',
    'payments.create', 'payments.read',
    'certificates.create', 'certificates.read', 'certificates.update', 'certificates.cancel',
    'notifications.read',
  ],

  [RoleTitle.ACCOUNTANT]: [
    'students.read',
    'bookings.read',
    'payments.read', 'payments.verify',
    'expenses.create', 'expenses.read', 'expenses.update',
    'notifications.read',
  ],

  [RoleTitle.INSTRUCTOR]: [
    'bookings.read',
    'notifications.read',
  ],

  [RoleTitle.STUDENT]: [
    'bookings.create', 'bookings.read',
    'payments.read',
    'certificates.read',
    'notifications.read',
  ],
};

// ─── بيانات المستخدمين التجريبيين ────────────────────────────────────────────

const DEFAULT_PASSWORD = 'Test@12345';

const EMPLOYEE_USERS = [
  { name: 'سارة المحمد',  phone: '0999200001', role: RoleTitle.RECEPTIONIST },
  { name: 'خالد العمر',   phone: '0999200002', role: RoleTitle.ACCOUNTANT },
];

const INSTRUCTOR_USERS = [
  { name: 'محمد حسن',   phone: '0999300001', gender: Gender.MALE,   instructorType: InstructorType.MANUAL },
  { name: 'أحمد علي',   phone: '0999300002', gender: Gender.MALE,   instructorType: InstructorType.AUTOMATIC },
  { name: 'فاطمة محمد', phone: '0999300003', gender: Gender.FEMALE, instructorType: InstructorType.BOTH },
  { name: 'نور حسين',   phone: '0999300004', gender: Gender.FEMALE, instructorType: InstructorType.MANUAL },
];

const STUDENT_USERS = Array.from({ length: 20 }, (_, i) => ({
  name: `طالب تجريبي ${i + 1}`,
  phone: `0999400${String(i + 1).padStart(3, '0')}`,
}));

// ─── دوال مساعدة ─────────────────────────────────────────────────────────────

async function createUserIfNotExists(
  manager: any,
  data: { name: string; phone: string },
  passwordHash: string,
): Promise<User | null> {
  const userRepo = manager.getRepository(User);
  const exists = await userRepo.findOne({ where: { phone: data.phone } });
  if (exists) return null;
  return userRepo.save(
    userRepo.create({
      name: data.phone === '0999111222' ? data.name : data.name,
      phone: data.phone,
      passwordHash,
      accountStatus: AccountStatus.ACTIVE,
      mustChangePassword: false,
    }),
  );
}

async function assignRole(manager: any, user: User, role: Role): Promise<void> {
  const userRoleRepo = manager.getRepository(UserRole);
  const exists = await userRoleRepo.findOne({
    where: { user: { id: user.id }, role: { id: role.id } },
  });
  if (!exists) {
    await userRoleRepo.save(userRoleRepo.create({ user, role }));
  }
}

// ─── الـ seed الرئيسي ─────────────────────────────────────────────────────────

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ الاتصال بقاعدة البيانات نجح\n');

  const passwordHash = await argon2.hash(DEFAULT_PASSWORD);

  await AppDataSource.transaction(async (manager) => {
    const roleRepo       = manager.getRepository(Role);
    const permRepo       = manager.getRepository(Permission);
    const rolePermRepo   = manager.getRepository(RolePermission);
    const employeeRepo   = manager.getRepository(Employee);
    const instructorRepo = manager.getRepository(Instructor);
    const studentRepo    = manager.getRepository(Student);

    // 1) صلاحيات
    console.log('── إنشاء الصلاحيات ──');
    const permMap: Record<string, Permission> = {};
    for (const p of PERMISSIONS) {
      let perm = await permRepo.findOne({ where: { code: p.code } });
      if (!perm) {
        perm = await permRepo.save(permRepo.create(p));
        console.log(`  ➕ ${p.code}`);
      }
      permMap[p.code] = perm;
    }

    // 2) ربط الصلاحيات بالأدوار
    console.log('\n── ربط الصلاحيات بالأدوار ──');
    for (const [roleTitle, codes] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await roleRepo.findOne({ where: { title: roleTitle as RoleTitle } });
      if (!role) {
        console.log(`  ⚠️  الدور ${roleTitle} غير موجود — شغّل seed:admin أولاً`);
        continue;
      }
      for (const code of codes) {
        const perm = permMap[code];
        const exists = await rolePermRepo.findOne({
          where: { role: { id: role.id }, permission: { id: perm.id } },
        });
        if (!exists) {
          await rolePermRepo.save(rolePermRepo.create({ role, permission: perm }));
        }
      }
      console.log(`  ✅ ${roleTitle} — ${codes.length} صلاحية`);
    }

    // 3) موظفو الاستقبال والمحاسبة
    console.log('\n── إنشاء الموظفين ──');
    for (const data of EMPLOYEE_USERS) {
      const user = await createUserIfNotExists(manager, data, passwordHash);
      if (!user) { console.log(`  ↩️  موجود مسبقاً: ${data.phone}`); continue; }
      const role = await roleRepo.findOneOrFail({ where: { title: data.role } });
      await assignRole(manager, user, role);
      await employeeRepo.save(employeeRepo.create({ user }));
      console.log(`  ✅ ${data.name} (${data.role})`);
    }

    // 4) المدرسون
    console.log('\n── إنشاء المدرسين ──');
    const instructorRole = await roleRepo.findOneOrFail({ where: { title: RoleTitle.INSTRUCTOR } });
    for (const data of INSTRUCTOR_USERS) {
      const user = await createUserIfNotExists(manager, data, passwordHash);
      if (!user) { console.log(`  ↩️  موجود مسبقاً: ${data.phone}`); continue; }
      await assignRole(manager, user, instructorRole);
      await instructorRepo.save(
        instructorRepo.create({ user, gender: data.gender, instructorType: data.instructorType }),
      );
      console.log(`  ✅ ${data.name} (${data.gender} — ${data.instructorType})`);
    }

    // 5) الطلاب
    console.log('\n── إنشاء الطلاب ──');
    const studentRole = await roleRepo.findOneOrFail({ where: { title: RoleTitle.STUDENT } });
    for (const data of STUDENT_USERS) {
      const user = await createUserIfNotExists(manager, data, passwordHash);
      if (!user) { console.log(`  ↩️  موجود مسبقاً: ${data.phone}`); continue; }
      await assignRole(manager, user, studentRole);
      await studentRepo.save(
        studentRepo.create({ user, studentStatus: StudentStatus.IN_TRAINING }),
      );
    }
    console.log(`  ✅ ${STUDENT_USERS.length} طالب`);
  });

  console.log('\n══════════════════════════════════════');
  console.log('  بيانات الدخول (كلمة المرور للجميع)');
  console.log('══════════════════════════════════════');
  console.log(`  🔑 كلمة المرور: ${DEFAULT_PASSWORD}`);
  console.log('  👤 المدير:      0999111222  (Admin@12345)');
  console.log('  👤 استقبال:     0999200001');
  console.log('  👤 محاسب:       0999200002');
  console.log('  👤 مدرس ذكر 1:  0999300001');
  console.log('  👤 مدرس ذكر 2:  0999300002');
  console.log('  👤 مدرس أنثى 1: 0999300003');
  console.log('  👤 مدرس أنثى 2: 0999300004');
  console.log('  👤 طالب 1:      0999400001');
  console.log('══════════════════════════════════════\n');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ فشل الـ seed:', err);
  process.exit(1);
});
