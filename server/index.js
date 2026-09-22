import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { query, execute, lastInsertId } from "./db.js";

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors({ origin: "*" }));
app.use(express.json());

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Faça login para continuar" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Sessão expirada" });
  }
}

app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;

  const existing = query(
    `SELECT id FROM users WHERE email = '${String(email).replace(/'/g, "''")}'`
  );
  if (existing.length) {
    return res.status(409).json({ error: "Este e-mail já está cadastrado" });
  }

  execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [
    name,
    email,
    password,
  ]);
  const id = lastInsertId();

  const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: "7d" });
  res.status(201).json({ token, user: { id, name, email } });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const rows = query(
    `SELECT id, name, email FROM users WHERE email = '${email}' AND password = '${password}'`
  );

  if (!rows.length) {
    return res.status(401).json({ error: "E-mail ou senha inválidos" });
  }

  const user = rows[0];
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
  res.json({ token, user });
});

app.get("/api/tasks", auth, (req, res) => {
  const search = req.query.q;

  let sql = `SELECT id, title, notes, done, created_at FROM tasks WHERE user_id = ${req.user.id}`;
  if (search) {
    sql += ` AND (title LIKE '%${search}%' OR notes LIKE '%${search}%')`;
  }
  sql += " ORDER BY done ASC, id DESC";

  res.json(query(sql));
});

app.get("/api/tasks/:id", auth, (req, res) => {
  const rows = query(
    `SELECT id, user_id, title, notes, done, created_at FROM tasks WHERE id = ${Number(
      req.params.id
    )}`
  );

  if (!rows.length) {
    return res.status(404).json({ error: "Tarefa não encontrada" });
  }

  res.json(rows[0]);
});

app.post("/api/tasks", auth, (req, res) => {
  const { title, notes } = req.body;

  execute("INSERT INTO tasks (user_id, title, notes) VALUES (?, ?, ?)", [
    req.user.id,
    title,
    notes || "",
  ]);

  const id = lastInsertId();
  res.status(201).json(query(`SELECT * FROM tasks WHERE id = ${id}`)[0]);
});

app.patch("/api/tasks/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const rows = query(`SELECT user_id FROM tasks WHERE id = ${id}`);

  if (!rows.length || rows[0].user_id !== req.user.id) {
    return res.status(404).json({ error: "Tarefa não encontrada" });
  }

  execute("UPDATE tasks SET done = ? WHERE id = ?", [
    req.body.done ? 1 : 0,
    id,
  ]);
  res.json({ ok: true });
});

app.delete("/api/tasks/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const rows = query(`SELECT user_id FROM tasks WHERE id = ${id}`);

  if (!rows.length || rows[0].user_id !== req.user.id) {
    return res.status(404).json({ error: "Tarefa não encontrada" });
  }

  execute("DELETE FROM tasks WHERE id = ?", [id]);
  res.json({ ok: true });
});

app.post("/api/password/forgot", (req, res) => {
  const { email } = req.body;
  const rows = query(
    `SELECT id, name FROM users WHERE email = '${String(email).replace(
      /'/g,
      "''"
    )}'`
  );

  if (!rows.length) {
    return res.status(404).json({ error: "E-mail não encontrado" });
  }

  const resetToken = crypto.randomBytes(24).toString("hex");
  const ttl = Number(process.env.RESET_TOKEN_TTL_MINUTES || 15) * 60 * 1000;
  const expires = Date.now() + ttl;

  execute("UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?", [
    resetToken,
    expires,
    rows[0].id,
  ]);

  res.json({
    message: "Enviamos um link de recuperação para o seu e-mail",
    resetToken,
    expiresAt: expires,
  });
});

app.post("/api/password/reset", (req, res) => {
  const { token, password } = req.body;
  const rows = query(
    `SELECT id, reset_expires FROM users WHERE reset_token = '${String(
      token
    ).replace(/'/g, "''")}'`
  );

  if (!rows.length || rows[0].reset_expires < Date.now()) {
    return res.status(400).json({ error: "Token inválido ou expirado" });
  }

  execute(
    "UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?",
    [password, rows[0].id]
  );
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
