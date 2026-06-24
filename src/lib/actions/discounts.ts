"use server";

import { revalidatePath } from "next/cache";
import { turso } from "@/lib/turso";
import { getSession } from "@/lib/actions";
import type { PipelineResult } from "@/types";
import type { InValue } from "@libsql/core/api";

interface DescuentoUpdate {
  cod_universal: string;
  genero: string;
  bf_descuento: number;
  af_descuento: number;
}

export async function guardarDescuentos(
  updates: DescuentoUpdate[]
): Promise<PipelineResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
    }

    if (updates.length === 0) {
      return { success: false, msg: "No hay descuentos para guardar." };
    }

    const fecha = new Date().toLocaleString("es-PE");

    await turso.execute(`CREATE TABLE IF NOT EXISTS descuento_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cod_universal TEXT NOT NULL,
      genero TEXT NOT NULL,
      bf_descuento REAL NOT NULL,
      af_descuento REAL NOT NULL,
      just_updated TEXT NOT NULL
    )`);

    const updateOps = updates.map((u) => ({
      sql: `UPDATE productos 
            SET descuento = ?, precio_final = precio_lista * (1 - ? / 100.0) 
            WHERE cod_universal = ? AND genero = ?`,
      args: [u.af_descuento, u.af_descuento, u.cod_universal, u.genero] as InValue[],
    }));

    for (let i = 0; i < updateOps.length; i += 2000) {
      await turso.batch(updateOps.slice(i, i + 2000), "write");
    }

    const auditOps = updates.map((u) => ({
      sql: `DELETE FROM descuento_updates WHERE cod_universal = ? AND genero = ?`,
      args: [u.cod_universal, u.genero] as InValue[],
    }));
    for (let i = 0; i < auditOps.length; i += 2000) {
      await turso.batch(auditOps.slice(i, i + 2000), "write");
    }

    const auditInserts = updates.map((u) => ({
      sql: `INSERT INTO descuento_updates (cod_universal, genero, bf_descuento, af_descuento, just_updated)
            VALUES (?, ?, ?, ?, ?)`,
      args: [u.cod_universal, u.genero, u.bf_descuento, u.af_descuento, fecha] as InValue[],
    }));

    for (let i = 0; i < auditInserts.length; i += 2000) {
      await turso.batch(auditInserts.slice(i, i + 2000), "write");
    }

    await turso.execute({
      sql: "INSERT OR REPLACE INTO metadata VALUES (?, ?)",
      args: ["actualizacion_activa", "true"],
    });

    revalidatePath("/admin/actualizacion");
    revalidatePath("/admin/productos");
    revalidatePath("/client");
    revalidatePath("/client/actualizacion");

    return { success: true, msg: `${updates.length} descuentos actualizados.` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}
