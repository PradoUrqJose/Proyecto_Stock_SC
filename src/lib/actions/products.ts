"use server";

import { revalidatePath } from "next/cache";
import { turso } from "@/lib/turso";
import { getSession } from "@/lib/actions";
import * as XLSX from "xlsx";
import * as cheerio from "cheerio";
import type { PipelineResult, Producto, Variante, VarianteRow } from "@/types";
import type { InValue } from "@libsql/core/api";
import { ALMACENES_VALIDOS } from "@/lib/constants";

const STOCK_MAX_BYTES = 50 * 1024 * 1024;
const IMAGENES_MAX_BYTES = 10 * 1024 * 1024;
const DESCUENTO_MAX_BYTES = 10 * 1024 * 1024;

const MIME_EXCEL = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);
const MIME_HTML = new Set(["text/html"]);

function validarArchivo(
  file: File,
  tiposPermitidos: Set<string>,
  maxBytes: number,
  nombreCampo: string
): string | null {
  if (file.size === 0) return `El archivo de ${nombreCampo} está vacío.`;
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return `El archivo de ${nombreCampo} supera el límite de ${mb} MB.`;
  }
  if (!tiposPermitidos.has(file.type)) {
    const tipos = [...tiposPermitidos].join(" / ");
    return `Tipo de archivo no válido para ${nombreCampo}. Se espera: ${tipos}, se recibió: ${file.type || "desconocido"}.`;
  }
  return null;
}

interface FinalizeParams {
  total_productos: number;
  total_variantes: number;
  valor_inventario: number;
  conteo_marcas: Record<string, number>;
  conteo_descuentos: Record<string, number>;
  imagenEntries: { cod_universal: string; imagen_url: string }[];
}

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

    const errStock = validarArchivo(archivoStock, MIME_EXCEL, STOCK_MAX_BYTES, "stock");
    if (errStock) return { success: false, msg: errStock };

    if (archivoImagenes && archivoImagenes.size > 0) {
      const errImg = validarArchivo(archivoImagenes, MIME_HTML, IMAGENES_MAX_BYTES, "imágenes");
      if (errImg) return { success: false, msg: errImg };
    }

    for (const arc of archivosDescuentos) {
      if (arc.size === 0) continue;
      const errDesc = validarArchivo(arc, MIME_EXCEL, DESCUENTO_MAX_BYTES, "descuentos");
      if (errDesc) return { success: false, msg: errDesc };
    }

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

    return { success: true, msg: `Éxito. ${productosMap.size} artículos indexados a velocidad nativa.` };

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg: `Error al insertar variantes: ${msg}` };
  }
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}

export async function getVariantesByProducto(
  cod_universal: string,
  genero: string
): Promise<{ success: boolean; data?: VarianteRow[]; msg?: string }> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, msg: "No autorizado." };
    }

    const result = await turso.execute({
      sql: `SELECT v.alm_izq, v.alm_der, v.cod_barras, v.talla,
                   p.precio_lista, p.modelo
            FROM variantes v
            JOIN productos p ON p.cod_universal = v.cod_universal AND p.genero = v.genero
            WHERE v.cod_universal = ? AND v.genero = ?`,
      args: [cod_universal, genero],
    });

    const data: VarianteRow[] = result.rows.map((row) => ({
      cod_universal,
      genero,
      alm_izq: row.alm_izq as string,
      alm_der: row.alm_der as string | null,
      cod_barras: row.cod_barras as string,
      talla: row.talla as string,
      precio_lista: row.precio_lista as number,
      modelo: row.modelo as string,
      bf_descuento: 0,
      af_descuento: 0,
      precio_final: 0,
    }));

    return { success: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}
