import Link from "next/link";
import { Store, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTiendas, getUsuarios } from "./actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gestión" };

export default async function GestionPage() {
  const [tiendas, usuarios] = await Promise.all([getTiendas(), getUsuarios()]);

  const cards = [
    {
      href: "/admin/gestion/tiendas",
      icon: Store,
      label: "Tiendas",
      count: tiendas.length,
      desc: "Crear, editar y eliminar tiendas",
    },
    {
      href: "/admin/gestion/usuarios",
      icon: Users,
      label: "Usuarios",
      count: usuarios.length,
      desc: "Crear, editar y asignar tienda a usuarios",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[#181d26]">Gestión</h1>
        <p className="text-sm text-[#41454d] mt-1">
          Administra tiendas, usuarios y sus relaciones.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(({ href, icon: Icon, label, count, desc }) => (
          <Link key={href} href={href} className="group">
            <Card className="border-[#dddddd] shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3 text-base font-medium text-[#181d26]">
                  <span className="p-2 rounded-lg bg-[#f1f3f7] group-hover:bg-[#e4e8f0] transition-colors">
                    <Icon className="h-5 w-5 text-[#41454d]" />
                  </span>
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-[#181d26]">{count}</p>
                <p className="text-sm text-[#41454d] mt-1">{desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
