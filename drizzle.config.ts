import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL!;
const [protocol, rest] = connectionString.split("://");
const [credentials, hostAndDb] = rest.split("@");
const [user, password] = credentials.split(":");
const [host, database] = hostAndDb.split("/");
const [hostname, port] = host.split(":");

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: hostname,
    port: parseInt(port),
    user,
    password,
    database,
  },
  verbose: true,
  strict: true,
} satisfies Config;
