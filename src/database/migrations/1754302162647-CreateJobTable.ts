import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobTable1754302162647 implements MigrationInterface {
  name = 'CreateJobTable1754302162647';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "job" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(50) NOT NULL DEFAULT 'refinement', "status" character varying(20) NOT NULL DEFAULT 'pending', "blobId" character varying(255) NOT NULL, "onchainFileId" character varying(255) NOT NULL, "policyId" character varying(255) NOT NULL, "priority" integer DEFAULT '5', "metadata" jsonb, "resultData" jsonb, "errorMessage" text, "workerId" character varying(100), "attempts" integer NOT NULL DEFAULT '0', "maxAttempts" integer NOT NULL DEFAULT '3', "pgBossJobId" character varying(100), "startedAt" TIMESTAMP, "completedAt" TIMESTAMP, "failedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" integer NOT NULL, CONSTRAINT "PK_98ab1c14ff8d1cf80d18703b92f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da98239d7276ae3f4bf09f028a" ON "job" ("workerId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6ca3dbfc342c98275ca8d8a422" ON "job" ("userId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_144aafaa5d742cbd5d22f63bb1" ON "job" ("status", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "job" ADD CONSTRAINT "FK_308fb0752c2ea332cb79f52ceaa" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "job" DROP CONSTRAINT "FK_308fb0752c2ea332cb79f52ceaa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_144aafaa5d742cbd5d22f63bb1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6ca3dbfc342c98275ca8d8a422"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_da98239d7276ae3f4bf09f028a"`,
    );
    await queryRunner.query(`DROP TABLE "job"`);
  }
}
