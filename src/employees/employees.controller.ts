import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/guards/roles.guard';
import { FindEmployeesQueryDto } from './dto/find-employees-query.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(PermissionGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @RequirePermissions('employees.read')
  @Get()
  findAll(@Query() query: FindEmployeesQueryDto) {
    return this.employeesService.findAll(query);
  }

  @RequirePermissions('employees.read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(+id);
  }
}
