import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubmissionTables1762415932677 implements MigrationInterface {
  name = 'CreateSubmissionTables1762415932677';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "submission" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying(255) NOT NULL, "blobUrl" character varying(500) NOT NULL, "blobName" character varying(500) NOT NULL, "chatCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_submission_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_submission_user_createdAt" ON "submission" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_batch_tracking" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying(255) NOT NULL, "chatCount" integer NOT NULL DEFAULT '0', "batchStatus" character varying(20) NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_user_batch_tracking_user" UNIQUE ("userId"), CONSTRAINT "PK_user_batch_tracking_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_batch_tracking_user_status" ON "user_batch_tracking" ("userId", "batchStatus") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_batch_tracking_user_status"`,
    );
    await queryRunner.query(`DROP TABLE "user_batch_tracking"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_submission_user_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE "submission"`);
  }
}
