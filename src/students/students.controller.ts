import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/guards/roles.guard';
import { BookingService } from '../booking/booking.service';
import { FindStudentsQueryDto } from './dto/find-students-query.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(PermissionGuard)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly bookingService: BookingService,
  ) {}

  @RequirePermissions('students.read')
  @Get()
  findAll(@Query() query: FindStudentsQueryDto) {
    return this.studentsService.findAll(query);
  }

  /** GET /students/:id/credit-check */
  @Get(':id/credit-check')
  @RequirePermissions('bookings.read')
  checkStudentCredit(@Param('id', ParseIntPipe) id: number) {
    return this.bookingService.checkStudentCredit(id);
  }

  @RequirePermissions('students.read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(+id);
  }
}
