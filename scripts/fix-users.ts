
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";

config({ path: ".env" });

async function main() {
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);

    console.log("Starting user verification status update...");

    try {
        const result = await db.update(user)
            .set({ emailVerified: true })
            .execute();

        console.log("Successfully updated all existing users to verified status.");
    } catch (error) {
        console.error("Failed to update users:", error);
        process.exit(1);
    }
}

main();
