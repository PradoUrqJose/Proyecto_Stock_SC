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
import { UploadCloud, Loader2 } from "lucide-react";
import { uploadStock } from "@/app/admin/actions";
import { toast } from "sonner";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadModal({ open, onOpenChange }: UploadModalProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      toast.info("Actualizando stock. Por favor espera...");
      const res = await uploadStock(formData);

      if (res.success) {
        toast.success(res.msg);
        onOpenChange(false);
      } else {
        toast.error(res.msg);
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#181d26]">Subir Reportes</DialogTitle>
          <DialogDescription className="text-[#41454d]">
            Sube los archivos necesarios para reconstruir la base de datos de stock a velocidad nativa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stock" className="text-[#333840]">Archivo de Stock (Excel)</Label>
              <Input id="stock" name="stock" type="file" accept=".xlsx,.xls" required disabled={loading} className="border-[#dddddd]" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imagenes" className="text-[#333840]">Archivo de Imágenes (HTML)</Label>
              <Input id="imagenes" name="imagenes" type="file" accept=".html,.htm" disabled={loading} className="border-[#dddddd]" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descuentos" className="text-[#333840]">Archivos de Descuentos (Excel o HTML)</Label>
              <Input id="descuentos" name="descuentos" type="file" accept=".xlsx,.xls,.html,.htm" multiple disabled={loading} className="border-[#dddddd]" />
            </div>
          </div>

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
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Subir y Procesar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
