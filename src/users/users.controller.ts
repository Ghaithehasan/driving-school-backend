import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/guards/roles.guard';
import { CreateStudentDto } from './dto/CreateStudentDto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(PermissionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermissions('students.create')
  @Post('students')
  createStudent(@Body() dto: CreateStudentDto) {
    return this.usersService.createStudent(dto);
  }

  @RequirePermissions('instructors.create')
  @Post('instructors')
  createInstructor(@Body() dto: CreateInstructorDto) {
    return this.usersService.createInstructor(dto);
  }

  @RequirePermissions('employees.create')
  @Post('employees')
  createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.usersService.createEmployee(dto);
  }
}
