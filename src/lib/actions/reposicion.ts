"use server";

import { revalidatePath } from "next/cache";
import { turso } from "@/lib/turso";
import { getSession } from "@/lib/actions";
import type { ActionResult } from "@/types";
import type { InValue } from "@libsql/core/api";

export interface ReposicionItem {
  cod_universal: string;
  genero: string;
  marca: string;
  modelo: string;
  categoria: string;
  grupo: string;
  color: string;
  descuento: number;
  precio_lista: number;
  precio_final: number;
  stock_total: number;
}

export async function buscarReposicion(codigos: string[]): Promise<ActionResult<ReposicionItem[]>> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, data: [], msg: "No autorizado." };
    }

    if (codigos.length === 0) {
      return { success: false, data: [], msg: "No se enviaron códigos." };
    }

    const uniqueCodigos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];

    await turso.batch([
      "DROP TABLE IF EXISTS remove_discount;",
      `CREATE TABLE remove_discount (
        cod_universal TEXT PRIMARY KEY,
        fecha TEXT
      );`,
      {
        sql: "INSERT OR REPLACE INTO metadata VALUES (?, ?);",
        args: ["reposicion_activa", "false"],
      },
    ], "write");

    const result = await turso.execute({
      sql: `SELECT p.cod_universal, p.genero, p.marca, p.modelo, p.categoria, 
                   p.grupo, p.color, p.descuento, p.precio_lista, p.precio_final, 
                   p.stock_total,
                   COALESCE(pi.imagen_url, p.imagen_url) as imagen_url
            FROM productos p
            LEFT JOIN producto_imagenes pi ON p.cod_universal = pi.cod_universal
            WHERE p.cod_universal IN (${uniqueCodigos.map(() => "?").join(",")})
            AND p.descuento > 0`,
      args: uniqueCodigos,
    });

    const items: ReposicionItem[] = result.rows.map((row) => ({
      cod_universal: row.cod_universal as string,
      genero: row.genero as string,
      marca: row.marca as string,
      modelo: row.modelo as string,
      categoria: row.categoria as string,
      grupo: row.grupo as string,
      color: row.color as string,
      descuento: row.descuento as number,
      precio_lista: row.precio_lista as number,
      precio_final: row.precio_final as number,
      stock_total: row.stock_total as number,
    }));

    if (items.length > 0) {
      const fecha = new Date().toLocaleString("es-PE");
      const inserts = items.map((item) => ({
        sql: "INSERT OR IGNORE INTO remove_discount VALUES (?, ?);",
        args: [item.cod_universal, fecha] as InValue[],
      }));
      for (let i = 0; i < inserts.length; i += 2000) {
        await turso.batch(inserts.slice(i, i + 2000), "write");
      }
    }

    return { success: true, data: items, msg: `Se encontraron ${items.length} productos con descuento para reposición.` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, data: [], msg };
  }
}

export async function aplicarReposicion(codigos: string[]): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
    }

    const uniqueCodigos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];

    const updates = uniqueCodigos.map((cod) => ({
      sql: `UPDATE productos SET descuento = 0, precio_final = precio_lista WHERE cod_universal = ?`,
      args: [cod] as InValue[],
    }));

    for (let i = 0; i < updates.length; i += 2000) {
      await turso.batch(updates.slice(i, i + 2000), "write");
    }

    revalidatePath("/admin");
    revalidatePath("/admin/reposicion");
    revalidatePath("/client");

    return { success: true, msg: `Se retiraron descuentos de ${uniqueCodigos.length} productos.` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}

export async function isReposicionActiva(): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session) return false;

    const result = await turso.execute({
      sql: "SELECT valor FROM metadata WHERE clave = ?",
      args: ["reposicion_activa"],
    });
    return result.rows[0]?.valor === "true";
  } catch {
    return false;
  }
}

export async function obtenerReposicionActual(): Promise<ReposicionItem[]> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") return [];

    const codigosResult = await turso.execute("SELECT cod_universal FROM remove_discount");
    const codigos = codigosResult.rows.map((r) => r.cod_universal as string);

    if (codigos.length === 0) return [];

    const placeholders = codigos.map(() => "?").join(",");
    const result = await turso.execute({
      sql: `SELECT p.cod_universal, p.genero, p.marca, p.modelo, p.categoria, 
                   p.grupo, p.color, p.descuento, p.precio_lista, p.precio_final, 
                   p.stock_total,
                   COALESCE(pi.imagen_url, p.imagen_url) as imagen_url
            FROM productos p
            LEFT JOIN producto_imagenes pi ON p.cod_universal = pi.cod_universal
            WHERE p.cod_universal IN (${placeholders})`,
      args: codigos,
    });

    return result.rows.map((row) => ({
      cod_universal: row.cod_universal as string,
      genero: row.genero as string,
      marca: row.marca as string,
      modelo: row.modelo as string,
      categoria: row.categoria as string,
      grupo: row.grupo as string,
      color: row.color as string,
      descuento: row.descuento as number,
      precio_lista: row.precio_lista as number,
      precio_final: row.precio_final as number,
      stock_total: row.stock_total as number,
    }));
  } catch {
    return [];
  }
}

export async function publicarReposicion(): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
    }

    const countResult = await turso.execute("SELECT COUNT(*) as total FROM remove_discount");
    const total = countResult.rows[0]?.total as number ?? 0;

    if (total === 0) {
      return { success: false, msg: "No hay productos para publicar." };
    }

    await turso.execute({
      sql: "INSERT OR REPLACE INTO metadata VALUES (?, ?);",
      args: ["reposicion_activa", "true"],
    });

    revalidatePath("/admin/reposicion");
    revalidatePath("/client/reposicion");

    return { success: true, msg: `Publicado. ${total} productos visibles en cliente.` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}

export async function detenerReposicion(): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
    }

    await turso.execute({
      sql: "INSERT OR REPLACE INTO metadata VALUES (?, ?);",
      args: ["reposicion_activa", "false"],
    });

    revalidatePath("/admin/reposicion");
    revalidatePath("/client/reposicion");

    return { success: true, msg: "Reposición detenida. Ya no es visible en cliente." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}
