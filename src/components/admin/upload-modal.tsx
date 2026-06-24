"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  initUpload,
  uploadProductosBatch,
  uploadVariantesBatch,
  finalizeUpload,
} from "@/lib/actions/products";
import {
  parseStockFile,
  parseImagesFile,
  parseDiscountFiles,
  buildData,
  type ParsedResult,
} from "@/lib/client-parse";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UploadPhase =
  | "idle"
  | "parsing"
  | "initializing"
  | "productos"
  | "variantes"
  | "finalizing"
  | "done"
  | "error";

export function UploadModal({ open, onOpenChange }: UploadModalProps) {
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState("");

  const BATCH_SIZE = 500;
  const CONCURRENCY = 6;

  async function processBatches<T>(
    items: T[],
    sendFn: (batch: T[]) => Promise<{ success: boolean; msg: string }>,
    onProgress: (done: number, total: number) => void
  ): Promise<void> {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push(items.slice(i, i + BATCH_SIZE));
    }
    const total = batches.length;
    if (total === 0) return;

    let nextIdx = 0;
    let hasError = false;

    const worker = async () => {
      while (!hasError) {
        const idx = nextIdx++;
        if (idx >= total) break;
        const batch = batches[idx];
        const res = await sendFn(batch);
        if (!res.success) {
          hasError = true;
          throw new Error(res.msg);
        }
        onProgress(idx + 1, total);
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () =>
      worker()
    );

    const results = await Promise.allSettled(workers);

    const rejected = results.find((r) => r.status === "rejected");
    if (rejected) {
      throw rejected.reason instanceof Error
        ? rejected.reason
        : new Error(String(rejected.reason));
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setPhase("parsing");
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const stockFile = formData.get("stock") as File | null;
    const imagenesFile = formData.get("imagenes") as File | null;
    const descuentosFiles = formData.getAll("descuentos") as File[];

    if (!stockFile || stockFile.size === 0) {
      toast.error("El archivo de stock es obligatorio.");
      setLoading(false);
      setPhase("idle");
      return;
    }

    try {
      toast.info("Procesando archivos...");

      const [rows, dictImagenes, dictDescuentos] = await Promise.all([
        parseStockFile(stockFile),
        imagenesFile?.size
          ? parseImagesFile(imagenesFile)
          : Promise.resolve({} as Record<string, string | null>),
        descuentosFiles.some((f) => f.size > 0)
          ? parseDiscountFiles(descuentosFiles.filter((f) => f.size > 0))
          : Promise.resolve({} as Record<string, number>),
      ]);

      const data: ParsedResult = buildData(rows, dictImagenes, dictDescuentos);

      if (data.productos.length === 0) {
        throw new Error("No se encontraron productos válidos en el archivo.");
      }

      setPhase("initializing");
      const initRes = await initUpload();
      if (!initRes.success) throw new Error(initRes.msg);

      setPhase("productos");
      setProgress({
        current: 0,
        total: Math.ceil(data.productos.length / BATCH_SIZE),
      });
      await processBatches(
        data.productos,
        async (batch) => uploadProductosBatch(batch),
        (current, total) => setProgress({ current, total })
      );

      setPhase("variantes");
      setProgress({
        current: 0,
        total: Math.ceil(data.variantes.length / BATCH_SIZE),
      });
      await processBatches(
        data.variantes,
        async (batch) => uploadVariantesBatch(batch),
        (current, total) => setProgress({ current, total })
      );

      setPhase("finalizing");
      const finalRes = await finalizeUpload({
        total_productos: data.metadata.total_productos,
        total_variantes: data.metadata.total_variantes,
        valor_inventario: data.metadata.valor_inventario,
        conteo_marcas: data.metadata.conteo_marcas,
        conteo_descuentos: data.metadata.conteo_descuentos,
        imagenEntries: data.imagenEntries,
      });
      if (!finalRes.success) throw new Error(finalRes.msg);

      setPhase("done");
      toast.success(`Éxito. ${data.productos.length} artículos indexados.`);
      setTimeout(() => {
        onOpenChange(false);
        setPhase("idle");
      }, 1500);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      setPhase("error");
      setErrorMsg(msg);
      toast.error(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!loading) {
      onOpenChange(open);
      if (!open) setPhase("idle");
    }
  };

  const phaseInfo = (): { text: string; detail?: string } => {
    switch (phase) {
      case "parsing":
        return { text: "Parseando archivos..." };
      case "initializing":
        return { text: "Preparando base de datos..." };
      case "productos":
        return {
          text: "Subiendo productos...",
          detail: `Lote ${progress.current} / ${progress.total}`,
        };
      case "variantes":
        return {
          text: "Subiendo variantes...",
          detail: `Lote ${progress.current} / ${progress.total}`,
        };
      case "finalizing":
        return { text: "Finalizando..." };
      case "done":
        return { text: "¡Completado!" };
      case "error":
        return { text: "Error" };
      default:
        return { text: "" };
    }
  };

  const showForm = phase === "idle" || phase === "error";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#181d26]">Subir Reportes</DialogTitle>
          <DialogDescription className="text-[#41454d]">
            Sube los archivos necesarios para reconstruir la base de datos de
            stock.
          </DialogDescription>
        </DialogHeader>

        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stock" className="text-[#333840]">
                  Archivo de Stock (Excel)
                </Label>
                <Input
                  id="stock"
                  name="stock"
                  type="file"
                  accept=".xlsx,.xls"
                  required
                  disabled={loading}
                  className="border-[#dddddd]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imagenes" className="text-[#333840]">
                  Archivo de Imágenes (HTML)
                </Label>
                <Input
                  id="imagenes"
                  name="imagenes"
                  type="file"
                  accept=".html,.htm"
                  disabled={loading}
                  className="border-[#dddddd]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descuentos" className="text-[#333840]">
                  Archivos de Descuentos (Excel o HTML)
                </Label>
                <Input
                  id="descuentos"
                  name="descuentos"
                  type="file"
                  accept=".xlsx,.xls,.html,.htm"
                  multiple
                  disabled={loading}
                  className="border-[#dddddd]"
                />
              </div>
            </div>

            {phase === "error" && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {errorMsg}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="border-[#dddddd]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#1b61c9] hover:bg-[#1a3866] text-white"
              >
                Subir y Procesar
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-6 pt-4">
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              {phase === "done" ? (
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              ) : (
                <Loader2 className="w-10 h-10 animate-spin text-[#1b61c9]" />
              )}

              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-[#181d26]">
                  {phaseInfo().text}
                </p>
                {phaseInfo().detail && (
                  <p className="text-xs text-[#41454d]">
                    {phaseInfo().detail}
                  </p>
                )}
              </div>

              {(phase === "productos" || phase === "variantes") &&
                progress.total > 0 && (
                  <div className="w-full max-w-xs space-y-1">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1b61c9] rounded-full transition-all duration-300"
                        style={{
                          width: `${(progress.current / progress.total) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-[#41454d] text-right">
                      {Math.round(
                        (progress.current / progress.total) * 100
                      )}
                      %
                    </p>
                  </div>
                )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
