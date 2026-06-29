"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Camera, Pencil } from "lucide-react";
import { getDiscountColor, getDiscountTextClass } from "@/lib/discount-colors";
import type { ColumnDef } from "@tanstack/react-table";
import type { Producto } from "@/types";

const DESCUENTOS_OPTIONS = [10, 20, 30, 40, 50, 60, 70];

function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

type Row = Producto & { descuentoN: number | null };

export function getColumns(
  updatePending: (codKey: string, valor: number | null, originalDesc: number) => void,
  setPreviewImage: (url: string | null) => void,
  setEditingImage: (cod: string | null) => void,
  setImageUrlInput: (url: string) => void
): ColumnDef<Row>[] {
  return [
    {
      accessorKey: "imagen_url",
      header: "Imagen",
      cell: ({ row }) => {
        const url = row.original.imagen_url;
        const validUrl =
          url && (url.startsWith("http://") || url.startsWith("https://"));
        return (
          <div
            className="w-10 h-10 relative rounded-md overflow-hidden bg-[#f8fafc] cursor-pointer hover:ring-2 hover:ring-[#1b61c9] transition-all group"
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
              <>
                <Image
                  src={url!}
                  alt={row.original.modelo}
                  fill
                  className="object-cover"
                  loading="lazy"
                  sizes="40px"
                />
                <div
                  className="absolute bottom-0 right-0 h-4 w-4 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Editar imagen"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingImage(row.original.cod_universal);
                    setImageUrlInput(url!);
                  }}
                >
                  <Pencil className="h-2.5 w-2.5 text-white" />
                </div>
              </>
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
          <Badge className={`${getDiscountColor(desc)} ${getDiscountTextClass(desc)} text-[13px]`}>
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
        const codKey = JSON.stringify([row.original.cod_universal, row.original.genero]);
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
              stock === 0 ? "text-[#dc2626] font-medium" : "font-medium"
            }
          >
            {stock}
          </span>
        );
      },
    },
  ];
}
