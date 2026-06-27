"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Info, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateAdminModules } from "@/app/admin/gestion/permisos/actions";
import type { Module, User } from "@/types";

type AdminWithModules = User & { modules: string[] };

interface Props {
  admins: AdminWithModules[];
  modules: Module[];
}

export function PermisosClient({ admins: initial, modules }: Props) {
  const [admins, setAdmins] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  function toggleModule(adminId: string, moduleId: string) {
    setAdmins((prev) =>
      prev.map((a) => {
        if (a.id !== adminId) return a;
        const has = a.modules.includes(moduleId);
        return {
          ...a,
          modules: has ? a.modules.filter((m) => m !== moduleId) : [...a.modules, moduleId],
        };
      }),
    );
  }

  function toggleAll(admin: AdminWithModules) {
    const allSelected = admin.modules.length === modules.length;
    setAdmins((prev) => prev.map((a) => (a.id === admin.id ? { ...a, modules: allSelected ? [] : modules.map((m) => m.id) } : a)));
  }

  function handleSave(admin: AdminWithModules) {
    setSavingId(admin.id);
    startTransition(async () => {
      const res = await updateAdminModules(admin.id, admin.modules);
      if (res.success) {
        toast.success(res.msg);
      } else {
        toast.error(res.msg);
      }
      setSavingId(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>Los cambios se aplican en el próximo inicio de sesión del usuario.</p>
      </div>

      {admins.length === 0 && (
        <div className="rounded-lg border border-[#dddddd] p-10 text-center text-sm text-[#41454d]">No hay administradores para configurar. Creá un usuario con rol Administrador primero.</div>
      )}

      <div className="space-y-3">
        {admins.map((admin) => {
          const allSelected = admin.modules.length === modules.length;
          const isSaving = isPending && savingId === admin.id;

          return (
            <div key={admin.id} className="rounded-lg border border-[#dddddd] bg-white overflow-hidden">
              {/* Header de la tarjeta */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#f8fafc] border-b border-[#dddddd]">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-[#e4e8f0] flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-[#41454d]">{admin.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#181d26]">{admin.name}</p>
                    <p className="text-xs text-[#41454d]">{admin.username}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs text-[#41454d] border-[#dddddd]">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  {admin.modules.length}/{modules.length} módulos
                </Badge>
              </div>

              {/* Módulos */}
              <div className="px-4 py-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
                  {modules.map((m) => {
                    const has = admin.modules.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleModule(admin.id, m.id)}
                        disabled={isSaving}
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium
                          transition-colors text-left
                          ${has ? "bg-[#181d26] border-[#181d26] text-white" : "bg-white border-[#dddddd] text-[#41454d] hover:border-[#181d26] hover:text-[#181d26]"}
                        `}
                      >
                        <span
                          className={`h-3.5 w-3.5 rounded border-2 flex-shrink-0 flex items-center justify-center
                            ${has ? "border-white" : "border-current"}`}
                        >
                          {has && (
                            <svg viewBox="0 0 10 10" className="w-2.5 h-2.5">
                              <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        {m.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer con acciones */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#dddddd] bg-[#f8fafc]">
                <button onClick={() => toggleAll(admin)} disabled={isSaving} className="text-xs text-[#41454d] hover:text-[#181d26] underline underline-offset-2">
                  {allSelected ? "Quitar todos" : "Seleccionar todos"}
                </button>
                <Button size="sm" className="bg-[#181d26] hover:bg-[#0d1218] text-white" onClick={() => handleSave(admin)} disabled={isPending}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar permisos"
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
