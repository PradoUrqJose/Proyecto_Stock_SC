"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { turso } from "@/lib/turso";
import { getSession } from "@/lib/actions";
import { hashPassword } from "@/lib/auth";
import { initDatabase } from "@/lib/db-schema";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Tienda, User } from "@/types";
import type { ActionResult } from "@/types";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function requireAdmin() {
  await initDatabase();
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("No autorizado.");
  }
  return session;
}

// ─────────────────────────────────────────────
// TIENDAS
// ─────────────────────────────────────────────

export async function getTiendas(): Promise<Tienda[]> {
  await requireAdmin();
  const result = await turso.execute(
    "SELECT id, nombre, created_at FROM tiendas ORDER BY nombre"
  );
  return result.rows.map((r) => ({
    id: r.id as string,
    nombre: r.nombre as string,
    created_at: r.created_at as string,
  }));
}

export async function createTienda(nombre: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`createTienda:${ip}`, 5, 60000)) {
      return { success: false, msg: "Demasiadas solicitudes. Intenta de nuevo en 1 minuto." };
    }
    const trimmed = nombre.trim().toUpperCase();
    if (!trimmed) return { success: false, msg: "El nombre es requerido." };

    const existing = await turso.execute({
      sql: "SELECT id FROM tiendas WHERE nombre = ?",
      args: [trimmed],
    });
    if (existing.rows.length > 0) {
      return { success: false, msg: "Ya existe una tienda con ese nombre." };
    }

    const id = crypto.randomUUID();
    await turso.execute({
      sql: "INSERT INTO tiendas (id, nombre) VALUES (?, ?)",
      args: [id, trimmed],
    });

    revalidatePath("/admin/gestion/tiendas");
    return { success: true, msg: `Tienda "${trimmed}" creada.` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}

export async function updateTienda(
  id: string,
  nombre: string
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`updateTienda:${ip}`, 10, 60000)) {
      return { success: false, msg: "Demasiadas solicitudes. Intenta de nuevo en 1 minuto." };
    }
    const trimmed = nombre.trim().toUpperCase();
    if (!trimmed) return { success: false, msg: "El nombre es requerido." };

    const conflict = await turso.execute({
      sql: "SELECT id FROM tiendas WHERE nombre = ? AND id != ?",
      args: [trimmed, id],
    });
    if (conflict.rows.length > 0) {
      return { success: false, msg: "Ya existe otra tienda con ese nombre." };
    }

    await turso.execute({
      sql: "UPDATE tiendas SET nombre = ? WHERE id = ?",
      args: [trimmed, id],
    });

    revalidatePath("/admin/gestion/tiendas");
    revalidatePath("/admin/gestion/usuarios");
    return { success: true, msg: `Tienda renombrada a "${trimmed}".` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}

