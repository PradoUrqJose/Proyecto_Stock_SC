export interface Producto {
  cod_universal: string;
  genero: string;
  marca: string;
  modelo: string;
  categoria: string;
  grupo: string;
  color: string;
  precio_lista: number;
  descuento: number;
  precio_final: number;
  imagen_url: string | null;
  stock_total: number;
}

export interface ProductoAdmin {
  cod_universal: string;
  grupo: string;
  marca: string;
  modelo: string;
  categoria: string;
  color: string;
  descuento: number;
  precio_final: number;
  stock_total: number;
}

export interface Variante {
  cod_universal: string;
  genero: string;
  alm_izq: string;
  alm_der: string | null;
  cod_prod: string;
  cod_barras: string;
  talla: string;
  precio_compra: number;
}

export interface Metadata {
  clave: string;
  valor: string;
}

export interface Tienda {
  id: string;
  nombre: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "client";
  tienda_id: string | null;
  tienda_nombre: string | null;
  created_at: string;
}

export type PipelineResult = {
  success: boolean;
  msg: string;
};

export interface ExportProduct {
  cod_universal: string;
  genero: string;
  marca: string;
  modelo: string;
  categoria: string;
  grupo: string;
  color: string;
  descuento: number;
  precio_final: number;
  stock_total: number;
  imagen_url: string | null;
}
