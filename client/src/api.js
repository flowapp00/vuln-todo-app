import { API_URL, ANALYTICS_API_KEY } from "./config.js";

function headers() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    "x-api-key": ANALYTICS_API_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro inesperado");
  return data;
}

export const api = {
  register: (body) =>
    request("/api/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) =>
    request("/api/login", { method: "POST", body: JSON.stringify(body) }),
  listTasks: (q) =>
    request(`/api/tasks${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getTask: (id) => request(`/api/tasks/${id}`),
  createTask: (body) =>
    request("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
  toggleTask: (id, done) =>
    request(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ done }),
    }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: "DELETE" }),
  forgotPassword: (email) =>
    request("/api/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (body) =>
    request("/api/password/reset", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
