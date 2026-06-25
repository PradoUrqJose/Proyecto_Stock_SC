"use client";

import { useState, useMemo, Fragment, useCallback } from "react";
import { useTableUrlState } from "@/hooks/use-table-url-state";
import Image from "next/image";
import { useReactTable, getCoreRowModel, getPaginationRowModel, getExpandedRowModel, flexRender, type ColumnDef, type SortingState, type ExpandedState } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, ArrowUpDown, X, Package, ArrowDown, ArrowUp, Loader2, FileSpreadsheet, FileArchive } from "lucide-react";
import { getDiscountColor } from "@/lib/discount-colors";
import { getVariantesByProducto } from "@/lib/actions/products";
import { exportUpdatesExcel } from "@/lib/actions/export";
import { exportUpdatesZip } from "@/lib/export-updates-zip";
import { MultiFilter } from "@/components/multi-filter";
import type { VarianteRow } from "@/types";

interface UpdateRow {
  cod_universal: string;
  genero: string;
  grupo: string;
  modelo: string;
  bf_descuento: number;
  af_descuento: number;
  just_updated: string;
  imagen_url: string | null;
  precio_lista: number;
}

interface Props {
  data: UpdateRow[];
  tiendas: string[];
  productoTiendas: Record<string, string[]>;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

type SubSortKey = keyof VarianteRow;

export function ActualizacionUpdatesTable({ data, tiendas, productoTiendas }: Props) {
  const { get, getAll, getPage, sync, makePaginationHandler } = useTableUrlState();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState(() => get("q"));
  const [selectedTiendas, setSelectedTiendas] = useState<string[]>(() => getAll("tienda"));
  const [pagination, setPagination] = useState(() => ({ pageIndex: getPage(), pageSize: 15 }));
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [subSort, setSubSort] = useState<{ key: SubSortKey; dir: "asc" | "desc" } | null>(null);
  const [fetchedVariantes, setFetchedVariantes] = useState<Record<string, VarianteRow[]>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingZip, setLoadingZip] = useState(false);

  const filteredData = useMemo(() => {
    let result = data;

    if (selectedTiendas.length > 0) {
      result = result.filter((p) => {
        const key = `${p.cod_universal}-${p.genero}`;
        const tiendasDelProducto = productoTiendas[key] ?? [];
        return selectedTiendas.some((t) => tiendasDelProducto.includes(t));
      });
    }

    if (globalFilter) {
      const search = globalFilter.toLowerCase();
      result = result.filter((p) => p.cod_universal.toLowerCase().includes(search) || p.modelo.toLowerCase().includes(search) || p.grupo.toLowerCase().includes(search));
    }

    return result;
  }, [data, globalFilter, selectedTiendas, productoTiendas]);

  const snap = (overrides: Record<string, string | string[] | number> = {}) =>
    sync({ q: globalFilter, tienda: selectedTiendas, page: pagination.pageIndex + 1, ...overrides });

  const handleSearchChange = (value: string) => {
    setGlobalFilter(value);
    setPagination(p => ({ ...p, pageIndex: 0 }));
    snap({ q: value, page: 1 });
  };
  const handleTiendasChange = (values: string[]) => {
    setSelectedTiendas(values);
    setPagination(p => ({ ...p, pageIndex: 0 }));
    snap({ tienda: values, page: 1 });
  };

  const handleToggleExpand = useCallback(
    async (row: any) => {
      const key = `${row.original.cod_universal}-${row.original.genero}`;

      if (row.getIsExpanded()) {
        row.toggleExpanded();
        return;
      }

      if (fetchedVariantes[key]) {
        row.toggleExpanded();
        return;
      }

      setLoadingKey(key);
      const result = await getVariantesByProducto(row.original.cod_universal, row.original.genero);

      if (result.success && result.data) {
        const enriched = result.data.map((v) => ({
          ...v,
          bf_descuento: row.original.bf_descuento,
          af_descuento: row.original.af_descuento,
          precio_final: v.precio_lista * (1 - row.original.af_descuento / 100),
        }));
        setFetchedVariantes((prev) => ({ ...prev, [key]: enriched }));
        row.toggleExpanded();
      }

      setLoadingKey(null);
    },
    [fetchedVariantes],
  );

