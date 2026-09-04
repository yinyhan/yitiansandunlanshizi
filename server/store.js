import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── Supabase Client ───────────────────────────────────────
const supabaseUrl    = process.env.SUPABASE_URL    || "";
const supabaseKey    = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";
export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabase) {
  console.warn("[store] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — running in MOCK mode (data will not persist)");
}

// ─── 本地临时目录（multer 写入后上传到 Supabase Storage） ──
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadTmpDir = path.join(__dirname, "..", ".uploads-tmp");
export const uploadBucket = "travel-photos";

// ─── 共享码生成 ───────────────────────────────────────────
export function normalizeCode(code) {
  return String(code || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function newShareCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

// ─── 数据库 → 内存结构（兼容现有 index.js） ─────────────────
async function fetchTripRows(tripId) {
  if (!supabase) return null;
  const [tripRes, peopleRes, itinRes, expRes, photoRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase.from("people").select("*").eq("trip_id", tripId),
    supabase.from("itinerary").select("*").eq("trip_id", tripId).order("date").order("hour"),
    supabase.from("expenses").select("*").eq("trip_id", tripId).order("date"),
    supabase.from("photos").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }),
  ]);

  if (tripRes.error || !tripRes.data) return null;
  return serializeTrip(
    tripRes.data,
    peopleRes.data || [],
    itinRes.data || [],
    expRes.data || [],
    photoRes.data || [],
  );
}

export function serializeTrip(trip, people = [], itinerary = [], expenses = [], photos = []) {
  return {
    shareCode: trip.share_code,
    title: trip.title,
    city: trip.city,
    mapPath: trip.map_path || "",
    coverImagePath: trip.cover_image_path || "",
    startDate: trip.start_date || "",
    endDate: trip.end_date || "",
    tabLabels: trip.tab_labels || { setup: "行程", album: "画册", money: "账单", photos: "相册" },
    updatedAt: trip.updated_at ? new Date(trip.updated_at).getTime() : Date.now(),
    people: (people).map((p) => ({ id: p.id, name: p.name })),
    itinerary: itinerary.map((i) => ({
      id: i.id,
      date: i.date,
      hour: i.hour,
      title: i.title,
      note: i.note,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      category: e.category,
      date: e.date,
      note: e.note,
      amounts: e.amounts || {},
      paidBy: e.paid_by,
    })),
    photos: photos.map((p) => ({
      id: p.id,
      path: p.path,
      caption: p.caption,
      uploaderName: p.uploader_name,
      takenAt: p.taken_at,
      createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
    })),
  };
}

// ─── CRUD 操作 ─────────────────────────────────────────────

export async function createTrip(title) {
  const shareCode = newShareCode();
  const tabLabels = { setup: "行程", album: "画册", money: "账单", photos: "相册" };

  if (!supabase) {
    // MOCK 模式：返回一个带 ID 的假对象
    return {
      id: crypto.randomUUID(),
      shareCode,
      title: title || "未命名旅程",
      city: "", mapPath: "", coverImagePath: "",
      startDate: "", endDate: "",
      tabLabels,
      updatedAt: Date.now(),
      people: [], itinerary: [], expenses: [], photos: [],
    };
  }

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({ share_code: shareCode, title: title || "未命名旅程", tab_labels: tabLabels })
    .select()
    .single();

  if (error || !trip) throw new Error(`创建旅行失败: ${error?.message}`);

  return serializeTrip(trip, [], [], [], []);
}

export async function readTrip(code) {
  if (!supabase) return null;
  const shareCode = normalizeCode(code);
  const { data, error } = await supabase
    .from("trips")
    .select("id")
    .eq("share_code", shareCode)
    .single();

  if (error || !data) return null;
  return fetchTripRows(data.id);
}

