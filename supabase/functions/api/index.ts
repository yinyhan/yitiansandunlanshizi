// ============================================================
// Supabase Edge Function: api
// 替代 server/index.js + server/store.js
// 路由前缀: /functions/v1/api/*
//
// 用法：客户端带 header "x-owner-token" 调用
// ============================================================

// @ts-nocheck — Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.115.0";
import { randomUUID } from "https://deno.land/std@0.224.0/uuid/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("[api] 缺少 SUPABASE_URL 或 SUPABASE_SERVICE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BUCKET = "travel-photos";

// ─── 通用工具 ────────────────────────────────────────────────

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, x-owner-token",
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
    },
  });
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase().slice(0, 12);
}

function makeShareCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function checkToken(req) {
  return req.headers.get("x-owner-token") || "";
}

// ─── 序列化：把 DB 行 → 前端期望的对象格式 ──────────────────
// 前端期望的 trip 形状：
// { shareCode, title, city, mapPath, coverImagePath, startDate, endDate,
//   tabLabels, people:[{id,name}], itinerary:[{id,date,hour,title,note}],
//   expenses:[{id,category,date,note,amounts,paidBy}],
//   photos:[{id,path,caption,uploaderName,takenAt,createdAt}] }

function serializeTrip(trip, people, itinerary, expenses, photos) {
  return {
    shareCode: trip.share_code,
    title: trip.title,
    city: trip.city,
    mapPath: trip.map_path,
    coverImagePath: trip.cover_image_path,
    startDate: trip.start_date,
    endDate: trip.end_date,
    tabLabels: trip.tab_labels,
    people: people.map((p) => ({ id: p.id, name: p.name })),
    itinerary: itinerary.map((i) => ({
      id: i.id, date: i.date, hour: i.hour, title: i.title, note: i.note,
    })),
    expenses: expenses.map((e) => ({
      id: e.id, category: e.category, date: e.date, note: e.note,
      amounts: e.amounts, paidBy: e.paid_by,
    })),
    photos: photos.map((p) => ({
      id: p.id, path: p.path, caption: p.caption,
      uploaderName: p.uploader_name, takenAt: p.taken_at, createdAt: p.created_at,
    })),
  };
}

async function readTripFull(shareCode) {
  const { data: trip, error } = await supabase
    .from("trips").select("*").eq("share_code", shareCode).maybeSingle();
  if (error) throw error;
  if (!trip) return null;
  const tripId = trip.id;
  const [people, itinerary, expenses, photos] = await Promise.all([
    supabase.from("people").select("*").eq("trip_id", tripId).order("created_at"),
    supabase.from("itinerary").select("*").eq("trip_id", tripId).order("created_at"),
    supabase.from("expenses").select("*").eq("trip_id", tripId).order("created_at"),
    supabase.from("photos").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }),
  ]);
  if (people.error) throw people.error;
  if (itinerary.error) throw itinerary.error;
  if (expenses.error) throw expenses.error;
  if (photos.error) throw photos.error;
  return { trip, ...serializeTrip(trip, people.data, itinerary.data, expenses.data, photos.data) };
}

