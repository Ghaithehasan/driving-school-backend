import 'reflect-metadata';
import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';
dotenv.config();

import {
  AccountStatus,
  AttendanceStatus,
  BookingStatus,
  CancellationParty,
  CertificateCategory,
  CertificateRequestStatus,
  ChargeReason,
  ChargeStatus,
  DayOfWeek,
  EmployeeExpenseType,
  ExamResult,
  ExamType,
  ExpenseCategory,
  ExpenseStatus,
  Gender,
  GeneralExpenseType,
  InstructorPriceType,
  InstructorType,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  RegistrationStatus,
  RoleTitle,
  SettingValueType,
  StudentStatus,
  TrainingType,
  TripStatus,
  TripType,
  VehicleExpenseReason,
  VehicleSource,
  VehicleStatus,
  VehicleType,
  VehicleUnavailableReasonType,
} from '../../common/enums/index';
import { BookingCancellation } from '../../booking/booking-cancellation.entity';
import { Booking } from '../../booking/booking.entity';
import { LessonPrice } from '../../booking/lesson-price.entity';
import { Certificate } from '../../certificates/certificate.entity';
import { CertificateExamResult } from '../../certificates/certificate-exam-result.entity';
import { CertificateTrainingSession } from '../../certificates/certificate-training-session.entity';
import { Employee } from '../../employees/employee.entity';
import { Expense } from '../../expenses/expense.entity';
import { ExpenseEmployee } from '../../expenses/expense-employee.entity';
import { ExpenseGeneral } from '../../expenses/expense-general.entity';
import { ExpenseInstructor } from '../../expenses/expense-instructor.entity';
import { ExpenseVehicle } from '../../expenses/expense-vehicle.entity';
import { InstructorPrice } from '../../expenses/instructor-price.entity';
import { InstructorWeeklyAvailability } from '../../instructors/instructor-weekly-availability.entity';
import { Instructor } from '../../instructors/instructor.entity';
import { Notification } from '../../notifications/notification.entity';
import { StudentCharge } from '../../payments/student-charge.entity';
import { StudentPayment } from '../../payments/student-payment.entity';
import { Permission } from '../../roles/permission.entity';
import { RolePermission } from '../../roles/role-permission.entity';
import { Role } from '../../roles/role.entity';
import { UserRole } from '../../roles/user-role.entity';
import { Setting } from '../../settings/setting.entity';
import { Student } from '../../students/student.entity';
import { TransportAttendance } from '../../transport/transport-attendance.entity';
import { TransportRegistration } from '../../transport/transport-registration.entity';
import { TransportTrip } from '../../transport/transport-trip.entity';
import { User } from '../../users/user.entity';
import { VehicleUnavailablePeriod } from '../../vehicles/vehicle-unavailable-period.entity';
import { Vehicle } from '../../vehicles/vehicle.entity';
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
  { code: 'vehicles.fuel',        module: 'vehicles',      description: 'تعبئة وقود سيارة' },
  { code: 'vehicles.maintenance', module: 'vehicles',      description: 'إدارة صيانة السيارة' },
  { code: 'vehicles.archive',     module: 'vehicles',      description: 'أرشفة سيارة' },

  { code: 'bookings.create',      module: 'bookings',      description: 'إنشاء حجز' },
  { code: 'bookings.read',        module: 'bookings',      description: 'عرض الحجوزات' },
  { code: 'bookings.cancel',      module: 'bookings',      description: 'إلغاء حجز' },
  { code: 'bookings.complete',    module: 'bookings',      description: 'إتمام حجز' },
  { code: 'bookings.no-show',     module: 'bookings',      description: 'تسجيل غياب' },

  { code: 'payments.create',      module: 'payments',      description: 'إضافة دفعة' },
  { code: 'payments.read',        module: 'payments',      description: 'عرض المدفوعات' },
  { code: 'payments.verify',      module: 'payments',      description: 'التحقق من الدفع' },
  { code: 'payments.collect',     module: 'payments',      description: 'تحصيل باقي المبلغ وإتمام الدرس' },

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
    'vehicles.read', 'vehicles.create', 'vehicles.update', 'vehicles.maintenance', 'vehicles.archive',
    'bookings.create', 'bookings.read', 'bookings.cancel', 'bookings.complete', 'bookings.no-show',
    'payments.create', 'payments.read', 'payments.collect',
    'certificates.create', 'certificates.read', 'certificates.update', 'certificates.cancel',
    'notifications.read',
  ],

  [RoleTitle.ACCOUNTANT]: [
    'students.read',
    'bookings.read',
    'payments.read', 'payments.verify', 'payments.collect',
    'expenses.create', 'expenses.read', 'expenses.update',
    'vehicles.read', 'vehicles.fuel',
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

// ─── بيانات المركبات ──────────────────────────────────────────────────────────

const VEHICLES: {
  plateNumber: string;
  model: string;
  color: string;
  type: VehicleType;
  status: VehicleStatus;
  adminNotes?: string;
  maintenance?: boolean; // هل تحتاج فترة صيانة مفتوحة؟
}[] = [
  // ── أوتوماتيك نشطة ──
  { plateNumber: 'أ ب ج 201', model: 'هيونداي إلنترا 2021', color: 'أسود',  type: VehicleType.AUTOMATIC, status: VehicleStatus.ACTIVE },
  { plateNumber: 'أ ب ج 202', model: 'هيونداي إلنترا 2022', color: 'أبيض',  type: VehicleType.AUTOMATIC, status: VehicleStatus.ACTIVE },

  // ── عادي نشطة ──
  { plateNumber: 'أ ب ج 101', model: 'تويوتا كورولا 2020',  color: 'أبيض',  type: VehicleType.MANUAL,    status: VehicleStatus.ACTIVE },
  { plateNumber: 'أ ب ج 103', model: 'تويوتا كورولا 2021',  color: 'فضي',   type: VehicleType.MANUAL,    status: VehicleStatus.ACTIVE },

  // ── في الصيانة (1 أوتو + 1 عادي) ──
  { plateNumber: 'أ ب ج 203', model: 'هيونداي إلنترا 2020', color: 'أحمر',  type: VehicleType.AUTOMATIC, status: VehicleStatus.INACTIVE, maintenance: true },
  { plateNumber: 'أ ب ج 102', model: 'تويوتا كورولا 2019',  color: 'رمادي', type: VehicleType.MANUAL,    status: VehicleStatus.INACTIVE, adminNotes: 'تغيير زيت', maintenance: true },

  // ── مؤرشفة (2 أوتو + 2 عادي) ──
  { plateNumber: 'أ ب ج 204', model: 'هيونداي إلنترا 2018', color: 'أبيض',  type: VehicleType.AUTOMATIC, status: VehicleStatus.ARCHIVED },
  { plateNumber: 'أ ب ج 205', model: 'هيونداي إلنترا 2019', color: 'رمادي', type: VehicleType.AUTOMATIC, status: VehicleStatus.ARCHIVED },
  { plateNumber: 'أ ب ج 104', model: 'تويوتا كورولا 2017',  color: 'أبيض',  type: VehicleType.MANUAL,    status: VehicleStatus.ARCHIVED },
  { plateNumber: 'أ ب ج 105', model: 'تويوتا كورولا 2018',  color: 'أسود',  type: VehicleType.MANUAL,    status: VehicleStatus.ARCHIVED },
];

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

// ─── دوال مساعدة إضافية ─────────────────────────────────────────────────────
async function trainingSessionExists(repo: any, certId: number): Promise<boolean> {
  const count = await repo.count({ where: { certificate: { id: certId } } });
  return count > 0;
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
        const count = await rolePermRepo
          .createQueryBuilder('rp')
          .innerJoin('rp.role', 'r')
          .innerJoin('rp.permission', 'p')
          .where('r.id = :roleId', { roleId: role.id })
          .andWhere('p.id = :permId', { permId: perm.id })
          .getCount();
        if (count === 0) {
          await rolePermRepo.save(rolePermRepo.create({ role, permission: perm }));
          console.log(`    ➕ ${roleTitle} ← ${code}`);
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

    // 6) المركبات
    console.log('\n── إنشاء المركبات ──');
    const vehicleRepo      = manager.getRepository(Vehicle);
    const unavailableRepo  = manager.getRepository(VehicleUnavailablePeriod);
    const expenseRepo      = manager.getRepository(Expense);
    const expVehicleRepo   = manager.getRepository(ExpenseVehicle);

    const savedVehicles: Vehicle[] = [];
    for (const data of VEHICLES) {
      let vehicle = await vehicleRepo.findOne({ where: { plateNumber: data.plateNumber } });
      if (vehicle) {
        console.log(`  ↩️  موجودة مسبقاً: ${data.plateNumber}`);
        savedVehicles.push(vehicle);
        continue;
      }
      vehicle = await vehicleRepo.save(vehicleRepo.create({
        plateNumber: data.plateNumber,
        model:       data.model,
        color:       data.color,
        type:        data.type,
        status:      data.status,
        adminNotes:  data.adminNotes ?? null,
      }));
      savedVehicles.push(vehicle);

      if (data.maintenance) {
        const startAt = new Date();
        startAt.setDate(startAt.getDate() - Math.floor(Math.random() * 10 + 3));
        await unavailableRepo.save(unavailableRepo.create({
          vehicle,
          startAt,
          endAt:      null,
          reasonType: VehicleUnavailableReasonType.MAINTENANCE,
          notes:      data.adminNotes ?? null,
        }));
      }
      console.log(`  ✅ ${data.plateNumber} — ${data.type} — ${data.status}`);
    }

    // 7) مصاريف سيارات تجريبية
    console.log('\n── إنشاء مصاريف السيارات ──');
    const activeVehicles = savedVehicles.filter((v) => v.status === VehicleStatus.ACTIVE);

    const vehicleExpenses: {
      vehicleIdx: number;
      reason: VehicleExpenseReason;
      liters: string | null;
      amount: string;
      expenseDate: string;
      status: ExpenseStatus;
      note: string | null;
    }[] = [
      { vehicleIdx: 0, reason: VehicleExpenseReason.GAS,         liters: '40.00', amount: '60.00',  expenseDate: '2026-05-10', status: ExpenseStatus.PAID,   note: 'تعبئة وقود دورية' },
      { vehicleIdx: 1, reason: VehicleExpenseReason.GAS,         liters: '35.00', amount: '52.50',  expenseDate: '2026-05-18', status: ExpenseStatus.PAID,   note: null },
      { vehicleIdx: 2, reason: VehicleExpenseReason.GAS,         liters: '45.00', amount: '67.50',  expenseDate: '2026-06-01', status: ExpenseStatus.PAID,   note: null },
      { vehicleIdx: 3, reason: VehicleExpenseReason.GAS,         liters: '38.00', amount: '57.00',  expenseDate: '2026-06-10', status: ExpenseStatus.PAID,   note: null },
      { vehicleIdx: 0, reason: VehicleExpenseReason.GAS,         liters: '42.00', amount: '63.00',  expenseDate: '2026-06-20', status: ExpenseStatus.PAID,   note: 'تعبئة وقود' },
      { vehicleIdx: 1, reason: VehicleExpenseReason.INSURANCE,   liters: null,    amount: '350.00', expenseDate: '2026-01-05', status: ExpenseStatus.PAID,   note: 'تجديد تأمين سنوي' },
      { vehicleIdx: 2, reason: VehicleExpenseReason.INSURANCE,   liters: null,    amount: '320.00', expenseDate: '2026-01-05', status: ExpenseStatus.PAID,   note: 'تجديد تأمين سنوي' },
      { vehicleIdx: 3, reason: VehicleExpenseReason.MAINTENANCE, liters: null,    amount: '150.00', expenseDate: '2026-04-15', status: ExpenseStatus.PAID,   note: 'تغيير زيت وفلتر' },
      { vehicleIdx: 0, reason: VehicleExpenseReason.OTHER,       liters: null,    amount: '80.00',  expenseDate: '2026-05-25', status: ExpenseStatus.UNPAID, note: 'غسيل وتلميع' },
    ];

    for (const row of vehicleExpenses) {
      const vehicle = activeVehicles[row.vehicleIdx % activeVehicles.length];
      if (!vehicle) continue;

      const expense = await expenseRepo.save(expenseRepo.create({
        category:    ExpenseCategory.VEHICLE,
        amount:      row.amount,
        expenseDate: row.expenseDate,
        status:      row.status,
        note:        row.note,
        employee:    null,
      }));

      await expVehicleRepo.save(expVehicleRepo.create({
        reason:  row.reason,
        liters:  row.liters,
        vehicle,
        expense,
      }));
    }
    console.log(`  ✅ ${vehicleExpenses.length} سجل مصاريف`);

    // 8) الحجوزات
    console.log('\n── إنشاء الحجوزات ──');

    // نجلب الطلاب والمدرسين والسيارات من الداتا
    const students    = await manager.getRepository(Student).find({ relations: { user: true }, take: 10 });
    const instructors = await manager.getRepository(Instructor).find({ take: 4 });
    const activeVehiclesList = savedVehicles.filter((v) => v.status === VehicleStatus.ACTIVE);

    if (students.length < 5 || instructors.length < 2 || activeVehiclesList.length < 2) {
      console.log('  ⚠️  بيانات غير كافية لإنشاء الحجوزات');
    } else {
      const bookingRepo      = manager.getRepository(Booking);
      const cancellationRepo = manager.getRepository(BookingCancellation);

      // دالة مساعدة لإنشاء تاريخ بساعة محددة
      const dt = (dateStr: string, hour: number) => {
        const d = new Date(`${dateStr}T${String(hour).padStart(2,'0')}:00:00+03:00`);
        return d;
      };

      // تعريف الحجوزات: [طالب_idx, مدرس_idx, سيارة_idx, نوع_تدريب, مصدر_سيارة, حالة_الحجز, حالة_الدفع, تاريخ, ساعة]
      type BookingRow = {
        studentIdx:    number;
        instructorIdx: number;
        vehicleIdx:    number | null;
        trainingType:  TrainingType;
        source:        VehicleSource;
        bStatus:       BookingStatus;
        pStatus:       PaymentStatus;
        date:          string;
        hour:          number;
        cancelParty?:  CancellationParty;
        cancelReason?: string;
      };

      const rows: BookingRow[] = [
        // ── مكتملة ──
        { studentIdx: 0, instructorIdx: 0, vehicleIdx: 2, trainingType: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.COMPLETED,       pStatus: PaymentStatus.FULLY_PAID,    date: '2026-05-08', hour: 9  },
        { studentIdx: 1, instructorIdx: 0, vehicleIdx: 2, trainingType: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.COMPLETED,       pStatus: PaymentStatus.FULLY_PAID,    date: '2026-05-08', hour: 11 },
        { studentIdx: 2, instructorIdx: 1, vehicleIdx: 0, trainingType: TrainingType.AUTOMATIC, source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.COMPLETED,       pStatus: PaymentStatus.FULLY_PAID,    date: '2026-05-12', hour: 9  },
        { studentIdx: 3, instructorIdx: 2, vehicleIdx: 1, trainingType: TrainingType.AUTOMATIC, source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.COMPLETED,       pStatus: PaymentStatus.FULLY_PAID,    date: '2026-05-15', hour: 10 },
        { studentIdx: 4, instructorIdx: 3, vehicleIdx: 3, trainingType: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.COMPLETED,       pStatus: PaymentStatus.FULLY_PAID,    date: '2026-05-20', hour: 9  },
        { studentIdx: 0, instructorIdx: 0, vehicleIdx: 2, trainingType: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.COMPLETED,       pStatus: PaymentStatus.FULLY_PAID,    date: '2026-06-02', hour: 9  },
        { studentIdx: 5, instructorIdx: 1, vehicleIdx: 0, trainingType: TrainingType.AUTOMATIC, source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.COMPLETED,       pStatus: PaymentStatus.FULLY_PAID,    date: '2026-06-05', hour: 10 },

        // ── لم يحضر ──
        { studentIdx: 6, instructorIdx: 0, vehicleIdx: 2, trainingType: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.NO_SHOW,         pStatus: PaymentStatus.DEPOSIT_PAID,          date: '2026-06-10', hour: 9  },
        { studentIdx: 7, instructorIdx: 2, vehicleIdx: 1, trainingType: TrainingType.AUTOMATIC, source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.NO_SHOW,         pStatus: PaymentStatus.DEPOSIT_PAID,          date: '2026-06-12', hour: 11 },

        // ── منتهي الصلاحية ──
        { studentIdx: 8, instructorIdx: 3, vehicleIdx: 3, trainingType: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.EXPIRED,         pStatus: PaymentStatus.DEPOSIT_NON_REFUNDABLE, date: '2026-06-15', hour: 9  },
        { studentIdx: 9, instructorIdx: 1, vehicleIdx: 0, trainingType: TrainingType.AUTOMATIC, source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.EXPIRED,         pStatus: PaymentStatus.DEPOSIT_NON_REFUNDABLE, date: '2026-06-18', hour: 10 },

        // ── ملغاة ──
        // الطالب يُلغي → العربون غير مسترد (NON_REFUNDABLE)
        { studentIdx: 1, instructorIdx: 0, vehicleIdx: 2, trainingType: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR,  bStatus: BookingStatus.CANCELLED, pStatus: PaymentStatus.DEPOSIT_NON_REFUNDABLE,          date: '2026-06-08', hour: 9,  cancelParty: CancellationParty.STUDENT, cancelReason: 'ظرف طارئ' },
        // الطالب يُلغي → العربون غير مسترد
        { studentIdx: 3, instructorIdx: 3, vehicleIdx: 3, trainingType: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR,  bStatus: BookingStatus.CANCELLED, pStatus: PaymentStatus.DEPOSIT_NON_REFUNDABLE,          date: '2026-06-14', hour: 11, cancelParty: CancellationParty.STUDENT, cancelReason: 'تغيير الموعد' },
        // المدرسة تُلغي → العربون متاح للنقل لحجز جديد (AVAILABLE_FOR_REBOOKING)
        { studentIdx: 4, instructorIdx: 1, vehicleIdx: null, trainingType: TrainingType.MANUAL, source: VehicleSource.STUDENT_CAR, bStatus: BookingStatus.CANCELLED, pStatus: PaymentStatus.DEPOSIT_AVAILABLE_FOR_REBOOKING, date: '2026-06-16', hour: 10, cancelParty: CancellationParty.SCHOOL,  cancelReason: 'غياب المدرب' },

        // ── بانتظار الدفع (مدرس مختلف + سيارة مختلفة لكل صف) ──
        { studentIdx: 2, instructorIdx: 0, vehicleIdx: 2, trainingType: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.PENDING_PAYMENT, pStatus: PaymentStatus.PENDING_DEPOSIT, date: '2026-06-28', hour: 9  },
        { studentIdx: 5, instructorIdx: 2, vehicleIdx: 1, trainingType: TrainingType.AUTOMATIC, source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.PENDING_PAYMENT, pStatus: PaymentStatus.PENDING_DEPOSIT, date: '2026-06-29', hour: 9  },

        // ── مؤكدة (مستقبلية) — كل مدرس وسيارة على يوم منفصل تماماً ──
        { studentIdx: 6, instructorIdx: 0, vehicleIdx: 2, trainingType: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.BOOKED,          pStatus: PaymentStatus.DEPOSIT_PAID,    date: '2026-07-01', hour: 9  },
        { studentIdx: 7, instructorIdx: 1, vehicleIdx: 0, trainingType: TrainingType.AUTOMATIC, source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.BOOKED,          pStatus: PaymentStatus.DEPOSIT_PAID,    date: '2026-07-02', hour: 9  },
        { studentIdx: 8, instructorIdx: 2, vehicleIdx: 1, trainingType: TrainingType.AUTOMATIC, source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.BOOKED,          pStatus: PaymentStatus.DEPOSIT_PAID,    date: '2026-07-03', hour: 9  },
        { studentIdx: 9, instructorIdx: 3, vehicleIdx: 3, trainingType: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.BOOKED,          pStatus: PaymentStatus.DEPOSIT_PAID,    date: '2026-07-05', hour: 9  },
        { studentIdx: 0, instructorIdx: 1, vehicleIdx: 0, trainingType: TrainingType.AUTOMATIC, source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.BOOKED,          pStatus: PaymentStatus.DEPOSIT_PAID,    date: '2026-07-07', hour: 9  },
        { studentIdx: 1, instructorIdx: 3, vehicleIdx: 3, trainingType: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR, bStatus: BookingStatus.BOOKED,          pStatus: PaymentStatus.DEPOSIT_PAID,    date: '2026-07-08', hour: 9  },
      ];

      const savedBookings: Booking[] = [];
      let bookingCount = 0;
      for (const row of rows) {
        const student    = students[row.studentIdx % students.length];
        const instructor = instructors[row.instructorIdx % instructors.length];
        const vehicle    = row.vehicleIdx !== null ? activeVehiclesList[row.vehicleIdx % activeVehiclesList.length] : null;

        const startAt = dt(row.date, row.hour);
        const endAt   = dt(row.date, row.hour + 1);

        // Idempotency: skip if this exact slot already exists (prevents constraint violations on re-run)
        const existing = await bookingRepo.findOne({
          where: { student: { id: student.id }, instructor: { id: instructor.id }, startAt },
        });
        if (existing) {
          // Update statuses in case seed data was corrected after initial insert
          if (
            existing.bookingStatus !== row.bStatus ||
            existing.paymentStatus !== row.pStatus
          ) {
            await bookingRepo.update(existing.id, {
              bookingStatus: row.bStatus,
              paymentStatus: row.pStatus,
            });
            existing.bookingStatus = row.bStatus;
            existing.paymentStatus = row.pStatus;
          }
          savedBookings.push(existing);
          continue;
        }

        const booking = await bookingRepo.save(bookingRepo.create({
          vehicleSource: row.source,
          bookingStatus: row.bStatus,
          paymentStatus: row.pStatus,
          trainingType:  row.trainingType,
          startAt,
          endAt,
          lockedUntil:   null,
          student,
          instructor,
          vehicle:       vehicle ?? null,
          replacedBooking: null,
        }));

        if (row.cancelParty) {
          await cancellationRepo.save(cancellationRepo.create({
            booking,
            cancellationParty:  row.cancelParty,
            cancellationReason: row.cancelReason ?? null,
            cancelledAt:        new Date(startAt.getTime() - 86400000),
            cancelledByUser:    null,
          }));
        }

        savedBookings.push(booking);
        bookingCount++;
      }
      console.log(`  ✅ ${bookingCount} حجز`);

      // ────────────────────────────────────────────────────────
      // 9) أسعار الدروس (lesson_price)
      // ────────────────────────────────────────────────────────
      console.log('\n── إنشاء أسعار الدروس ──');
      const lessonPriceRepo = manager.getRepository(LessonPrice);
      const lessonPrices: { gender: Gender; training: TrainingType; source: VehicleSource; price: string }[] = [
        { gender: Gender.MALE,   training: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR,  price: '2500.00' },
        { gender: Gender.MALE,   training: TrainingType.AUTOMATIC, source: VehicleSource.SCHOOL_CAR,  price: '3000.00' },
        { gender: Gender.FEMALE, training: TrainingType.MANUAL,    source: VehicleSource.SCHOOL_CAR,  price: '2800.00' },
        { gender: Gender.FEMALE, training: TrainingType.AUTOMATIC, source: VehicleSource.SCHOOL_CAR,  price: '3500.00' },
        { gender: Gender.MALE,   training: TrainingType.MANUAL,    source: VehicleSource.STUDENT_CAR, price: '1200.00' },
        { gender: Gender.MALE,   training: TrainingType.AUTOMATIC, source: VehicleSource.STUDENT_CAR, price: '1500.00' },
        { gender: Gender.FEMALE, training: TrainingType.MANUAL,    source: VehicleSource.STUDENT_CAR, price: '1500.00' },
        { gender: Gender.FEMALE, training: TrainingType.AUTOMATIC, source: VehicleSource.STUDENT_CAR, price: '1800.00' },
      ];
      let lpCount = 0;
      for (const lp of lessonPrices) {
        const exists = await lessonPriceRepo.findOne({
          where: { instructorGender: lp.gender, trainingType: lp.training, vehicleSource: lp.source, effectiveFrom: '2026-01-01' },
        });
        if (!exists) {
          await lessonPriceRepo.save(lessonPriceRepo.create({
            instructorGender: lp.gender, trainingType: lp.training,
            vehicleSource: lp.source, price: lp.price, effectiveFrom: '2026-01-01',
          }));
          lpCount++;
        }
      }
      console.log(`  ✅ ${lpCount} سعر درس (${lessonPrices.length - lpCount} موجود مسبقاً)`);

      // ────────────────────────────────────────────────────────
      // 10) أسعار المدربين (instructor_price)
      // ────────────────────────────────────────────────────────
      console.log('\n── إنشاء أسعار المدربين ──');
      const instructorPriceRepo = manager.getRepository(InstructorPrice);
      for (const [type, price] of [[InstructorPriceType.MALE, '500.00'], [InstructorPriceType.FEMALE, '600.00']] as const) {
        const exists = await instructorPriceRepo.findOne({ where: { type, effectiveFrom: '2026-01-01' } });
        if (!exists) await instructorPriceRepo.save(instructorPriceRepo.create({ type, price, effectiveFrom: '2026-01-01' }));
      }
      console.log('  ✅ سعر مدرب ذكر (500) + أنثى (600)');

      // ────────────────────────────────────────────────────────
      // 11) جداول المدربين الأسبوعية
      // ────────────────────────────────────────────────────────
      console.log('\n── إنشاء جداول المدربين ──');
      const availRepo = manager.getRepository(InstructorWeeklyAvailability);
      const workDays = [DayOfWeek.SAT, DayOfWeek.SUN, DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU];
      let availCount = 0;
      for (const instructor of instructors) {
        for (const day of workDays) {
          const exists = await availRepo.findOne({ where: { instructor: { id: instructor.id }, dayOfWeek: day, startTime: '08:00:00' } });
          if (!exists) {
            await availRepo.save(availRepo.create({ instructor, dayOfWeek: day, startTime: '08:00:00', endTime: '14:00:00' }));
            availCount++;
          }
        }
      }
      console.log(`  ✅ ${availCount} سلوت متاح`);

      // ────────────────────────────────────────────────────────
      // 12) إعدادات النظام (settings)
      // ────────────────────────────────────────────────────────
      console.log('\n── إنشاء إعدادات النظام ──');
      const settingRepo = manager.getRepository(Setting);
      const SETTINGS = [
        { key: 'school_name',               value: 'مدرسة القيادة',    valueType: SettingValueType.STRING,  description: 'اسم المدرسة' },
        { key: 'school_phone',              value: '0111234567',        valueType: SettingValueType.STRING,  description: 'هاتف المدرسة' },
        { key: 'lesson_duration_minutes',   value: '60',                valueType: SettingValueType.NUMBER,  description: 'مدة الحصة بالدقائق' },
        { key: 'deposit_amount',            value: '500',               valueType: SettingValueType.NUMBER,  description: 'مبلغ العربون الثابت (legacy)' },
        { key: 'deposit_percentage',        value: '50',                valueType: SettingValueType.PERCENT, description: 'نسبة العربون من سعر الدرس' },
        { key: 'booking_window_days',       value: '4',                 valueType: SettingValueType.NUMBER,  description: 'عدد أيام نافذة الحجز المتاحة' },
        { key: 'booking_hold_minutes',      value: '15',                valueType: SettingValueType.NUMBER,  description: 'مدة الحجز المعلق قبل انتهائه (موبايل)' },
        { key: 'max_bookings_per_day',      value: '8',                 valueType: SettingValueType.NUMBER,  description: 'أقصى حجوزات يومية للمدرب' },
        { key: 'booking_lock_minutes',      value: '30',                valueType: SettingValueType.NUMBER,  description: 'مدة قفل الحجز (legacy)' },
        { key: 'cancellation_fee_percent',  value: '0',                 valueType: SettingValueType.PERCENT, description: 'نسبة رسوم الإلغاء' },
        { key: 'working_hours_start',       value: '08:00',             valueType: SettingValueType.TIME,    description: 'بداية ساعات العمل' },
        { key: 'working_hours_end',         value: '18:00',             valueType: SettingValueType.TIME,    description: 'نهاية ساعات العمل' },
        { key: 'allow_student_car',         value: 'true',              valueType: SettingValueType.BOOLEAN, description: 'السماح بسيارة الطالب' },
      ];
      let settingCount = 0;
      for (const s of SETTINGS) {
        const exists = await settingRepo.findOne({ where: { key: s.key } });
        if (!exists) {
          await settingRepo.save(settingRepo.create({ ...s, updatedAt: new Date() }));
          settingCount++;
        }
      }
      console.log(`  ✅ ${settingCount} إعداد`);

      // ────────────────────────────────────────────────────────
      // 13) مصاريف الموظفين + العامة
      // ────────────────────────────────────────────────────────
      console.log('\n── إنشاء مصاريف الموظفين والعامة ──');
      const expRepo       = manager.getRepository(Expense);
      const expEmpRepo    = manager.getRepository(ExpenseEmployee);
      const expGenRepo    = manager.getRepository(ExpenseGeneral);
      const expInstRepo   = manager.getRepository(ExpenseInstructor);
      const allEmployees  = await manager.getRepository(Employee).find({ take: 5 });

      // رواتب الموظفين (3 أشهر)
      const salaryMonths = ['2026-04-01', '2026-05-01', '2026-06-01'];
      for (const emp of allEmployees) {
        for (const month of salaryMonths) {
          const existsEmp = await expEmpRepo.findOne({ where: { employee: { id: emp.id }, month } });
          if (!existsEmp) {
            const expense = await expRepo.save(expRepo.create({
              category: ExpenseCategory.EMPLOYEE, amount: '150000.00',
              expenseDate: month, status: ExpenseStatus.PAID, note: `راتب شهر ${month.slice(0,7)}`, employee: emp,
            }));
            await expEmpRepo.save(expEmpRepo.create({ type: EmployeeExpenseType.SALARY, month, employee: emp, expense }));
          }
        }
      }
      // مكافأة لموظف
      if (allEmployees[0]) {
        const bonusMonth = '2026-06-01';
        const existsBonus = await expEmpRepo.findOne({ where: { employee: { id: allEmployees[0].id }, month: bonusMonth, type: EmployeeExpenseType.BONUS } });
        if (!existsBonus) {
          const exp = await expRepo.save(expRepo.create({ category: ExpenseCategory.EMPLOYEE, amount: '25000.00', expenseDate: bonusMonth, status: ExpenseStatus.PAID, note: 'مكافأة أداء', employee: allEmployees[0] }));
          await expEmpRepo.save(expEmpRepo.create({ type: EmployeeExpenseType.BONUS, month: bonusMonth, employee: allEmployees[0], expense: exp }));
        }
      }
      console.log('  ✅ رواتب + مكافآت');

      // مصاريف عامة
      const generalItems: { type: GeneralExpenseType; amount: string; date: string; note: string }[] = [
        { type: GeneralExpenseType.ELECTRICITY, amount: '45000.00', date: '2026-04-01', note: 'فاتورة كهرباء أبريل' },
        { type: GeneralExpenseType.ELECTRICITY, amount: '42000.00', date: '2026-05-01', note: 'فاتورة كهرباء مايو' },
        { type: GeneralExpenseType.ELECTRICITY, amount: '48000.00', date: '2026-06-01', note: 'فاتورة كهرباء يونيو' },
        { type: GeneralExpenseType.WATER,       amount: '8000.00',  date: '2026-04-01', note: 'فاتورة مياه' },
        { type: GeneralExpenseType.WATER,       amount: '8500.00',  date: '2026-05-01', note: 'فاتورة مياه' },
        { type: GeneralExpenseType.INTERNET,    amount: '12000.00', date: '2026-04-01', note: 'اشتراك إنترنت' },
        { type: GeneralExpenseType.INTERNET,    amount: '12000.00', date: '2026-05-01', note: 'اشتراك إنترنت' },
        { type: GeneralExpenseType.INTERNET,    amount: '12000.00', date: '2026-06-01', note: 'اشتراك إنترنت' },
        { type: GeneralExpenseType.KITCHEN,     amount: '15000.00', date: '2026-05-15', note: 'مستلزمات المطبخ' },
        { type: GeneralExpenseType.SUPPLIES,    amount: '20000.00', date: '2026-06-10', note: 'قرطاسية ومستلزمات مكتبية' },
      ];
      for (const g of generalItems) {
        const exp = await expRepo.save(expRepo.create({ category: ExpenseCategory.GENERAL, amount: g.amount, expenseDate: g.date, status: ExpenseStatus.PAID, note: g.note, employee: null }));
        await expGenRepo.save(expGenRepo.create({ type: g.type, expense: exp }));
      }
      console.log(`  ✅ ${generalItems.length} مصروف عام`);

      // مصاريف المدربين (للحجوزات المكتملة)
      const completedBookings = savedBookings.filter(b => b.bookingStatus === BookingStatus.COMPLETED);
      for (const booking of completedBookings) {
        const existsInst = await expInstRepo.findOne({ where: { booking: { id: booking.id } } });
        if (!existsInst) {
          const exp = await expRepo.save(expRepo.create({ category: ExpenseCategory.INSTRUCTOR, amount: '500.00', expenseDate: booking.startAt.toISOString().split('T')[0], status: ExpenseStatus.PAID, note: null, employee: null }));
          await expInstRepo.save(expInstRepo.create({ booking, expense: exp }));
        }
      }
      console.log(`  ✅ ${completedBookings.length} مصروف مدرب`);

      // ────────────────────────────────────────────────────────
      // 14) رسوم الطلاب + المدفوعات (student_charges + payments)
      // ────────────────────────────────────────────────────────
      console.log('\n── إنشاء رسوم الطلاب والمدفوعات ──');
      const chargeRepo  = manager.getRepository(StudentCharge);
      const paymentRepo = manager.getRepository(StudentPayment);
      let chargeCount = 0;

      for (const booking of savedBookings) {
        const existsCharge = await chargeRepo.findOne({ where: { booking: { id: booking.id }, chargeReason: ChargeReason.LESSON_DEPOSIT } });
        if (existsCharge) continue;

        if (booking.bookingStatus === BookingStatus.COMPLETED) {
          // عربون مدفوع
          const deposit = await chargeRepo.save(chargeRepo.create({ chargeReason: ChargeReason.LESSON_DEPOSIT, amountDue: '500.00', chargeStatus: ChargeStatus.PAID, student: booking.student, booking, certificate: null, certificateExamResult: null, dueAt: null }));
          await paymentRepo.save(paymentRepo.create({ amountPaid: '500.00', paymentMethod: PaymentMethod.CASH, receivedAt: new Date(booking.startAt.getTime() - 86400000 * 3), studentCharge: deposit }));
          // باقي المبلغ
          const remainder = await chargeRepo.save(chargeRepo.create({ chargeReason: ChargeReason.LESSON_REMAINDER, amountDue: '2000.00', chargeStatus: ChargeStatus.PAID, student: booking.student, booking, certificate: null, certificateExamResult: null, dueAt: null }));
          await paymentRepo.save(paymentRepo.create({ amountPaid: '2000.00', paymentMethod: PaymentMethod.CASH, receivedAt: booking.startAt, studentCharge: remainder }));
          chargeCount += 2;
        } else if ([BookingStatus.BOOKED, BookingStatus.NO_SHOW].includes(booking.bookingStatus)) {
          const deposit = await chargeRepo.save(chargeRepo.create({ chargeReason: ChargeReason.LESSON_DEPOSIT, amountDue: '500.00', chargeStatus: ChargeStatus.PAID, student: booking.student, booking, certificate: null, certificateExamResult: null, dueAt: null }));
          await paymentRepo.save(paymentRepo.create({ amountPaid: '500.00', paymentMethod: PaymentMethod.CASH, receivedAt: new Date(booking.startAt.getTime() - 86400000 * 2), studentCharge: deposit }));
          chargeCount++;
        } else if (booking.bookingStatus === BookingStatus.PENDING_PAYMENT) {
          await chargeRepo.save(chargeRepo.create({ chargeReason: ChargeReason.LESSON_DEPOSIT, amountDue: '500.00', chargeStatus: ChargeStatus.UNPAID, student: booking.student, booking, certificate: null, certificateExamResult: null, dueAt: new Date(booking.startAt.getTime() - 86400000).toISOString().split('T')[0] }));
          chargeCount++;
        } else if (booking.bookingStatus === BookingStatus.CANCELLED) {
          const deposit = await chargeRepo.save(chargeRepo.create({ chargeReason: ChargeReason.LESSON_DEPOSIT, amountDue: '500.00', chargeStatus: ChargeStatus.PAID, student: booking.student, booking, certificate: null, certificateExamResult: null, dueAt: null }));
          await paymentRepo.save(paymentRepo.create({ amountPaid: '500.00', paymentMethod: PaymentMethod.CASH, receivedAt: new Date(booking.startAt.getTime() - 86400000 * 5), studentCharge: deposit }));
          chargeCount++;
        }
      }
      console.log(`  ✅ ${chargeCount} رسوم طالب + مدفوعات`);

      // ────────────────────────────────────────────────────────
      // 15) شهادات الطلاب
      // ────────────────────────────────────────────────────────
      console.log('\n── إنشاء الشهادات ──');
      const certRepo        = manager.getRepository(Certificate);
      const examResultRepo  = manager.getRepository(CertificateExamResult);
      const trainingSessRepo = manager.getRepository(CertificateTrainingSession);

      // نأخذ 5 طلاب مختلفين
      const certStudents = students.slice(0, 5);
      const certData: { studentIdx: number; category: CertificateCategory; status: CertificateRequestStatus; transport: boolean; requestedAt: Date }[] = [
        { studentIdx: 0, category: CertificateCategory.B,  status: CertificateRequestStatus.COMPLETED,                     transport: false, requestedAt: new Date('2026-03-01') },
        { studentIdx: 1, category: CertificateCategory.B,  status: CertificateRequestStatus.WAITING_FOR_PRACTICAL_EXAM,    transport: true,  requestedAt: new Date('2026-04-15') },
        { studentIdx: 2, category: CertificateCategory.B,  status: CertificateRequestStatus.IN_GOVERNMENT_TRAINING,         transport: true,  requestedAt: new Date('2026-05-01') },
        { studentIdx: 3, category: CertificateCategory.B1, status: CertificateRequestStatus.WAITING_FOR_TRAINING_SCHEDULE,  transport: false, requestedAt: new Date('2026-06-01') },
        { studentIdx: 4, category: CertificateCategory.B,  status: CertificateRequestStatus.WAITING_FOR_SERVICE_FEE,        transport: false, requestedAt: new Date('2026-06-15') },
      ];

      const savedCerts: Certificate[] = [];
      for (const cd of certData) {
        const student = certStudents[cd.studentIdx];
        const existing = await certRepo.findOne({ where: { student: { id: student.id }, category: cd.category } });
        if (existing) { savedCerts.push(existing); continue; }
        const cert = await certRepo.save(certRepo.create({ category: cd.category, requestStatus: cd.status, personalPhotoUrl: `https://example.com/photos/student_${student.id}.jpg`, transportRequested: cd.transport, requestedAt: cd.requestedAt, student }));
        savedCerts.push(cert);
      }

      // شهادة مكتملة - نتائج الامتحانات
      if (savedCerts[0]) {
        const existsExam = await examResultRepo.findOne({ where: { certificate: { id: savedCerts[0].id }, examType: ExamType.THEORY } });
        if (!existsExam) {
          await examResultRepo.save(examResultRepo.create({ certificate: savedCerts[0], examType: ExamType.THEORY, attemptNumber: 1, scheduledAt: new Date('2026-03-15'), examResult: ExamResult.PASS, resultRecordedAt: new Date('2026-03-15') }));
          await examResultRepo.save(examResultRepo.create({ certificate: savedCerts[0], examType: ExamType.PRACTICAL, attemptNumber: 1, scheduledAt: new Date('2026-03-25'), examResult: ExamResult.FAIL, resultRecordedAt: new Date('2026-03-25') }));
          await examResultRepo.save(examResultRepo.create({ certificate: savedCerts[0], examType: ExamType.PRACTICAL, attemptNumber: 2, scheduledAt: new Date('2026-04-05'), examResult: ExamResult.PASS, resultRecordedAt: new Date('2026-04-05') }));
        }
      }
      // شهادة بانتظار العملي - نظري ناجح فقط
      if (savedCerts[1]) {
        const existsExam = await examResultRepo.findOne({ where: { certificate: { id: savedCerts[1].id }, examType: ExamType.THEORY } });
        if (!existsExam) {
          await examResultRepo.save(examResultRepo.create({ certificate: savedCerts[1], examType: ExamType.THEORY, attemptNumber: 1, scheduledAt: new Date('2026-05-10'), examResult: ExamResult.PASS, resultRecordedAt: new Date('2026-05-10') }));
          await examResultRepo.save(examResultRepo.create({ certificate: savedCerts[1], examType: ExamType.PRACTICAL, attemptNumber: 1, scheduledAt: new Date('2026-07-05'), examResult: null, resultRecordedAt: null }));
        }
      }
      // جلسات التدريب الحكومي (IN_GOVERNMENT_TRAINING)
      if (savedCerts[2]) {
        const existsSess = await trainingSessionExists(trainingSessRepo, savedCerts[2].id);
        if (!existsSess) {
          for (let i = 1; i <= 6; i++) {
            const scheduledAt = i <= 4 ? new Date(`2026-05-${10 + i * 2}`) : null;
            await trainingSessRepo.save(trainingSessRepo.create({ certificate: savedCerts[2], sessionNumber: i, scheduledAt }));
          }
        }
      }
      console.log(`  ✅ ${savedCerts.length} شهادة + نتائج امتحانات + جلسات تدريب`);

      // ────────────────────────────────────────────────────────
      // 16) خدمة النقل
      // ────────────────────────────────────────────────────────
      console.log('\n── إنشاء خدمة النقل ──');
      const tripRepo  = manager.getRepository(TransportTrip);
      const regRepo   = manager.getRepository(TransportRegistration);
      const attnRepo  = manager.getRepository(TransportAttendance);
      const receptionist = allEmployees[0] ?? null;

      const trips = [
        { tripType: TripType.LECTURE,  tripDate: '2026-05-20', dayNumber: 1, assemblyTime: '07:30:00', destination: 'مركز التدريب الحكومي', capacity: 20, status: TripStatus.COMPLETED },
        { tripType: TripType.LECTURE,  tripDate: '2026-06-03', dayNumber: 2, assemblyTime: '07:30:00', destination: 'مركز التدريب الحكومي', capacity: 20, status: TripStatus.COMPLETED },
        { tripType: TripType.EXAM,     tripDate: '2026-06-15', dayNumber: null, assemblyTime: '08:00:00', destination: 'مديرية السير', capacity: 15, status: TripStatus.COMPLETED },
        { tripType: TripType.LECTURE,  tripDate: '2026-07-08', dayNumber: 3, assemblyTime: '07:30:00', destination: 'مركز التدريب الحكومي', capacity: 20, status: TripStatus.SCHEDULED },
      ];

      const savedTrips: TransportTrip[] = [];
      for (const t of trips) {
        const existing = await tripRepo.findOne({ where: { tripDate: t.tripDate, tripType: t.tripType } });
        if (existing) { savedTrips.push(existing); continue; }
        const trip = await tripRepo.save(tripRepo.create({ ...t, createdBy: receptionist }));
        savedTrips.push(trip);
      }

      // تسجيل الشهادات التي طلبت نقل في الرحلات المكتملة
      const certsWithTransport = savedCerts.filter(c => c.transportRequested);
      for (const cert of certsWithTransport) {
        for (const trip of savedTrips.filter(t => t.status === TripStatus.COMPLETED)) {
          const existsReg = await regRepo.findOne({ where: { certificate: { id: cert.id }, tripType: trip.tripType } });
          if (existsReg) continue;

          // رسوم النقل أولاً
          const chargeForTransport = await chargeRepo.save(chargeRepo.create({
            chargeReason: trip.tripType === TripType.LECTURE ? ChargeReason.TRANSPORT_LECTURE : ChargeReason.TRANSPORT_EXAM,
            amountDue: '5000.00', chargeStatus: ChargeStatus.PAID,
            student: cert.student, booking: null, certificate: cert, certificateExamResult: null, dueAt: null,
          }));
          await paymentRepo.save(paymentRepo.create({ amountPaid: '5000.00', paymentMethod: PaymentMethod.CASH, receivedAt: new Date(trip.tripDate), studentCharge: chargeForTransport }));

          const reg = await regRepo.save(regRepo.create({
            tripType: trip.tripType, registrationStatus: RegistrationStatus.COMPLETED,
            certificate: cert, studentCharge: chargeForTransport, createdBy: receptionist,
          }));

          await attnRepo.save(attnRepo.create({
            transportRegistration: reg, transportTrip: trip,
            attendanceStatus: AttendanceStatus.ATTENDED, attendedAt: new Date(trip.tripDate),
          }));
        }
      }
      console.log(`  ✅ ${savedTrips.length} رحلة + تسجيلات + حضور`);

      // ────────────────────────────────────────────────────────
      // 17) إشعارات تجريبية
      // ────────────────────────────────────────────────────────
      console.log('\n── إنشاء إشعارات تجريبية ──');
      const notifRepo = manager.getRepository(Notification);
      const notifCount = await notifRepo.count();
      if (notifCount === 0) {
        const notifData = [
          { student: certStudents[0], title: 'تأكيد الحجز',            body: 'تم تأكيد حجزك للدرس بنجاح.',                     type: NotificationType.BOOKING_CONFIRMED  },
          { student: certStudents[1], title: 'تم إلغاء الحجز',         body: 'تم إلغاء درسك بسبب ظرف طارئ.',                   type: NotificationType.BOOKING_CANCELLED  },
          { student: certStudents[2], title: 'تحديث حالة الشهادة',     body: 'تم قبول طلب شهادتك وهي قيد المعالجة.',            type: NotificationType.CERTIFICATE_STATUS_CHANGED },
          { student: certStudents[0], title: 'استلام الدفعة',           body: 'تم استلام دفعتك بمبلغ 500 ل.س.',                  type: NotificationType.PAYMENT_ACCEPTED   },
          { student: certStudents[3], title: 'موعد الدرس غداً',        body: 'تذكير: لديك درس غداً الساعة 9:00 صباحاً.',        type: NotificationType.GENERAL            },
        ];
        for (const n of notifData) {
          if (!n.student?.user) continue;
          await notifRepo.save(notifRepo.create({ recipientUser: n.student.user, title: n.title, body: n.body, notificationType: n.type, channel: NotificationChannel.IN_APP, status: NotificationStatus.SENT, sentAt: new Date(), readAt: null }));
        }
        console.log(`  ✅ ${notifData.length} إشعار`);
      } else {
        console.log(`  ↩️  الإشعارات موجودة مسبقاً (${notifCount})`);
      }

    } // end else (bookings block)
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
