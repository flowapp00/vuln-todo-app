import { useEffect, useState } from "react";
import { api } from "./api.js";
import { APP_NAME } from "./config.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Auth({ onLogged }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function validate() {
    if (mode === "register" && form.name.trim().length < 2) {
      return "Digite seu nome completo";
    }
    if (!EMAIL_RE.test(form.email)) {
      return "Digite um e-mail válido";
    }
    if (form.password.length < 8) {
      return "A senha precisa ter pelo menos 8 caracteres";
    }
    return "";
  }

  async function submit(e) {
    e.preventDefault();
    setInfo("");
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");

    try {
      const data =
        mode === "login"
          ? await api.login({ email: form.email, password: form.password })
          : await api.register(form);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogged(data.user);
    } catch (err) {
      setError(err.message);
    }
  }

  async function forgot() {
    setError("");
    try {
      const data = await api.forgotPassword(form.email);
      setInfo(`${data.message} (token: ${data.resetToken})`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="wrap">
      <h1>{APP_NAME}</h1>
      <p className="muted">Organize o seu dia em um lugar só.</p>

      <div className="card">
        <div className="tabs">
          <button
            className={mode === "login" ? "" : "ghost"}
            onClick={() => setMode("login")}
          >
            Entrar
          </button>
          <button
            className={mode === "register" ? "" : "ghost"}
            onClick={() => setMode("register")}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={submit}>
          {mode === "register" && (
            <input placeholder="Nome" value={form.name} onChange={set("name")} />
          )}
          <input
            placeholder="E-mail"
            value={form.email}
            onChange={set("email")}
          />
          <input
            type="password"
            placeholder="Senha"
            value={form.password}
            onChange={set("password")}
          />

          {error && <p className="error">{error}</p>}
          {info && <p className="ok">{info}</p>}

          <button type="submit">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </button>
          {mode === "login" && (
            <button type="button" className="ghost" onClick={forgot}>
              Esqueci minha senha
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function Tasks({ user, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  async function load(q = "") {
    try {
      setTasks(await api.listTasks(q));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Escreva o nome da tarefa");
      return;
    }
    if (title.length > 80) {
      setError("O nome da tarefa é muito longo (máximo 80 caracteres)");
      return;
    }
    setError("");
    await api.createTask({ title, notes });
    setTitle("");
    setNotes("");
    load(search);
  }

  async function toggle(task) {
    await api.toggleTask(task.id, !task.done);
    load(search);
  }

  async function remove(id) {
    await api.deleteTask(id);
    setDetail(null);
    load(search);
  }

  async function open(id) {
    setDetail(await api.getTask(id));
  }

  return (
    <div className="wrap">
      <h1>{APP_NAME}</h1>
      <p className="muted">
        Olá, {user.name || user.email}.{" "}
        <button className="ghost" onClick={onLogout}>
          sair
        </button>
      </p>

      <div className="card">
        <form onSubmit={add}>
          <input
            placeholder="Nova tarefa"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            placeholder="Detalhes (opcional)"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit">Adicionar</button>
        </form>
      </div>

      <div className="card">
        <input
          placeholder="Buscar nas suas tarefas"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            load(e.target.value);
          }}
        />

        {tasks.length === 0 && <p className="muted">Nenhuma tarefa por aqui.</p>}

        {tasks.map((task) => (
          <div className="row" key={task.id}>
            <input
              type="checkbox"
              style={{ width: 16, margin: 0 }}
              checked={!!task.done}
              onChange={() => toggle(task)}
            />
            <span className={task.done ? "done" : ""}>{task.title}</span>
            <button className="ghost" onClick={() => open(task.id)}>
              ver
            </button>
            <button className="ghost" onClick={() => remove(task.id)}>
              excluir
            </button>
          </div>
        ))}
      </div>

      {detail && (
        <div className="card">
          <h1 style={{ fontSize: 16 }}>{detail.title}</h1>
          <p className="muted">{detail.notes || "Sem detalhes"}</p>
          <button className="ghost" onClick={() => setDetail(null)}>
            fechar
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  function logout() {
    localStorage.clear();
    setUser(null);
  }

  return user ? (
    <Tasks user={user} onLogout={logout} />
  ) : (
    <Auth onLogged={setUser} />
  );
}
