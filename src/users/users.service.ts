import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { AccountStatus, RoleTitle } from '../common/enums/index';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';
import { User } from './user.entity';
import { createStudentAccount } from './create-student-account';
import { CreateStudentDto } from './dto/CreateStudentDto';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { Instructor } from '../instructors/instructor.entity';
import { Employee } from '../employees/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@Injectable()
export class UsersService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createStudent(dto: CreateStudentDto) {
    return this.dataSource.transaction(async (manager) => {
      const passwordHash = await argon2.hash(dto.password);

      // الإدارة تنشئ الطالب بكلمة مرور مؤقتة يجب تغييرها عند أول دخول.
      const { user, student } = await createStudentAccount(manager, {
        name: dto.name,
        phone: dto.phone,
        passwordHash,
        mustChangePassword: true,
      });

      return {
        id: Number(user.id),
        studentId: Number(student.id),
        name: user.name,
        phone: user.phone,
        studentStatus: student.studentStatus,
        accountStatus: user.accountStatus,
        mustChangePassword: user.mustChangePassword,
      };
    });
  }

  public async createInstructor(dto: CreateInstructorDto) {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(User, {
        where: { phone: dto.phone },
      });
      if (existing) throw new ConflictException('رقم الهاتف مستخدم مسبقاً');

      const passwordHash = await argon2.hash(dto.password);

      const user = await manager.save(
        manager.create(User, {
          name: dto.name,
          phone: dto.phone,
          passwordHash,
          accountStatus: AccountStatus.ACTIVE,
          mustChangePassword: true,
        }),
      );

      const instructor = await manager.save(
        manager.create(Instructor, {
          user,
          gender: dto.gender,
          instructorType: dto.instructorType,
        }),
      );

      const role = await manager.findOneOrFail(Role, {
        where: { title: RoleTitle.INSTRUCTOR },
      });

      await manager.save(manager.create(UserRole, { user, role }));

      return {
        id: Number(user.id),
        instructorId: Number(instructor.id),
        name: user.name,
        phone: user.phone,
        gender: instructor.gender,
        instructorType: instructor.instructorType,
        accountStatus: user.accountStatus,
        mustChangePassword: user.mustChangePassword,
      };
    });
  }

  public async createEmployee(dto: CreateEmployeeDto) {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(User, {
        where: { phone: dto.phone },
      });
      if (existing) throw new ConflictException('رقم الهاتف مستخدم مسبقاً');

      const passwordHash = await argon2.hash(dto.password);

      const user = await manager.save(
        manager.create(User, {
          name: dto.name,
          phone: dto.phone,
          passwordHash,
          accountStatus: AccountStatus.ACTIVE,
          mustChangePassword: true,
        }),
      );

      const employee = await manager.save(
        manager.create(Employee, {
          user,
          hireDate: dto.hireDate ?? new Date().toISOString().split('T')[0],
          monthlySalary: dto.monthlySalary?.toString() ?? null,
        }),
      );

      const role = await manager.findOneOrFail(Role, {
        where: { title: dto.role },
      });

      await manager.save(manager.create(UserRole, { user, role }));

      return {
        id: Number(user.id),
        employeeId: Number(employee.id),
        name: user.name,
        phone: user.phone,
        role: dto.role,
        hireDate: employee.hireDate,
        monthlySalary: employee.monthlySalary
          ? Number(employee.monthlySalary)
          : null,
        accountStatus: user.accountStatus,
        mustChangePassword: user.mustChangePassword,
      };
    });
  }
}
