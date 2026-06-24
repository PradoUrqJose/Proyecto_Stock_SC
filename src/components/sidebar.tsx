"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/lib/actions";
import {
  LayoutDashboard,
  Package,
  LogOut,
  Search,
  Menu,
  X,
  RefreshCcw,
  Percent,
  Settings,
  Store,
  Users,
  Wrench,
  History,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  role: "admin" | "client";
}

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
];

const adminOperacionLinks = [
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/actualizacion", label: "Actualización", icon: Percent },
  { href: "/admin/reposicion", label: "Reposición", icon: RefreshCcw },
  { href: "/admin/actualizacion-updates", label: "Registro Cambios", icon: History },
];

const adminGestionLinks = [
  { href: "/admin/gestion/tiendas", label: "Tiendas", icon: Store },
  { href: "/admin/gestion/usuarios", label: "Usuarios", icon: Users },
];

const clientLinks = [
  { href: "/client", label: "Catalogo", icon: Search },
  { href: "/client/actualizacion", label: "Actualización", icon: Percent },
  { href: "/client/reposicion", label: "Reposición", icon: RefreshCcw },
];

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = role === "admin" ? adminLinks : clientLinks;

  const isActiveLink = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-white/10">
        <h1 className="text-lg font-semibold text-white tracking-tight">
          Mercaderia
        </h1>
        <p className="text-xs text-white/50 mt-0.5 capitalize">{role} Panel</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive =
            link.href === "/admin" || link.href === "/client"
              ? pathname === link.href
              : isActiveLink(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}

        {role === "admin" && (
          <div className="pt-3">
            <div className="flex items-center gap-2 px-3 pb-1.5">
              <Wrench className="h-3.5 w-3.5 text-white/30" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">
                Operación
              </span>
            </div>
            {adminOperacionLinks.map((link) => {
              const isActive = isActiveLink(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
        {role === "admin" && (
          <div className="pt-3">
            <div className="flex items-center gap-2 px-3 pb-1.5">
              <Settings className="h-3.5 w-3.5 text-white/30" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">
                Gestión
              </span>
            </div>
            {adminGestionLinks.map((link) => {
              const isActive = isActiveLink(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesion
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#181d26] z-30">
        <SidebarContent />
      </aside>

      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#181d26] px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Mercaderia</h1>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-white/70 hover:text-white"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 h-full bg-[#181d26]">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
