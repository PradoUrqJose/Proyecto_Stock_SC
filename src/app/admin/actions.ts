"use server";

import { revalidatePath } from "next/cache";
import { turso } from "@/lib/turso";
import { getSession } from "@/lib/actions";
import * as XLSX from "xlsx";
import * as cheerio from "cheerio";
import type { PipelineResult, Producto, Variante } from "@/types";
import type { InValue } from "@libsql/core/api";

export async function uploadStock(formData: FormData): Promise<PipelineResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
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
      const alm_izq = fila['IZQ']?.toString().trim();
      const alm_der = fila['DER']?.toString().trim() || null;

      if (!codUniversal || !ALMACENES_VALIDOS.has(alm_izq)) continue;

      const key = `${codUniversal}-${genero}`;
      stockMap[key] = (stockMap[key] || 0) + 1;

      variantesParaInsertar.push({
        sql: `INSERT OR IGNORE INTO variantes VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          codUniversal, genero, alm_izq, alm_der,
          fila['COD.PROD']?.toString() || "", fila['COD.BARRAS']?.toString().trim(),
          fila['TALLA']?.toString().trim() || "ÚNICA", Number(fila['COMPRA']) || 0,
        ],
      });
    }

    // Construcción de Productos Únicos
    for (const fila of filas as any[]) {
      const codUniversal = fila['COD.UNIV.']?.toString().trim();
      const genero = fila['GENERO']?.toString().trim();
      const alm_izq = fila['IZQ']?.toString().trim();

      if (!codUniversal || !ALMACENES_VALIDOS.has(alm_izq)) continue;

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

    await turso.batch([
      "PRAGMA foreign_keys = OFF;",
      "DROP TABLE IF EXISTS variantes;",
      "DROP TABLE IF EXISTS productos;",
      "PRAGMA foreign_keys = ON;",
      "CREATE TABLE IF NOT EXISTS metadata (clave TEXT PRIMARY KEY, valor TEXT);",
      "DELETE FROM metadata WHERE clave IN ('total_productos','total_variantes','valor_inventario','ultima_sync','grafico_marcas','grafico_descuentos');",
      `CREATE TABLE productos (
        cod_universal TEXT, genero TEXT, marca TEXT, modelo TEXT, categoria TEXT, grupo TEXT, color TEXT,
        precio_lista REAL, descuento REAL, precio_final REAL, imagen_url TEXT, stock_total INTEGER,
        PRIMARY KEY (cod_universal, genero)
      );`,
      `CREATE TABLE variantes (
        cod_universal TEXT, genero TEXT, alm_izq TEXT, alm_der TEXT, cod_prod TEXT, cod_barras TEXT PRIMARY KEY, talla TEXT, precio_compra REAL,
        FOREIGN KEY (cod_universal, genero) REFERENCES productos(cod_universal, genero)
      );`,
    ], "write");

    const opsProductos = Array.from(productosMap.values());
    for (let i = 0; i < opsProductos.length; i += 2000) {
      await turso.batch(opsProductos.slice(i, i + 2000), "write");
    }

    for (let i = 0; i < variantesParaInsertar.length; i += 2000) {
      await turso.batch(variantesParaInsertar.slice(i, i + 2000), "write");
    }

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

    await turso.execute(`CREATE TABLE IF NOT EXISTS producto_imagenes (
      cod_universal TEXT PRIMARY KEY,
      imagen_url TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('archivo', 'sistema')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    const imagenEntries = Object.entries(dictImagenes).filter(
      ([, url]) => url !== null
    );
    if (imagenEntries.length > 0) {
      const imagenInserts = imagenEntries.map(([cod, url]) => ({
        sql: `INSERT INTO producto_imagenes (cod_universal, imagen_url, source)
              VALUES (?, ?, 'archivo')
              ON CONFLICT(cod_universal) DO NOTHING`,
        args: [cod, url] as InValue[],
      }));
      for (let i = 0; i < imagenInserts.length; i += 2000) {
        await turso.batch(imagenInserts.slice(i, i + 2000), "write");
      }
    }

    revalidatePath("/admin");
    revalidatePath("/client");

    return { success: true, msg: `🎉 Éxito. ${productosMap.size} artículos indexados a velocidad nativa.` };

  } catch (error: any) {
    return { success: false, msg: `❌ Fallo crítico: ${error.message}` };
  }
}

// ========== Batch upload helpers ==========

export async function initUpload(): Promise<PipelineResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
    }

    await turso.batch([
      "PRAGMA foreign_keys = OFF;",
      "DROP TABLE IF EXISTS variantes;",
      "DROP TABLE IF EXISTS productos;",
      "PRAGMA foreign_keys = ON;",
      "CREATE TABLE IF NOT EXISTS metadata (clave TEXT PRIMARY KEY, valor TEXT);",
      "DELETE FROM metadata WHERE clave IN ('total_productos','total_variantes','valor_inventario','ultima_sync','grafico_marcas','grafico_descuentos');",
      `CREATE TABLE productos (
        cod_universal TEXT, genero TEXT, marca TEXT, modelo TEXT, categoria TEXT, grupo TEXT, color TEXT,
        precio_lista REAL, descuento REAL, precio_final REAL, imagen_url TEXT, stock_total INTEGER,
        PRIMARY KEY (cod_universal, genero)
      );`,
      `CREATE TABLE variantes (
        cod_universal TEXT, genero TEXT, alm_izq TEXT, alm_der TEXT, cod_prod TEXT, cod_barras TEXT PRIMARY KEY, talla TEXT, precio_compra REAL,
        FOREIGN KEY (cod_universal, genero) REFERENCES productos(cod_universal, genero)
      );`,
    ], "write");

    return { success: true, msg: "Tablas listas." };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return { success: false, msg: `Error al inicializar: ${msg}` };
  }
}

