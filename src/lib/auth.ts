import { cookies } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { db, schema } from "@/db";
import { newId } from "./utils";

const SESSION_COOKIE = "slipgate_session";
const SESSION_TTL_DAYS = 30;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 12);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return compare(plain, hashed);
}

export async function registerUser(email: string, password: string, name?: string) {
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) throw new Error("EMAIL_TAKEN");

  const userId = newId("usr");
  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx.insert(schema.users).values({ id: userId, email, passwordHash, name });
    await tx.insert(schema.wallets).values({ id: newId("wal"), userId, balanceSatang: 0 });
  });

  return userId;
}

export async function loginWithPassword(email: string, password: string) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return user;
}

export async function createSession(userId: string) {
  const id = newId("sess");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600_000);
  await db.insert(schema.sessions).values({ id, userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return id;
}

export async function destroySession() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sid));
  }
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const row = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sid), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return row[0] ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
