import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/guards/roles.guard';
import { AddFuelDto } from './dto/add-fuel.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { FindVehiclesQueryDto } from './dto/find-vehicles-query.dto';
import { ReturnFromMaintenanceDto } from './dto/return-from-maintenance.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
@UseGuards(PermissionGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @RequirePermissions('vehicles.read')
  @Get()
  findAll(@Query() query: FindVehiclesQueryDto) {
    return this.vehiclesService.findAll(query);
  }

  @RequirePermissions('vehicles.read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(+id);
  }

  @RequirePermissions('vehicles.create')
  @Post()
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @RequirePermissions('vehicles.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(+id, dto);
  }

  @RequirePermissions('vehicles.fuel')
  @Post(':id/fuel')
  addFuel(@Param('id') id: string, @Body() dto: AddFuelDto) {
    return this.vehiclesService.addFuel(+id, dto);
  }

  @RequirePermissions('vehicles.maintenance')
  @Post(':id/maintenance')
  sendToMaintenance(@Param('id') id: string) {
    return this.vehiclesService.sendToMaintenance(+id);
  }

  @RequirePermissions('vehicles.archive')
  @Post(':id/archive')
  archiveVehicle(@Param('id') id: string) {
    return this.vehiclesService.archiveVehicle(+id);
  }

  @RequirePermissions('vehicles.maintenance')
  @Post(':id/return-from-maintenance')
  returnFromMaintenance(
    @Param('id') id: string,
    @Body() dto: ReturnFromMaintenanceDto,
    @CurrentUser('userId') userId: number,
  ) {
    return this.vehiclesService.returnFromMaintenance(+id, dto, userId);
  }
}
