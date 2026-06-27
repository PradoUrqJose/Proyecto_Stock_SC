import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions";
import { getAllModules, getAdminUsersWithModules } from "./actions";
import { PermisosClient } from "@/components/admin/gestion/permisos-client";

export default async function PermisosPage() {
  const session = await getSession();
  if (!session || session.role !== "administrador_general") {
    redirect("/admin");
  }

  const [modules, admins] = await Promise.all([getAllModules(), getAdminUsersWithModules()]);

  return (
    <div className="mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#181d26]">Permisos de Módulos</h1>
        <p className="text-sm text-[#41454d] mt-1">Seleccioná qué módulos puede ver cada administrador.</p>
      </div>
      <Suspense fallback={null}>
        <PermisosClient admins={admins} modules={modules} />
      </Suspense>
    </div>
  );
}
