import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaidAtToExpenses1782000000003 implements MigrationInterface {
  name = 'AddPaidAtToExpenses1782000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "expenses"
        ADD COLUMN "paid_at" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "expenses"
        DROP COLUMN "paid_at"
    `);
  }
}
