"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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

export async function requireModule(moduleId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role === "administrador_general") return session;

  if (session.role === "admin" && session.modules?.includes(moduleId)) return session;

  redirect("/admin");
}
