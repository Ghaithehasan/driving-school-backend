import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { InstructorProfileService } from './instructor-profile.service';
import { UpdateDayScheduleDto } from './dto/update-day-schedule.dto';
import { SubmitLeaveDto } from './dto/submit-leave.dto';
import { InstructorBookingsQueryDto } from './dto/instructor-bookings-query.dto';

@Controller('instructors/:id')
@UseGuards(PermissionGuard)
export class InstructorProfileController {
  constructor(private readonly profileService: InstructorProfileService) { }

  /** GET /instructors/:id/profile — Header data, leave status, today's lessons */
  @Get('profile')
  @RequirePermissions('instructors.read')
  getProfile(@Param('id', ParseIntPipe) id: number) {
    return this.profileService.getProfile(id);
  }

  /** GET /instructors/:id/schedule — Full weekly schedule grouped by day */
  @Get('schedule')
  @RequirePermissions('instructors.read')
  getSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.profileService.getSchedule(id);
  }

  /**
   * PUT /instructors/:id/schedule — Replace one weekday's periods.
   * Empty periods[] = instructor does not work that day (recurring day-off).
   * Web / receptionist only.
   */
  @Put('schedule')
  @RequirePermissions('instructor.schedule.update')
  updateDaySchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDayScheduleDto,
  ) {
    return this.profileService.updateDaySchedule(id, dto);
  }

  /** GET /instructors/:id/bookings — Filtered bookings (day view or week view) */
  @Get('bookings')
  @RequirePermissions('instructors.read')
  getBookings(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: InstructorBookingsQueryDto,
  ) {
    return this.profileService.getBookings(id, query);
  }

  /** GET /instructors/:id/stats — Statistics card */
  @Get('stats')
  @RequirePermissions('instructors.read')
  getStats(@Param('id', ParseIntPipe) id: number) {
    return this.profileService.getStats(id);
  }

  /** GET /instructors/:id/dues — Outstanding dues with per-day breakdown */
  @Get('dues')
  @RequirePermissions('expenses.read')
  getDues(@Param('id', ParseIntPipe) id: number) {
    return this.profileService.getDues(id);
  }

  /**
   * POST /instructors/:id/pay-dues — Settle all UNPAID instructor expenses.
   * Accountant / Manager only (grantable to receptionist via role_permissions without code change).
   */
  @Post('pay-dues')
  @RequirePermissions('expenses.pay')
  payDues(@Param('id', ParseIntPipe) id: number) {
    return this.profileService.payDues(id);
  }

  /** GET /instructors/:id/leaves — List all leaves for this instructor */
  @Get('leaves')
  @RequirePermissions('instructors.read')
  getLeaves(@Param('id', ParseIntPipe) id: number) {
    return this.profileService.getLeaves(id);
  }

  /**
   * POST /instructors/:id/leaves — Submit a leave (full-day or hourly).
   * Cancels overlapping reserving bookings. Web / receptionist only.
   */
  @Post('leaves')
  @RequirePermissions('instructor.leave.create')
  submitLeave(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitLeaveDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.profileService.submitLeave(id, dto, currentUser);
  }

  /** PATCH /instructors/:id/leaves/:leaveId — Edit leave times or type */
  @Put('leaves/:leaveId')
  @RequirePermissions('instructor.leave.create')
  updateLeave(
    @Param('id', ParseIntPipe) id: number,
    @Param('leaveId', ParseIntPipe) leaveId: number,
    @Body() dto: SubmitLeaveDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.profileService.updateLeave(id, leaveId, dto, currentUser);
  }

  /** DELETE /instructors/:id/leaves/:leaveId — Cancel (delete) a leave */
  @Delete('leaves/:leaveId')
  @RequirePermissions('instructor.leave.create')
  cancelLeave(
    @Param('id', ParseIntPipe) id: number,
    @Param('leaveId', ParseIntPipe) leaveId: number,
  ) {
    return this.profileService.cancelLeave(id, leaveId);
  }
}
