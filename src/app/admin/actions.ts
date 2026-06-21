"use server";

import { revalidatePath } from "next/cache";
import { turso } from "@/lib/turso";
import { getSession } from "@/lib/actions";
import * as XLSX from "xlsx";
import * as cheerio from "cheerio";
import type { PipelineResult } from "@/types";
import type { InValue } from "@libsql/core/api";

export async function uploadStock(formData: FormData): Promise<PipelineResult> {
  try {
    console.log("⚡ [INICIO] Pipeline Atómico - Velocidad Nativa");

    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado. Debes iniciar sesión como administrador." };
    }

    const archivoStock = formData.get("stock") as File | null;
    const archivoImagenes = formData.get("imagenes") as File | null;
    const archivosDescuentos = formData.getAll("descuentos") as File[];

    if (!archivoStock || archivoStock.size === 0) {
      return { success: false, msg: "El archivo de stock global es obligatorio." };
    }

    const ALMACENES_VALIDOS = new Set(["JAL1", "JAL4", "T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10", "OUT"]);

    // 1. Parseo de Imágenes
    const dictImagenes: Record<string, string | null> = {};
    if (archivoImagenes && archivoImagenes.size > 0) {
      const htmlTexto = Buffer.from(await archivoImagenes.arrayBuffer()).toString("utf-8");
      const $ = cheerio.load(htmlTexto);
      $("table tr").each((_, fila) => {
        const codUniv = $(fila).find("td").eq(3).text().trim();
        const urlImg = $(fila).find("td").eq(2).find("img").attr("src") || null;
        if (codUniv && urlImg && urlImg.startsWith("https")) dictImagenes[codUniv] = urlImg;
      });
    }

    // 2. Parseo de Descuentos
    const dictDescuentos: Record<string, number> = {};
    for (const arc of archivosDescuentos) {
      if (arc && arc.size > 0) {
        const pct = Number(arc.name.match(/\d+/)?.[0] || 0);
        const wbDesc = XLSX.read(Buffer.from(await arc.arrayBuffer()), { type: "buffer" });
        const filasDesc = XLSX.utils.sheet_to_json(wbDesc.Sheets[wbDesc.SheetNames[0]]);
        for (const fDesc of filasDesc as any[]) {
          const codUniv = fDesc['COD. UNIVERSAL.']?.toString().trim();
          if (codUniv) dictDescuentos[codUniv] = pct;
        }
      }
    }

    // 3. Procesar inventario
    const workbook = XLSX.read(Buffer.from(await archivoStock.arrayBuffer()), { type: "buffer" });
    const filas = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const productosMap = new Map<string, { sql: string; args: InValue[] }>();
    const variantesParaInsertar: { sql: string; args: InValue[] }[] = [];

    const stockMap: Record<string, number> = {};
    let valorTotalInventario = 0;
    const conteoMarcas: Record<string, number> = {};
    const conteoDescuentos: Record<string, number> = { "10%": 0, "20%": 0, "30%": 0, "40%": 0, "50%": 0, "60%": 0, "70%": 0 };

    // Pre-conteo y filtrado estricto
    for (const fila of filas as any[]) {
      const codUniversal = fila['COD.UNIV.']?.toString().trim();
      const genero = fila['GENERO']?.toString().trim();
      const almacen = fila['IZQ']?.toString().trim();

      if (!codUniversal || !ALMACENES_VALIDOS.has(almacen)) continue;

      const key = `${codUniversal}-${genero}`;
      stockMap[key] = (stockMap[key] || 0) + 1;

      variantesParaInsertar.push({
        sql: `INSERT OR IGNORE INTO variantes VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          codUniversal, genero, almacen,
          fila['COD.PROD']?.toString() || "", fila['COD.BARRAS']?.toString().trim(),
          fila['TALLA']?.toString().trim() || "ÚNICA", Number(fila['COMPRA']) || 0,
        ],
      });
    }

    // Construcción de Productos Únicos
    for (const fila of filas as any[]) {
      const codUniversal = fila['COD.UNIV.']?.toString().trim();
      const genero = fila['GENERO']?.toString().trim();
      const almacen = fila['IZQ']?.toString().trim();

      if (!codUniversal || !ALMACENES_VALIDOS.has(almacen)) continue;

      const llaveProducto = `${codUniversal}-${genero}`;
      const descPorcentaje = dictDescuentos[codUniversal] || 0;
      const precioLista = Number(fila['LISTA']) || 0;
      const precioFinal = precioLista * (1 - descPorcentaje / 100);
      const stockCalculado = stockMap[llaveProducto] || 0;

      if (!productosMap.has(llaveProducto)) {
        productosMap.set(llaveProducto, {
          sql: `INSERT INTO productos VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            codUniversal, genero, fila['MARCA']?.toString().trim() || "SIN MARCA",
            fila['MODELO']?.toString().trim() || "SIN MODELO", fila['CATEGORIA']?.toString().trim() || "GENERAL",
            fila['GRUPO']?.toString().trim() || "VARIOS", fila['COLOR']?.toString().trim() || "VARIOS",
            precioLista, descPorcentaje, precioFinal, dictImagenes[codUniversal] || null, stockCalculado,
          ],
        });

        valorTotalInventario += (precioLista * stockCalculado);
        const m = fila['MARCA']?.toString().trim() || "SIN MARCA";
        conteoMarcas[m] = (conteoMarcas[m] || 0) + stockCalculado;
        if (conteoDescuentos[`${descPorcentaje}%`] !== undefined) {
          conteoDescuentos[`${descPorcentaje}%`] += stockCalculado;
        }
      }
    }

    console.log("🧹 Ejecutando esquema DDL limpio...");
    await turso.batch([
      "PRAGMA foreign_keys = OFF;",
      "DROP TABLE IF EXISTS variantes;",
      "DROP TABLE IF EXISTS productos;",
      "DROP TABLE IF EXISTS metadata;",
      "PRAGMA foreign_keys = ON;",
      `CREATE TABLE productos (
        cod_universal TEXT, genero TEXT, marca TEXT, modelo TEXT, categoria TEXT, grupo TEXT, color TEXT,
        precio_lista REAL, descuento REAL, precio_final REAL, imagen_url TEXT, stock_total INTEGER,
        PRIMARY KEY (cod_universal, genero)
      );`,
      `CREATE TABLE variantes (
        cod_universal TEXT, genero TEXT, almacen TEXT, cod_prod TEXT, cod_barras TEXT PRIMARY KEY, talla TEXT, precio_compra REAL,
        FOREIGN KEY (cod_universal, genero) REFERENCES productos(cod_universal, genero)
      );`,
      "CREATE TABLE metadata (clave TEXT PRIMARY KEY, valor TEXT);",
    ], "write");

    console.log(`📤 Enviando ${productosMap.size} productos...`);
    const opsProductos = Array.from(productosMap.values());
    for (let i = 0; i < opsProductos.length; i += 2000) {
      await turso.batch(opsProductos.slice(i, i + 2000), "write");
    }

    console.log(`📤 Enviando ${variantesParaInsertar.length} variantes...`);
    for (let i = 0; i < variantesParaInsertar.length; i += 2000) {
      await turso.batch(variantesParaInsertar.slice(i, i + 2000), "write");
    }

    console.log("⚡ Creando índices y guardando metadata...");
    await turso.batch([
      { sql: "CREATE INDEX idx_variantes_lookup ON variantes (cod_universal, genero);", args: [] as InValue[] },
      { sql: "INSERT INTO metadata VALUES (?, ?);", args: ["total_productos", productosMap.size.toString()] },
      { sql: "INSERT INTO metadata VALUES (?, ?);", args: ["total_variantes", variantesParaInsertar.length.toString()] },
      { sql: "INSERT INTO metadata VALUES (?, ?);", args: ["valor_inventario", valorTotalInventario.toFixed(0)] },
      { sql: "INSERT INTO metadata VALUES (?, ?);", args: ["ultima_sync", new Date().toLocaleString("es-PE")] },
      { sql: "INSERT INTO metadata VALUES (?, ?);", args: ["grafico_marcas", JSON.stringify(conteoMarcas)] },
      { sql: "INSERT INTO metadata VALUES (?, ?);", args: ["grafico_descuentos", JSON.stringify(conteoDescuentos)] },
    ], "write");

    await turso.execute(`
      UPDATE productos SET imagen_url = NULL
      WHERE imagen_url IS NOT NULL AND imagen_url NOT LIKE 'https://%'
    `);

    revalidatePath("/admin");
    revalidatePath("/client");

    return { success: true, msg: `🎉 Éxito. ${productosMap.size} artículos indexados a velocidad nativa.` };

  } catch (error: any) {
    console.error(error);
    return { success: false, msg: `❌ Fallo crítico: ${error.message}` };
  }
}

