"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTableUrlState } from "@/hooks/use-table-url-state";
import Image from "next/image";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, flexRender, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Search, Upload, ArrowUpDown, Download, Package, X, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UploadModal } from "./upload-modal";
import { MultiFilter } from "@/components/multi-filter";
import { getDiscountColor, getDiscountTextClass } from "@/lib/discount-colors";
import { setProductoImagen, removeProductoImagen } from "@/lib/actions/products";
import { exportCatalogoExcel } from "@/lib/actions/export";
import type { ExportProduct } from "@/types";

interface ProductoAdmin {
  cod_universal: string;
  genero: string;
  grupo: string;
  marca: string;
  modelo: string;
  categoria: string;
  color: string;
  descuento: number;
  precio_lista: number;
  precio_final: number;
  stock_total: number;
  imagen_url: string | null;
}

interface ProductsTableProps {
  data: ProductoAdmin[];
  categorias: string[];
  grupos: string[];
  marcas: string[];
  descuentos: string[];
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

export function ProductsTable({ data, categorias, grupos, marcas, descuentos }: ProductsTableProps) {
  const router = useRouter();
  const { get, getAll, getPage, sync, makePaginationHandler } = useTableUrlState();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState(() => get("q"));
  const [filterCategoria, setFilterCategoria] = useState<string[]>(() => getAll("cat"));
  const [filterGrupo, setFilterGrupo] = useState<string[]>(() => getAll("grupo"));
  const [filterMarca, setFilterMarca] = useState<string[]>(() => getAll("marca"));
  const [filterDescuento, setFilterDescuento] = useState<string[]>(() => getAll("desc"));
  const [pagination, setPagination] = useState(() => ({
    pageIndex: getPage(),
    pageSize: 15,
  }));
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [savingImage, setSavingImage] = useState(false);

  // Builds a full URL snapshot from current state + any overrides
  const snap = (overrides: Record<string, string | string[] | number> = {}) =>
    sync({
      q: globalFilter,
      cat: filterCategoria,
      grupo: filterGrupo,
      marca: filterMarca,
      desc: filterDescuento,
      page: pagination.pageIndex + 1,
      ...overrides,
    });

  const handleSearchChange = (value: string) => {
    setGlobalFilter(value);
    setPagination(p => ({ ...p, pageIndex: 0 }));
    snap({ q: value, page: 1 });
  };
  const handleCategoriaChange = (values: string[]) => {
    setFilterCategoria(values);
    setPagination(p => ({ ...p, pageIndex: 0 }));
    snap({ cat: values, page: 1 });
  };
  const handleGrupoChange = (values: string[]) => {
    setFilterGrupo(values);
    setPagination(p => ({ ...p, pageIndex: 0 }));
    snap({ grupo: values, page: 1 });
  };
  const handleMarcaChange = (values: string[]) => {
    setFilterMarca(values);
    setPagination(p => ({ ...p, pageIndex: 0 }));
    snap({ marca: values, page: 1 });
  };
  const handleDescuentoChange = (values: string[]) => {
    setFilterDescuento(values);
    setPagination(p => ({ ...p, pageIndex: 0 }));
    snap({ desc: values, page: 1 });
  };

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

  const filteredData = useMemo(() => {
    let result = [...data];

    if (globalFilter) {
      const search = globalFilter.toLowerCase();
      result = result.filter(
        (p) => p.cod_universal.toLowerCase().includes(search) || p.marca.toLowerCase().includes(search) || p.modelo.toLowerCase().includes(search) || p.color.toLowerCase().includes(search),
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

    return result;
  }, [data, globalFilter, filterCategoria, filterGrupo, filterMarca, filterDescuento]);

  const columns: ColumnDef<ProductoAdmin>[] = useMemo(
    () => [
      {
        accessorKey: "imagen_url",
        header: "Imagen",
        cell: ({ row }) => {
          const url = row.original.imagen_url;
          const validUrl = url && (url.startsWith("http://") || url.startsWith("https://"));
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
                <Image src={url} alt={row.original.modelo} fill className="object-cover" loading="lazy" sizes="40px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#f0f0f0] hover:bg-[#e5e7eb]" title="Agregar imagen">
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
        cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("cod_universal")}</span>,
      },
      {
        accessorKey: "grupo",
        header: "Grupo",
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
      {
        accessorKey: "modelo",
        header: "Modelo",
      },
      {
        accessorKey: "categoria",
        header: "Categoria",
      },
      {
        accessorKey: "color",
        header: "Color",
      },
      {
        accessorKey: "descuento",
        header: "Descuento",
        cell: ({ row }) => {
          const desc = row.getValue("descuento") as number;
          return desc > 0 ? <Badge className={`${getDiscountColor(desc)} ${getDiscountTextClass(desc)} text-[13px]`}>{desc}%</Badge> : <span className="text-[#41454d]">-</span>;
        },
      },
      {
        accessorKey: "precio_final",
        header: "Precio Final",
        cell: ({ row }) => <span className="font-medium">{formatPrice(row.getValue("precio_final"))}</span>,
      },
      {
        accessorKey: "stock_total",
        header: "Stock",
        cell: ({ row }) => {
          const stock = row.getValue("stock_total") as number;
          return <span className={stock === 0 ? "text-[#dc2626] font-medium" : "font-medium"}>{stock}</span>;
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onPaginationChange: makePaginationHandler(pagination, setPagination, () => ({
      q: globalFilter, cat: filterCategoria, grupo: filterGrupo, marca: filterMarca, desc: filterDescuento,
    })),
    state: { sorting, pagination },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#41454d]" />
            <Input placeholder="Buscar por codigo, marca, modelo..." value={globalFilter} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9 border-[#dddddd]" />
          </div>
          <MultiFilter title="Categoria" options={categorias} selected={filterCategoria} onChange={handleCategoriaChange} />
          <MultiFilter title="Grupo" options={grupos} selected={filterGrupo} onChange={handleGrupoChange} />
          <MultiFilter title="Marca" options={marcas} selected={filterMarca} onChange={handleMarcaChange} />
          <MultiFilter title="Descuento" options={descuentos} selected={filterDescuento} onChange={handleDescuentoChange} />
        </div>
        <Button onClick={() => setShowUploadModal(true)} className="bg-[#1b61c9] hover:bg-[#1a3866] text-white">
          <Upload className="mr-2 h-4 w-4" />
          Actualizar Stock
        </Button>
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
                a.download = "catalogo_productos.xlsx";
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
      </div>

      <div className="border border-[#dddddd] rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-[#dddddd]">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="text-[#41454d] font-medium text-xs cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row, i) => (
                  <TableRow key={row.id} className="animate-row-enter border-[#dddddd] hover:bg-[#f8fafc]" style={{ "--index": i } as React.CSSProperties}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3 text-sm text-[#333840]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-[#41454d]">
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
          Mostrando {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} a{" "}
          {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} de {table.getFilteredRowModel().rows.length} productos
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="border-[#dddddd]">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-[#333840]">
            Pagina {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
          </span>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="border-[#dddddd]">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <UploadModal open={showUploadModal} onOpenChange={setShowUploadModal} />

      <Dialog open={!!editingImage} onOpenChange={() => setEditingImage(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Agregar imagen</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              Código:{" "}
              <a
                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(editingImage ?? "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[#1b61c9] hover:text-[#1a3866] underline underline-offset-2 decoration-dotted hover:decoration-solid transition-colors"
              >
                {editingImage}
                <Search className="h-3 w-3 opacity-60" />
              </a>
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

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
          <div className="relative aspect-square w-full bg-[#f8fafc]">
            {previewImage && <Image src={previewImage} alt="Preview" fill className="object-contain" sizes="(max-width: 600px) 100vw, 600px" />}
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
