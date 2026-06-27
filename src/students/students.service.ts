import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
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

    const searchTerms = this.getSearchTerms(query.search);
    searchTerms.forEach((term, index) => {
      const termParam = `searchTerm${index}`;

      qb.andWhere(
        new Brackets((orQb) => {
          orQb.where(`user.name ILIKE :${termParam}`, {
            [termParam]: `%${term}%`,
          });
        }),
      );
    });

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

  private getSearchTerms(search?: string): string[] {
    if (!search) return [];
    return search.trim().split(/\s+/).filter(Boolean);
  }
}
