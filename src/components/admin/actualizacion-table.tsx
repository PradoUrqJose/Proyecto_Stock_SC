"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
  AlertTriangle,
  Loader2,
  X,
  Camera,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { MultiFilter } from "@/components/multi-filter";
import { getDiscountColor } from "@/lib/discount-colors";
import { guardarDescuentos } from "@/lib/actions/discounts";
import { setProductoImagen, removeProductoImagen } from "@/lib/actions/products";
import { exportCatalogoExcel } from "@/lib/actions/export";
import type { ExportProduct } from "@/types";

const STORAGE_KEY = "descuentos_pendientes_actualizacion";
const DESCUENTOS_OPTIONS = [10, 20, 30, 40, 50, 60, 70];

interface ProductoActualizacion {
  cod_universal: string;
  genero: string;
  marca: string;
  modelo: string;
  categoria: string;
  grupo: string;
  color: string;
  descuento: number;
  precio_lista: number;
  precio_final: number;
  stock_total: number;
  imagen_url: string | null;
}

interface ActualizacionTableProps {
  data: ProductoActualizacion[];
  descuentos: string[];
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

function loadPending(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePending(pending: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
}

export function ActualizacionTable({ data, descuentos }: ActualizacionTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });
  const [globalFilter, setGlobalFilter] = useState("");
  const [filterCategoria, setFilterCategoria] = useState<string[]>([]);
  const [filterGrupo, setFilterGrupo] = useState<string[]>([]);
  const [filterMarca, setFilterMarca] = useState<string[]>([]);
  const [filterDescuento, setFilterDescuento] = useState<string[]>([]);
  const [filterDescNuevo, setFilterDescNuevo] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [savingImage, setSavingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [pending, setPending] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPending(loadPending());
    setLoaded(true);
  }, []);

  const pendingCount = useMemo(
    () => Object.keys(pending).length,
    [pending]
  );

  const prevFiltersRef = useRef({ globalFilter, filterCategoria, filterGrupo, filterMarca, filterDescuento, filterDescNuevo });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.globalFilter !== globalFilter ||
      prev.filterCategoria !== filterCategoria ||
      prev.filterGrupo !== filterGrupo ||
      prev.filterMarca !== filterMarca ||
      prev.filterDescuento !== filterDescuento ||
      prev.filterDescNuevo !== filterDescNuevo
    ) {
      setPagination((p) => ({ ...p, pageIndex: 0 }));
      prevFiltersRef.current = { globalFilter, filterCategoria, filterGrupo, filterMarca, filterDescuento, filterDescNuevo };
    }
  }, [globalFilter, filterCategoria, filterGrupo, filterMarca, filterDescuento, filterDescNuevo]);

  useEffect(() => {
    if (pendingCount === 0 && filterDescNuevo) {
      setFilterDescNuevo(false);
    }
  }, [pendingCount, filterDescNuevo]);

  const updatePending = useCallback(
    (codKey: string, valor: number | null, originalDesc: number) => {
      setPending((prev) => {
        const next = { ...prev };
        if (valor === null || valor === originalDesc) {
          delete next[codKey];
        } else {
          next[codKey] = valor;
        }
        savePending(next);
        return next;
      });
    },
    []
  );

  const pendingDescuentos = useMemo(() => {
    const vals = Object.values(pending);
    return [...new Set(vals)].sort((a, b) => a - b).map((v) => `${v}%`);
  }, [pending]);

  type Row = ProductoActualizacion & { descuentoN: number | null };

  const dataWithPending = useMemo<Row[]>(() => {
    if (!loaded) return data as Row[];
    return data.map((p) => {
      const key = `${p.cod_universal}-${p.genero}`;
      const pendingValue = pending[key];
      if (pendingValue !== undefined) {
        return { ...p, descuentoN: pendingValue };
      }
      return { ...p, descuentoN: null as number | null };
    });
  }, [data, pending, loaded]);

  const filteredData = useMemo(() => {
    let result = [...dataWithPending];

    if (globalFilter) {
      const search = globalFilter.toLowerCase();
      result = result.filter(
        (p) =>
          p.cod_universal.toLowerCase().includes(search) ||
          p.marca.toLowerCase().includes(search) ||
          p.modelo.toLowerCase().includes(search) ||
          p.color.toLowerCase().includes(search)
      );
    }

    if (filterCategoria.length > 0) {
      result = result.filter((p) => filterCategoria.includes(p.categoria));
    }
    if (filterGrupo.length > 0) {
      result = result.filter((p) => filterGrupo.includes(p.grupo));
    }
    if (filterMarca.length > 0) {
      result = result.filter((p) => filterMarca.includes(p.marca));
    }
    if (filterDescuento.length > 0) {
      result = result.filter((p) => filterDescuento.includes(`${p.descuento}%`));
    }
    if (filterDescNuevo) {
      result = result.filter((p) => p.descuentoN !== null);
    }

    return result;
  }, [dataWithPending, globalFilter, filterCategoria, filterGrupo, filterMarca, filterDescuento, filterDescNuevo]);

  const categorias = useMemo(
    () => [...new Set(data.map((p) => p.categoria))].sort(),
    [data]
  );
  const grupos = useMemo(
    () => [...new Set(data.map((p) => p.grupo))].sort(),
    [data]
  );
  const marcas = useMemo(
    () => [...new Set(data.map((p) => p.marca))].sort(),
    [data]
  );

  const handleSaveImage = async () => {
    if (!editingImage || !imageUrlInput.trim()) return;
    if (!imageUrlInput.startsWith("https://")) {
      toast.error("La URL debe ser HTTPS.");
      return;
    }
    setSavingImage(true);
    try {
      const result = await setProductoImagen(editingImage, imageUrlInput.trim());
      if (result.success) {
        toast.success(result.msg);
        setEditingImage(null);
        setImageUrlInput("");
        router.refresh();
      } else {
        toast.error(result.msg);
      }
    } catch {
      toast.error("Error al guardar imagen.");
    } finally {
      setSavingImage(false);
    }
  };

  const handleRemoveImage = async (cod_universal: string) => {
    try {
      const result = await removeProductoImagen(cod_universal);
      if (result.success) {
        toast.success(result.msg);
        router.refresh();
      } else {
        toast.error(result.msg);
      }
    } catch {
      toast.error("Error al eliminar imagen.");
    }
  };

  const handleGuardar = async () => {
    const updates = Object.entries(pending).map(([key, af_descuento]) => {
      const [cod_universal, genero] = key.split("-");
      const original = data.find(
        (p) => p.cod_universal === cod_universal && p.genero === genero
      );
      return {
        cod_universal,
        genero,
        bf_descuento: original?.descuento ?? 0,
        af_descuento,
      };
    });

    setSaving(true);
    try {
      const result = await guardarDescuentos(updates);
      if (result.success) {
        toast.success(result.msg);
        setPending({});
        savePending({});
        router.refresh();
      } else {
        toast.error(result.msg);
      }
    } catch {
      toast.error("Error al guardar descuentos.");
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      {
        accessorKey: "imagen_url",
        header: "Imagen",
        cell: ({ row }) => {
          const url = row.original.imagen_url;
          const validUrl =
            url && (url.startsWith("http://") || url.startsWith("https://"));
          return (
            <div
              className="w-10 h-10 relative rounded-md overflow-hidden bg-[#f8fafc] cursor-pointer hover:ring-2 hover:ring-[#1b61c9] transition-all"
              onClick={(e) => {
                e.stopPropagation();
                if (validUrl && url) {
                  setPreviewImage(url);
                } else {
                  setEditingImage(row.original.cod_universal);
                  setImageUrlInput("");
                }
              }}
            >
              {validUrl ? (
                <Image
                  src={url}
                  alt={row.original.modelo}
                  fill
                  className="object-cover"
                  loading="lazy"
                  sizes="40px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#f0f0f0] hover:bg-[#e5e7eb]">
                  <Camera className="h-4 w-4 text-[#9297a0]" />
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "cod_universal",
        header: "Cod. Universal",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.getValue("cod_universal")}
          </span>
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
      { accessorKey: "categoria", header: "Categoria" },
      { accessorKey: "color", header: "Color" },
      {
        accessorKey: "descuento",
        header: "Desc. Actual",
        cell: ({ row }) => {
          const desc = row.getValue("descuento") as number;
          return desc > 0 ? (
            <Badge className={`${getDiscountColor(desc)} text-white`}>
              {desc}%
            </Badge>
          ) : (
            <span className="text-[#41454d]">-</span>
          );
        },
      },
      {
        accessorKey: "descuentoN",
        header: "Desc. Nuevo",
        cell: ({ row }) => {
          const codKey = `${row.original.cod_universal}-${row.original.genero}`;
          const current = row.original.descuentoN;
          const originalDesc = row.original.descuento;
          return (
            <select
              value={current ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                updatePending(codKey, val, originalDesc);
              }}
              className="border border-[#dddddd] rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1b61c9]"
            >
              <option value="">-</option>
              <option value={0}>0%</option>
              {DESCUENTOS_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}%
                </option>
              ))}
            </select>
          );
        },
      },
      {
        accessorKey: "precio_lista",
        header: "P. Lista",
        cell: ({ row }) => (
          <span className="font-medium">
            {formatPrice(row.getValue("precio_lista") as number)}
          </span>
        ),
      },
      {
        accessorKey: "stock_total",
        header: "Stock",
        cell: ({ row }) => {
          const stock = row.getValue("stock_total") as number;
          return (
            <span
              className={
                stock === 0
                  ? "text-[#dc2626] font-medium"
                  : "font-medium"
              }
            >
              {stock}
            </span>
          );
        },
      },
    ],
    [updatePending]
  );

  const table = useReactTable({
    data: filteredData as Row[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: { sorting, pagination },
    pageCount: Math.ceil(filteredData.length / 15),
  });

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#f97316]/10 border border-[#f97316]/30">
          <AlertTriangle className="h-5 w-5 text-[#f97316] shrink-0" />
          <span className="text-sm font-medium text-[#181d26]">
            {pendingCount} descuento{pendingCount !== 1 ? "s" : ""} modificado
            {pendingCount !== 1 ? "s" : ""} por guardar
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#41454d]" />
            <Input
              placeholder="Buscar por codigo, marca, modelo..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 border-[#dddddd]"
            />
          </div>
          <MultiFilter
            title="Categoria"
            options={categorias}
            selected={filterCategoria}
            onChange={setFilterCategoria}
          />
          <MultiFilter
            title="Grupo"
            options={grupos}
            selected={filterGrupo}
            onChange={setFilterGrupo}
          />
          <MultiFilter
            title="Marca"
            options={marcas}
            selected={filterMarca}
            onChange={setFilterMarca}
          />
          <MultiFilter
            title="Descuento"
            options={descuentos}
            selected={filterDescuento}
            onChange={setFilterDescuento}
          />
          <Button
            variant={filterDescNuevo ? "default" : "outline"}
            size="sm"
            disabled={pendingCount === 0}
            onClick={() => setFilterDescNuevo(!filterDescNuevo)}
            className={`whitespace-nowrap ${
              filterDescNuevo
                ? "bg-[#f97316] hover:bg-[#ea580c] text-white"
                : "border-[#dddddd] text-[#41454d]"
            }`}
          >
            Desc Nuevo {pendingCount > 0 ? `(${pendingCount})` : ""}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const rows = table.getFilteredRowModel().rows;
                const allData: ExportProduct[] = rows.map((r) => r.original as ExportProduct);
                const result = await exportCatalogoExcel(allData);
                if (result.success && result.data) {
                  const binary = atob(result.data);
                  const bytes = new Uint8Array(binary.length);
                  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
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
            }}
            className="rounded-md whitespace-nowrap"
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exportando..." : "Exportar Excel"}
          </Button>
          <Button
            onClick={handleGuardar}
            disabled={saving || pendingCount === 0}
            className="bg-[#1b61c9] hover:bg-[#1a3866] text-white"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Guardar
          </Button>
        </div>
      </div>

      <div className="border border-[#dddddd] rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-[#dddddd]">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-[#41454d] font-medium text-xs cursor-pointer select-none"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row, i) => {
                  const codKey = `${row.original.cod_universal}-${row.original.genero}`;
                  const isModified = pending[codKey] !== undefined;
                  return (
                    <TableRow
                      key={row.id}
                      className={`border-[#dddddd] hover:bg-[#f8fafc] ${
                        isModified ? "bg-[#f97316]/5" : ""
                      }`}
                      style={
                        { "--index": i } as React.CSSProperties
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="py-3 text-sm text-[#333840]"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-[#41454d]"
                  >
                    No se encontraron productos
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-[#41454d]">
          Mostrando{" "}
          {table.getState().pagination.pageIndex *
            table.getState().pagination.pageSize +
            1}{" "}
          a{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) *
              table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )}{" "}
          de {table.getFilteredRowModel().rows.length} productos
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border-[#dddddd]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-[#333840]">
            Pagina {table.getState().pagination.pageIndex + 1} de{" "}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border-[#dddddd]"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={!!editingImage} onOpenChange={() => setEditingImage(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Agregar imagen</DialogTitle>
            <DialogDescription>
              Código: <span className="font-mono">{editingImage}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="https://ejemplo.com/imagen.jpg"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              className="border-[#dddddd]"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingImage(null)}
                className="border-[#dddddd]"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveImage}
                disabled={savingImage || !imageUrlInput.trim()}
                className="bg-[#1b61c9] hover:bg-[#1a3866] text-white"
              >
                {savingImage ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewImage}
        onOpenChange={() => setPreviewImage(null)}
      >
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
          <div className="relative aspect-square w-full bg-[#f8fafc]">
            {previewImage && (
              <Image
                src={previewImage}
                alt="Preview"
                fill
                className="object-contain"
                sizes="(max-width: 600px) 100vw, 600px"
              />
            )}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
