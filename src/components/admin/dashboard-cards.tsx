"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Image, BarChart3, DollarSign, Package, PieChart as PieChartIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { DISCOUNT_COLORS, getDiscountHex } from "@/lib/discount-colors";

interface DashboardCardsProps {
  productsWithImage: number;
  marcasData: { marca: string; stock: number }[];
  valorTotal: number;
  totalVariantes: number;
  descuentoData: { name: string; value: number; descuento: number }[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 0,
  }).format(value);
}

export function DashboardCards({
  productsWithImage,
  marcasData,
  valorTotal,
  totalVariantes,
  descuentoData,
}: DashboardCardsProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-[#dddddd]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#41454d]">
                    Productos con imagen
                  </p>
                  <p className="text-3xl font-medium text-[#181d26] mt-1">
                    {productsWithImage}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-[#f8fafc] flex items-center justify-center">
                  <Image className="h-6 w-6 text-[#41454d]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-[#dddddd]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#41454d]">
                    Valor del inventario
                  </p>
                  <p className="text-3xl font-medium text-[#181d26] mt-1">
                    {formatCurrency(valorTotal)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-[#f8fafc] flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-[#41454d]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-[#dddddd]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#41454d]">
                    Total variantes
                  </p>
                  <p className="text-3xl font-medium text-[#181d26] mt-1">
                    {totalVariantes.toLocaleString()}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-[#f8fafc] flex items-center justify-center">
                  <Package className="h-6 w-6 text-[#41454d]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-[#dddddd]">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-[#41454d]" />
                <h3 className="text-sm font-medium text-[#181d26]">
                  Stock por marca (Top 10)
                </h3>
              </div>
              <div className="w-full" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                  <BarChart data={marcasData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dddddd" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      dataKey="marca"
                      type="category"
                      width={120}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip />
                    <Bar dataKey="stock" fill="#1b61c9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#dddddd]">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="h-5 w-5 text-[#41454d]" />
                <h3 className="text-sm font-medium text-[#181d26]">
                  Distribución de Descuentos
                </h3>
              </div>
              <div className="w-full" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={descuentoData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {descuentoData.map((entry) => (
                        <Cell key={entry.name} fill={getDiscountHex(entry.descuento)} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
