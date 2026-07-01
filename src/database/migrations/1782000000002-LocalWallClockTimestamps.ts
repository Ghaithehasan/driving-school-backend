import { MigrationInterface, QueryRunner } from 'typeorm';

export class LocalWallClockTimestamps1782000000002 implements MigrationInterface {
  name = 'LocalWallClockTimestamps1782000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop btree_gist EXCLUDE constraints (they use tstzrange which requires TIMESTAMPTZ)
    await queryRunner.query(
      `ALTER TABLE "booking" DROP CONSTRAINT IF EXISTS "ex_booking_instructor_overlap"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" DROP CONSTRAINT IF EXISTS "ex_booking_vehicle_overlap"`,
    );

    // Convert booking slots from TIMESTAMPTZ (UTC) to TIMESTAMP (local wall-clock UTC+3)
    await queryRunner.query(`
      ALTER TABLE "booking"
        ALTER COLUMN "start_at" TYPE TIMESTAMP WITHOUT TIME ZONE
          USING (start_at AT TIME ZONE '+03:00'),
        ALTER COLUMN "end_at" TYPE TIMESTAMP WITHOUT TIME ZONE
          USING (end_at AT TIME ZONE '+03:00')
    `);

    // Convert instructor unavailable periods — same offset
    await queryRunner.query(`
      ALTER TABLE "instructor_unavailable_periods"
        ALTER COLUMN "start_at" TYPE TIMESTAMP WITHOUT TIME ZONE
          USING (start_at AT TIME ZONE '+03:00'),
        ALTER COLUMN "end_at" TYPE TIMESTAMP WITHOUT TIME ZONE
          USING (end_at AT TIME ZONE '+03:00')
    `);

    // Convert vehicle unavailable periods — end_at is nullable, USING handles NULL correctly
    await queryRunner.query(`
      ALTER TABLE "vehicle_unavailable_periods"
        ALTER COLUMN "start_at" TYPE TIMESTAMP WITHOUT TIME ZONE
          USING (start_at AT TIME ZONE '+03:00'),
        ALTER COLUMN "end_at" TYPE TIMESTAMP WITHOUT TIME ZONE
          USING (CASE WHEN end_at IS NULL THEN NULL ELSE end_at AT TIME ZONE '+03:00' END)
    `);

    // Recreate btree_gist constraints using tsrange (matches TIMESTAMP WITHOUT TIME ZONE)
    await queryRunner.query(`
      ALTER TABLE "booking"
        ADD CONSTRAINT "ex_booking_instructor_overlap"
        EXCLUDE USING gist (
          instructor_id WITH =,
          tsrange(start_at, end_at, '[)') WITH &&
        )
        WHERE (booking_status IN ('PENDING_PAYMENT', 'BOOKED'))
    `);
    await queryRunner.query(`
      ALTER TABLE "booking"
        ADD CONSTRAINT "ex_booking_vehicle_overlap"
        EXCLUDE USING gist (
          vehicle_id WITH =,
          tsrange(start_at, end_at, '[)') WITH &&
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

    await queryRunner.query(`
      ALTER TABLE "booking"
        ALTER COLUMN "start_at" TYPE TIMESTAMP WITH TIME ZONE
          USING (start_at AT TIME ZONE '+03:00'),
        ALTER COLUMN "end_at" TYPE TIMESTAMP WITH TIME ZONE
          USING (end_at AT TIME ZONE '+03:00')
    `);

    await queryRunner.query(`
      ALTER TABLE "instructor_unavailable_periods"
        ALTER COLUMN "start_at" TYPE TIMESTAMP WITH TIME ZONE
          USING (start_at AT TIME ZONE '+03:00'),
        ALTER COLUMN "end_at" TYPE TIMESTAMP WITH TIME ZONE
          USING (end_at AT TIME ZONE '+03:00')
    `);

    await queryRunner.query(`
      ALTER TABLE "vehicle_unavailable_periods"
        ALTER COLUMN "start_at" TYPE TIMESTAMP WITH TIME ZONE
          USING (start_at AT TIME ZONE '+03:00'),
        ALTER COLUMN "end_at" TYPE TIMESTAMP WITH TIME ZONE
          USING (CASE WHEN end_at IS NULL THEN NULL ELSE end_at AT TIME ZONE '+03:00' END)
    `);

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
}
