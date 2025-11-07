import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubmissionTables1762415932677 implements MigrationInterface {
  name = 'CreateSubmissionTables1762415932677';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create batch table first (submission references it)
    await queryRunner.query(
      `CREATE TABLE "batch" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying(255) NOT NULL, "batchNumber" integer NOT NULL, "chatCount" integer NOT NULL DEFAULT '0', "batchStatus" character varying(20) NOT NULL DEFAULT 'pending', "retryCount" integer NOT NULL DEFAULT '0', "maxRetries" integer NOT NULL DEFAULT '3', "errorMessage" text, "quiltId" character varying(500), "quiltBlobId" character varying(500), "epochs" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_batch_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_batch_user_batchNumber" ON "batch" ("userId", "batchNumber")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_batch_user_status" ON "batch" ("userId", "batchStatus")`,
    );

    // Create submission table with batchId foreign key
    await queryRunner.query(
      `CREATE TABLE "submission" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying(255) NOT NULL, "blobUrl" character varying(500) NOT NULL, "blobName" character varying(500) NOT NULL, "chatCount" integer NOT NULL DEFAULT '0', "batchId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_submission_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_submission_user_createdAt" ON "submission" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_submission_batch" ON "submission" ("batchId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "submission" ADD CONSTRAINT "FK_submission_batch" FOREIGN KEY ("batchId") REFERENCES "batch"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submission" DROP CONSTRAINT "FK_submission_batch"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_submission_batch"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_submission_user_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE "submission"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_batch_user_status"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_batch_user_batchNumber"`);
    await queryRunner.query(`DROP TABLE "batch"`);
  }
}
