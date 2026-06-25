export type DiscountColor = { hex: string; tailwind: string; excel: string };

export const DISCOUNT_COLORS: Record<number, DiscountColor> = {
  10: { hex: "#06b050", tailwind: "bg-[#06b050]", excel: "FF06B050" },
  20: { hex: "#feff00", tailwind: "bg-[#feff00]", excel: "FFFEFF00" },
  30: { hex: "#ffbf00", tailwind: "bg-[#ffbf00]", excel: "FFFFBF00" },
  40: { hex: "#ff0000", tailwind: "bg-[#ff0000]", excel: "FFFF0000" },
  50: { hex: "#7031a0", tailwind: "bg-[#7031a0]", excel: "FF7031A0" },
  60: { hex: "#c75912", tailwind: "bg-[#c75912]", excel: "FFC75912" },
  70: { hex: "#404040", tailwind: "bg-[#404040]", excel: "FF404040" },
};

export function getDiscountColor(pct: number): string {
  return DISCOUNT_COLORS[pct]?.tailwind ?? "";
}

export function getDiscountHex(pct: number): string {
  return DISCOUNT_COLORS[pct]?.hex ?? "#6b7280";
}

export function getDiscountTextClass(pct: number): string {
  return pct === 20 ? "text-[#c00000]" : "text-white";
}

export function getDiscountTextHex(pct: number): string {
  return pct === 20 ? "FFC00000" : "FFFFFFFF";
}

export const DISCOUNT_ORDER = [10, 20, 30, 40, 50, 60, 70];
