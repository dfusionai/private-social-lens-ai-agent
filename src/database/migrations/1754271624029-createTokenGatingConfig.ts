import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTokenGatingConfig1754271624029
  implements MigrationInterface
{
  name = 'CreateTokenGatingConfig1754271624029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "token_gating_config" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "stakeThreshold" numeric NOT NULL, "balanceThreshold" numeric NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9591511e705c0793ca6b2d72042" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "token_gating_config"`);
  }
}
