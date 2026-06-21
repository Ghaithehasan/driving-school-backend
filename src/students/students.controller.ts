import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/guards/roles.guard';
import { FindStudentsQueryDto } from './dto/find-students-query.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(PermissionGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @RequirePermissions('students.read')
  @Get()
  findAll(@Query() query: FindStudentsQueryDto) {
    return this.studentsService.findAll(query);
  }

  @RequirePermissions('students.read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(+id);
  }
}
