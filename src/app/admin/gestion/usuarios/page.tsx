import { Suspense } from "react";
import { getUsuarios, getTiendas } from "../actions";
import { UsuariosClient } from "@/components/admin/gestion/usuarios-client";
import { getSession } from "@/lib/actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  const [usuarios, tiendas, session] = await Promise.all([
    getUsuarios(),
    getTiendas(),
    getSession(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[#181d26]">Usuarios</h1>
        <p className="text-sm text-[#41454d] mt-1">
          Crea y gestiona los accesos. Asigna una tienda a los clientes para filtrar su vista.
        </p>
      </div>
      <Suspense fallback={null}>
        <UsuariosClient
          usuarios={usuarios}
          tiendas={tiendas}
          currentUserId={session?.id ?? ""}
        />
      </Suspense>
    </div>
  );
}
