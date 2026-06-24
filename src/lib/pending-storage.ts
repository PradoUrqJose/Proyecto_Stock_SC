const STORAGE_KEY = "descuentos_pendientes_actualizacion";

export function loadPending(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function savePending(pending: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
}

export function resetPending() {
  localStorage.removeItem(STORAGE_KEY);
}