export async function deleteTienda(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    // Desvincular usuarios antes de borrar
    await turso.execute({
      sql: "UPDATE users SET tienda_id = NULL WHERE tienda_id = ?",
      args: [id],
    });

    await turso.execute({
      sql: "DELETE FROM tiendas WHERE id = ?",
      args: [id],
    });

    revalidatePath("/admin/gestion/tiendas");
    revalidatePath("/admin/gestion/usuarios");
    return { success: true, msg: "Tienda eliminada." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}

/** Devuelve los nombres de almacén únicos que existen en variantes,
 *  para que el admin los use al crear tiendas que coincidan con la BD. */
export async function getAlmacenesDisponibles(): Promise<string[]> {
  await requireAdmin();
  const result = await turso.execute(
    "SELECT DISTINCT alm_izq FROM variantes ORDER BY alm_izq"
  );
  return result.rows.map((r) => r.alm_izq as string);
}

// ─────────────────────────────────────────────
// USUARIOS
// ─────────────────────────────────────────────

export async function getUsuarios(): Promise<User[]> {
  await requireAdmin();
  const result = await turso.execute(`
    SELECT u.id, u.email, u.username, u.name, u.role, u.tienda_id, u.created_at,
           t.nombre as tienda_nombre
    FROM users u
    LEFT JOIN tiendas t ON u.tienda_id = t.id
    ORDER BY u.created_at DESC
  `);
  return result.rows.map((r) => ({
    id: r.id as string,
    email: r.email as string,
    username: r.username as string,
    name: r.name as string,
    role: r.role as "admin" | "client",
    tienda_id: (r.tienda_id as string) ?? null,
    tienda_nombre: (r.tienda_nombre as string) ?? null,
    created_at: r.created_at as string,
  }));
}

export async function createUsuario(data: {
  name: string;
  email: string;
  username: string;
  password: string;
  role: "admin" | "client";
  tienda_id: string | null;
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`createUsuario:${ip}`, 5, 60000)) {
      return { success: false, msg: "Demasiadas solicitudes. Intenta de nuevo en 1 minuto." };
    }

    if (!data.name.trim() || !data.email.trim() || !data.username.trim() || !data.password) {
      return { success: false, msg: "Nombre, email, usuario y contraseña son requeridos." };
    }
    if (data.password.length < 6) {
      return { success: false, msg: "La contraseña debe tener al menos 6 caracteres." };
    }

    const existingEmail = await turso.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [data.email.trim().toLowerCase()],
    });
    if (existingEmail.rows.length > 0) {
      return { success: false, msg: "Ya existe un usuario con ese correo." };
    }

    const existingUsername = await turso.execute({
      sql: "SELECT id FROM users WHERE username = ?",
      args: [data.username.trim().toLowerCase()],
    });
    if (existingUsername.rows.length > 0) {
      return { success: false, msg: "Ya existe un usuario con ese nombre de usuario." };
    }

    const id = crypto.randomUUID();
    const hashed = await hashPassword(data.password);

    await turso.execute({
      sql: "INSERT INTO users (id, email, username, password, name, role, tienda_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [
        id,
        data.email.trim().toLowerCase(),
        data.username.trim().toLowerCase(),
        hashed,
        data.name.trim(),
        data.role,
        data.tienda_id ?? null,
      ],
    });

    revalidatePath("/admin/gestion/usuarios");
    return { success: true, msg: `Usuario "${data.name.trim()}" creado.` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}

export async function updateUsuario(
  id: string,
  data: {
    name: string;
    email: string;
    username: string;
    role: "admin" | "client";
    tienda_id: string | null;
    password?: string;
  }
): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`updateUsuario:${ip}`, 10, 60000)) {
      return { success: false, msg: "Demasiadas solicitudes. Intenta de nuevo en 1 minuto." };
    }

    if (!data.name.trim() || !data.email.trim() || !data.username.trim()) {
      return { success: false, msg: "Nombre, email y usuario son requeridos." };
    }

    const conflictEmail = await turso.execute({
      sql: "SELECT id FROM users WHERE email = ? AND id != ?",
      args: [data.email.trim().toLowerCase(), id],
    });
    if (conflictEmail.rows.length > 0) {
      return { success: false, msg: "Ya existe otro usuario con ese correo." };
    }

    const conflictUsername = await turso.execute({
      sql: "SELECT id FROM users WHERE username = ? AND id != ?",
      args: [data.username.trim().toLowerCase(), id],
    });
    if (conflictUsername.rows.length > 0) {
      return { success: false, msg: "Ya existe otro usuario con ese nombre de usuario." };
    }

    // No permitir que un admin se quite el rol de admin a sí mismo
    if (session.id === id && data.role !== "admin") {
      return { success: false, msg: "No puedes cambiar tu propio rol de administrador." };
    }

    if (data.password && data.password.length > 0) {
      if (data.password.length < 6) {
        return { success: false, msg: "La contraseña debe tener al menos 6 caracteres." };
      }
      const hashed = await hashPassword(data.password);
      await turso.execute({
        sql: "UPDATE users SET name = ?, email = ?, username = ?, role = ?, tienda_id = ?, password = ? WHERE id = ?",
        args: [data.name.trim(), data.email.trim().toLowerCase(), data.username.trim().toLowerCase(), data.role, data.tienda_id ?? null, hashed, id],
      });
    } else {
      await turso.execute({
        sql: "UPDATE users SET name = ?, email = ?, username = ?, role = ?, tienda_id = ? WHERE id = ?",
        args: [data.name.trim(), data.email.trim().toLowerCase(), data.username.trim().toLowerCase(), data.role, data.tienda_id ?? null, id],
      });
    }

    revalidatePath("/admin/gestion/usuarios");
    return { success: true, msg: "Usuario actualizado." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}

export async function deleteUsuario(id: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin();

    if (session.id === id) {
      return { success: false, msg: "No puedes eliminar tu propia cuenta." };
    }

    await turso.execute({
      sql: "DELETE FROM users WHERE id = ?",
      args: [id],
    });

    revalidatePath("/admin/gestion/usuarios");
    return { success: true, msg: "Usuario eliminado." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}
