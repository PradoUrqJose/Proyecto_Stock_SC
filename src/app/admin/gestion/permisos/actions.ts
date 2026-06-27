"use server";

import { revalidatePath } from "next/cache";
import { turso } from "@/lib/turso";
import { getSession } from "@/lib/actions";
import { initDatabase } from "@/lib/db-schema";
import type { Module, User, ActionResult } from "@/types";

async function requireGeneralAdmin() {
  await initDatabase();
  const session = await getSession();
  if (!session || session.role !== "administrador_general") {
    throw new Error("No autorizado.");
  }
  return session;
}

export async function getAllModules(): Promise<Module[]> {
  await requireGeneralAdmin();
  const result = await turso.execute(
    "SELECT id, nombre, ruta, descripcion FROM modules ORDER BY id"
  );
  return result.rows.map((r) => ({
    id: r.id as string,
    nombre: r.nombre as string,
    ruta: r.ruta as string,
    descripcion: (r.descripcion as string) ?? null,
  }));
}

export async function getAdminUsersWithModules(): Promise<(User & { modules: string[] })[]> {
  await requireGeneralAdmin();
  const usersResult = await turso.execute(
    "SELECT id, name, username, email, role, tienda_id, created_at FROM users WHERE role = 'admin' ORDER BY name"
  );
  const modulesResult = await turso.execute(
    "SELECT user_id, module_id FROM admin_modules"
  );

  const modulesByUser = new Map<string, string[]>();
  for (const r of modulesResult.rows) {
    const uid = r.user_id as string;
    if (!modulesByUser.has(uid)) modulesByUser.set(uid, []);
    modulesByUser.get(uid)!.push(r.module_id as string);
  }

  return usersResult.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    username: r.username as string,
    email: r.email as string,
    role: "admin" as const,
    tienda_id: (r.tienda_id as string) ?? null,
    tienda_nombre: null,
    created_at: r.created_at as string,
    modules: modulesByUser.get(r.id as string) ?? [],
  }));
}

export async function updateAdminModules(
  userId: string,
  moduleIds: string[]
): Promise<ActionResult> {
  try {
    await requireGeneralAdmin();

    const userCheck = await turso.execute({
      sql: "SELECT id FROM users WHERE id = ? AND role = 'admin'",
      args: [userId],
    });
    if (userCheck.rows.length === 0) {
      return { success: false, msg: "Usuario no encontrado o no es admin." };
    }

    await turso.execute({
      sql: "DELETE FROM admin_modules WHERE user_id = ?",
      args: [userId],
    });

    if (moduleIds.length > 0) {
      await turso.batch(
        moduleIds.map((mid) => ({
          sql: "INSERT OR IGNORE INTO admin_modules (user_id, module_id) VALUES (?, ?)",
          args: [userId, mid],
        })),
        "write"
      );
    }

    revalidatePath("/admin/gestion/permisos");
    return { success: true, msg: "Permisos actualizados. El usuario debe reiniciar sesión para que los cambios tomen efecto." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}
