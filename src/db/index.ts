import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __pg: ReturnType<typeof postgres> | undefined;
}

// Lazy: don't throw at import time so `next build` can statically analyse
// pages that import this module even when DATABASE_URL isn't set in the
// build environment. The first actual query is what needs the connection.
function getClient() {
  if (globalThis.__pg) return globalThis.__pg;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = postgres(url, { max: 10, prepare: false });
  if (process.env.NODE_ENV !== "production") globalThis.__pg = client;
  return client;
}

export const db = drizzle(
  // Pass a thunk that resolves at first query time, not at import.
  new Proxy({} as ReturnType<typeof postgres>, {
    get(_target, prop) {
      const real = getClient();
      const value = (real as unknown as Record<string | symbol, unknown>)[prop as string];
      return typeof value === "function" ? (value as Function).bind(real) : value;
    },
  }),
  { schema },
);
export type DB = typeof db;
export { schema };
