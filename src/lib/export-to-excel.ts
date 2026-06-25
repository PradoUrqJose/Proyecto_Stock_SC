import ExcelJS from "exceljs";
import { DISCOUNT_COLORS, DISCOUNT_ORDER } from "./discount-colors";
import type { ExportProduct } from "@/types";

async function fetchImage(url: string): Promise<{ buffer: ArrayBuffer; type: string } | null> {
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
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

export async function exportToExcel(products: ExportProduct[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Catálogo de Productos");

  const headers = [
    "Imagen",
    "Cod. Marca",
    "Marca",
    "Modelo",
    "Género",
    "Categoría",
    "Color",
    "Cant.",
    "P. Venta",
    "10%",
    "20%",
    "30%",
    "40%",
    "50%",
    "60%",
    "70%",
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
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: color?.excel ?? "FF000000" },
      };
    } else {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF000000" },
      };
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
      const result = await fetchImage(item.url!);
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
    const discountPcts = [10, 20, 30, 40, 50, 60, 70];
    const discountValues: (number | null)[] = discountPcts.map((pct) =>
      product.descuento === pct ? product.precio_final : null
    );

    const row = sheet.addRow([
      "",
      product.cod_universal,
      product.marca,
      product.modelo,
      product.genero,
      product.categoria,
      product.color,
      product.stock_total,
      product.precio_final,
      ...discountValues,
    ]);

    row.height = IMAGE_ROW_HEIGHT;
    row.alignment = { vertical: "middle" };

    const imageData = imageMap.get(idx);
    if (imageData) {
      sheet.addImage(imageData.id, {
        tl: { col: 0.05, row: (idx + 1) + 0.05 } as any,
        br: { col: 0.98, row: (idx + 2) - 0.05 } as any,
        editAs: "twoCell"
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
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: color.excel },
            };
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
      row.eachCell((cell, colNumber) => {
        if (!(colNumber >= 10 && cell.value !== null && cell.value !== undefined)) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF9FAFB" },
          };
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
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "catalogo_productos.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
