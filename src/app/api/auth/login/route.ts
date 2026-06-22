import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { initDatabase } from "@/lib/db-schema";

export async function POST(request: Request) {
  try {
    await initDatabase();

    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contrasena son requeridos" },
        { status: 400 }
      );
    }

    const result = await authenticate(email, password);

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
