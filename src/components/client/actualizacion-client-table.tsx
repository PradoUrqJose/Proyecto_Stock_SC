"use client";

import { useState, useMemo } from "react";
import { useTableUrlState } from "@/hooks/use-table-url-state";
import Image from "next/image";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
  X,
  Package,
  ArrowRight,
} from "lucide-react";
import { getDiscountColor } from "@/lib/discount-colors";

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

interface ActualizacionClientTableProps {
  data: ProductoActualizacion[];
  descuentosAnteriores: Record<string, number>;
  tiendas: string[];
  tiendaStock: Record<string, number>;
  tiendaAsignada?: string | null;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

export function ActualizacionClientTable({
  data,
  descuentosAnteriores,
  tiendas,
  tiendaStock,
  tiendaAsignada,
}: ActualizacionClientTableProps) {
  const { get, getPage, sync, makePaginationHandler } = useTableUrlState();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState(() => get("q"));
  const [selectedTienda, setSelectedTienda] = useState<string>(() => tiendaAsignada ?? (get("tienda") || "all"));
  const [pagination, setPagination] = useState(() => ({ pageIndex: getPage(), pageSize: 15 }));
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const snap = (overrides: Record<string, string | number | null> = {}) =>
    sync({ q: globalFilter, tienda: selectedTienda === "all" ? null : selectedTienda, page: pagination.pageIndex + 1, ...overrides });

  const handleSearchChange = (value: string) => {
    setGlobalFilter(value);
    setPagination(p => ({ ...p, pageIndex: 0 }));
    snap({ q: value, page: 1 });
  };
  const handleTiendaChange = (value: string) => {
    setSelectedTienda(value);
    setPagination(p => ({ ...p, pageIndex: 0 }));
    snap({ tienda: value === "all" ? null : value, page: 1 });
  };

  const filteredData = useMemo(() => {
    let result = [...data];

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

    if (selectedTienda !== "all") {
      result = result.filter((p) => {
        const key = `${p.cod_universal}-${p.genero}-${selectedTienda}`;
        return (tiendaStock[key] ?? 0) > 0;
      });
    }

    return result;
  }, [data, globalFilter, selectedTienda, tiendaStock]);

  const columns: ColumnDef<ProductoActualizacion>[] = useMemo(
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
              className="w-12 h-12 relative rounded-md overflow-hidden bg-[#f8fafc] cursor-pointer hover:ring-2 hover:ring-[#1b61c9] transition-all"
              onClick={(e) => {
                e.stopPropagation();
                if (validUrl && url) setPreviewImage(url);
              }}
            >
              {validUrl ? (
                <Image
                  src={url}
                  alt={row.original.modelo}
                  fill
                  className="object-cover"
                  loading="lazy"
                  sizes="48px"
                />
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
      { accessorKey: "genero", header: "Género" },
      { accessorKey: "categoria", header: "Categoría" },
      { accessorKey: "grupo", header: "Grupo" },
      { accessorKey: "color", header: "Color" },
      {
        id: "descuento_anterior",
        header: "Desc. Anterior",
        cell: ({ row }) => {
          const key = `${row.original.cod_universal}-${row.original.genero}`;
          const descAnt = descuentosAnteriores[key];
          if (descAnt === undefined) return <span className="text-[#41454d]">-</span>;
          return descAnt > 0 ? (
            <Badge className={`${getDiscountColor(descAnt)} text-white`}>
              {descAnt}%
            </Badge>
          ) : (
            <span className="text-[#41454d]">0%</span>
          );
        },
      },
      {
        id: "cambio",
        header: "",
        cell: () => (
          <ArrowRight className="h-4 w-4 text-[#9297a0]" />
        ),
      },
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
            <span className="text-[#41454d]">0%</span>
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
        accessorKey: "precio_final",
        header: "P. Final",
        cell: ({ row }) => (
          <span className="font-medium">
            {formatPrice(row.getValue("precio_final") as number)}
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
      ...(selectedTienda !== "all"
        ? [
            {
              id: "stock_tienda",
              header: `Stock ${selectedTienda}`,
              cell: ({
                row,
              }: {
                row: { original: ProductoActualizacion };
              }) => {
                const key = `${row.original.cod_universal}-${row.original.genero}-${selectedTienda}`;
                const stock = tiendaStock[key] ?? 0;
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
            } as ColumnDef<ProductoActualizacion>,
          ]
        : []),
    ],
    [selectedTienda, tiendaStock, descuentosAnteriores]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onPaginationChange: makePaginationHandler(pagination, setPagination, () => ({
      q: globalFilter, tienda: selectedTienda === "all" ? null : selectedTienda,
    })),
    state: { sorting, pagination },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#41454d]" />
          <Input
            placeholder="Buscar por código, marca, modelo..."
            value={globalFilter}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 border-[#dddddd]"
          />
        </div>
        {!tiendaAsignada && (
          <Select
            value={selectedTienda}
            onValueChange={(v) => handleTiendaChange(v ?? "all")}
          >
            <SelectTrigger className="w-[180px] border-[#dddddd]">
              <SelectValue placeholder="Tienda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las tiendas</SelectItem>
              {tiendas.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
                table.getRowModel().rows.map((row, i) => (
                  <TableRow
                    key={row.id}
                    className="border-[#dddddd] hover:bg-[#f8fafc]"
                    style={{ "--index": i } as React.CSSProperties}
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
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-[#41454d]"
                  >
                    No se encontraron productos
                    {selectedTienda !== "all"
                      ? ` en ${selectedTienda}`
                      : ""}
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
            Página {table.getState().pagination.pageIndex + 1} de{" "}
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
