import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem("access_token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`, { headers: await authHeaders() });
  if (!r.ok) throw new Error((await r.json()).detail || "Fehler");
  return r.json();
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(typeof data.detail === "string" ? data.detail : "Fehler");
  }
  return r.json();
}

export async function apiPatch<T>(path: string, body: any): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json()).detail || "Fehler");
  return r.json();
}

export async function apiDelete(path: string): Promise<any> {
  const r = await fetch(`${BASE}/api${path}`, { method: "DELETE", headers: await authHeaders() });
  if (!r.ok) throw new Error((await r.json()).detail || "Fehler");
  return r.json();
}
