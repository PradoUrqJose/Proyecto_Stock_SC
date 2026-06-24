import JSZip from "jszip";

interface UpdateRow {
  cod_universal: string;
  genero: string;
  grupo: string;
  modelo: string;
  bf_descuento: number;
  af_descuento: number;
  just_updated: string;
  imagen_url: string | null;
  precio_lista: number;
}

export async function exportUpdatesZip(products: UpdateRow[]) {
  const zip = new JSZip();

  const grouped: Record<number, string[]> = {};
  for (const product of products) {
    const pct = product.af_descuento;
    if (!grouped[pct]) grouped[pct] = [];
    grouped[pct].push(product.cod_universal);
  }

  for (const [pct, codes] of Object.entries(grouped)) {
    const fileName = `dsc_${pct}.txt`;
    const content = codes.join("\n");
    zip.file(fileName, content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "actualizacion_archivos.zip";
  a.click();
  URL.revokeObjectURL(url);
}
