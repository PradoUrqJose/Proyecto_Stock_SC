"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function LoadingBar() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      <div className="h-0.5 bg-[#1b61c9] animate-pulse" />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#1b61c9]" />
        <p className="text-sm text-[#41454d] font-medium">Cargando...</p>
      </div>
    </div>
  );
}
