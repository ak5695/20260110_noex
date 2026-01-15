import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    emailAndPassword: {
        enabled: true
    },
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    if (user.email !== "ji569514123@gmail.com") {
                        return false; // Cancel operation
                    }
                    return { data: user };
                },
            },
        },
        session: {
            create: {
                before: async (session) => {
                    const user = await db.query.user.findFirst({
                        where: (table, { eq }) => eq(table.id, session.userId),
                    });
                    if (user?.email !== "ji569514123@gmail.com") {
                        return false;
                    }
                    return { data: session };
                },
            },
        },
    },
});
