import { turso } from "@/lib/turso";
import { RepositionClientTable } from "@/components/client/reposicion-client-table";

export default async function ClientReposicionPage() {
  const activaResult = await turso.execute({
    sql: "SELECT valor FROM metadata WHERE clave = ?",
    args: ["reposicion_activa"],
  });

  const activa = activaResult.rows[0]?.valor === "true";

  if (!activa) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium text-[#181d26]">Reposición</h1>
          <p className="text-sm text-[#41454d] mt-1">
            No hay reposiciones activas en este momento.
          </p>
        </div>
      </div>
    );
  }

  const codigosResult = await turso.execute(
    "SELECT cod_universal FROM remove_discount"
  );
  const codigos = codigosResult.rows.map((r) => r.cod_universal as string);

  if (codigos.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium text-[#181d26]">Reposición</h1>
          <p className="text-sm text-[#41454d] mt-1">
            No hay productos en reposición.
          </p>
        </div>
      </div>
    );
  }

  const placeholders = codigos.map(() => "?").join(",");
  const productosResult = await turso.execute({
    sql: `SELECT cod_universal, genero, marca, modelo, categoria, grupo, color, descuento, precio_lista, precio_final, stock_total, imagen_url
          FROM productos
          WHERE cod_universal IN (${placeholders})`,
    args: codigos,
  });

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

  const tiendasResult = await turso.execute({
    sql: `SELECT DISTINCT v.almacen
          FROM variantes v
          INNER JOIN remove_discount r ON v.cod_universal = r.cod_universal
          ORDER BY v.almacen`,
    args: [],
  });

  const tiendas = tiendasResult.rows.map((r) => r.almacen as string);

  const tiendaStockResult = await turso.execute({
    sql: `SELECT v.cod_universal, v.genero, v.almacen, COUNT(*) as stock_tienda
          FROM variantes v
          INNER JOIN remove_discount r ON v.cod_universal = r.cod_universal
          GROUP BY v.cod_universal, v.genero, v.almacen`,
    args: [],
  });

  const tiendaStock: Record<string, number> = {};
  for (const row of tiendaStockResult.rows) {
    const key = `${row.cod_universal}-${row.genero}-${row.almacen}`;
    tiendaStock[key] = row.stock_tienda as number;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[#181d26]">Reposición</h1>
        <p className="text-sm text-[#41454d] mt-1">
          Productos con descuento a retirar por reposición.
        </p>
      </div>
      <RepositionClientTable
        data={productos}
        tiendas={tiendas}
        tiendaStock={tiendaStock}
      />
    </div>
  );
}
