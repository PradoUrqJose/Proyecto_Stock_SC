import { turso } from "@/lib/turso";
import { DashboardCards } from "@/components/admin/dashboard-cards";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function AdminDashboardPage() {
  let productsWithImage = 0;
  let marcasData: { marca: string; stock: number }[] = [];
  let valorTotal = 0;
  let totalVars = 0;
  let descuentoData: { name: string; value: number; descuento: number }[] = [];

  try {
    const [totalProducts, stockByMarca, valorInventario, totalVariantes, descuentoDist] =
      await Promise.all([
        turso.execute(
          "SELECT COUNT(*) as total FROM productos WHERE imagen_url IS NOT NULL"
        ),
        turso.execute(
          "SELECT marca, SUM(stock_total) as total_stock FROM productos GROUP BY marca ORDER BY total_stock DESC LIMIT 10"
        ),
        turso.execute(
          "SELECT SUM(precio_lista * stock_total) as valor_total FROM productos"
        ),
        turso.execute("SELECT COUNT(*) as total FROM variantes"),
        turso.execute(
          "SELECT descuento, COUNT(*) as total FROM productos GROUP BY descuento ORDER BY descuento"
        ),
      ]);

    productsWithImage = totalProducts.rows[0]?.total as number || 0;
    valorTotal = valorInventario.rows[0]?.valor_total as number || 0;
    totalVars = totalVariantes.rows[0]?.total as number || 0;

    marcasData = stockByMarca.rows.map((row) => ({
      marca: row.marca as string,
      stock: row.total_stock as number,
    }));

    descuentoData = descuentoDist.rows
      .map((row) => ({
        name: `${row.descuento}%`,
        value: row.total as number,
        descuento: row.descuento as number,
      }))
      .filter((d) => d.descuento > 0);
  } catch {
    // Fallback a valores por defecto si las consultas fallan
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[#181d26]">Dashboard</h1>
        <p className="text-sm text-[#41454d] mt-1">
          Resumen del inventario actual
        </p>
      </div>
      <DashboardCards
        productsWithImage={productsWithImage}
        marcasData={marcasData}
        valorTotal={valorTotal}
        totalVariantes={totalVars}
        descuentoData={descuentoData}
      />
    </div>
  );
}
