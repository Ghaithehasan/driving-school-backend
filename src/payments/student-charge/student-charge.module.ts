import { Module } from '@nestjs/common';
import { StudentCharge } from '../student-charge.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({ 
    imports: [
    TypeOrmModule.forFeature([StudentCharge]),  
  ],

})
export class StudentChargeModule {}
