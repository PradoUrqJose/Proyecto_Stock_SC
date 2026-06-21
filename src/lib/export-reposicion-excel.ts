import ExcelJS from "exceljs";
import { DISCOUNT_COLORS, DISCOUNT_ORDER } from "./discount-colors";
import type { ReposicionItem } from "@/app/admin/actions";

export async function exportReposicionToExcel(products: ReposicionItem[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Reposición - Descuentos a Retirar");

  const headers = [
    "Cod. Universal",
    "Marca",
    "Modelo",
    "Género",
    "Categoría",
    "Grupo",
    "Color",
    "Descuento",
    "P. Lista",
    "P. Final",
    "Stock",
  ];

  sheet.addRow(headers);

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    if (colNumber === 8) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDC2626" },
      };
    } else {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF000000" },
      };
    }
  });

  headerRow.height = 28;

  products.forEach((product, idx) => {
    const row = sheet.addRow([
      product.cod_universal,
      product.marca,
      product.modelo,
      product.genero,
      product.categoria,
      product.grupo,
      product.color,
      `${product.descuento}%`,
      product.precio_lista,
      product.precio_final,
      product.stock_total,
    ]);

    row.alignment = { vertical: "middle" };

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };

      if (colNumber === 8) {
        const pct = DISCOUNT_ORDER[product.descuento / 10 - 1] ?? product.descuento;
        const color = DISCOUNT_COLORS[pct];
        if (color) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: color.excel },
          };
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        }
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      if (colNumber === 9 || colNumber === 10) {
        cell.numFmt = "#,##0.00";
        cell.alignment = { vertical: "middle", horizontal: "right" };
      }

      if (colNumber === 11) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });

    if (idx % 2 === 0) {
      row.eachCell((cell, colNumber) => {
        if (colNumber !== 8) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF9FAFB" },
          };
        }
      });
    }
  });

  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 18;
  sheet.getColumn(4).width = 14;
  sheet.getColumn(5).width = 16;
  sheet.getColumn(6).width = 14;
  sheet.getColumn(7).width = 14;
  sheet.getColumn(8).width = 12;
  sheet.getColumn(9).width = 14;
  sheet.getColumn(10).width = 14;
  sheet.getColumn(11).width = 10;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "reposicion_descuentos.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
