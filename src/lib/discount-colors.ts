export const DISCOUNT_COLORS: Record<number, { hex: string; tailwind: string; excel: string }> = {
  10: { hex: "#22c55e", tailwind: "bg-[#22c55e]", excel: "FF22C55E" },
  20: { hex: "#eab308", tailwind: "bg-[#eab308]", excel: "FFEAB308" },
  30: { hex: "#f97316", tailwind: "bg-[#f97316]", excel: "FFF97316" },
  40: { hex: "#6b7280", tailwind: "bg-[#6b7280]", excel: "FF6B7280" },
  50: { hex: "#a855f7", tailwind: "bg-[#a855f7]", excel: "FFA855F7" },
  60: { hex: "#3b82f6", tailwind: "bg-[#3b82f6]", excel: "FF3B82F6" },
  70: { hex: "#ef4444", tailwind: "bg-[#ef4444]", excel: "FFEF4444" },
};

export function getDiscountColor(pct: number): string {
  return DISCOUNT_COLORS[pct]?.tailwind ?? "";
}

export function getDiscountHex(pct: number): string {
  return DISCOUNT_COLORS[pct]?.hex ?? "#6b7280";
}

export const DISCOUNT_ORDER = [10, 20, 30, 40, 50, 60, 70];
