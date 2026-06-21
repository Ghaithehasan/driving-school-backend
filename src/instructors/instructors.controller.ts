import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/guards/roles.guard';
import { FindInstructorsQueryDto } from './dto/find-instructors-query.dto';
import { InstructorsService } from './instructors.service';

@Controller('instructors')
@UseGuards(PermissionGuard)
export class InstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @RequirePermissions('instructors.read')
  @Get()
  findAll(@Query() query: FindInstructorsQueryDto) {
    return this.instructorsService.findAll(query);
  }

  @RequirePermissions('instructors.read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.instructorsService.findOne(+id);
  }
}
