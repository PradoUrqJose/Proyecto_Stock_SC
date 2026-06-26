import { Suspense } from "react";
import { turso } from "@/lib/turso";
import { ProductsTable } from "@/components/admin/products-table";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Productos",
};

export default async function AdminProductosPage() {
  const result = await turso.execute(
    `SELECT p.cod_universal, p.genero, p.grupo, p.marca, p.modelo, 
            p.categoria, p.color, p.descuento, p.precio_lista, p.precio_final, 
            p.stock_total, 
            COALESCE(CASE WHEN pi.source = 'sistema' THEN pi.imagen_url ELSE NULL END, p.imagen_url) as imagen_url
     FROM productos p
     LEFT JOIN producto_imagenes pi ON p.cod_universal = pi.cod_universal
     ORDER BY p.marca, p.modelo`
  );

  const productos = result.rows.map((row) => ({
    cod_universal: row.cod_universal as string,
    genero: row.genero as string,
    grupo: row.grupo as string,
    marca: row.marca as string,
    modelo: row.modelo as string,
    categoria: row.categoria as string,
    color: row.color as string,
    descuento: row.descuento as number,
    precio_lista: row.precio_lista as number,
    precio_final: row.precio_final as number,
    stock_total: row.stock_total as number,
    imagen_url: row.imagen_url as string | null,
  }));

  // Get unique categories for filters
  const categorias = [...new Set(productos.map((p) => p.categoria))].sort();
  const grupos = [...new Set(productos.map((p) => p.grupo))].sort();
  const marcas = [...new Set(productos.map((p) => p.marca))].sort();
  const descuentos = [...new Set(productos.map((p) => `${p.descuento}%`))].sort((a, b) => parseInt(a) - parseInt(b));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[#181d26]">Productos</h1>
        <p className="text-sm text-[#41454d] mt-1">
          {productos.length} productos en inventario
        </p>
      </div>
      <Suspense fallback={null}>
        <ProductsTable
          data={productos}
          categorias={categorias}
          grupos={grupos}
          marcas={marcas}
          descuentos={descuentos}
        />
      </Suspense>
    </div>
  );
}
