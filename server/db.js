import initSqlJs from "sql.js";

const SQL = await initSqlJs();
const db = new SQL.Database();

db.run(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    reset_token TEXT,
    reset_expires INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    notes TEXT,
    done INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

export function query(sql) {
  const result = db.exec(sql);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

export function execute(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
}

export function lastInsertId() {
  return query("SELECT last_insert_rowid() AS id")[0].id;
}

function seed() {
  execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [
    "Ana Souza",
    "ana@exemplo.com",
    "ana123456",
  ]);
  execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [
    "Bruno Lima",
    "bruno@exemplo.com",
    "bruno123456",
  ]);

  execute("INSERT INTO tasks (user_id, title, notes) VALUES (?, ?, ?)", [
    1,
    "Comprar leite",
    "Mercado da esquina",
  ]);
  execute("INSERT INTO tasks (user_id, title, notes) VALUES (?, ?, ?)", [
    1,
    "Pagar internet",
    "Vence dia 10",
  ]);
  execute("INSERT INTO tasks (user_id, title, notes) VALUES (?, ?, ?)", [
    2,
    "Renovar contrato do apartamento",
    "Valor negociado: R$ 2.300 - falar com a imobiliaria",
  ]);
}

seed();

export default db;
