"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { exportCatalogoExcel } from "@/lib/actions/export";
import type { ExportProduct } from "@/types";

export function useDiscountExport() {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const exportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleExport = useCallback(async (rows: { original: ExportProduct }[]) => {
    setExporting(true);
    setExportProgress(0);
    exportIntervalRef.current = setInterval(() => {
      setExportProgress((prev) => {
        const inc = Math.max(0.4, (90 - prev) * 0.06);
        return Math.min(90, prev + inc);
      });
    }, 300);
    try {
      const allData: ExportProduct[] = rows.map((r) => r.original);
      const result = await exportCatalogoExcel(allData);
      if (exportIntervalRef.current) clearInterval(exportIntervalRef.current);
      if (result.success && result.data) {
        setExportProgress(100);
        const bytes = Uint8Array.from(atob(result.data), c => c.charCodeAt(0));
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
      if (exportIntervalRef.current) clearInterval(exportIntervalRef.current);
      setTimeout(() => {
        setExporting(false);
        setExportProgress(0);
      }, 600);
    }
  }, []);

  return { exporting, exportProgress, handleExport };
}