export async function limpiarImagenesRotas() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
    }

    await turso.execute(`
      UPDATE productos SET imagen_url = NULL
      WHERE imagen_url IS NOT NULL AND imagen_url NOT LIKE 'https://%'
    `);

    revalidatePath("/admin");
    revalidatePath("/client");
    return { success: true, msg: "Imágenes rotas limpiadas." };
  } catch (error: any) {
    return { success: false, msg: error.message };
  }
}

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

export async function buscarReposicion(codigos: string[]): Promise<{ success: boolean; items: ReposicionItem[]; msg: string }> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, items: [], msg: "No autorizado." };
    }

    if (codigos.length === 0) {
      return { success: false, items: [], msg: "No se enviaron códigos." };
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
      sql: `SELECT cod_universal, genero, marca, modelo, categoria, grupo, color, descuento, precio_lista, precio_final, stock_total
            FROM productos
            WHERE cod_universal IN (${uniqueCodigos.map(() => "?").join(",")})
            AND descuento > 0`,
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

    return { success: true, items, msg: `Se encontraron ${items.length} productos con descuento para reposición.` };
  } catch (error: any) {
    return { success: false, items: [], msg: `Error: ${error.message}` };
  }
}

export async function aplicarReposicion(codigos: string[]): Promise<PipelineResult> {
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
  } catch (error: any) {
    return { success: false, msg: `Error: ${error.message}` };
  }
}

export async function isReposicionActiva(): Promise<boolean> {
  try {
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
      sql: `SELECT cod_universal, genero, marca, modelo, categoria, grupo, color, descuento, precio_lista, precio_final, stock_total
            FROM productos
            WHERE cod_universal IN (${placeholders})`,
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

export async function publicarReposicion(): Promise<PipelineResult> {
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
  } catch (error: any) {
    return { success: false, msg: `Error: ${error.message}` };
  }
}

export async function detenerReposicion(): Promise<PipelineResult> {
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
  } catch (error: any) {
    return { success: false, msg: `Error: ${error.message}` };
  }
}
