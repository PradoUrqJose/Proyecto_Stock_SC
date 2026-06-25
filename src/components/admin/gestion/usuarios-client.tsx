"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, ShieldCheck, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createUsuario, updateUsuario, deleteUsuario } from "@/app/admin/gestion/actions";
import type { User, Tienda } from "@/types";

interface Props {
  usuarios: User[];
  tiendas: Tienda[];
  currentUserId: string;
}

type FormData = {
  name: string;
  email: string;
  username: string;
  password: string;
  role: "admin" | "client";
  tienda_id: string | null;
};

const emptyForm = (): FormData => ({
  name: "",
  email: "",
  username: "",
  password: "",
  role: "client",
  tienda_id: null,
});

export function UsuariosClient({ usuarios: initial, tiendas, currentUserId }: Props) {
  const [usuarios, setUsuarios] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<FormData>(emptyForm());

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<FormData>(emptyForm());

  const [deletingId, setDeletingId] = useState<string | null>(null);

  function optimisticAdd(u: User) {
    setUsuarios((prev) => [u, ...prev]);
  }
  function optimisticUpdate(id: string, data: Partial<User>) {
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
  }
  function optimisticDelete(id: string) {
    setUsuarios((prev) => prev.filter((u) => u.id !== id));
  }

  function tiendaNombre(id: string | null) {
    if (!id) return null;
    return tiendas.find((t) => t.id === id)?.nombre ?? null;
  }

  // ── CREATE
  function handleCreate() {
    startTransition(async () => {
      const fakeId = crypto.randomUUID();
      const fakeUser: User = {
        id: fakeId,
        name: createForm.name,
        email: createForm.email,
        username: createForm.username,
        role: createForm.role,
        tienda_id: createForm.tienda_id,
        tienda_nombre: tiendaNombre(createForm.tienda_id),
        created_at: "",
      };
      optimisticAdd(fakeUser);
      setShowCreate(false);
      const res = await createUsuario(createForm);
      if (res.success) {
        toast.success(res.msg);
        setCreateForm(emptyForm());
      } else {
        optimisticDelete(fakeId);
        toast.error(res.msg);
      }
    });
  }

  // ── UPDATE
  function startEditUser(u: User) {
    setEditingUser(u);
    setEditForm({
      name: u.name,
      email: u.email,
      username: u.username,
      password: "",
      role: u.role,
      tienda_id: u.tienda_id,
    });
  }
  function handleUpdate() {
    if (!editingUser) return;
    startTransition(async () => {
      const updated: Partial<User> = {
        name: editForm.name,
        email: editForm.email,
        username: editForm.username,
        role: editForm.role,
        tienda_id: editForm.tienda_id,
        tienda_nombre: tiendaNombre(editForm.tienda_id),
      };
      optimisticUpdate(editingUser.id, updated);
      setEditingUser(null);
      const res = await updateUsuario(editingUser.id, editForm);
      if (res.success) {
        toast.success(res.msg);
      } else {
        optimisticUpdate(editingUser.id, {
          name: editingUser.name,
          email: editingUser.email,
          username: editingUser.username,
          role: editingUser.role,
          tienda_id: editingUser.tienda_id,
          tienda_nombre: editingUser.tienda_nombre,
        });
        toast.error(res.msg);
      }
    });
  }

  // ── DELETE
  function handleDelete(id: string) {
    startTransition(async () => {
      optimisticDelete(id);
      setDeletingId(null);
      const res = await deleteUsuario(id);
      if (res.success) {
        toast.success(res.msg);
      } else {
        toast.error(res.msg);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#41454d]">
          {usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""}
        </p>
        <Button
          size="sm"
          className="bg-[#181d26] hover:bg-[#0d1218] text-white gap-2"
          onClick={() => { setCreateForm(emptyForm()); setShowCreate(true); }}
        >
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      <div className="rounded-lg border border-[#dddddd] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#f8fafc] hover:bg-[#f8fafc]">
              <TableHead className="text-[#41454d] font-medium">Usuario</TableHead>
              <TableHead className="text-[#41454d] font-medium">Rol</TableHead>
              <TableHead className="text-[#41454d] font-medium">Tienda</TableHead>
              <TableHead className="text-[#41454d] font-medium text-right pr-4">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-[#41454d] py-8">
                  No hay usuarios.
                </TableCell>
              </TableRow>
            )}
            {usuarios.map((u) => (
              <TableRow key={u.id} className="hover:bg-[#f8fafc]">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-[#e4e8f0] flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-[#41454d]">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#181d26]">{u.name}</p>
                      <p className="text-xs text-[#41454d]">{u.username}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      u.role === "admin"
                        ? "border-[#181d26] text-[#181d26] bg-[#f1f3f7] gap-1"
                        : "border-[#dddddd] text-[#41454d] gap-1"
                    }
                  >
                    {u.role === "admin"
                      ? <ShieldCheck className="h-3 w-3" />
                      : <UserIcon className="h-3 w-3" />}
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.tienda_nombre ? (
                    <Badge variant="outline" className="border-[#dddddd] text-[#41454d] font-mono text-xs">
                      {u.tienda_nombre}
                    </Badge>
                  ) : (
                    <span className="text-xs text-[#41454d] italic">Sin tienda</span>
                  )}
                </TableCell>
                <TableCell className="text-right pr-4">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-[#41454d] hover:text-[#181d26]"
                      onClick={() => startEditUser(u)}
                      disabled={isPending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {u.id !== currentUserId && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-400 hover:text-red-600"
                        onClick={() => setDeletingId(u.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── CREATE DIALOG */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>
              El usuario podrá iniciar sesión con estas credenciales.
            </DialogDescription>
          </DialogHeader>
          <UserForm
            form={createForm}
            onChange={setCreateForm}
            tiendas={tiendas}
            isPending={isPending}
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            submitLabel="Crear usuario"
            showPassword
            passwordRequired
          />
        </DialogContent>
      </Dialog>

      {/* ── EDIT DIALOG */}
      <Dialog open={!!editingUser} onOpenChange={(o) => { if (!o) setEditingUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>
              Deja la contraseña vacía para no cambiarla.
            </DialogDescription>
          </DialogHeader>
          <UserForm
            form={editForm}
            onChange={setEditForm}
            tiendas={tiendas}
            isPending={isPending}
            onSubmit={handleUpdate}
            onCancel={() => setEditingUser(null)}
            submitLabel="Guardar cambios"
            showPassword
            passwordRequired={false}
          />
        </DialogContent>
      </Dialog>

      {/* ── DELETE DIALOG */}
      <Dialog open={!!deletingId} onOpenChange={(o) => { if (!o) setDeletingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. ¿Confirmas?
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
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// Shared form component
// ─────────────────────────────────────────────

interface UserFormProps {
  form: FormData;
  onChange: (f: FormData) => void;
  tiendas: Tienda[];
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  showPassword: boolean;
  passwordRequired: boolean;
}

function UserForm({
  form, onChange, tiendas, isPending,
  onSubmit, onCancel, submitLabel, showPassword, passwordRequired,
}: UserFormProps) {
  const set = (key: keyof FormData) => (val: string) =>
    onChange({ ...form, [key]: val });

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm text-[#333840]">Nombre</Label>
          <Input
            placeholder="Nombre completo"
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
            className="border-[#dddddd]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-[#333840]">Usuario</Label>
          <Input
            type="text"
            placeholder="nombre_usuario"
            value={form.username}
            onChange={(e) => set("username")(e.target.value)}
            className="border-[#dddddd]"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-[#333840]">Correo</Label>
        <Input
          type="email"
          placeholder="correo@ejemplo.com"
          value={form.email}
          onChange={(e) => set("email")(e.target.value)}
          className="border-[#dddddd]"
        />
      </div>

      {showPassword && (
        <div className="space-y-1.5">
          <Label className="text-sm text-[#333840]">
            Contraseña {!passwordRequired && <span className="text-[#41454d] font-normal">(dejar vacío para no cambiar)</span>}
          </Label>
          <Input
            type="password"
            placeholder={passwordRequired ? "Mínimo 6 caracteres" : "••••••••"}
            value={form.password}
            onChange={(e) => set("password")(e.target.value)}
            className="border-[#dddddd]"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm text-[#333840]">Rol</Label>
          <Select value={form.role} onValueChange={(v) => onChange({ ...form, role: v as "admin" | "client" })}>
            <SelectTrigger className="border-[#dddddd]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Cliente</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm text-[#333840]">Tienda</Label>
          <Select
            value={form.tienda_id ?? "none"}
            onValueChange={(v) => onChange({ ...form, tienda_id: v === "none" ? null : v })}
          >
            <SelectTrigger className="border-[#dddddd]">
              <SelectValue placeholder="Sin tienda">
                {tiendas.find((t) => t.id === form.tienda_id)?.nombre ?? "Sin tienda"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin tienda</SelectItem>
              {tiendas.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" className="border-[#dddddd]" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          className="bg-[#181d26] hover:bg-[#0d1218] text-white"
          onClick={onSubmit}
          disabled={isPending}
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
