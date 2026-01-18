
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env" });

async function main() {
    const sql = neon(process.env.DATABASE_URL!);

    console.log("Starting surgical auth table reset and record cleanup...");

    try {
        // Drop tables in reverse order of dependencies
        // Added CASCADE to ensure thorough cleanup
        await sql`DROP TABLE IF EXISTS "session" CASCADE`;
        await sql`DROP TABLE IF EXISTS "account" CASCADE`;
        await sql`DROP TABLE IF EXISTS "verification" CASCADE`;
        await sql`DROP TABLE IF EXISTS "user" CASCADE`;
        // Also drop the drizzle migrations table to reset the history
        await sql`DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE`;

        // Cleanup orphaned records that might block push/constraints in other tables
        console.log("Cleaning up orphaned records in supplemental tables...");
        try {
            await sql`DELETE FROM "binding_existence_cache" WHERE "binding_id" NOT IN (SELECT "id" FROM "document_canvas_bindings")`;
        } catch (e) {
            console.log("Note: binding_existence_cache cleanup skipped or failed (might not exist yet).");
        }

        console.log("Auth tables, migration history, and orphaned records successfully purged.");
    } catch (error) {
        console.error("Failed to reset database:", error);
        process.exit(1);
    }
}

main();
