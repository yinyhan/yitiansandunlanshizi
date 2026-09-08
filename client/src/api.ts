import type { Trip } from "./types";

// ============================================================
// 部署目标：Vercel（前端）+ Supabase Edge Functions（后端）
//
// 环境变量（在 Vercel 项目设置里配置）：
//   VITE_SUPABASE_URL         = https://xxxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY    = eyJ...（anon public key，前端可见，安全）
// ============================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const API_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/api` : "/api";
const BUCKET = "travel-photos";

// ─── 单密码 owner_token（每个 trip 一份，存在 localStorage）──
const TOKEN_KEY = (code: string) => `owner_token:${code}`;

export function getOwnerToken(code: string): string {
  return localStorage.getItem(TOKEN_KEY(code)) || "";
}

export function setOwnerToken(code: string, token: string) {
  localStorage.setItem(TOKEN_KEY(code), token);
}

export function generateToken(): string {
  // 32 位随机 base36
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 36).toString(36),
  ).join("");
}

// ─── 通用 fetch 包装 ────────────────────────────────────────

async function parse<T = any>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

function headers(code: string, extra: Record<string, string> = {}): Record<string, string> {
  const token = getOwnerToken(code);
  const base: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (SUPABASE_ANON_KEY) {
    base["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  base["apikey"] = SUPABASE_ANON_KEY || "";
  return {
    ...base,
    ...(token ? { "x-owner-token": token } : {}),
    ...extra,
  };
}

// ─── Storage 直传（前端 → Supabase Storage，不走后端）──────

async function uploadToStorage(file: File, pathPrefix = ""): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  const objectKey = `${pathPrefix}${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const fd = new FormData();
  fd.append("file", file);

  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Storage 上传失败: ${res.status} ${text.slice(0, 120)}`);
  }
  // Storage 是公开 bucket，拼接 public URL
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectKey}`;
}

// ─── API 客户端 ─────────────────────────────────────────────

export const api = {
  health: () => fetch(`${API_BASE}/health`).then(parse),

  createTrip: async (title: string): Promise<Trip> => {
    // 创建 trip 时还没有 share_code，先用一个临时 key 把 token 存起来
    // 实际接口由后端返回 share_code，前端用 code 作 key 重存 token
    const token = generateToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-owner-token": token,
    };
    if (SUPABASE_ANON_KEY) {
      headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
      headers["apikey"] = SUPABASE_ANON_KEY;
    }
    const data = await parse<any>(
      await fetch(`${API_BASE}/trips`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title }),
      }),
    );
    if (data?.shareCode) setOwnerToken(data.shareCode, token);
    return data as Trip;
  },

  getTrip: (code: string) =>
    fetch(`${API_BASE}/trips/${code}`).then(parse) as Promise<Trip>,

  saveMeta: (code: string, body: Partial<Trip>) =>
    fetch(`${API_BASE}/trips/${code}/meta`, {
      method: "PUT",
      headers: headers(code),
      body: JSON.stringify(body),
    }).then(parse) as Promise<Trip>,

  addPerson: (code: string, name: string) =>
    fetch(`${API_BASE}/trips/${code}/people`, {
      method: "POST",
      headers: headers(code),
      body: JSON.stringify({ name }),
    }).then(parse) as Promise<Trip>,

  removePerson: (code: string, id: string) =>
    fetch(`${API_BASE}/trips/${code}/people/${id}`, {
      method: "DELETE",
      headers: headers(code),
    }).then(parse) as Promise<Trip>,

  addPlan: (code: string, body: object) =>
    fetch(`${API_BASE}/trips/${code}/itinerary`, {
      method: "POST",
      headers: headers(code),
      body: JSON.stringify(body),
    }).then(parse) as Promise<Trip>,

  updatePlan: (code: string, id: string, body: object) =>
    fetch(`${API_BASE}/trips/${code}/itinerary/${id}`, {
      method: "PUT",
      headers: headers(code),
      body: JSON.stringify(body),
    }).then(parse) as Promise<Trip>,

  removePlan: (code: string, id: string) =>
    fetch(`${API_BASE}/trips/${code}/itinerary/${id}`, {
      method: "DELETE",
      headers: headers(code),
    }).then(parse) as Promise<Trip>,

  addExpense: (code: string, body: object) =>
    fetch(`${API_BASE}/trips/${code}/expenses`, {
      method: "POST",
      headers: headers(code),
      body: JSON.stringify(body),
    }).then(parse) as Promise<Trip>,

  updateExpense: (code: string, id: string, body: object) =>
    fetch(`${API_BASE}/trips/${code}/expenses/${id}`, {
      method: "PUT",
      headers: headers(code),
      body: JSON.stringify(body),
    }).then(parse) as Promise<Trip>,

  removeExpense: (code: string, id: string) =>
    fetch(`${API_BASE}/trips/${code}/expenses/${id}`, {
      method: "DELETE",
      headers: headers(code),
    }).then(parse) as Promise<Trip>,

  // ─── 图片上传：前端直传 Storage，再调 Edge Function 记一笔 ─
  upload: async (
    code: string,
    kind: "map" | "photos" | "cover",
    file: File,
    caption = "",
    uploaderName = "",
    takenAt = 0,
  ): Promise<Trip> => {
    // 1. 直传 Storage
    const publicUrl = await uploadToStorage(file, `${code}/`);

    // 2. 调 API 把路径写进数据库
    if (kind === "map" || kind === "cover") {
      // map 和 cover 是覆盖字段，走 /meta 接口
      const body = kind === "map" ? { mapPath: publicUrl } : { coverImagePath: publicUrl };
      return fetch(`${API_BASE}/trips/${code}/meta`, {
        method: "PUT",
        headers: headers(code),
        body: JSON.stringify(body),
      }).then(parse) as Promise<Trip>;
    }

    // photos 是新增
    return fetch(`${API_BASE}/trips/${code}/photos`, {
      method: "POST",
      headers: headers(code),
      body: JSON.stringify({
        path: publicUrl,
        caption,
        uploaderName,
        takenAt: takenAt || Date.now(),
      }),
    }).then(parse) as Promise<Trip>;
  },

  removePhoto: (code: string, id: string) =>
    fetch(`${API_BASE}/trips/${code}/photos/${id}`, {
      method: "DELETE",
      headers: headers(code),
    }).then(parse) as Promise<Trip>,
};

// 兼容性：保留默认导出
export default api;
