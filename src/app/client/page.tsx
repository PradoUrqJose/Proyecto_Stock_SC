import { turso } from "@/lib/turso";
import { ClientTable } from "@/components/client/client-table";

export default async function ClientPage() {
  const result = await turso.execute(
    `SELECT cod_universal, genero, marca, modelo, categoria, grupo, color, descuento, precio_final, stock_total, imagen_url FROM productos ORDER BY marca, modelo`
  );

  const productos = result.rows.map((row) => ({
    cod_universal: row.cod_universal as string,
    genero: row.genero as string,
    marca: row.marca as string,
    modelo: row.modelo as string,
    categoria: row.categoria as string,
    grupo: row.grupo as string,
    color: row.color as string,
    descuento: row.descuento as number,
    precio_final: row.precio_final as number,
    stock_total: row.stock_total as number,
    imagen_url: row.imagen_url as string | null,
  }));

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
      <ClientTable
        data={productos}
        categorias={categorias}
        grupos={grupos}
        marcas={marcas}
        descuentos={descuentos}
      />
    </div>
  );
}
