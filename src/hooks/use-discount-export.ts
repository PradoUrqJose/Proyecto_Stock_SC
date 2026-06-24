"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { exportCatalogoExcel } from "@/lib/actions/export";
import type { ExportProduct } from "@/types";

export function useDiscountExport() {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async (rows: { original: ExportProduct }[]) => {
    setExporting(true);
    try {
      const allData: ExportProduct[] = rows.map((r) => r.original);
      const result = await exportCatalogoExcel(allData);
      if (result.success && result.data) {
        const binary = atob(result.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "catalogo_actualizacion.xlsx";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Excel exportado.");
      } else {
        toast.error(result.msg);
      }
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, handleExport };
}
