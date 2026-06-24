import { turso } from "./turso";
import { hashPassword } from "./auth";

export async function initDatabase() {
  await turso.batch([
    `CREATE TABLE IF NOT EXISTS tiendas (
      id TEXT PRIMARY KEY,
      nombre TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('admin', 'client')),
      tienda_id TEXT REFERENCES tiendas(id) ON DELETE SET NULL,
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
      alm_izq TEXT,
      alm_der TEXT,
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
    `CREATE TABLE IF NOT EXISTS descuento_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cod_universal TEXT NOT NULL,
      genero TEXT NOT NULL,
      bf_descuento REAL NOT NULL,
      af_descuento REAL NOT NULL,
      just_updated TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS remove_discount (
      cod_universal TEXT PRIMARY KEY
    );`,
  ], "write");

  // Migración: agregar tienda_id a users si no existe
  const userColumns = await turso.execute("PRAGMA table_info(users)");
  const hasTiendaId = userColumns.rows.some((r) => r.name === "tienda_id");
  if (!hasTiendaId) {
    await turso.execute(
      "ALTER TABLE users ADD COLUMN tienda_id TEXT REFERENCES tiendas(id) ON DELETE SET NULL"
    );
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@merch.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  const existing = await turso.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [adminEmail],
  });

  if (existing.rows.length === 0) {
    const id = crypto.randomUUID();
    const hashed = await hashPassword(adminPassword);
    await turso.execute({
      sql: "INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)",
      args: [id, adminEmail, hashed, "Administrador", "admin"],
    });
  }
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
      alm_izq TEXT,
      alm_der TEXT,
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
