"use server";

import { cookies } from "next/headers";

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("session-token");
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session-token")?.value;
  if (!token) return null;

  const { verifyToken } = await import("@/lib/auth");
  return verifyToken(token);
}
