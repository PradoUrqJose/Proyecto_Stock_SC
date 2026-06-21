"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-md border-[#dddddd]">
        <CardContent className="p-6 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 mx-auto text-[#dc2626]" />
          <h2 className="text-lg font-medium text-[#181d26]">
            Algo salio mal
          </h2>
          <p className="text-sm text-[#41454d]">
            {error.message || "Error al cargar el catalogo"}
          </p>
          <Button
            onClick={reset}
            className="bg-[#181d26] hover:bg-[#0d1218] text-white"
          >
            Reintentar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
