import { Suspense } from "react";
import { getTiendas, getAlmacenesDisponibles } from "../actions";
import { TiendasClient } from "@/components/admin/gestion/tiendas-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tiendas" };

export default async function TiendasPage() {
  const [tiendas, almacenes] = await Promise.all([
    getTiendas(),
    getAlmacenesDisponibles(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[#181d26]">Tiendas</h1>
        <p className="text-sm text-[#41454d] mt-1">
          Las tiendas deben coincidir con el nombre del almacén en la base de datos.
        </p>
      </div>
      <Suspense fallback={null}>
        <TiendasClient tiendas={tiendas} almacenes={almacenes} />
      </Suspense>
    </div>
  );
}
