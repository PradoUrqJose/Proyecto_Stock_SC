import { NextResponse } from "next/server";
import { getUserByEmail, createUser } from "@/lib/auth";
import { initDatabase } from "@/lib/db-schema";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0] || "unknown";

    if (!checkRateLimit(`register:${ip}`, 3, 60000)) {
      return NextResponse.json(
        { error: "Demasiados registros. Intenta de nuevo en 1 minuto." },
        { status: 429 }
      );
    }

    await initDatabase();

    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Nombre, email y contrasena son requeridos" },
        { status: 400 }
      );
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "Este correo ya esta registrado" },
        { status: 409 }
      );
    }

    const user = await createUser(email, password, name, "client");

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
