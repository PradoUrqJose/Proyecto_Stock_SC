import { NextResponse } from "next/server";

// El registro público está deshabilitado.
// Los usuarios son creados únicamente por el administrador desde /admin/gestion/usuarios.
export async function POST() {
  return NextResponse.json(
    { error: "El registro público no está disponible. Contacta al administrador." },
    { status: 403 }
  );
}
