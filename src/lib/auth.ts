import { SignJWT, jwtVerify } from "jose";
import bcryptjs from "bcryptjs";
import { turso } from "./turso";

const SECRET = new TextEncoder().encode(
  process.env.BETTER_AUTH_SECRET || "default-secret-change-me"
);

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "client";
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

export async function getUserByEmail(email: string) {
  const result = await turso.execute({
    sql: "SELECT * FROM users WHERE email = ?",
    args: [email],
  });
  return result.rows[0] || null;
}

export async function createUser(
  email: string,
  password: string,
  name: string,
  role: "admin" | "client" = "client"
) {
  const id = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);
  await turso.execute({
    sql: "INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)",
    args: [id, email, hashedPassword, name, role],
  });
  return { id, email, name, role };
}

export async function authenticate(
  email: string,
  password: string
): Promise<{ user: SessionUser; token: string } | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const valid = await verifyPassword(password, user.password as string);
  if (!valid) return null;

  const sessionUser: SessionUser = {
    id: user.id as string,
    email: user.email as string,
    name: user.name as string,
    role: user.role as "admin" | "client",
  };

  const token = await createToken(sessionUser);
  return { user: sessionUser, token };
}

export async function getSessionFromRequest(
  request: Request
): Promise<SessionUser | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const tokenMatch = cookieHeader.match(/session-token=([^;]+)/);
  if (!tokenMatch) return null;
  return verifyToken(tokenMatch[1]);
}
