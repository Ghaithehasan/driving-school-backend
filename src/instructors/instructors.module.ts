import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Instructor } from './instructor.entity';
import { InstructorsController } from './instructors.controller';
import { InstructorsService } from './instructors.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Instructor]),
    AuthModule,
  ],
  controllers: [InstructorsController],
  providers: [InstructorsService],
})
export class InstructorsModule {}
