import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema.
 *
 * Highlights:
 *  - `ex_vacation_requests_no_overlap`: a GiST exclusion constraint guaranteeing, at the database
 *    level, that a user can never hold two pending/approved requests whose date ranges overlap —
 *    even under concurrent inserts (business rule #2 is race-condition proof).
 *  - CHECK constraints mirror business rules #1 (end > start) and #5 (rejection needs a comment).
 *  - Composite indexes match the access paths of the requester list, the validator dashboard
 *    (status filter + created_at ordering) and the team calendar (date-range overlap).
 */
export class InitialSchema1760659200000 implements MigrationInterface {
  name = 'InitialSchema1760659200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "btree_gist"`);

    await queryRunner.query(`CREATE TYPE "public"."user_role" AS ENUM('requester', 'validator')`);
    await queryRunner.query(
      `CREATE TYPE "public"."vacation_request_status" AS ENUM('pending', 'approved', 'rejected')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(120) NOT NULL,
        "email" character varying(254) NOT NULL,
        "password" character varying(255) NOT NULL,
        "role" "public"."user_role" NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "chk_users_email_lowercase" CHECK ("email" = lower("email")),
        CONSTRAINT "pk_users" PRIMARY KEY ("id")
      )`);

    await queryRunner.query(`
      CREATE TABLE "vacation_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "reason" character varying(500),
        "status" "public"."vacation_request_status" NOT NULL DEFAULT 'pending',
        "comments" text,
        "decided_by" uuid,
        "decided_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "chk_vacation_requests_dates" CHECK ("end_date" > "start_date"),
        CONSTRAINT "chk_vacation_requests_rejection_comment"
          CHECK ("status" <> 'rejected' OR ("comments" IS NOT NULL AND length(btrim("comments")) > 0)),
        CONSTRAINT "ex_vacation_requests_no_overlap"
          EXCLUDE USING gist ("user_id" WITH =, daterange("start_date", "end_date", '[]') WITH &&)
          WHERE ("status" <> 'rejected'),
        CONSTRAINT "pk_vacation_requests" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_vacation_requests_user_start" ON "vacation_requests" ("user_id", "start_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_vacation_requests_status_created" ON "vacation_requests" ("status", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_vacation_requests_created" ON "vacation_requests" ("created_at") `,
    );
    await queryRunner.query(`
      ALTER TABLE "vacation_requests"
        ADD CONSTRAINT "fk_vacation_requests_user" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`
      ALTER TABLE "vacation_requests"
        ADD CONSTRAINT "fk_vacation_requests_decided_by" FOREIGN KEY ("decided_by")
        REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "event_name" character varying(100) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "actor_id" uuid,
        "payload" jsonb NOT NULL,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "uq_audit_logs_event_id" UNIQUE ("event_id"),
        CONSTRAINT "pk_audit_logs" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_aggregate" ON "audit_logs" ("aggregate_id", "occurred_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "vacation_requests"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."vacation_request_status"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
  }
}
