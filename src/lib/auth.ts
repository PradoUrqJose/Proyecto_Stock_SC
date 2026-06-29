import { SignJWT, jwtVerify } from "jose";
import bcryptjs from "bcryptjs";
import { turso } from "./turso";

const SECRET = new TextEncoder().encode(
  process.env.BETTER_AUTH_SECRET
);

if (!SECRET || SECRET.length === 0) {
  throw new Error("BETTER_AUTH_SECRET is required. Set it in .env.local");
}

import type { UserRole } from "@/types";

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  name: string;
  role: UserRole;
  tienda_id: string | null;
  tienda_nombre: string | null;
  modules?: string[];
}

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcryptjs.compare(password, hashedPassword);
}

export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET);
}

export async function verifyToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getUserByUsername(username: string) {
  const result = await turso.execute({
    sql: "SELECT * FROM users WHERE username = ?",
    args: [username],
  });
  return result.rows[0] || null;
}

export async function createUser(
  email: string,
  username: string,
  password: string,
  name: string,
  role: UserRole = "client",
  tienda_id: string | null = null
) {
  const id = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);
  await turso.execute({
    sql: "INSERT INTO users (id, email, username, password, name, role, tienda_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [id, email, username, hashedPassword, name, role, tienda_id],
  });
  return { id, email, username, name, role, tienda_id };
}

export async function authenticate(
  username: string,
  password: string
): Promise<{ user: SessionUser; token: string } | null> {
  const user = await getUserByUsername(username);
  if (!user) return null;

  const valid = await verifyPassword(password, user.password as string);
  if (!valid) return null;

  // Resolve tienda nombre if tienda_id is set
  let tienda_nombre: string | null = null;
  if (user.tienda_id) {
    const tiendaResult = await turso.execute({
      sql: "SELECT nombre FROM tiendas WHERE id = ?",
      args: [user.tienda_id as string],
    });
    tienda_nombre = (tiendaResult.rows[0]?.nombre as string) ?? null;
  }

  const role = user.role as UserRole;

  // Para admin, cargar los módulos asignados desde la DB
  let modules: string[] | undefined;
  if (role === "admin") {
    const modulesResult = await turso.execute({
      sql: "SELECT module_id FROM admin_modules WHERE user_id = ? ORDER BY module_id",
      args: [user.id as string],
    });
    modules = modulesResult.rows.map((r) => r.module_id as string);
  }

  const sessionUser: SessionUser = {
    id: user.id as string,
    email: user.email as string,
    username: user.username as string,
    name: user.name as string,
    role,
    tienda_id: (user.tienda_id as string) ?? null,
    tienda_nombre,
    modules,
  };

  const token = await createToken(sessionUser);
  return { user: sessionUser, token };
}

export function isAdminRole(role: string): boolean {
  return role === "admin" || role === "administrador_general";
}

export async function getSessionFromRequest(
  request: Request
): Promise<SessionUser | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const tokenMatch = cookieHeader.match(/session-token=([^;]+)/);
  if (!tokenMatch) return null;
  return verifyToken(tokenMatch[1]);
}