  const handleExportExcel = useCallback(async () => {
    if (filteredData.length === 0) return;
    setLoadingExcel(true);
    try {
      const result = await exportUpdatesExcel(filteredData);
      if (result.success && result.data) {
        const binary = atob(result.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "registro_cambios.xlsx";
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setLoadingExcel(false);
    }
  }, [filteredData]);

  const handleExportZip = useCallback(async () => {
    if (filteredData.length === 0) return;
    setLoadingZip(true);
    try {
      await exportUpdatesZip(filteredData);
    } finally {
      setLoadingZip(false);
    }
  }, [filteredData]);

  const columns: ColumnDef<UpdateRow>[] = useMemo(
    () => [
      {
        id: "actions",
        enableSorting: false,
        header: "",
        cell: ({ row }) => {
          const isExpanded = row.getIsExpanded();
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpand(row);
              }}
              className="p-1 rounded transition-colors text-emerald-600 hover:bg-emerald-50 cursor-pointer"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          );
        },
      },
      {
        accessorKey: "imagen_url",
        enableSorting: false,
        header: "Imagen",
        cell: ({ row }) => {
          const url = row.original.imagen_url;
          const validUrl = url && (url.startsWith("http://") || url.startsWith("https://"));
          return (
            <div
              className="w-12 h-12 relative rounded-md overflow-hidden bg-[#f8fafc] cursor-pointer hover:ring-2 hover:ring-[#1b61c9] transition-all"
              onClick={(e) => {
                e.stopPropagation();
                if (validUrl && url) setPreviewImage(url);
              }}
            >
              {validUrl ? (
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
      { accessorKey: "grupo", header: "Grupo" },
      { accessorKey: "modelo", header: "Modelo" },
      { accessorKey: "genero", header: "Género" },
      {
        accessorKey: "bf_descuento",
        header: "Desc. Anterior",
        cell: ({ row }) => {
          const desc = row.getValue("bf_descuento") as number;
          return desc > 0 ? <Badge className={`${getDiscountColor(desc)} text-white`}>{desc}%</Badge> : <span className="text-[#41454d]">0%</span>;
        },
      },
      {
        accessorKey: "af_descuento",
        header: "Desc. Actual",
        cell: ({ row }) => {
          const desc = row.getValue("af_descuento") as number;
          return desc > 0 ? <Badge className={`${getDiscountColor(desc)} text-white`}>{desc}%</Badge> : <span className="text-[#41454d]">0%</span>;
        },
      },
      {
        accessorKey: "precio_lista",
        header: "P. Lista",
        cell: ({ row }) => <span className="font-medium">{formatPrice(row.getValue("precio_lista") as number)}</span>,
      },
      {
        id: "precio_final",
        header: "P. Final",
        accessorFn: (row) => row.precio_lista * (1 - row.af_descuento / 100),
        cell: ({ row }) => <span className="font-medium">{formatPrice(row.getValue("precio_final") as number)}</span>,
      },
      { accessorKey: "just_updated", header: "Fecha" },
    ],
    [handleToggleExpand],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onPaginationChange: makePaginationHandler(pagination, setPagination, () => ({
      q: globalFilter, tienda: selectedTiendas,
    })),
    state: { sorting, expanded, pagination },
    getRowCanExpand: () => true,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#41454d]" />
          <Input placeholder="Buscar por código, modelo..." value={globalFilter} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9 border-[#dddddd]" />
        </div>
        {tiendas.length > 0 && <MultiFilter title="Tiendas" options={tiendas} selected={selectedTiendas} onChange={handleTiendasChange} />}
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={loadingExcel || filteredData.length === 0} className="border-[#dddddd] gap-1.5">
            {loadingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Exportar Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportZip} disabled={loadingZip || filteredData.length === 0} className="border-[#dddddd] gap-1.5">
            {loadingZip ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
            Exportar Archivos
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
                        {header.column.getCanSort() && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => {
                  const key = `${row.original.cod_universal}-${row.original.genero}`;
                  const variantesData = fetchedVariantes[key] ?? [];
                  const sortedVariantes = !subSort
                    ? variantesData
                    : [...variantesData].sort((a, b) => {
                        const aVal = a[subSort.key];
                        const bVal = b[subSort.key];
                        if (aVal == null) return 1;
                        if (bVal == null) return -1;
                        if (typeof aVal === "string" && typeof bVal === "string") {
                          return subSort.dir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                        }
                        const aNum = Number(aVal);
                        const bNum = Number(bVal);
                        return subSort.dir === "asc" ? aNum - bNum : bNum - aNum;
                      });

                  const toggleSubSort = (colKey: SubSortKey) => {
                    setSubSort((prev) => {
                      if (prev?.key === colKey) {
                        return { key: colKey, dir: prev.dir === "asc" ? "desc" : "asc" };
                      }
                      return { key: colKey, dir: "asc" };
                    });
                  };

                  const subSortIcon = (colKey: SubSortKey) => {
                    if (subSort?.key !== colKey) return <ArrowUpDown className="h-3 w-3 opacity-50 inline ml-1" />;
                    return subSort.dir === "asc" ? <ArrowUp className="h-3 w-3 inline ml-1 text-emerald-600" /> : <ArrowDown className="h-3 w-3 inline ml-1 text-emerald-600" />;
                  };

                  return (
                    <Fragment key={row.id}>
                      <TableRow className="border-[#dddddd] hover:bg-[#f8fafc]">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-3 text-sm text-[#333840]">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                      {row.getIsExpanded() && (
                        <TableRow className="bg-[#f0fdf4]">
                          <TableCell colSpan={columns.length} className="p-0">
                            <div className="px-4 py-3">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-emerald-200">
                                    {(
                                      [
                                        { key: "alm_izq", label: "Alm. Izq" },
                                        { key: "alm_der", label: "Alm. Der" },
                                        { key: "cod_barras", label: "Cod. Barras" },
                                        { key: "modelo", label: "Modelo" },
                                        { key: "genero", label: "Género" },
                                        { key: "cod_universal", label: "Cod. Universal" },
                                        { key: "talla", label: "Talla" },
                                        { key: "bf_descuento", label: "Desc. Anterior" },
                                        { key: "af_descuento", label: "Desc. Actual" },
                                        { key: "precio_final", label: "P. Final" },
                                        { key: "precio_lista", label: "P. Lista" },
                                      ] as const
                                    ).map((col) => (
                                      <th
                                        key={col.key}
                                        className="text-left text-xs font-medium text-[#41454d] px-2 py-2 cursor-pointer select-none hover:text-[#181d26]"
                                        onClick={() => toggleSubSort(col.key as SubSortKey)}
                                      >
                                        {col.label}
                                        {subSortIcon(col.key as SubSortKey)}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedVariantes.length > 0 ? (
                                    sortedVariantes.map((v, idx) => (
                                      <tr key={`${v.cod_barras}-${idx}`} className="border-b border-emerald-100 hover:bg-emerald-50/50">
                                        <td className="px-2 py-2 text-[#333840]">{v.alm_izq}</td>
                                        <td className="px-2 py-2 text-[#333840]">{v.alm_der ?? "-"}</td>
                                        <td className="px-2 py-2 font-mono text-xs text-[#333840]">{v.cod_barras}</td>
                                        <td className="px-2 py-2 text-[#333840]">{v.modelo}</td>
                                        <td className="px-2 py-2 text-[#333840]">{v.genero}</td>
                                        <td className="px-2 py-2 font-mono text-xs text-[#333840]">{v.cod_universal}</td>
                                        <td className="px-2 py-2 text-[#333840]">{v.talla}</td>
                                        <td className="px-2 py-2">
                                          {v.bf_descuento > 0 ? (
                                            <Badge className={`${getDiscountColor(v.bf_descuento)} text-white`}>{v.bf_descuento}%</Badge>
                                          ) : (
                                            <span className="text-[#41454d]">0%</span>
                                          )}
                                        </td>
                                        <td className="px-2 py-2">
                                          {v.af_descuento > 0 ? (
                                            <Badge className={`${getDiscountColor(v.af_descuento)} text-white`}>{v.af_descuento}%</Badge>
                                          ) : (
                                            <span className="text-[#41454d]">0%</span>
                                          )}
                                        </td>
                                        <td className="px-2 py-2 font-medium text-[#333840]">{formatPrice(v.precio_final)}</td>
                                        <td className="px-2 py-2 text-[#333840]">{formatPrice(v.precio_lista)}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={11} className="h-12 text-center text-[#41454d] text-sm">
                                        No hay variantes disponibles
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
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
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
          </span>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="border-[#dddddd]">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

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

      {loadingKey !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-3 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-[#1b61c9]" />
            <span className="text-sm text-[#41454d]">Cargando variantes...</span>
          </div>
        </div>
      )}
    </div>
  );
}
