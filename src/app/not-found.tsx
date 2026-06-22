import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-[#181d26]">404</h1>
        <p className="text-lg text-[#41454d]">Pagina no encontrada</p>
        <Link href="/login">
          <Button className="bg-[#181d26] hover:bg-[#0d1218] text-white">
            Volver al inicio
          </Button>
        </Link>
      </div>
    </div>
  );
}
