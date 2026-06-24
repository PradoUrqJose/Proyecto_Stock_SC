"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, flexRender, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Search, ArrowUpDown, X, Package, Download } from "lucide-react";
import { exportCatalogoExcel } from "@/lib/actions/export";
import { MultiFilter } from "@/components/multi-filter";
import { getDiscountColor } from "@/lib/discount-colors";
import { toast } from "sonner";
import type { ExportProduct } from "@/types";

interface ProductoClient {
  cod_universal: string;
  genero: string;
  marca: string;
  modelo: string;
  categoria: string;
  grupo: string;
  color: string;
  descuento: number;
  precio_final: number;
  stock_total: number;
  imagen_url: string | null;
}

interface ClientTableProps {
  data: ProductoClient[];
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

function isValidImageUrl(url: string | null): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

export function ClientTable({ data, categorias, grupos, marcas, descuentos }: ClientTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [filterCategoria, setFilterCategoria] = useState<string[]>([]);
  const [filterGrupo, setFilterGrupo] = useState<string[]>([]);
  const [filterMarca, setFilterMarca] = useState<string[]>([]);
  const [filterDescuento, setFilterDescuento] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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

  const columns: ColumnDef<ProductoClient>[] = useMemo(
    () => [
      {
        accessorKey: "imagen_url",
        header: "Imagen",
        cell: ({ row }) => {
          const url = row.getValue("imagen_url") as string | null;
          const validUrl = isValidImageUrl(url);
          return (
            <div
              className="w-12 h-12 relative rounded-md overflow-hidden bg-[#f8fafc] cursor-pointer hover:ring-2 hover:ring-[#1b61c9] transition-all"
              onClick={(e) => {
                e.stopPropagation();
                if (validUrl && url) setPreviewImage(url);
              }}
            >
              {validUrl && url ? (
                <Image src={url} alt={row.original.modelo} fill className="object-cover" loading="lazy" sizes="48px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#f0f0f0]">
                  <Package className="h-5 w-5 text-[#9297a0]" />
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
          return desc > 0 ? <Badge className={`${getDiscountColor(desc)} text-white`}>{desc}%</Badge> : <span className="text-[#41454d]">-</span>;
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
    state: { sorting },
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#41454d]" />
          <Input placeholder="Buscar por codigo, marca, modelo..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="pl-9 border-[#dddddd]" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MultiFilter title="Categoria" options={categorias} selected={filterCategoria} onChange={setFilterCategoria} />
          <MultiFilter title="Grupo" options={grupos} selected={filterGrupo} onChange={setFilterGrupo} />
          <MultiFilter title="Marca" options={marcas} selected={filterMarca} onChange={setFilterMarca} />
          <MultiFilter title="Descuento" options={descuentos} selected={filterDescuento} onChange={setFilterDescuento} />
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
                if (result.success && result.buffer) {
                  const binary = atob(result.buffer);
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

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
          <div className="relative aspect-square w-full bg-[#f8fafc]">
            {previewImage && isValidImageUrl(previewImage) && <Image src={previewImage} alt="Preview" fill className="object-contain" sizes="(max-width: 600px) 100vw, 600px" />}
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
