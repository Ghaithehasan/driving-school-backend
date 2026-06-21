import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Instructor } from './instructor.entity';
import { FindInstructorsQueryDto } from './dto/find-instructors-query.dto';

@Injectable()
export class InstructorsService {
  constructor(
    @InjectRepository(Instructor)
    private readonly instructorsRepo: Repository<Instructor>,
  ) {}

  async findAll(query: FindInstructorsQueryDto) {
    const qb = this.instructorsRepo
      .createQueryBuilder('instructor')
      .innerJoinAndSelect('instructor.user', 'user')
      .orderBy('instructor.id', 'DESC');

    if (query.gender) {
      qb.andWhere('instructor.gender = :gender', { gender: query.gender });
    }

    if (query.instructorType) {
      qb.andWhere('instructor.instructorType = :type', { type: query.instructorType });
    }

    if (query.search) {
      qb.andWhere(
        '(user.name ILIKE :search OR user.phone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const instructors = await qb.getMany();

    return instructors.map((i) => ({
      id: Number(i.user.id),
      instructorId: Number(i.id),
      name: i.user.name,
      phone: i.user.phone,
      gender: i.gender,
      instructorType: i.instructorType,
      accountStatus: i.user.accountStatus,
    }));
  }

  async findOne(id: number) {
    const instructor = await this.instructorsRepo
      .createQueryBuilder('instructor')
      .innerJoinAndSelect('instructor.user', 'user')
      .where('instructor.id = :id', { id })
      .getOne();

    if (!instructor) throw new NotFoundException('المدرب غير موجود');

    return {
      id: Number(instructor.user.id),
      instructorId: Number(instructor.id),
      name: instructor.user.name,
      phone: instructor.user.phone,
      gender: instructor.gender,
      instructorType: instructor.instructorType,
      accountStatus: instructor.user.accountStatus,
    };
  }
}
