import { Module } from '@nestjs/common';
import { ShamcashService } from './shamcash.service';

@Module({
  providers: [ShamcashService],
  exports: [ShamcashService],
})
export class ShamcashModule {}
