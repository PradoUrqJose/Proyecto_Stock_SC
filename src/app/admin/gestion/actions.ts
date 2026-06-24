"use server";

import { revalidatePath } from "next/cache";
import { turso } from "@/lib/turso";
import { getSession } from "@/lib/actions";
import { hashPassword } from "@/lib/auth";
import { initDatabase } from "@/lib/db-schema";
import type { Tienda, User } from "@/types";
import type { PipelineResult } from "@/types";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function requireAdmin() {
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

export async function createTienda(nombre: string): Promise<PipelineResult> {
  try {
    await requireAdmin();
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
): Promise<PipelineResult> {
  try {
    await requireAdmin();
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

export async function deleteTienda(id: string): Promise<PipelineResult> {
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
  await initDatabase(); // aplica migraciones pendientes (ej: columna tienda_id)
  const result = await turso.execute(`
    SELECT u.id, u.email, u.name, u.role, u.tienda_id, u.created_at,
           t.nombre as tienda_nombre
    FROM users u
    LEFT JOIN tiendas t ON u.tienda_id = t.id
    ORDER BY u.created_at DESC
  `);
  return result.rows.map((r) => ({
    id: r.id as string,
    email: r.email as string,
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
  password: string;
  role: "admin" | "client";
  tienda_id: string | null;
}): Promise<PipelineResult> {
  try {
    await requireAdmin();

    if (!data.name.trim() || !data.email.trim() || !data.password) {
      return { success: false, msg: "Nombre, email y contraseña son requeridos." };
    }
    if (data.password.length < 6) {
      return { success: false, msg: "La contraseña debe tener al menos 6 caracteres." };
    }

    const existing = await turso.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [data.email.trim().toLowerCase()],
    });
    if (existing.rows.length > 0) {
      return { success: false, msg: "Ya existe un usuario con ese correo." };
    }

    const id = crypto.randomUUID();
    const hashed = await hashPassword(data.password);

    await turso.execute({
      sql: "INSERT INTO users (id, email, password, name, role, tienda_id) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        id,
        data.email.trim().toLowerCase(),
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
    role: "admin" | "client";
    tienda_id: string | null;
    password?: string;
  }
): Promise<PipelineResult> {
  try {
    const session = await requireAdmin();

    if (!data.name.trim() || !data.email.trim()) {
      return { success: false, msg: "Nombre y email son requeridos." };
    }

    const conflict = await turso.execute({
      sql: "SELECT id FROM users WHERE email = ? AND id != ?",
      args: [data.email.trim().toLowerCase(), id],
    });
    if (conflict.rows.length > 0) {
      return { success: false, msg: "Ya existe otro usuario con ese correo." };
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
        sql: "UPDATE users SET name = ?, email = ?, role = ?, tienda_id = ?, password = ? WHERE id = ?",
        args: [data.name.trim(), data.email.trim().toLowerCase(), data.role, data.tienda_id ?? null, hashed, id],
      });
    } else {
      await turso.execute({
        sql: "UPDATE users SET name = ?, email = ?, role = ?, tienda_id = ? WHERE id = ?",
        args: [data.name.trim(), data.email.trim().toLowerCase(), data.role, data.tienda_id ?? null, id],
      });
    }

    revalidatePath("/admin/gestion/usuarios");
    return { success: true, msg: "Usuario actualizado." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}

export async function deleteUsuario(id: string): Promise<PipelineResult> {
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
