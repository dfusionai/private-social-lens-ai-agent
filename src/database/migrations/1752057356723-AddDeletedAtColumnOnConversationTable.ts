import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtColumnOnConversationTable1752057356723
  implements MigrationInterface
{
  name = 'AddDeletedAtColumnOnConversationTable1752057356723';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversation" ADD "deletedAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversation" DROP COLUMN "deletedAt"`,
    );
  }
}
