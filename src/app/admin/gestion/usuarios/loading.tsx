import { Loader2 } from "lucide-react";
export default function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#1b61c9]" />
        <p className="text-sm text-[#41454d] font-medium">Cargando...</p>
      </div>
    </div>
  );
}