export async function updateTrip(code, mutator) {
  if (!supabase) return null;
  const shareCode = normalizeCode(code);

  const { data: existing, error: fetchErr } = await supabase
    .from("trips")
    .select("id")
    .eq("share_code", shareCode)
    .single();

  if (fetchErr || !existing) return null;

  // 先取最新完整数据
  const trip = await fetchTripRows(existing.id);
  if (!trip) return null;

  // 执行内存中的 mutate（复刻原有逻辑）
  const next = (await mutator(trip)) || trip;
  next.shareCode = shareCode;

  // 写回各表
  await supabase.from("trips").update({
    title: next.title,
    city: next.city,
    map_path: next.mapPath,
    cover_image_path: next.coverImagePath,
    start_date: next.startDate || null,
    end_date: next.endDate || null,
    tab_labels: next.tabLabels,
  }).eq("id", existing.id);

  // people
  const currentPeople = trip.people;
  const nextIds = new Set(currentPeople.map((p) => p.id));
  const newPeople = next.people.filter((p) => !p.id || !nextIds.has(p.id));
  if (newPeople.length) {
    await supabase.from("people").insert(newPeople.map((p) => ({ trip_id: existing.id, name: p.name })));
  }
  const keepIds = next.people.map((p) => p.id).filter(Boolean);
  if (keepIds.length) {
    await supabase.from("people").delete().eq("trip_id", existing.id).not("id", "in", `(${keepIds.map((id) => `'${id}'`).join(",")})`);
  }

  // itinerary
  const itinMap = new Map(trip.itinerary.map((i) => [i.id, i]));
  const nextItinIds = new Set(next.itinerary.map((i) => i.id));
  const upsertItin = next.itinerary.map((i) => ({
    id: itinMap.has(i.id) ? i.id : crypto.randomUUID(),
    trip_id: existing.id,
    date: i.date,
    hour: i.hour,
    title: i.title,
    note: i.note,
  }));
  await supabase.from("itinerary").upsert(upsertItin, { onConflict: "id" });
  const deleteItinIds = trip.itinerary.map((i) => i.id).filter((id) => !nextItinIds.has(id));
  if (deleteItinIds.length) {
    await supabase.from("itinerary").delete().in("id", deleteItinIds);
  }

  // expenses
  const expMap = new Map(trip.expenses.map((e) => [e.id, e]));
  const nextExpIds = new Set(next.expenses.map((e) => e.id));
  const upsertExp = next.expenses.map((e) => ({
    id: expMap.has(e.id) ? e.id : crypto.randomUUID(),
    trip_id: existing.id,
    category: e.category,
    date: e.date || trip.startDate || "",
    note: e.note,
    amounts: e.amounts || {},
    paid_by: e.paidBy || "",
  }));
  await supabase.from("expenses").upsert(upsertExp, { onConflict: "id" });
  const deleteExpIds = trip.expenses.map((e) => e.id).filter((id) => !nextExpIds.has(id));
  if (deleteExpIds.length) {
    await supabase.from("expenses").delete().in("id", deleteExpIds);
  }

  // photos
  const photoMap = new Map(trip.photos.map((p) => [p.id, p]));
  const nextPhotoIds = new Set(next.photos.map((p) => p.id));
  const upsertPhotos = next.photos.map((p) => ({
    id: photoMap.has(p.id) ? p.id : crypto.randomUUID(),
    trip_id: existing.id,
    path: p.path,
    caption: p.caption,
    uploader_name: p.uploaderName,
    taken_at: p.takenAt || null,
  }));
  await supabase.from("photos").upsert(upsertPhotos, { onConflict: "id" });
  const deletePhotoIds = trip.photos.map((p) => p.id).filter((id) => !nextPhotoIds.has(id));
  if (deletePhotoIds.length) {
    await supabase.from("photos").delete().in("id", deletePhotoIds);
  }

  return fetchTripRows(existing.id);
}

// ─── 工具函数 ──────────────────────────────────────────────

/**
 * 将图片上传到 Supabase Storage，返回 public URL
 */
export async function uploadPhoto(fileBuffer, filename) {
  if (!supabase) return filename;
  const ext = path.extname(filename || ".jpg").toLowerCase() || ".jpg";
  const key = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
  const { error } = await supabase.storage
    .from(uploadBucket)
    .upload(key, fileBuffer, { contentType: "image/*", upsert: false });
  if (error) {
    console.error("[uploadPhoto] supabase upload error:", error);
    return filename;
  }
  const { data } = supabase.storage.from(uploadBucket).getPublicUrl(key);
  return data.publicUrl;
}

/**
 * 删除 Supabase Storage 中的图片
 */
export async function deletePhoto(publicUrl) {
  if (!supabase || !publicUrl) return;
  // 从 URL 中提取 storage key: .../storage/v1/object/public/travel-photos/KEY
  const match = publicUrl.match(/\/travel-photos\/(.+)$/);
  if (!match) return;
  await supabase.storage.from(uploadBucket).remove([match[1]]);
}

export function publicUrl(relPath) {
  if (!relPath) return "";
  // 如果是完整 URL（Supabase Storage CDN），直接返回
  if (relPath.startsWith("http")) return relPath;
  // 否则拼成 Supabase public URL（仅作回退）
  if (supabase) {
    const { data } = supabase.storage.from(uploadBucket).getPublicUrl(relPath);
    return data.publicUrl;
  }
  return `/uploads/${relPath.replace(/\\/g, "/")}`;
}
