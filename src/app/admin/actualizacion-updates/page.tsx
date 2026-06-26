import { Suspense } from "react";
import { turso } from "@/lib/turso";
import { ActualizacionUpdatesTable } from "@/components/admin/actualizacion-updates-table";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registro Cambios",
};

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

export default async function AdminActualizacionUpdatesPage() {
  const activaResult = await turso.execute({
    sql: "SELECT valor FROM metadata WHERE clave = ?",
    args: ["actualizacion_activa"],
  });
  const isActive = activaResult.rows[0]?.valor === "true";

  const updatesResult = await turso.execute(
    `SELECT u.cod_universal, u.genero, u.bf_descuento, u.af_descuento, u.just_updated,
            p.grupo, p.modelo, p.precio_lista,
            COALESCE(CASE WHEN pi.source = 'sistema' THEN pi.imagen_url ELSE NULL END, p.imagen_url) as imagen_url
     FROM descuento_updates u
     JOIN productos p ON p.cod_universal = u.cod_universal AND p.genero = u.genero
     LEFT JOIN producto_imagenes pi ON p.cod_universal = pi.cod_universal
     ORDER BY u.just_updated DESC`
  );

  if (updatesResult.rows.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium text-[#181d26]">Registro Cambios</h1>
          <p className="text-sm text-[#41454d] mt-1">
            No hay registros de cambios de descuentos.
          </p>
        </div>
      </div>
    );
  }

  const updates: UpdateRow[] = updatesResult.rows.map((row) => ({
    cod_universal: row.cod_universal as string,
    genero: row.genero as string,
    grupo: row.grupo as string,
    modelo: row.modelo as string,
    bf_descuento: row.bf_descuento as number,
    af_descuento: row.af_descuento as number,
    just_updated: row.just_updated as string,
    imagen_url: row.imagen_url as string | null,
    precio_lista: row.precio_lista as number,
  }));

  const tiendasResult = await turso.execute(
    `SELECT DISTINCT store, cod_universal, genero
     FROM (
       SELECT v.alm_izq AS store, v.cod_universal, v.genero
       FROM variantes v
       WHERE EXISTS (SELECT 1 FROM descuento_updates u WHERE u.cod_universal = v.cod_universal AND u.genero = v.genero)
       UNION
       SELECT v.alm_der AS store, v.cod_universal, v.genero
       FROM variantes v
       WHERE v.alm_der IS NOT NULL
         AND EXISTS (SELECT 1 FROM descuento_updates u WHERE u.cod_universal = v.cod_universal AND u.genero = v.genero)
     )
     ORDER BY store`
  );

  const tiendasSet = new Set<string>();
  const productoTiendas: Record<string, string[]> = {};

  for (const row of tiendasResult.rows) {
    const store = row.store as string;
    const key = `${row.cod_universal}-${row.genero}`;
    tiendasSet.add(store);
    if (!productoTiendas[key]) productoTiendas[key] = [];
    productoTiendas[key].push(store);
  }

  const tiendas = [...tiendasSet].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[#181d26]">Registro Cambios</h1>
        <p className="text-sm text-[#41454d] mt-1">
          Productos con descuentos actualizados.
        </p>
      </div>
      <Suspense fallback={null}>
        <ActualizacionUpdatesTable
          data={updates}
          tiendas={tiendas}
          productoTiendas={productoTiendas}
          isActive={isActive}
        />
      </Suspense>
    </div>
  );
}
