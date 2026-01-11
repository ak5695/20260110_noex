/**
 * Step-by-step Migration Runner for Neon PostgreSQL
 *
 * Neon's HTTP driver doesn't support multi-statement SQL execution,
 * so we need to execute each statement individually.
 */

// CRITICAL: Load environment variables BEFORE importing db
import { config } from "dotenv";
config();

import { db } from "../db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("[Migration] Starting step-by-step migration...");

  try {
    // Step 1: Add version column
    console.log("[Migration] Step 1: Adding version column...");
    await db.execute(sql`
      ALTER TABLE "documents"
        ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL
    `);

    // Step 2: Add lastModifiedBy column (nullable first)
    console.log("[Migration] Step 2: Adding lastModifiedBy column...");
    await db.execute(sql`
      ALTER TABLE "documents"
        ADD COLUMN IF NOT EXISTS "lastModifiedBy" text
    `);

    // Step 3: Backfill lastModifiedBy with userId
    console.log("[Migration] Step 3: Backfilling lastModifiedBy...");
    await db.execute(sql`
      UPDATE "documents"
      SET "lastModifiedBy" = "userId"
      WHERE "lastModifiedBy" IS NULL
    `);

    // Step 4: Make lastModifiedBy NOT NULL
    console.log("[Migration] Step 4: Setting lastModifiedBy to NOT NULL...");
    await db.execute(sql`
      ALTER TABLE "documents"
        ALTER COLUMN "lastModifiedBy" SET NOT NULL
    `);

    // Step 5: Add foreign key constraint (check if exists first)
    console.log("[Migration] Step 5: Adding foreign key constraint...");
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'documents_lastModifiedBy_user_id_fk'
        ) THEN
          ALTER TABLE "documents"
            ADD CONSTRAINT "documents_lastModifiedBy_user_id_fk"
            FOREIGN KEY ("lastModifiedBy")
            REFERENCES "public"."user"("id")
            ON DELETE NO ACTION
            ON UPDATE NO ACTION;
        END IF;
      END $$
    `);

    // Step 6: Add index on updatedAt
    console.log("[Migration] Step 6: Adding updatedAt index...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "by_updated_idx" ON "documents" USING btree ("updatedAt")
    `);

    // Step 7: Create audit log table
    console.log("[Migration] Step 7: Creating audit log table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "document_audit_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "documentId" uuid NOT NULL,
        "userId" text NOT NULL,
        "action" text NOT NULL,
        "fieldChanged" text,
        "oldValue" text,
        "newValue" text,
        "version" integer NOT NULL,
        "timestamp" timestamp DEFAULT now() NOT NULL,
        "ipAddress" text,
        "userAgent" text,
        CONSTRAINT "document_audit_log_documentId_documents_id_fk"
          FOREIGN KEY ("documentId")
          REFERENCES "public"."documents"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "document_audit_log_userId_user_id_fk"
          FOREIGN KEY ("userId")
          REFERENCES "public"."user"("id")
          ON DELETE NO ACTION
          ON UPDATE NO ACTION
      )
    `);

    // Step 8: Create audit log indices
    console.log("[Migration] Step 8: Creating audit log indices...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "audit_by_document_idx" ON "document_audit_log" USING btree ("documentId")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "audit_by_user_idx" ON "document_audit_log" USING btree ("userId")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "audit_by_timestamp_idx" ON "document_audit_log" USING btree ("timestamp")
    `);

    // Step 9: Add comments for documentation
    console.log("[Migration] Step 9: Adding documentation comments...");
    await db.execute(sql`
      COMMENT ON COLUMN "documents"."version" IS 'Optimistic locking version number, incremented on each update'
    `);
    await db.execute(sql`
      COMMENT ON COLUMN "documents"."lastModifiedBy" IS 'User ID of last person who modified this document'
    `);
    await db.execute(sql`
      COMMENT ON TABLE "document_audit_log" IS 'Audit trail of all document changes for compliance and recovery'
    `);

    console.log("[Migration] ✅ Migration completed successfully!");

    // Verify the changes
    console.log("\n[Migration] Verifying changes...");
    const versionCheck = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'documents'
      AND column_name IN ('version', 'lastModifiedBy')
      ORDER BY column_name
    `);

    console.log("[Migration] Documents table columns:");
    console.log(versionCheck.rows);

    const auditTableCheck = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'document_audit_log'
    `);

    if (auditTableCheck.rows.length > 0) {
      console.log("[Migration] ✅ Audit log table created successfully");
    } else {
      console.log("[Migration] ⚠️ Audit log table not found");
    }
  } catch (error) {
    console.error("[Migration] ❌ Migration failed:", error);
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log("\n[Migration] Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n[Migration] Fatal error:", error);
    process.exit(1);
  });
