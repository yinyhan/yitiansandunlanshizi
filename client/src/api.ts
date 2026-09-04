import type { Trip } from "./types";

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status?: number; code?: string };
    err.status = res.status;
    if (data.code) err.code = data.code;
    throw err;
  }
  return data;
}

export const api = {
  health: () => fetch("/api/health").then(parse),
  createTrip: (title: string) =>
    fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).then(parse) as Promise<Trip>,
  getTrip: (code: string) => fetch(`/api/trips/${code}`).then(parse) as Promise<Trip>,
  saveMeta: (code: string, body: Partial<Trip>) =>
    fetch(`/api/trips/${code}/meta`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(parse) as Promise<Trip>,
  addPerson: (code: string, name: string) =>
    fetch(`/api/trips/${code}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then(parse) as Promise<Trip>,
  removePerson: (code: string, id: string) =>
    fetch(`/api/trips/${code}/people/${id}`, { method: "DELETE" }).then(parse) as Promise<Trip>,
  addPlan: (code: string, body: object) =>
    fetch(`/api/trips/${code}/itinerary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(parse) as Promise<Trip>,
  updatePlan: (code: string, id: string, body: object) =>
    fetch(`/api/trips/${code}/itinerary/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(parse) as Promise<Trip>,
  removePlan: (code: string, id: string) =>
    fetch(`/api/trips/${code}/itinerary/${id}`, { method: "DELETE" }).then(parse) as Promise<Trip>,
  addExpense: (code: string, body: object) =>
    fetch(`/api/trips/${code}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(parse) as Promise<Trip>,
  updateExpense: (code: string, id: string, body: object) =>
    fetch(`/api/trips/${code}/expenses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(parse) as Promise<Trip>,
  removeExpense: (code: string, id: string) =>
    fetch(`/api/trips/${code}/expenses/${id}`, { method: "DELETE" }).then(parse) as Promise<Trip>,
  upload: async (code: string, kind: "map" | "photos" | "cover", file: File, caption = "", uploaderName = "", takenAt = 0) => {
    const form = new FormData();
    form.append("file", file);
    if (caption) form.append("caption", caption);
    if (uploaderName) form.append("uploaderName", uploaderName);
    if (takenAt) form.append("takenAt", String(takenAt));
    return parse(await fetch(`/api/trips/${code}/${kind}`, { method: "POST", body: form })) as Promise<Trip>;
  },
  removePhoto: (code: string, id: string) =>
    fetch(`/api/trips/${code}/photos/${id}`, { method: "DELETE" }).then(parse) as Promise<Trip>,
};
