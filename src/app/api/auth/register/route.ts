import { NextResponse } from "next/server";
import { getUserByEmail, createUser } from "@/lib/auth";
import { initDatabase } from "@/lib/db-schema";

export async function POST(request: Request) {
  try {
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
