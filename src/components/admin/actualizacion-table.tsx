"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
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
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { MultiFilter } from "@/components/multi-filter";
import { setProductoImagen, removeProductoImagen } from "@/lib/actions/products";
import { usePendingDiscounts } from "@/hooks/use-pending-discounts";
import { useDiscountExport } from "@/hooks/use-discount-export";
import { getColumns } from "@/components/admin/actualizacion-columns";
import type { Producto } from "@/types";

interface ActualizacionTableProps {
  data: Producto[];
  descuentos: string[];
}

export function ActualizacionTable({ data, descuentos }: ActualizacionTableProps) {
  const router = useRouter();
  const {
    pending,
    pendingCount,
    dataWithPending,
    updatePending,
    handleGuardar,
  } = usePendingDiscounts(data);

  const { exporting, handleExport } = useDiscountExport();

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

  type Row = Producto & { descuentoN: number | null };

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

  useEffect(() => {
    setImageUrlInput("");
  }, [editingImage]);

  const filteredData = useMemo(() => {
    let result = dataWithPending as Row[];

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

  const handleSaveImage = useCallback(async () => {
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
  }, [editingImage, imageUrlInput, router]);

  const handleRemoveImage = useCallback(async (cod_universal: string) => {
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
  }, [router]);

  const onGuardar = useCallback(async () => {
    setSaving(true);
    try {
      await handleGuardar();
    } finally {
      setSaving(false);
    }
  }, [handleGuardar]);

  const columns = useMemo(
    () => getColumns(updatePending, setPreviewImage, setEditingImage),
    [updatePending]
  );

  const table = useReactTable({
    data: filteredData,
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
            onClick={() => handleExport(table.getFilteredRowModel().rows)}
            className="rounded-md whitespace-nowrap"
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exportando..." : "Exportar Excel"}
          </Button>
          <Button
            onClick={onGuardar}
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
