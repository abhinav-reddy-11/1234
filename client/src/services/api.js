// One small wrapper around fetch for every backend call.
// - Adds the JWT from localStorage
// - Throws an Error with the backend's message, so pages can show it directly
// - On 401 (expired/invalid session) it logs the user out

const BASE_URL = `${(import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "")}/api`;
const TOKEN_KEY = "rp_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(method, path, body) {
  const token = tokenStore.get();
  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers: {
        ...(!isForm && body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the server. Check that the backend is running.");
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty response */
  }

  if (res.status === 401 && token) {
    tokenStore.clear();
    window.dispatchEvent(new Event("rp:logout"));
  }
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body ?? {}),
  patch: (path, body) => request("PATCH", path, body ?? {}),
  del: (path) => request("DELETE", path),
  upload: (path, formData) => request("POST", path, formData),
};

export const formatINR = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export const formatDate = (d) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
