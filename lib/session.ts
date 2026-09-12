import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const PLAYER_COOKIE = "goose_duck_player";
const ADMIN_COOKIE = "goose_duck_admin";

function secret(): string {
  return process.env.SESSION_SECRET || "local-mvp-only-change-before-real-use";
}

function signature(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setPlayerSession(playerId: number): Promise<void> {
  const jar = await cookies();
  const raw = String(playerId);
  jar.set(PLAYER_COOKIE, `${raw}.${signature(raw)}`, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
}

export async function getPlayerSession(): Promise<number | null> {
  const jar = await cookies();
  const value = jar.get(PLAYER_COOKIE)?.value;
  if (!value) return null;
  const [raw, sig] = value.split(".");
  if (!raw || !sig || !safeEqual(sig, signature(raw))) return null;
  const playerId = Number(raw);
  return Number.isInteger(playerId) && playerId > 0 ? playerId : null;
}

export async function clearPlayerSession(): Promise<void> {
  (await cookies()).delete(PLAYER_COOKIE);
}

export async function setAdminSession(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, signature("admin"), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(value && safeEqual(value, signature("admin")));
}

export function verifyAdminPin(pin: string): boolean {
  const expected = process.env.ADMIN_PIN || "2468";
  return safeEqual(pin, expected);
}
