import { turso } from "@/lib/turso";
import { getSession } from "@/lib/actions";
import { ActualizacionClientTable } from "@/components/client/actualizacion-client-table";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Actualización",
};

export default async function ClientActualizacionPage() {
  const [activaResult, session] = await Promise.all([
    turso.execute({
      sql: "SELECT valor FROM metadata WHERE clave = ?",
      args: ["actualizacion_activa"],
    }),
    getSession(),
  ]);

  const activa = activaResult.rows[0]?.valor === "true";

  if (!activa) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium text-[#181d26]">Actualización</h1>
          <p className="text-sm text-[#41454d] mt-1">
            No hay actualizaciones disponibles en este momento.
          </p>
        </div>
      </div>
    );
  }

  const tiendaFiltro = session?.tienda_nombre ?? null;

  const updatesResult = await turso.execute({
    sql: `SELECT DISTINCT u.cod_universal, u.genero, u.bf_descuento, u.af_descuento,
                 p.marca, p.modelo, p.categoria, p.grupo, p.color,
                 p.precio_lista, p.stock_total,
                 COALESCE(pi.imagen_url, p.imagen_url) as imagen_url
          FROM descuento_updates u
          JOIN productos p ON p.cod_universal = u.cod_universal AND p.genero = u.genero
          LEFT JOIN producto_imagenes pi ON p.cod_universal = pi.cod_universal
          ${tiendaFiltro
            ? "WHERE u.cod_universal IN (SELECT DISTINCT cod_universal FROM variantes WHERE alm_izq = ? OR alm_der = ?)"
            : ""}`,
    args: tiendaFiltro ? [tiendaFiltro, tiendaFiltro] : [],
  });

  if (updatesResult.rows.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium text-[#181d26]">Actualización</h1>
          <p className="text-sm text-[#41454d] mt-1">
            No hay productos actualizados{tiendaFiltro ? ` para ${tiendaFiltro}` : ""}.
          </p>
        </div>
      </div>
    );
  }

  const codigos = [...new Set(updatesResult.rows.map((r) => r.cod_universal as string))];
  const placeholders = codigos.map(() => "?").join(",");

  // BUG FIX: descuento = af_descuento (lo que se actualizó a), no p.descuento (estado actual)
  // precio_final recalculado desde precio_lista y af_descuento para mantener coherencia
  const productos = updatesResult.rows.map((row) => {
    const precioLista = row.precio_lista as number;
    const afDescuento = row.af_descuento as number;
    return {
      cod_universal: row.cod_universal as string,
      genero: row.genero as string,
      marca: row.marca as string,
      modelo: row.modelo as string,
      categoria: row.categoria as string,
      grupo: row.grupo as string,
      color: row.color as string,
      descuento: afDescuento,
      precio_lista: precioLista,
      precio_final: precioLista * (1 - afDescuento / 100),
      stock_total: row.stock_total as number,
      imagen_url: row.imagen_url as string | null,
    };
  });

  const descuentosAnteriores: Record<string, number> = {};
  for (const row of updatesResult.rows) {
    const key = `${row.cod_universal}-${row.genero}`;
    descuentosAnteriores[key] = row.bf_descuento as number;
  }

  const tiendasResult = await turso.execute({
    sql: `SELECT DISTINCT store
          FROM (
            SELECT v.alm_izq AS store FROM variantes v WHERE v.cod_universal IN (${placeholders})
            UNION
            SELECT v.alm_der AS store FROM variantes v WHERE v.cod_universal IN (${placeholders}) AND v.alm_der IS NOT NULL
          )
          ORDER BY store`,
    args: [...codigos, ...codigos],
  });

  const tiendas = tiendasResult.rows.map((r) => r.store as string);

  const tiendaStockResult = await turso.execute({
    sql: `SELECT cod_universal, genero, store, SUM(cnt) as stock_tienda
          FROM (
            SELECT v.cod_universal, v.genero, v.alm_izq AS store, COUNT(*) as cnt
            FROM variantes v
            WHERE v.cod_universal IN (${placeholders})
            GROUP BY v.cod_universal, v.genero, v.alm_izq
            UNION ALL
            SELECT v.cod_universal, v.genero, v.alm_der AS store, COUNT(*) as cnt
            FROM variantes v
            WHERE v.cod_universal IN (${placeholders}) AND v.alm_der IS NOT NULL
            GROUP BY v.cod_universal, v.genero, v.alm_der
          )
          GROUP BY cod_universal, genero, store`,
    args: [...codigos, ...codigos],
  });

  const tiendaStock: Record<string, number> = {};
  for (const row of tiendaStockResult.rows) {
    const key = `${row.cod_universal}-${row.genero}-${row.store}`;
    tiendaStock[key] = row.stock_tienda as number;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[#181d26]">Actualización</h1>
        <p className="text-sm text-[#41454d] mt-1">
          Productos con descuentos actualizados recientemente
          {tiendaFiltro ? ` · ${tiendaFiltro}` : ""}.
        </p>
      </div>
      <ActualizacionClientTable
        data={productos}
        descuentosAnteriores={descuentosAnteriores}
        tiendas={tiendas}
        tiendaStock={tiendaStock}
        tiendaAsignada={tiendaFiltro}
      />
    </div>
  );
}
