import { turso } from "./turso";

export async function initDatabase() {
  await turso.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('admin', 'client')),
      created_at TEXT DEFAULT (datetime('now'))
    );`,
    `CREATE TABLE IF NOT EXISTS productos (
      cod_universal TEXT,
      genero TEXT,
      marca TEXT,
      modelo TEXT,
      categoria TEXT,
      grupo TEXT,
      color TEXT,
      precio_lista REAL,
      descuento REAL,
      precio_final REAL,
      imagen_url TEXT,
      stock_total INTEGER,
      PRIMARY KEY (cod_universal, genero)
    );`,
    `CREATE TABLE IF NOT EXISTS variantes (
      cod_universal TEXT,
      genero TEXT,
      almacen TEXT,
      cod_prod TEXT,
      cod_barras TEXT PRIMARY KEY,
      talla TEXT,
      precio_compra REAL,
      FOREIGN KEY (cod_universal, genero) REFERENCES productos(cod_universal, genero)
    );`,
    `CREATE TABLE IF NOT EXISTS metadata (
      clave TEXT PRIMARY KEY,
      valor TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS producto_imagenes (
      cod_universal TEXT PRIMARY KEY,
      imagen_url TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('archivo', 'sistema')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,
  ], "write");
}

export async function destroyDatabase() {
  await turso.batch([
    "PRAGMA foreign_keys = OFF;",
    "DROP TABLE IF EXISTS variantes;",
    "DROP TABLE IF EXISTS productos;",
    "DROP TABLE IF EXISTS metadata;",
    "PRAGMA foreign_keys = ON;",
  ], "write");
}

export async function createSchema() {
  await turso.batch([
    `CREATE TABLE IF NOT EXISTS productos (
      cod_universal TEXT,
      genero TEXT,
      marca TEXT,
      modelo TEXT,
      categoria TEXT,
      grupo TEXT,
      color TEXT,
      precio_lista REAL,
      descuento REAL,
      precio_final REAL,
      imagen_url TEXT,
      stock_total INTEGER,
      PRIMARY KEY (cod_universal, genero)
    );`,
    `CREATE TABLE IF NOT EXISTS variantes (
      cod_universal TEXT,
      genero TEXT,
      almacen TEXT,
      cod_prod TEXT,
      cod_barras TEXT PRIMARY KEY,
      talla TEXT,
      precio_compra REAL,
      FOREIGN KEY (cod_universal, genero) REFERENCES productos(cod_universal, genero)
    );`,
    `CREATE TABLE IF NOT EXISTS metadata (
      clave TEXT PRIMARY KEY,
      valor TEXT
    );`,
  ], "write");
}
