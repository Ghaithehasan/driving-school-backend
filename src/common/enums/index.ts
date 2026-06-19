export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
  ARCHIVED = 'ARCHIVED',
}

export enum RoleTitle {
  MANAGER = 'MANAGER',
  RECEPTIONIST = 'RECEPTIONIST',
  ACCOUNTANT = 'ACCOUNTANT',
  INSTRUCTOR = 'INSTRUCTOR',
  STUDENT = 'STUDENT',
}

export enum StudentStatus {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  IN_TRAINING = 'IN_TRAINING',
  CERTIFICATE_SEEKER = 'CERTIFICATE_SEEKER',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum InstructorType {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC',
  BOTH = 'BOTH',
}

export enum VehicleType {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC',
}

export enum VehicleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum VehicleSource {
  SCHOOL_CAR = 'SCHOOL_CAR',
  STUDENT_CAR = 'STUDENT_CAR',
}

export enum BookingStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  BOOKED = 'BOOKED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING_DEPOSIT = 'PENDING_DEPOSIT',
  DEPOSIT_PAID = 'DEPOSIT_PAID',
  FULLY_PAID = 'FULLY_PAID',
  DEPOSIT_NON_REFUNDABLE = 'DEPOSIT_NON_REFUNDABLE',
  DEPOSIT_AVAILABLE_FOR_REBOOKING = 'DEPOSIT_AVAILABLE_FOR_REBOOKING',
  DEPOSIT_USED_IN_REBOOKING = 'DEPOSIT_USED_IN_REBOOKING',
}

export enum TrainingType {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC',
}

export enum TrainingTypeFull {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC',
  STUDENT_OWN_CAR = 'STUDENT_OWN_CAR',
}

export enum CancellationParty {
  STUDENT = 'STUDENT',
  VEHICLE = 'VEHICLE',
  INSTRUCTOR = 'INSTRUCTOR',
  SCHOOL = 'SCHOOL',
}

export enum DayOfWeek {
  SAT = 'SAT',
  SUN = 'SUN',
  MON = 'MON',
  TUE = 'TUE',
  WED = 'WED',
  THU = 'THU',
  FRI = 'FRI',
}

export enum ChargeReason {
  LESSON_DEPOSIT = 'LESSON_DEPOSIT',
  LESSON_REMAINDER = 'LESSON_REMAINDER',
  CERTIFICATE_FEE = 'CERTIFICATE_FEE',
  TRANSPORT_LECTURE = 'TRANSPORT_LECTURE',
  TRANSPORT_EXAM = 'TRANSPORT_EXAM',
  REEXAM_THEORY = 'REEXAM_THEORY',
  REEXAM_PRACTICAL = 'REEXAM_PRACTICAL',
  OTHER = 'OTHER',
}

export enum ChargeStatus {
  PAID = 'PAID',
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  SHAM_CASH = 'SHAM_CASH',
}

export enum ExpenseCategory {
  VEHICLE = 'VEHICLE',
  INSTRUCTOR = 'INSTRUCTOR',
  EMPLOYEE = 'EMPLOYEE',
  GENERAL = 'GENERAL',
}

export enum ExpenseStatus {
  PAID = 'PAID',
  UNPAID = 'UNPAID',
}

export enum VehicleExpenseReason {
  MAINTENANCE = 'MAINTENANCE',
  GAS = 'GAS',
  INSURANCE = 'INSURANCE',
  OTHER = 'OTHER',
}

export enum EmployeeExpenseType {
  SALARY = 'SALARY',
  BONUS = 'BONUS',
  OTHER = 'OTHER',
}

export enum GeneralExpenseType {
  WATER = 'WATER',
  ELECTRICITY = 'ELECTRICITY',
  INTERNET = 'INTERNET',
  KITCHEN = 'KITCHEN',
  SUPPLIES = 'SUPPLIES',
  OTHER = 'OTHER',
}

export enum InstructorPriceType {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum CertificateCategory {
  B = 'B',
  B1 = 'B1',
  C = 'C',
  D = 'D',
}

export enum CertificateStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum ExamType {
  THEORY = 'THEORY',
  PRACTICAL = 'PRACTICAL',
}

export enum ExamResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  ABSENT = 'ABSENT',
}

export enum TripType {
  LECTURE = 'LECTURE',
  EXAM = 'EXAM',
}

export enum TripStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum RegistrationStatus {
  REGISTERED = 'REGISTERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum AttendanceStatus {
  PENDING = 'PENDING',
  ATTENDED = 'ATTENDED',
  ABSENT = 'ABSENT',
}

export enum SettingValueType {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  TIME = 'TIME',
  PERCENT = 'PERCENT',
  BOOLEAN = 'BOOLEAN',
}
