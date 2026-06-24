"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loadPending, savePending, resetPending } from "@/lib/pending-storage";
import { guardarDescuentos } from "@/lib/actions/discounts";
import type { Producto } from "@/types";

type Row = Producto & { descuentoN: number | null };

export function usePendingDiscounts(data: Producto[]) {
  const router = useRouter();
  const [pending, setPending] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPending(loadPending());
    setLoaded(true);
  }, []);

  const pendingCount = useMemo(
    () => Object.keys(pending).length,
    [pending]
  );

  const pendingDescuentos = useMemo(() => {
    const vals = Object.values(pending);
    return [...new Set(vals)].sort((a, b) => a - b).map((v) => `${v}%`);
  }, [pending]);

  const dataWithPending = useMemo<Row[]>(() => {
    if (!loaded) return data as Row[];
    return data.map((p) => {
      const key = `${p.cod_universal}-${p.genero}`;
      const pendingValue = pending[key];
      if (pendingValue !== undefined) {
        return { ...p, descuentoN: pendingValue };
      }
      return { ...p, descuentoN: null as number | null };
    });
  }, [data, pending, loaded]);

  const updatePending = useCallback(
    (codKey: string, valor: number | null, originalDesc: number) => {
      setPending((prev) => {
        const next = { ...prev };
        if (valor === null || valor === originalDesc) {
          delete next[codKey];
        } else {
          next[codKey] = valor;
        }
        savePending(next);
        return next;
      });
    },
    []
  );

  const handleGuardar = useCallback(async () => {
    const updates = Object.entries(pending).map(([key, af_descuento]) => {
      const [cod_universal, genero] = key.split("-");
      const original = data.find(
        (p) => p.cod_universal === cod_universal && p.genero === genero
      );
      return {
        cod_universal,
        genero,
        bf_descuento: original?.descuento ?? 0,
        af_descuento,
      };
    });

    const result = await guardarDescuentos(updates);
    if (result.success) {
      toast.success(result.msg);
      setPending({});
      resetPending();
      router.refresh();
    } else {
      toast.error(result.msg);
    }
  }, [pending, data, router]);

  return {
    pending,
    loaded,
    pendingCount,
    pendingDescuentos,
    dataWithPending,
    updatePending,
    handleGuardar,
  };
}
