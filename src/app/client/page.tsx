import { Suspense } from "react";
import { turso } from "@/lib/turso";
import { ClientTable } from "@/components/client/client-table";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catálogo",
};

export default async function ClientPage() {
  const [productosResult, tiendasResult, tiendaStockResult] = await Promise.all([
    turso.execute(
      `SELECT p.cod_universal, p.genero, p.marca, p.modelo, 
              p.categoria, p.grupo, p.color, p.descuento, 
              p.precio_lista, p.precio_final, p.stock_total,
              COALESCE(pi.imagen_url, p.imagen_url) as imagen_url
       FROM productos p
       LEFT JOIN producto_imagenes pi ON p.cod_universal = pi.cod_universal
       ORDER BY p.marca, p.modelo`
    ),
    turso.execute(
      `SELECT DISTINCT store
       FROM (
         SELECT v.alm_izq AS store FROM variantes v
         UNION
         SELECT v.alm_der AS store FROM variantes v WHERE v.alm_der IS NOT NULL
       )
       ORDER BY store`
    ),
    turso.execute(
      `SELECT cod_universal, genero, store, SUM(cnt) as stock_tienda
       FROM (
         SELECT v.cod_universal, v.genero, v.alm_izq AS store, COUNT(*) as cnt
         FROM variantes v
         GROUP BY v.cod_universal, v.genero, v.alm_izq
         UNION ALL
         SELECT v.cod_universal, v.genero, v.alm_der AS store, COUNT(*) as cnt
         FROM variantes v
         WHERE v.alm_der IS NOT NULL
         GROUP BY v.cod_universal, v.genero, v.alm_der
       )
       GROUP BY cod_universal, genero, store`
    ),
  ]);

  const productos = productosResult.rows.map((row) => ({
    cod_universal: row.cod_universal as string,
    genero: row.genero as string,
    marca: row.marca as string,
    modelo: row.modelo as string,
    categoria: row.categoria as string,
    grupo: row.grupo as string,
    color: row.color as string,
    descuento: row.descuento as number,
    precio_lista: row.precio_lista as number,
    precio_final: row.precio_final as number,
    stock_total: row.stock_total as number,
    imagen_url: row.imagen_url as string | null,
  }));

  const tiendas = tiendasResult.rows.map((r) => r.store as string);

  const tiendaStock: Record<string, number> = {};
  for (const row of tiendaStockResult.rows) {
    const key = `${row.cod_universal}-${row.genero}-${row.store}`;
    tiendaStock[key] = row.stock_tienda as number;
  }

  const categorias = [...new Set(productos.map((p) => p.categoria))].sort();
  const grupos = [...new Set(productos.map((p) => p.grupo))].sort();
  const marcas = [...new Set(productos.map((p) => p.marca))].sort();
  const descuentos = [...new Set(productos.map((p) => `${p.descuento}%`))].sort((a, b) => parseInt(a) - parseInt(b));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[#181d26]">Catalogo</h1>
        <p className="text-sm text-[#41454d] mt-1">
          {productos.length} productos disponibles
        </p>
      </div>
      <Suspense fallback={null}>
        <ClientTable
          data={productos}
          categorias={categorias}
          grupos={grupos}
          marcas={marcas}
          descuentos={descuentos}
          tiendas={tiendas}
          tiendaStock={tiendaStock}
        />
      </Suspense>
    </div>
  );
}
