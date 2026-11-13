// Cliente da API REST. Centraliza tratamento de erros e token do admin.
const TOKEN_KEY = "pc_admin_token";

export class ApiError extends Error {
  constructor(message, status, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const adminToken = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export async function api(path, { method = "GET", body, admin = false, form } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (admin && adminToken.get()) headers.Authorization = `Bearer ${adminToken.get()}`;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor. Verifique sua conexão.", 0);
  }
  let data = null;
  try { data = await response.json(); } catch { /* resposta sem JSON */ }
  if (!response.ok) {
    if (response.status === 401 && admin) adminToken.clear();
    throw new ApiError(data?.error || "Algo deu errado. Tente novamente.", response.status, data?.fields || {});
  }
  return data;
}

// Cache simples para dados que não mudam durante a visita
const cache = new Map();
export function cached(path) {
  if (!cache.has(path)) {
    cache.set(path, api(path).catch((e) => { cache.delete(path); throw e; }));
  }
  return cache.get(path);
}
