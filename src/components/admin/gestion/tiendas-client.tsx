"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Store, Loader2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createTienda, updateTienda, deleteTienda } from "@/app/admin/gestion/actions";
import type { Tienda } from "@/types";

interface Props {
  tiendas: Tienda[];
  almacenes: string[];
}

export function TiendasClient({ tiendas: initial, almacenes }: Props) {
  const [tiendas, setTiendas] = useState(initial);
  const [isPending, startTransition] = useTransition();

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newNombre, setNewNombre] = useState("");

  // Edit inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Nombres de almacenes sin tienda creada (para sugerir)
  const nombresTiendas = new Set(tiendas.map((t) => t.nombre));
  const sugeridos = almacenes.filter((a) => !nombresTiendas.has(a));

  function optimisticAdd(t: Tienda) {
    setTiendas((prev) => [...prev, t].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  }
  function optimisticUpdate(id: string, nombre: string) {
    setTiendas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, nombre } : t)).sort((a, b) => a.nombre.localeCompare(b.nombre))
    );
  }
  function optimisticDelete(id: string) {
    setTiendas((prev) => prev.filter((t) => t.id !== id));
  }

  // ── CREATE
  function handleCreate(nombre: string) {
    const trimmed = nombre.trim().toUpperCase();
    if (!trimmed) return;
    startTransition(async () => {
      const fakeId = crypto.randomUUID();
      optimisticAdd({ id: fakeId, nombre: trimmed, created_at: "" });
      setShowCreate(false);
      setNewNombre("");
      const res = await createTienda(trimmed);
      if (res.success) {
        toast.success(res.msg);
      } else {
        optimisticDelete(fakeId);
        toast.error(res.msg);
      }
    });
  }

  // ── UPDATE
  function startEdit(t: Tienda) {
    setEditingId(t.id);
    setEditNombre(t.nombre);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditNombre("");
  }
  function handleUpdate() {
    if (!editingId) return;
    const trimmed = editNombre.trim().toUpperCase();
    if (!trimmed) return;
    const prev = tiendas.find((t) => t.id === editingId)?.nombre ?? "";
    startTransition(async () => {
      optimisticUpdate(editingId, trimmed);
      setEditingId(null);
      const res = await updateTienda(editingId, trimmed);
      if (res.success) {
        toast.success(res.msg);
      } else {
        optimisticUpdate(editingId, prev);
        toast.error(res.msg);
      }
    });
  }

  // ── DELETE
  function handleDelete(id: string) {
    startTransition(async () => {
      optimisticDelete(id);
      setDeletingId(null);
      const res = await deleteTienda(id);
      if (res.success) {
        toast.success(res.msg);
      } else {
        toast.error(res.msg);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#41454d]">
          {tiendas.length} tienda{tiendas.length !== 1 ? "s" : ""}
        </p>
        <Button
          size="sm"
          className="bg-[#181d26] hover:bg-[#0d1218] text-white gap-2"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4" />
          Nueva tienda
        </Button>
      </div>

      {/* Sugerencias de almacenes sin tienda */}
      {sugeridos.length > 0 && (
        <div className="rounded-lg border border-[#e4e8f0] bg-[#f8fafc] p-3">
          <p className="text-xs font-medium text-[#41454d] mb-2">
            Almacenes en BD sin tienda creada:
          </p>
          <div className="flex flex-wrap gap-2">
            {sugeridos.map((a) => (
              <button
                key={a}
                onClick={() => { setNewNombre(a); setShowCreate(true); }}
                className="text-xs px-2 py-1 rounded-md bg-white border border-[#dddddd] text-[#41454d] hover:border-[#181d26] hover:text-[#181d26] transition-colors"
              >
                + {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-[#dddddd] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#f8fafc] hover:bg-[#f8fafc]">
              <TableHead className="text-[#41454d] font-medium">Nombre</TableHead>
              <TableHead className="text-[#41454d] font-medium text-right pr-4">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiendas.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-sm text-[#41454d] py-8">
                  No hay tiendas. Crea la primera.
                </TableCell>
              </TableRow>
            )}
            {tiendas.map((tienda) => (
              <TableRow key={tienda.id} className="hover:bg-[#f8fafc]">
                <TableCell>
                  {editingId === tienda.id ? (
                    <Input
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(); if (e.key === "Escape") cancelEdit(); }}
                      className="h-8 w-48 border-[#dddddd] text-sm uppercase"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-[#41454d]" />
                      <span className="font-medium text-[#181d26]">{tienda.nombre}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right pr-4">
                  {editingId === tienda.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700" onClick={handleUpdate} disabled={isPending}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-[#41454d] hover:text-[#181d26]" onClick={() => startEdit(tienda)} disabled={isPending}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setDeletingId(tienda.id)} disabled={isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setNewNombre(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva tienda</DialogTitle>
            <DialogDescription>
              Usa el mismo nombre que el almacén en la base de datos (ej: T01, JAL1).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Nombre (ej: T01)"
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(newNombre); }}
              className="border-[#dddddd] uppercase"
              autoFocus
            />
            {/* Quick pick from almacenes */}
            {sugeridos.length > 0 && (
              <div>
                <p className="text-xs text-[#41454d] mb-2">Seleccionar desde almacenes existentes:</p>
                <div className="flex flex-wrap gap-1.5">
                  {sugeridos.map((a) => (
                    <Badge
                      key={a}
                      variant="outline"
                      className="cursor-pointer hover:bg-[#181d26] hover:text-white transition-colors border-[#dddddd]"
                      onClick={() => setNewNombre(a)}
                    >
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-[#dddddd]" onClick={() => { setShowCreate(false); setNewNombre(""); }}>
                Cancelar
              </Button>
              <Button
                className="bg-[#181d26] hover:bg-[#0d1218] text-white"
                onClick={() => handleCreate(newNombre)}
                disabled={isPending || !newNombre.trim()}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Crear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm Dialog */}
      <Dialog open={!!deletingId} onOpenChange={(o) => { if (!o) setDeletingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar tienda</DialogTitle>
            <DialogDescription>
              Los usuarios asignados a esta tienda quedarán sin tienda. ¿Confirmas?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="border-[#dddddd]" onClick={() => setDeletingId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && handleDelete(deletingId)}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
