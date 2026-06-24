import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { initDatabase } from "@/lib/db-schema";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0] || "unknown";

    if (!checkRateLimit(`login:${ip}`, 5, 60000)) {
      return NextResponse.json(
        { error: "Demasiados intentos. Intenta de nuevo en 1 minuto." },
        { status: 429 }
      );
    }

    await initDatabase();

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son requeridos" },
        { status: 400 }
      );
    }

    const result = await authenticate(username, password);

    if (!result) {
      return NextResponse.json(
        { error: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ user: result.user });
    response.cookies.set("session-token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
