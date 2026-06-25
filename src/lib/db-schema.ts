import { turso } from "./turso";
import { hashPassword } from "./auth";

// ── Schema ─────────────────────────────────────────────────
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
      username TEXT UNIQUE NOT NULL,
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
    `CREATE TABLE IF NOT EXISTS descuento_updates_historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ciclo_id TEXT NOT NULL,
      cod_universal TEXT NOT NULL,
      genero TEXT NOT NULL,
      bf_descuento REAL NOT NULL,
      af_descuento REAL NOT NULL,
      just_updated TEXT NOT NULL,
      cerrado_en TEXT NOT NULL
    );`,
  ], "write");

// ── Migrations ─────────────────────────────────────────────
  // Migración: agregar tienda_id a users si no existe
  const userColumns = await turso.execute("PRAGMA table_info(users)");
  const hasTiendaId = userColumns.rows.some((r) => r.name === "tienda_id");
  if (!hasTiendaId) {
    await turso.execute(
      "ALTER TABLE users ADD COLUMN tienda_id TEXT REFERENCES tiendas(id) ON DELETE SET NULL"
    );
  }

  // Migración: agregar username a users si no existe
  const hasUsername = userColumns.rows.some((r) => r.name === "username");
  if (!hasUsername) {
    await turso.execute("ALTER TABLE users ADD COLUMN username TEXT");
    await turso.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)");

    // Migrar usuarios existentes: generar username desde email
    const usersResult = await turso.execute("SELECT id, email FROM users WHERE username IS NULL");
    const usedUsernames = new Set<string>();
    for (const row of usersResult.rows) {
      const email = row.email as string;
      const baseUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
      let username = baseUsername;
      let counter = 1;
      while (usedUsernames.has(username)) {
        username = `${baseUsername}${counter}`;
        counter++;
      }
      usedUsernames.add(username);
      await turso.execute({
        sql: "UPDATE users SET username = ? WHERE id = ?",
        args: [username, row.id as string],
      });
    }
  }

  // Migración: agregar cerrado_en a descuento_updates_historial si no existe
  const historialColumns = await turso.execute("PRAGMA table_info(descuento_updates_historial)");
  const hasCerradoEn = historialColumns.rows.some((r) => r.name === "cerrado_en");
  if (!hasCerradoEn) {
    await turso.execute("ALTER TABLE descuento_updates_historial ADD COLUMN cerrado_en TEXT NOT NULL DEFAULT ''");
  }

// ── Seed ───────────────────────────────────────────────────
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  const existing = await turso.execute({
    sql: "SELECT id FROM users WHERE username = ?",
    args: [adminUsername],
  });

  if (existing.rows.length === 0) {
    const id = crypto.randomUUID();
    const hashed = await hashPassword(adminPassword);
    await turso.execute({
      sql: "INSERT INTO users (id, email, username, password, name, role) VALUES (?, ?, ?, ?, ?, ?)",
      args: [id, `${adminUsername}@admin.local`, adminUsername, hashed, "Administrador", "admin"],
    });
  }
}
