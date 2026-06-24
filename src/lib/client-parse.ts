import * as XLSX from "xlsx";
import { ALMACENES_VALIDOS } from "@/lib/constants";

export interface ParsedProducto {
  cod_universal: string;
  genero: string;
  marca: string;
  modelo: string;
  categoria: string;
  grupo: string;
  color: string;
  precio_lista: number;
  descuento: number;
  precio_final: number;
  imagen_url: string | null;
  stock_total: number;
}

export interface ParsedVariante {
  cod_universal: string;
  genero: string;
  alm_izq: string;
  alm_der: string | null;
  cod_prod: string;
  cod_barras: string;
  talla: string;
  precio_compra: number;
}

export interface ParsedMetadata {
  total_productos: number;
  total_variantes: number;
  valor_inventario: number;
  conteo_marcas: Record<string, number>;
  conteo_descuentos: Record<string, number>;
}

export interface ParsedResult {
  productos: ParsedProducto[];
  variantes: ParsedVariante[];
  metadata: ParsedMetadata;
  imagenEntries: { cod_universal: string; imagen_url: string }[];
}

function isHtmlContent(text: string): boolean {
  const t = text.trim().toLowerCase().slice(0, 100);
  return t.includes("<!") || t.includes("<html") || t.includes("<table") || t.includes("<tr") || t.includes("<thead");
}

function parseHtmlTable(html: string): Record<string, string>[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];

  const rows = table.querySelectorAll("tr");
  if (rows.length < 2) return [];

  let headerRow: Element | null = null;
  let dataStartIndex = 0;
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll("th, td");
    if (cells.length > 2) {
      headerRow = rows[i];
      dataStartIndex = i + 1;
      break;
    }
  }

  if (!headerRow) return [];

  const headers: string[] = [];
  headerRow.querySelectorAll("th, td").forEach((cell) => {
    headers.push(cell.textContent?.trim() || "");
  });

  const result: Record<string, string>[] = [];
  for (let i = dataStartIndex; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll("td");
    if (cells.length === 0) continue;
    const row: Record<string, string> = {};
    cells.forEach((cell, j) => {
      if (j < headers.length) {
        row[headers[j]] = cell.textContent?.trim() || "";
      }
    });
    if (Object.values(row).some((v) => v.length > 0)) {
      result.push(row);
    }
  }

  return result;
}

async function parseExcelOrHtml(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();

  try {
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (sheet) {
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (rows.length > 0) return rows;
    }
  } catch {}

  const text = new TextDecoder().decode(buffer);
  if (isHtmlContent(text)) {
    return parseHtmlTable(text);
  }

  return [];
}

export async function parseStockFile(file: File): Promise<Record<string, string>[]> {
  return parseExcelOrHtml(file);
}

export async function parseImagesFile(file: File): Promise<Record<string, string | null>> {
  const text = new TextDecoder().decode(await file.arrayBuffer());
  const doc = new DOMParser().parseFromString(text, "text/html");
  const dict: Record<string, string | null> = {};

  doc.querySelectorAll("table tr").forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length >= 4) {
      const codUniv = cells[3].textContent?.trim();
      const img = cells[2].querySelector("img");
      const url = img?.getAttribute("src") || null;
      if (codUniv && url && url.startsWith("https")) {
        dict[codUniv] = url;
      }
    }
  });

  return dict;
}

export async function parseDiscountFiles(files: File[]): Promise<Record<string, number>> {
  const dict: Record<string, number> = {};

  for (const file of files) {
    const pct = Number(file.name.match(/\d+/)?.[0] || 0);
    if (!pct) continue;

    const rows = await parseExcelOrHtml(file);
    for (const row of rows) {
      const codUniv = (row["COD. UNIVERSAL."] || "").toString().trim();
      if (codUniv) dict[codUniv] = pct;
    }
  }

  return dict;
}

