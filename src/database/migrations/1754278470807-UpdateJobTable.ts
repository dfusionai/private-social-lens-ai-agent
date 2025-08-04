import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateJobTable1754278470807 implements MigrationInterface {
  name = 'UpdateJobTable1754278470807';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "job" DROP COLUMN "processingOptions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job" ADD "priority" integer DEFAULT '5'`,
    );
    await queryRunner.query(`ALTER TABLE "job" ADD "metadata" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "job" ALTER COLUMN "type" SET DEFAULT 'refinement'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "job" ALTER COLUMN "type" SET DEFAULT 'data-refinement'`,
    );
    await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "metadata"`);
    await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "priority"`);
    await queryRunner.query(`ALTER TABLE "job" ADD "processingOptions" jsonb`);
  }
}
