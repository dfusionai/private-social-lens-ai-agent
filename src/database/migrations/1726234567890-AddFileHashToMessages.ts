import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileHashToMessages1726234567890 implements MigrationInterface {
  name = 'AddFileHashToMessages1726234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message" ALTER COLUMN "content" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "message" ADD "fileHash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "message" ADD "isEncrypted" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "isEncrypted"`);
    await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "fileHash"`);
    await queryRunner.query(
      `ALTER TABLE "message" ALTER COLUMN "content" SET NOT NULL`,
    );
  }
}