export async function uploadProductosBatch(
  productos: Producto[]
): Promise<PipelineResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
    }

    if (productos.length === 0) {
      return { success: true, msg: "Sin productos." };
    }

    const ops = productos.map((p) => ({
      sql: `INSERT INTO productos VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        p.cod_universal, p.genero, p.marca, p.modelo, p.categoria,
        p.grupo, p.color, p.precio_lista, p.descuento, p.precio_final,
        p.imagen_url, p.stock_total,
      ] as InValue[],
    }));

    await turso.batch(ops, "write");
    return { success: true, msg: `${productos.length} productos insertados.` };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return { success: false, msg: `Error al insertar productos: ${msg}` };
  }
}

export async function uploadVariantesBatch(
  variantes: Variante[]
): Promise<PipelineResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
    }

    if (variantes.length === 0) {
      return { success: true, msg: "Sin variantes." };
    }

    const ops = variantes.map((v) => ({
      sql: `INSERT OR IGNORE INTO variantes VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        v.cod_universal, v.genero, v.alm_izq, v.alm_der ?? null,
        v.cod_prod, v.cod_barras, v.talla, v.precio_compra,
      ] as InValue[],
    }));

    await turso.batch(ops, "write");
    return { success: true, msg: `${variantes.length} variantes insertadas.` };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return { success: false, msg: `Error al insertar variantes: ${msg}` };
  }
}

interface FinalizeParams {
  total_productos: number;
  total_variantes: number;
  valor_inventario: number;
  conteo_marcas: Record<string, number>;
  conteo_descuentos: Record<string, number>;
  imagenEntries: { cod_universal: string; imagen_url: string }[];
}

