"use server";

import { getSession } from "@/lib/actions";
import { isAdminRole } from "@/lib/auth";
import type { ActionResult, ExportProduct } from "@/types";

interface UpdateRowExport {
  cod_universal: string;
  genero: string;
  grupo: string;
  modelo: string;
  bf_descuento: number;
  af_descuento: number;
  just_updated: string;
  imagen_url: string | null;
  precio_lista: number;
}

async function fetchImageServer(url: string): Promise<{ buffer: ArrayBuffer; type: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    const buffer = await res.arrayBuffer();
    return { buffer, type: contentType };
  } catch {
    return null;
  }
}

async function fetchImagesConcurrent(
  urlsToFetch: { url: string; index: number }[],
  maxConcurrent = 30
): Promise<Array<{ index: number; result: { buffer: ArrayBuffer; type: string } | null }>> {
  const results: Array<{ index: number; result: { buffer: ArrayBuffer; type: string } | null }> =
    new Array(urlsToFetch.length);
  let pos = 0;

  async function worker() {
    while (pos < urlsToFetch.length) {
      const i = pos++;
      if (i >= urlsToFetch.length) break;
      const item = urlsToFetch[i];
      try {
        results[i] = { index: item.index, result: await fetchImageServer(item.url) };
      } catch {
        results[i] = { index: item.index, result: null };
      }
    }
  }

  const workerCount = Math.min(maxConcurrent, urlsToFetch.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results.filter(Boolean) as Array<{ index: number; result: { buffer: ArrayBuffer; type: string } | null }>;
}

function getExcelImageType(contentType: string): "png" | "jpeg" | "gif" {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  return "jpeg";
}

export async function exportCatalogoExcel(
  products: ExportProduct[]
): Promise<ActionResult<string>> {
  try {
    const session = await getSession();
    if (!session || !isAdminRole(session.role)) {
      return { success: false, msg: "No autorizado." };
    }

    const ExcelJS = await import("exceljs");
    const { DISCOUNT_COLORS, DISCOUNT_ORDER, getDiscountTextHex } = await import("@/lib/discount-colors");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Catálogo de Productos");

    const headers = [
      "Imagen", "Cod. Marca", "Marca", "Modelo", "Género",
      "Categoría", "Color", "Grupo", "Cant.", "P. Lista",
      "10%", "20%", "30%", "40%", "50%", "60%", "70%",
    ];
    sheet.addRow(headers);

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.eachCell((cell, colNumber) => {
      if (colNumber >= 11) {
        const pct = DISCOUNT_ORDER[colNumber - 11];
        const color = DISCOUNT_COLORS[pct];
        cell.font = { bold: true, color: { argb: getDiscountTextHex(pct) } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color?.excel ?? "FF000000" } };
      } else {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
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

    const imageResults = await fetchImagesConcurrent(urlsToFetch as { url: string; index: number }[]);

    const imageMap = new Map<number, { id: number; width: number; height: number }>();
    for (const { index, result } of imageResults) {
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
        product.genero, product.categoria, product.color, product.grupo,
        product.stock_total, product.precio_lista, ...discountValues,
      ]);
      row.height = IMAGE_ROW_HEIGHT;
      row.alignment = { vertical: "middle", horizontal: "center" };

      const imageData = imageMap.get(idx);
      if (imageData) {
        const ROW_EMU = IMAGE_ROW_HEIGHT * 12700;
        const PAD_ROW_EMU = 38100;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sheet.addImage(imageData.id, {
          tl: { nativeCol: 0, nativeColOff: 45000, nativeRow: idx + 1, nativeRowOff: PAD_ROW_EMU } as any,
          br: { nativeCol: 1, nativeColOff: 0, nativeRow: idx + 1, nativeRowOff: ROW_EMU - PAD_ROW_EMU } as any,
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
        cell.alignment = { vertical: "middle", horizontal: "center" };
        if (colNumber >= 11) {
          if (cell.value !== null && cell.value !== undefined) {
            cell.numFmt = "#,##0.00";
            const pct = DISCOUNT_ORDER[colNumber - 11];
            const color = DISCOUNT_COLORS[pct];
            if (color) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color.excel } };
              cell.font = { color: { argb: getDiscountTextHex(pct) }, bold: true };
            }
          }
        }
        if (colNumber === 9 || colNumber === 10) {
          cell.numFmt = "#,##0.00";
        }
      });

      if (idx % 2 === 0) {
        row.eachCell((cell, colNumber) => {
          if (!(colNumber >= 11 && cell.value !== null && cell.value !== undefined)) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
          }
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
    sheet.getColumn(8).width = 14;
    sheet.getColumn(9).width = 10;
    sheet.getColumn(10).width = 14;
    sheet.getColumn(11).width = 12;
    sheet.getColumn(12).width = 12;
    sheet.getColumn(13).width = 12;
    sheet.getColumn(14).width = 12;
    sheet.getColumn(15).width = 12;
    sheet.getColumn(16).width = 12;
    sheet.getColumn(17).width = 12;

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return { success: true, data: base64, msg: "Excel generado." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}

export async function exportUpdatesExcel(
  products: UpdateRowExport[]
): Promise<ActionResult<string>> {
  try {
    const session = await getSession();
    if (!session || !isAdminRole(session.role)) {
      return { success: false, msg: "No autorizado." };
    }

    const ExcelJS = await import("exceljs");
    const { DISCOUNT_COLORS, getDiscountTextHex } = await import("@/lib/discount-colors");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Registro Cambios");

    const headers = [
      "Imagen", "Cod. Universal", "Grupo", "Modelo", "Género",
      "Desc. Anterior", "Desc. Actual", "P. Lista", "P. Final", "Fecha",
    ];
    sheet.addRow(headers);

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      if (colNumber === 6) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6B7280" } };
      } else if (colNumber === 7) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1b61c9" } };
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      }
    });
    headerRow.height = 28;

    const IMAGE_COL_WIDTH = 14 * 7;
    const IMAGE_ROW_HEIGHT = 63;
    const IMAGE_PADDING = 8;
    const MAX_IMG_WIDTH = IMAGE_COL_WIDTH - IMAGE_PADDING * 2;
    const MAX_IMG_HEIGHT = IMAGE_ROW_HEIGHT - IMAGE_PADDING * 2;

    const urlsToFetch = products
      .map((p, i) => ({ url: p.imagen_url, index: i }))
      .filter((item) => item.url && item.url.startsWith("https"));

    const imageResults = await fetchImagesConcurrent(urlsToFetch as { url: string; index: number }[]);

    const imageMap = new Map<number, { id: number; width: number; height: number }>();
    for (const { index, result } of imageResults) {
      if (!result) continue;
      const imgType = getExcelImageType(result.type);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imageId = workbook.addImage({ buffer: result.buffer as any, extension: imgType });
      imageMap.set(index, { id: imageId, width: MAX_IMG_WIDTH, height: MAX_IMG_HEIGHT });
    }

    products.forEach((product, idx) => {
      const precioFinal = product.precio_lista * (1 - product.af_descuento / 100);

      const row = sheet.addRow([
        "", product.cod_universal, product.grupo, product.modelo, product.genero,
        `${product.bf_descuento}%`, `${product.af_descuento}%`,
        product.precio_lista, precioFinal, product.just_updated,
      ]);
      row.height = IMAGE_ROW_HEIGHT;
      row.alignment = { vertical: "middle" };

      const imageData = imageMap.get(idx);
      if (imageData) {
        const ROW_EMU = IMAGE_ROW_HEIGHT * 12700;
        const PAD_ROW_EMU = 38100;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sheet.addImage(imageData.id, {
          tl: { nativeCol: 0, nativeColOff: 45000, nativeRow: idx + 1, nativeRowOff: PAD_ROW_EMU } as any,
          br: { nativeCol: 1, nativeColOff: 0, nativeRow: idx + 1, nativeRowOff: ROW_EMU - PAD_ROW_EMU } as any,
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

        if (colNumber === 6) {
          const color = DISCOUNT_COLORS[product.bf_descuento];
          if (color) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color.excel } };
            cell.font = { color: { argb: getDiscountTextHex(product.bf_descuento) }, bold: true };
          }
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }

        if (colNumber === 7) {
          const color = DISCOUNT_COLORS[product.af_descuento];
          if (color) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color.excel } };
            cell.font = { color: { argb: getDiscountTextHex(product.af_descuento) }, bold: true };
          }
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }

        if (colNumber === 8 || colNumber === 9) {
          cell.numFmt = "#,##0.00";
          cell.alignment = { vertical: "middle", horizontal: "right" };
        }

        if (colNumber === 10) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }
      });

      if (idx % 2 === 0) {
        row.eachCell((cell, colNumber) => {
          if (colNumber !== 6 && colNumber !== 7) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
          }
        });
      }
    });

    sheet.getColumn(1).width = 14;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(3).width = 14;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 14;
    sheet.getColumn(6).width = 14;
    sheet.getColumn(7).width = 14;
    sheet.getColumn(8).width = 14;
    sheet.getColumn(9).width = 14;
    sheet.getColumn(10).width = 22;

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { success: true, data: base64, msg: "Excel generado." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { success: false, msg };
  }
}
