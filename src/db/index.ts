import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __pg: ReturnType<typeof postgres> | undefined;
}

// postgres-js is lazy by default — it only opens a TCP connection on the
// first query — so a fallback URL keeps `next build` happy when the build
// environment doesn't set DATABASE_URL.
const connectionString =
  process.env.DATABASE_URL ?? "postgres://build:build@127.0.0.1:5432/build";

const client = globalThis.__pg ?? postgres(connectionString, { max: 10, prepare: false });
if (process.env.NODE_ENV !== "production") globalThis.__pg = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export { schema };
