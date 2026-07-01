import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBtreeGistConstraints1782000000001 implements MigrationInterface {
  name = 'AddBtreeGistConstraints1782000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await queryRunner.query(`
      ALTER TABLE "booking"
        ADD CONSTRAINT "ex_booking_instructor_overlap"
        EXCLUDE USING gist (
          instructor_id WITH =,
          tstzrange(start_at, end_at, '[)') WITH &&
        )
        WHERE (booking_status IN ('PENDING_PAYMENT', 'BOOKED'))
    `);
    await queryRunner.query(`
      ALTER TABLE "booking"
        ADD CONSTRAINT "ex_booking_vehicle_overlap"
        EXCLUDE USING gist (
          vehicle_id WITH =,
          tstzrange(start_at, end_at, '[)') WITH &&
        )
        WHERE (vehicle_id IS NOT NULL AND booking_status IN ('PENDING_PAYMENT', 'BOOKED'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking" DROP CONSTRAINT IF EXISTS "ex_booking_vehicle_overlap"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" DROP CONSTRAINT IF EXISTS "ex_booking_instructor_overlap"`,
    );
  }
}