export function buildData(
  rows: Record<string, string>[],
  dictImagenes: Record<string, string | null>,
  dictDescuentos: Record<string, number>
): ParsedResult {
  const stockMap = new Map<string, number>();
  const variantes: ParsedVariante[] = [];

  for (const row of rows) {
    const codUniversal = (row["COD.UNIV."] || "").toString().trim();
    const genero = (row["GENERO"] || "").toString().trim();
    const alm_izq = (row["IZQ"] || "").toString().trim();
    const alm_der = (row["DER"] || "").toString().trim() || null;

    if (!codUniversal || !ALMACENES_VALIDOS.has(alm_izq)) continue;

    const key = `${codUniversal}-${genero}`;
    stockMap.set(key, (stockMap.get(key) || 0) + 1);

    variantes.push({
      cod_universal: codUniversal,
      genero,
      alm_izq,
      alm_der,
      cod_prod: (row["COD.PROD"] || "").toString().trim(),
      cod_barras: (row["COD.BARRAS"] || "").toString().trim(),
      talla: (row["TALLA"] || "").toString().trim() || "ÚNICA",
      precio_compra: Number(row["COMPRA"]) || 0,
    });
  }

  const productosMap = new Map<string, ParsedProducto>();
  const conteoMarcas: Record<string, number> = {};
  const conteoDescuentos: Record<string, number> = {
    "10%": 0, "20%": 0, "30%": 0, "40%": 0, "50%": 0, "60%": 0, "70%": 0,
  };
  let valorTotalInventario = 0;

  const seen = new Set<string>();
  for (const row of rows) {
    const codUniversal = (row["COD.UNIV."] || "").toString().trim();
    const genero = (row["GENERO"] || "").toString().trim();
    const alm_izq = (row["IZQ"] || "").toString().trim();

    if (!codUniversal || !ALMACENES_VALIDOS.has(alm_izq)) continue;

    const key = `${codUniversal}-${genero}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const descPorcentaje = dictDescuentos[codUniversal] || 0;
    const precioLista = Number(row["LISTA"]) || 0;
    const precioFinal = precioLista * (1 - descPorcentaje / 100);
    const stockCalculado = stockMap.get(key) || 0;

    const producto: ParsedProducto = {
      cod_universal: codUniversal,
      genero,
      marca: (row["MARCA"] || "").toString().trim() || "SIN MARCA",
      modelo: (row["MODELO"] || "").toString().trim() || "SIN MODELO",
      categoria: (row["CATEGORIA"] || "").toString().trim() || "GENERAL",
      grupo: (row["GRUPO"] || "").toString().trim() || "VARIOS",
      color: (row["COLOR"] || "").toString().trim() || "VARIOS",
      precio_lista: precioLista,
      descuento: descPorcentaje,
      precio_final: precioFinal,
      imagen_url: dictImagenes[codUniversal] || null,
      stock_total: stockCalculado,
    };

    productosMap.set(key, producto);

    valorTotalInventario += precioLista * stockCalculado;
    const m = (row["MARCA"] || "").toString().trim() || "SIN MARCA";
    conteoMarcas[m] = (conteoMarcas[m] || 0) + stockCalculado;
    if (conteoDescuentos[`${descPorcentaje}%`] !== undefined) {
      conteoDescuentos[`${descPorcentaje}%`] += stockCalculado;
    }
  }

  const imagenEntries: { cod_universal: string; imagen_url: string }[] = [];
  for (const [cod, url] of Object.entries(dictImagenes)) {
    if (url) imagenEntries.push({ cod_universal: cod, imagen_url: url });
  }

  return {
    productos: Array.from(productosMap.values()),
    variantes,
    metadata: {
      total_productos: productosMap.size,
      total_variantes: variantes.length,
      valor_inventario: valorTotalInventario,
      conteo_marcas: conteoMarcas,
      conteo_descuentos: conteoDescuentos,
    },
    imagenEntries,
  };
}
