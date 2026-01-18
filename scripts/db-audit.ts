
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env" });

async function main() {
    const sql = neon(process.env.DATABASE_URL!);

    console.log("Auditing database schema...");

    try {
        const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `;
        console.log("Existing tables:", tables.map(t => t.table_name).join(", "));

        for (const table of tables) {
            const columns = await sql`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = ${table.table_name}
            `;
            console.log(`Columns for ${table.table_name}:`, columns.map(c => c.column_name).join(", "));
        }
    } catch (error) {
        console.error("Audit failed:", error);
    }
}

main();
