import { Module } from '@nestjs/common';
import { CertificateExamResult } from '../certificate-exam-result.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
    imports: [TypeOrmModule.forFeature([CertificateExamResult])],  // ✅ This registers the entity
})
export class CertificateExamResultModule {}