// ─── 路由分发 ────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type, x-owner-token",
        "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      },
    });
  }

  const url = new URL(req.url);
  // 路径去掉 /functions/v1/api 前缀
  let path = url.pathname.replace(/^\/functions\/v1\/api/, "");
  if (!path) path = "/";

  try {
    // ─── 健康检查 ──────────────────────────────────────────
    if (path === "/health") {
      return jsonResponse({
        ok: true,
        supabase: !!SUPABASE_URL && !!SUPABASE_SERVICE_KEY,
      });
    }

    // ─── 创建旅行 ──────────────────────────────────────────
    if (path === "/trips" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const token = checkToken(req);
      if (!token) return jsonResponse({ error: "缺少 x-owner-token" }, 401);
      const shareCode = makeShareCode();
      const { data, error } = await supabase.from("trips").insert({
        share_code: shareCode,
        title: String(body.title || "未命名旅程").slice(0, 80),
        city: "",
        owner_token: token,
      }).select().single();
      if (error) throw error;
      return jsonResponse(readTripFull(shareCode).then((t) => t || {}));
    }

    // ─── 读取旅行 ──────────────────────────────────────────
    const tripMatch = path.match(/^\/trips\/([A-Z0-9]+)(?:\/(.*))?$/);
    if (tripMatch) {
      const shareCode = normalizeCode(tripMatch[1]);
      const rest = tripMatch[2] || "";

      // GET /trips/:code
      if (req.method === "GET" && !rest) {
        const t = await readTripFull(shareCode);
        if (!t) return jsonResponse({ error: "找不到这场旅行" }, 404);
        return jsonResponse(t);
      }

      // PUT /trips/:code/meta
      if (req.method === "PUT" && rest === "meta") {
        const token = checkToken(req);
        const body = await req.json();
        const { data: trip } = await supabase.from("trips")
          .select("owner_token").eq("share_code", shareCode).maybeSingle();
        if (!trip) return jsonResponse({ error: "找不到这场旅行" }, 404);
        if (trip.owner_token !== token) return jsonResponse({ error: "无权修改" }, 403);

        const patch = {};
        if (typeof body.title === "string") patch.title = body.title.slice(0, 80);
        if (typeof body.city === "string") patch.city = body.city.slice(0, 80);
        if (typeof body.startDate === "string") patch.start_date = body.startDate;
        if (typeof body.endDate === "string") patch.end_date = body.endDate;
        if (body.tabLabels && typeof body.tabLabels === "object") {
          patch.tab_labels = body.tabLabels;
        }
        const { error } = await supabase.from("trips")
          .update(patch).eq("share_code", shareCode);
        if (error) throw error;
        return jsonResponse(await readTripFull(shareCode));
      }

      // ─── people ─────────────────────────────────────────
      if (req.method === "POST" && rest === "people") {
        const token = checkToken(req);
        const { name } = await req.json();
        if (!name?.trim()) return jsonResponse({ error: "请填写姓名" }, 400);
        const { data: trip } = await supabase.from("trips")
          .select("id, owner_token").eq("share_code", shareCode).maybeSingle();
        if (!trip) return jsonResponse({ error: "找不到这场旅行" }, 404);
        if (trip.owner_token !== token) return jsonResponse({ error: "无权修改" }, 403);

        const { error } = await supabase.from("people").insert({
          trip_id: trip.id, name: name.trim().slice(0, 24), owner_token: token,
        });
        if (error) throw error;
        return jsonResponse(await readTripFull(shareCode));
      }

      const personMatch = rest.match(/^people\/([0-9a-f-]+)$/);
      if (personMatch && req.method === "DELETE") {
        const token = checkToken(req);
        const personId = personMatch[1];
        const { data: person } = await supabase.from("people")
          .select("owner_token").eq("id", personId).maybeSingle();
        if (!person) return jsonResponse({ error: "找不到这个人" }, 404);
        if (person.owner_token !== token) return jsonResponse({ error: "无权修改" }, 403);
        const { error } = await supabase.from("people").delete().eq("id", personId);
        if (error) throw error;
        return jsonResponse(await readTripFull(shareCode));
      }

      // ─── itinerary ──────────────────────────────────────
      if (req.method === "POST" && rest === "itinerary") {
        const token = checkToken(req);
        const { date, hour, title, note } = await req.json();
        if (!date || hour == null) return jsonResponse({ error: "缺少日期或时间" }, 400);
        const { data: trip } = await supabase.from("trips")
          .select("id, owner_token").eq("share_code", shareCode).maybeSingle();
        if (!trip) return jsonResponse({ error: "找不到这场旅行" }, 404);
        if (trip.owner_token !== token) return jsonResponse({ error: "无权修改" }, 403);

        const { error } = await supabase.from("itinerary").insert({
          trip_id: trip.id,
          date,
          hour: Number(hour),
          title: String(title || "").slice(0, 80),
          note: String(note || "").slice(0, 400),
          owner_token: token,
        });
        if (error) throw error;
        return jsonResponse(await readTripFull(shareCode));
      }

      const itineraryMatch = rest.match(/^itinerary\/([0-9a-f-]+)$/);
      if (itineraryMatch) {
        const id = itineraryMatch[1];
        const token = checkToken(req);
        const { data: item } = await supabase.from("itinerary")
          .select("owner_token").eq("id", id).maybeSingle();
        if (!item) return jsonResponse({ error: "找不到这个行程" }, 404);
        if (item.owner_token !== token) return jsonResponse({ error: "无权修改" }, 403);

        if (req.method === "PUT") {
          const body = await req.json();
          const patch = {};
          if ("title" in body) patch.title = String(body.title).slice(0, 80);
          if ("note" in body) patch.note = String(body.note).slice(0, 400);
          if ("hour" in body) patch.hour = Number(body.hour);
          if ("date" in body) patch.date = String(body.date);
          const { error } = await supabase.from("itinerary").update(patch).eq("id", id);
          if (error) throw error;
        } else if (req.method === "DELETE") {
          const { error } = await supabase.from("itinerary").delete().eq("id", id);
          if (error) throw error;
        }
        return jsonResponse(await readTripFull(shareCode));
      }

      // ─── expenses ───────────────────────────────────────
      if (req.method === "POST" && rest === "expenses") {
        const token = checkToken(req);
        const body = await req.json();
        const { data: trip } = await supabase.from("trips")
          .select("id, owner_token, start_date").eq("share_code", shareCode).maybeSingle();
        if (!trip) return jsonResponse({ error: "找不到这场旅行" }, 404);
        if (trip.owner_token !== token) return jsonResponse({ error: "无权修改" }, 403);

        const { error } = await supabase.from("expenses").insert({
          trip_id: trip.id,
          category: String(body.category || "其他"),
          date: String(body.date || trip.start_date || new Date().toISOString().slice(0, 10)),
          note: String(body.note || "").slice(0, 80),
          amounts: body.amounts && typeof body.amounts === "object" ? body.amounts : {},
          paid_by: String(body.paidBy || ""),
          owner_token: token,
        });
        if (error) throw error;
        return jsonResponse(await readTripFull(shareCode));
      }

      const expenseMatch = rest.match(/^expenses\/([0-9a-f-]+)$/);
      if (expenseMatch) {
        const id = expenseMatch[1];
        const token = checkToken(req);
        const { data: item } = await supabase.from("expenses")
          .select("owner_token").eq("id", id).maybeSingle();
        if (!item) return jsonResponse({ error: "找不到这笔账单" }, 404);
        if (item.owner_token !== token) return jsonResponse({ error: "无权修改" }, 403);

        if (req.method === "PUT") {
          const body = await req.json();
          const patch = {};
          if ("category" in body) patch.category = String(body.category);
          if ("date" in body) patch.date = String(body.date);
          if ("note" in body) patch.note = String(body.note).slice(0, 80);
          if (body.amounts && typeof body.amounts === "object") patch.amounts = body.amounts;
          if ("paidBy" in body) patch.paid_by = String(body.paidBy);
          const { error } = await supabase.from("expenses").update(patch).eq("id", id);
          if (error) throw error;
        } else if (req.method === "DELETE") {
          const { error } = await supabase.from("expenses").delete().eq("id", id);
          if (error) throw error;
        }
        return jsonResponse(await readTripFull(shareCode));
      }

      // ─── photos ─────────────────────────────────────────
      if (req.method === "POST" && rest === "photos") {
        const token = checkToken(req);
        const body = await req.json();
        const { path, caption, uploaderName, takenAt } = body;
        if (!path) return jsonResponse({ error: "缺少图片地址" }, 400);
        const { data: trip } = await supabase.from("trips")
          .select("id, owner_token").eq("share_code", shareCode).maybeSingle();
        if (!trip) return jsonResponse({ error: "找不到这场旅行" }, 404);
        if (trip.owner_token !== token) return jsonResponse({ error: "无权修改" }, 403);

        const { error } = await supabase.from("photos").insert({
          trip_id: trip.id,
          path,
          caption: String(caption || "").slice(0, 80),
          uploader_name: String(uploaderName || "旅行者").slice(0, 24),
          taken_at: Number(takenAt) || Date.now(),
          owner_token: token,
        });
        if (error) throw error;
        return jsonResponse(await readTripFull(shareCode));
      }

      const photoMatch = rest.match(/^photos\/([0-9a-f-]+)$/);
      if (photoMatch && req.method === "DELETE") {
        const id = photoMatch[1];
        const token = checkToken(req);
        const { data: photo } = await supabase.from("photos")
          .select("path, owner_token").eq("id", id).maybeSingle();
        if (!photo) return jsonResponse({ error: "找不到这张照片" }, 404);
        if (photo.owner_token !== token) return jsonResponse({ error: "无权修改" }, 403);

        // 同时删 Storage 里的文件
        try {
          const url = new URL(photo.path);
          const objectKey = url.pathname.split(`/storage/v1/object/public/${BUCKET}/`)[1];
          if (objectKey) await supabase.storage.from(BUCKET).remove([objectKey]);
        } catch (_) { /* 删除失败不影响主流程 */ }

        const { error } = await supabase.from("photos").delete().eq("id", id);
        if (error) throw error;
        return jsonResponse(await readTripFull(shareCode));
      }
    }

    return jsonResponse({ error: "路由不存在", path }, 404);
  } catch (err) {
    console.error("[api error]", err);
    return jsonResponse({ error: err.message || "内部错误" }, 500);
  }
});
