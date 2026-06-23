import { ReposicionTable } from "@/components/admin/reposicion-table";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reposición",
};

export default async function AdminReposicionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[#181d26]">Reposición</h1>
        <p className="text-sm text-[#41454d] mt-1">
          Sube un archivo .txt con códigos universales para retirar descuentos por reposición.
        </p>
      </div>
      <ReposicionTable />
    </div>
  );
}
