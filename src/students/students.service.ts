import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from './student.entity';
import { FindStudentsQueryDto } from './dto/find-students-query.dto';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentsRepo: Repository<Student>,
  ) {}

  async findAll(query: FindStudentsQueryDto) {
    const qb = this.studentsRepo
      .createQueryBuilder('student')
      .innerJoinAndSelect('student.user', 'user')
      .orderBy('student.id', 'DESC');

    if (query.status) {
      qb.andWhere('student.studentStatus = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(user.name ILIKE :search OR user.phone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const students = await qb.getMany();

    return students.map((s) => ({
      id: Number(s.user.id),
      studentId: Number(s.id),
      name: s.user.name,
      phone: s.user.phone,
      studentStatus: s.studentStatus,
      accountStatus: s.user.accountStatus,
    }));
  }

  async findOne(id: number) {
    const student = await this.studentsRepo
      .createQueryBuilder('student')
      .innerJoinAndSelect('student.user', 'user')
      .where('student.id = :id', { id })
      .getOne();

    if (!student) throw new NotFoundException('الطالب غير موجود');

    return {
      id: Number(student.user.id),
      studentId: Number(student.id),
      name: student.user.name,
      phone: student.user.phone,
      studentStatus: student.studentStatus,
      accountStatus: student.user.accountStatus,
    };
  }
}
