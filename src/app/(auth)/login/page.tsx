"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Credenciales incorrectas");
        return;
      }

      toast.success("Bienvenido");
      router.push(data.user.role === "admin" ? "/admin" : "/client");
    } catch {
      toast.error("Error de conexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <Card className="w-full max-w-md border-[#dddddd] shadow-sm">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-medium text-[#181d26]">
            Mercaderia
          </CardTitle>
          <p className="text-sm text-[#41454d]">
            Inicia sesion para continuar
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[#333840] text-sm font-medium">
                Usuario
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="border-[#dddddd] focus:border-[#1b61c9] focus:ring-[#1b61c9]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#333840] text-sm font-medium">
                Contrasena
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-[#dddddd] focus:border-[#1b61c9] focus:ring-[#1b61c9]"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#181d26] hover:bg-[#0d1218] text-white rounded-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
            <p className="text-xs text-[#41454d] text-center">
              Contacta al administrador para obtener acceso.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
