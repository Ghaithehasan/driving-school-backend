import { Module } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { CertificatesController } from './certificates.controller';
import { Certificate } from './certificate.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificateExamResultModule } from './certificate-exam-result/certificate-exam-result.module';

@Module({
   imports: [
    TypeOrmModule.forFeature([Certificate]),
    CertificateExamResultModule,  
  ],
  controllers: [CertificatesController],
  providers: [CertificatesService],
})
export class CertificatesModule {}
