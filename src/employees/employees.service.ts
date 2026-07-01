import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './employee.entity';
import { FindEmployeesQueryDto } from './dto/find-employees-query.dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepo: Repository<Employee>,
  ) {}

  async findAll(query: FindEmployeesQueryDto) {
    const qb = this.employeesRepo
      .createQueryBuilder('employee')
      .innerJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('user.userRoles', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .orderBy('employee.id', 'DESC');

    if (query.role) {
      qb.andWhere('role.title = :role', { role: query.role });
    }

    if (query.search) {
      qb.andWhere('(user.name ILIKE :search OR user.phone ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const employees = await qb.getMany();

    return employees.map((e) => ({
      id: Number(e.user.id),
      employeeId: Number(e.id),
      name: e.user.name,
      phone: e.user.phone,
      role: e.user.userRoles[0]?.role.title ?? null,
      hireDate: e.hireDate,
      monthlySalary: e.monthlySalary ? Number(e.monthlySalary) : null,
      accountStatus: e.user.accountStatus,
    }));
  }

  async findOne(id: number) {
    const employee = await this.employeesRepo
      .createQueryBuilder('employee')
      .innerJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('user.userRoles', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .where('employee.id = :id', { id })
      .getOne();

    if (!employee) throw new NotFoundException('الموظف غير موجود');

    return {
      id: Number(employee.user.id),
      employeeId: Number(employee.id),
      name: employee.user.name,
      phone: employee.user.phone,
      role: employee.user.userRoles[0]?.role.title ?? null,
      hireDate: employee.hireDate,
      monthlySalary: employee.monthlySalary
        ? Number(employee.monthlySalary)
        : null,
      accountStatus: employee.user.accountStatus,
    };
  }
}
