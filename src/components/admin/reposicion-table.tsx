"use client";

import { useState, useRef, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  Loader2,
  AlertTriangle,
  Download,
  Send,
  Square,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  buscarReposicion,
  publicarReposicion,
  detenerReposicion,
  isReposicionActiva,
  obtenerReposicionActual,
  type ReposicionItem,
} from "@/app/admin/actions";
import { getDiscountColor } from "@/lib/discount-colors";
import { exportReposicionToExcel } from "@/lib/export-reposicion-excel";

export function ReposicionTable() {
  const [items, setItems] = useState<ReposicionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [checking, setChecking] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([isReposicionActiva(), obtenerReposicionActual()]).then(
      ([active, items]) => {
        setIsActive(active);
        setItems(items);
        setSelectedCodes(items.map((i) => i.cod_universal));
        setChecking(false);
      }
    );
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setSelectedCodes([]);

    try {
      const text = await file.text();
      const codigos = text
        .split(/[\n\r,;\t]+/)
        .map((c) => c.trim())
        .filter(Boolean);

      if (codigos.length === 0) {
        toast.error("El archivo no contiene códigos.");
        return;
      }

      toast.info(`Buscando ${codigos.length} códigos en la base de datos...`);
      const result = await buscarReposicion(codigos);

      if (result.success) {
        setItems(result.items);
        setSelectedCodes(result.items.map((i) => i.cod_universal));
        setIsActive(false);
        toast.success(result.msg);
      } else {
        toast.error(result.msg);
      }
    } catch {
      toast.error("Error al leer el archivo.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (selectedCodes.length === 0) {
      toast.error("Selecciona al menos un código.");
      return;
    }

    setPublishing(true);
    try {
      const result = await publicarReposicion();
      if (result.success) {
        toast.success(result.msg);
        setIsActive(true);
      } else {
        toast.error(result.msg);
      }
    } catch {
      toast.error("Error al publicar.");
    } finally {
      setPublishing(false);
    }
  };

  const handleStop = async () => {
    setPublishing(true);
    try {
      const result = await detenerReposicion();
      if (result.success) {
        toast.success(result.msg);
        setIsActive(false);
      } else {
        toast.error(result.msg);
      }
    } catch {
      toast.error("Error al detener.");
    } finally {
      setPublishing(false);
    }
  };

  const toggleCode = (cod: string) => {
    setSelectedCodes((prev) =>
      prev.includes(cod) ? prev.filter((c) => c !== cod) : [...prev, cod]
    );
  };

  const toggleAll = () => {
    if (selectedCodes.length === items.length) {
      setSelectedCodes([]);
    } else {
      setSelectedCodes(items.map((i) => i.cod_universal));
    }
  };

  const columns: ColumnDef<ReposicionItem>[] = [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={items.length > 0 && selectedCodes.length === items.length}
          onChange={toggleAll}
          className="h-4 w-4 rounded border-[#dddddd] cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedCodes.includes(row.original.cod_universal)}
          onChange={() => toggleCode(row.original.cod_universal)}
          className="h-4 w-4 rounded border-[#dddddd] cursor-pointer"
        />
      ),
      size: 40,
    },
    {
      accessorKey: "cod_universal",
      header: "Cod. Universal",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.getValue("cod_universal")}</span>
      ),
    },
    {
      accessorKey: "marca",
      header: "Marca",
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-medium">
          {row.getValue("marca")}
        </Badge>
      ),
    },
    { accessorKey: "modelo", header: "Modelo" },
    { accessorKey: "genero", header: "Género" },
    { accessorKey: "categoria", header: "Categoría" },
    { accessorKey: "grupo", header: "Grupo" },
    { accessorKey: "color", header: "Color" },
    {
      accessorKey: "descuento",
      header: "Descuento",
      cell: ({ row }) => {
        const desc = row.getValue("descuento") as number;
        return (
          <Badge className={`${getDiscountColor(desc)} text-white`}>
            {desc}%
          </Badge>
        );
      },
    },
    {
      accessorKey: "precio_lista",
      header: "P. Lista",
      cell: ({ row }) => (
        <span className="font-medium">{formatPrice(row.getValue("precio_lista") as number)}</span>
      ),
    },
    {
      accessorKey: "precio_final",
      header: "P. Final",
      cell: ({ row }) => (
        <span className="font-medium">{formatPrice(row.getValue("precio_final") as number)}</span>
      ),
    },
    {
      accessorKey: "stock_total",
      header: "Stock",
      cell: ({ row }) => {
        const stock = row.getValue("stock_total") as number;
        return <span className={stock === 0 ? "text-[#dc2626] font-medium" : "font-medium"}>{stock}</span>;
      },
    },
  ];

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (checking) {
    return (
      <Card className="border-[#dddddd]">
        <CardContent className="p-6 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[#41454d]" />
          <p className="text-sm text-[#41454d]">Verificando estado...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-[#dddddd]">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-[#181d26]">
                Archivo de códigos (.txt)
              </p>
              <p className="text-xs text-[#41454d] mt-1">
                Un código por línea, separados por coma, punto y coma o tabulación.
              </p>
            </div>
            <Input
              ref={fileRef}
              type="file"
              accept=".txt,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={loading || publishing}
              className="bg-[#1b61c9] hover:bg-[#1a3866] text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Subir archivo
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card className={isActive ? "border-[#22c55e] bg-[#22c55e]/5" : "border-[#f97316] bg-[#f97316]/5"}>
          <CardContent className="p-4 flex items-center gap-3">
            {isActive ? (
              <CheckCircle2 className="h-5 w-5 text-[#22c55e]" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-[#f97316]" />
            )}
            <p className="text-sm font-medium text-[#181d26]">
              Reposición {isActive ? "publicada — visible en la vista de cliente." : "detenida — no visible en cliente."}
            </p>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#f97316]" />
              <p className="text-sm font-medium text-[#181d26]">
                {selectedCodes.length} de {items.length} productos seleccionados
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportReposicionToExcel(items.filter((i) => selectedCodes.includes(i.cod_universal)))}
                disabled={selectedCodes.length === 0}
                className="border-[#dddddd]"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar Excel
              </Button>
              {isActive ? (
                <Button
                  size="sm"
                  onClick={handleStop}
                  disabled={publishing}
                  className="bg-[#dc2626] hover:bg-[#b91c1c] text-white"
                >
                  {publishing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4 mr-2" />
                  )}
                  Detener
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handlePublish}
                  disabled={publishing || selectedCodes.length === 0}
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
                >
                  {publishing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Publicar
                </Button>
              )}
            </div>
          </div>

          <div className="border border-[#dddddd] rounded-lg overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="border-[#dddddd]">
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="text-[#41454d] font-medium text-xs">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="border-[#dddddd] hover:bg-[#f8fafc]">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3 text-sm text-[#333840]">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}