export async function finalizeUpload(
  params: FinalizeParams
): Promise<PipelineResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
    }

    const ultimaSync = new Date().toLocaleString("es-PE");

    const metaOps: ({ sql: string; args: InValue[] })[] = [
      { sql: "CREATE INDEX IF NOT EXISTS idx_variantes_lookup ON variantes (cod_universal, genero);", args: [] },
      { sql: "INSERT INTO metadata VALUES (?, ?);", args: ["total_productos", params.total_productos.toString()] },
      { sql: "INSERT INTO metadata VALUES (?, ?);", args: ["total_variantes", params.total_variantes.toString()] },
      { sql: "INSERT INTO metadata VALUES (?, ?);", args: ["valor_inventario", params.valor_inventario.toFixed(0)] },
      { sql: "INSERT INTO metadata VALUES (?, ?);", args: ["ultima_sync", ultimaSync] },
      { sql: "INSERT INTO metadata VALUES (?, ?);", args: ["grafico_marcas", JSON.stringify(params.conteo_marcas)] },
      { sql: "INSERT INTO metadata VALUES (?, ?);", args: ["grafico_descuentos", JSON.stringify(params.conteo_descuentos)] },
    ];

    await turso.batch(metaOps, "write");

    await turso.execute(`
      UPDATE productos SET imagen_url = NULL
      WHERE imagen_url IS NOT NULL AND imagen_url NOT LIKE 'https://%'
    `);

    await turso.execute(`CREATE TABLE IF NOT EXISTS producto_imagenes (
      cod_universal TEXT PRIMARY KEY,
      imagen_url TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('archivo', 'sistema')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);

    if (params.imagenEntries.length > 0) {
      const inserts = params.imagenEntries.map((e) => ({
        sql: `INSERT INTO producto_imagenes (cod_universal, imagen_url, source)
              VALUES (?, ?, 'archivo')
              ON CONFLICT(cod_universal) DO NOTHING`,
        args: [e.cod_universal, e.imagen_url] as InValue[],
      }));
      for (let i = 0; i < inserts.length; i += 2000) {
        await turso.batch(inserts.slice(i, i + 2000), "write");
      }
    }

    revalidatePath("/admin");
    revalidatePath("/client");

    return { success: true, msg: "Base de datos finalizada correctamente." };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return { success: false, msg: `Error al finalizar: ${msg}` };
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

export async function setProductoImagen(
  cod_universal: string,
  imagen_url: string
): Promise<PipelineResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
    }

    if (!imagen_url.startsWith("https://")) {
      return { success: false, msg: "La URL debe ser HTTPS." };
    }

    await turso.execute({
      sql: `INSERT INTO producto_imagenes (cod_universal, imagen_url, source, updated_at)
            VALUES (?, ?, 'sistema', datetime('now'))
            ON CONFLICT(cod_universal) DO UPDATE SET
              imagen_url = excluded.imagen_url,
              source = 'sistema',
              updated_at = excluded.updated_at`,
      args: [cod_universal, imagen_url],
    });

    revalidatePath("/admin/productos");
    revalidatePath("/client");
    return { success: true, msg: "Imagen guardada." };
  } catch (error: any) {
    return { success: false, msg: `Error: ${error.message}` };
  }
}

export async function removeProductoImagen(
  cod_universal: string
): Promise<PipelineResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
    }

    await turso.execute({
      sql: "DELETE FROM producto_imagenes WHERE cod_universal = ?",
      args: [cod_universal],
    });

    revalidatePath("/admin/productos");
    revalidatePath("/client");
    return { success: true, msg: "Imagen eliminada." };
  } catch (error: any) {
    return { success: false, msg: `Error: ${error.message}` };
  }
}

interface ExportProductInput {
  cod_universal: string;
  genero: string;
  marca: string;
  modelo: string;
  categoria: string;
  grupo: string;
  color: string;
  descuento: number;
  precio_final: number;
  stock_total: number;
  imagen_url: string | null;
}

async function fetchImageServer(url: string): Promise<{ buffer: ArrayBuffer; type: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    const buffer = await res.arrayBuffer();
    return { buffer, type: contentType };
  } catch {
    return null;
  }
}

function getExcelImageType(contentType: string): "png" | "jpeg" | "gif" {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  return "jpeg";
}

export async function exportCatalogoExcel(
  products: ExportProductInput[]
): Promise<{ success: boolean; buffer?: string; msg: string }> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
    }

    const ExcelJS = await import("exceljs");
    const { DISCOUNT_COLORS, DISCOUNT_ORDER } = await import("@/lib/discount-colors");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Catálogo de Productos");

    const headers = [
      "Imagen", "Cod. Marca", "Marca", "Modelo", "Género",
      "Categoría", "Color", "Cant.", "P. Venta",
      "10%", "20%", "30%", "40%", "50%", "60%", "70%",
    ];
    sheet.addRow(headers);

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      if (colNumber >= 10) {
        const pct = DISCOUNT_ORDER[colNumber - 10];
        const color = DISCOUNT_COLORS[pct];
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color?.excel ?? "FF000000" } };
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      }
    });
    headerRow.height = 30;

    const IMAGE_COL_WIDTH = 14 * 7;
    const IMAGE_ROW_HEIGHT = 63;
    const IMAGE_PADDING = 8;
    const MAX_IMG_WIDTH = IMAGE_COL_WIDTH - IMAGE_PADDING * 2;
    const MAX_IMG_HEIGHT = IMAGE_ROW_HEIGHT - IMAGE_PADDING * 2;

    const urlsToFetch = products
      .map((p, i) => ({ url: p.imagen_url, index: i }))
      .filter((item) => item.url && item.url.startsWith("https"));

    const imageResults = await Promise.allSettled(
      urlsToFetch.map(async (item) => {
        const result = await fetchImageServer(item.url!);
        return { index: item.index, result };
      })
    );

    const imageMap = new Map<number, { id: number; width: number; height: number }>();
    for (const settled of imageResults) {
      if (settled.status !== "fulfilled") continue;
      const { index, result } = settled.value;
      if (!result) continue;
      const imgType = getExcelImageType(result.type);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imageId = workbook.addImage({
        buffer: result.buffer as any,
        extension: imgType,
      });
      imageMap.set(index, { id: imageId, width: MAX_IMG_WIDTH, height: MAX_IMG_HEIGHT });
    }

    products.forEach((product, idx) => {
      const discountValues: (number | null)[] = [10, 20, 30, 40, 50, 60, 70].map((pct) =>
        product.descuento === pct ? product.precio_final : null
      );

      const row = sheet.addRow([
        "", product.cod_universal, product.marca, product.modelo,
        product.genero, product.categoria, product.color,
        product.stock_total, product.precio_final, ...discountValues,
      ]);
      row.height = IMAGE_ROW_HEIGHT;
      row.alignment = { vertical: "middle" };

      const imageData = imageMap.get(idx);
      if (imageData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sheet.addImage(imageData.id, {
          tl: { col: 0.05, row: (idx + 1) + 0.05 } as any,
          br: { col: 0.98, row: (idx + 2) - 0.05 } as any,
          editAs: "twoCell",
        });
      }

      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
        if (colNumber >= 10) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          if (cell.value !== null && cell.value !== undefined) {
            cell.numFmt = "#,##0.00";
            const pct = DISCOUNT_ORDER[colNumber - 10];
            const color = DISCOUNT_COLORS[pct];
            if (color) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color.excel } };
              cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
            }
          }
        }
        if (colNumber === 8 || colNumber === 9) {
          cell.numFmt = "#,##0.00";
          cell.alignment = { vertical: "middle", horizontal: "right" };
        }
      });

      if (idx % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
        });
      }
    });

    sheet.getColumn(1).width = 14;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(3).width = 16;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 14;
    sheet.getColumn(6).width = 16;
    sheet.getColumn(7).width = 14;
    sheet.getColumn(8).width = 10;
    sheet.getColumn(9).width = 14;
    sheet.getColumn(10).width = 12;
    sheet.getColumn(11).width = 12;
    sheet.getColumn(12).width = 12;
    sheet.getColumn(13).width = 12;
    sheet.getColumn(14).width = 12;
    sheet.getColumn(15).width = 12;
    sheet.getColumn(16).width = 12;

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return { success: true, buffer: base64, msg: "Excel generado." };
  } catch (error: any) {
    return { success: false, msg: `Error: ${error.message}` };
  }
}

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
  } catch (error: any) {
    return { success: false, msg: `Error: ${error.message}` };
  }
}
