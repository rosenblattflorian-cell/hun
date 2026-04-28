/**
 * Offline-Queue: lokal speichern, später syncen.
 * Verwendet AsyncStorage. Pending-Aktionen werden bei Netz-Verbindung wiederholt.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "offline_queue_v1";

export type PendingAction = {
  id: string;
  endpoint: string;       // z.B. "/monteur/site-photos"
  method: "POST" | "PATCH" | "DELETE";
  body?: any;
  created_at: string;
  label: string;          // human-readable für UI
};

export async function getQueue(): Promise<PendingAction[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function enqueue(a: Omit<PendingAction, "id" | "created_at">) {
  const q = await getQueue();
  q.push({ ...a, id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function removeFromQueue(id: string) {
  const q = await getQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q.filter(a => a.id !== id)));
}

export async function clearQueue() {
  await AsyncStorage.setItem(QUEUE_KEY, "[]");
}

import { apiPost, apiPatch, apiDelete } from "./api";

export async function syncQueue(): Promise<{ ok: number; failed: number }> {
  const q = await getQueue();
  let ok = 0, failed = 0;
  for (const a of q) {
    try {
      if (a.method === "POST") await apiPost(a.endpoint, a.body);
      else if (a.method === "PATCH") await apiPatch(a.endpoint, a.body);
      else if (a.method === "DELETE") await apiDelete(a.endpoint);
      await removeFromQueue(a.id);
      ok++;
    } catch {
      failed++;
    }
  }
  return { ok, failed };
}
