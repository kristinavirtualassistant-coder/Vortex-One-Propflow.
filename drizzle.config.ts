import { defineConfig } from "drizzle-kit";
import "dotenv/config";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  throw new Error("DATABASE_URL must be set for Drizzle tooling.");
}
const databaseUrl = rawUrl.replace(/:\s+/, ':').replace(/\s+@/, '@');

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: false,
});
