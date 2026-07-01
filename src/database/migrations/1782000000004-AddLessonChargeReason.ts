import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLessonChargeReason1782000000004 implements MigrationInterface {
  name = 'AddLessonChargeReason1782000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."student_charges_charge_reason_enum"
        ADD VALUE IF NOT EXISTS 'LESSON'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values directly.
    // To roll back: recreate the type without 'LESSON' and ALTER the column.
    // Left intentionally empty — removing an enum value requires a full type rebuild.
  }
}
