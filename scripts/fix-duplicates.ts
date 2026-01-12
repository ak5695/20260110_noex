/**
 * Fix duplicate semantic_nodes
 *
 * This script removes duplicate entries in semantic_nodes table,
 * keeping only the most recent entry for each (userId, title, type) combination.
 *
 * Usage: npx tsx scripts/fix-duplicates.ts
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env" });

const sql = neon(process.env.DATABASE_URL!);

async function fixDuplicates() {
  console.log("🔍 Checking for duplicate semantic_nodes...\n");

  try {
    // Step 1: Find duplicates
    const duplicates = await sql`
      SELECT "userId", title, type, COUNT(*) as count
      FROM semantic_nodes
      GROUP BY "userId", title, type
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      console.log("✅ No duplicates found! You're good to go.\n");
      console.log("Now you can run: npx drizzle-kit push");
      return;
    }

    console.log(`⚠️  Found ${duplicates.length} duplicate groups:\n`);
    duplicates.forEach((dup: any) => {
      console.log(`  - User: ${dup.userId.substring(0, 10)}..., Title: "${dup.title}", Type: ${dup.type}, Count: ${dup.count}`);
    });

    console.log("\n🗑️  Removing duplicates (keeping most recent)...\n");

    // Step 2: Delete duplicates, keeping the most recent
    const result = await sql`
      WITH duplicates AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "userId", title, type
            ORDER BY "createdAt" DESC
          ) as rn
        FROM semantic_nodes
      )
      DELETE FROM semantic_nodes
      WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
      )
    `;

    console.log(`✅ Successfully removed duplicate entries!\n`);

    // Step 3: Verify
    const remaining = await sql`
      SELECT "userId", title, type, COUNT(*) as count
      FROM semantic_nodes
      GROUP BY "userId", title, type
      HAVING COUNT(*) > 1
    `;

    if (remaining.length === 0) {
      console.log("✅ Verification passed! No duplicates remain.\n");
      console.log("📦 Now run the migration:");
      console.log("   npx drizzle-kit push\n");
    } else {
      console.log("⚠️  Some duplicates still remain. Please check manually.");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixDuplicates();
