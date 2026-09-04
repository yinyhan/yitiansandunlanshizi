import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import multer from "multer";
import {
  createTrip,
  deletePhoto,
  normalizeCode,
  publicUrl,
  readTrip,
  serializeTrip,
  supabase,
  updateTrip,
  uploadBucket,
  uploadPhoto,
  uploadTmpDir,
} from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);

// Railway 磁盘挂载路径（存放预编译的前端 dist）
const RAILWAY_DISK_MOUNT = process.env.RAILWAY_DISK_MOUNT_PATH || "";
// 本地临时上传目录（multer 写入后立即上传到 Supabase Storage）
const tmpUploadDir = path.join(__dirname, "..", ".uploads-tmp");
fs.mkdirSync(tmpUploadDir, { recursive: true });

// ─── Multer：先写本地 tmp，再异步上传 Supabase Storage ────────
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, tmpUploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("只接受图片"));
      return;
    }
    cb(null, true);
  },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ─── Multer 错误处理 ─────────────────────────────────────────
app.use((err, _req, res, next) => {
  if (err && err.name && err.name.startsWith("Multer")) {
    console.error("[multer error]", err.name, err.message);
    return res.status(400).json({ error: err.message, code: err.code || err.name });
  }
  if (err) {
    console.error("[express error]", err);
    return res.status(500).json({ error: err.message });
  }
  next();
});

// ─── 本地调试用局域网地址提示 ─────────────────────────────────
function lanUrls() {
  try {
    const nets = os.networkInterfaces();
    const urls = [];
    for (const list of Object.values(nets || {})) {
      for (const net of list || []) {
        if ((net.family === "IPv4" || net.family === 4) && !net.internal) {
          urls.push(`http://${net.address}:${PORT}`);
        }
      }
    }
    return urls;
  } catch {
    return [];
  }
}

// ─── API 路由 ────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    supabase: !!supabase,
    lan: lanUrls(),
  });
});

app.post("/api/trips", async (req, res) => {
  try {
    const trip = await createTrip(req.body?.title);
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/trips/:code", (req, res) => {
  readTrip(req.params.code).then((trip) => {
    if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
    res.json(trip);
  });
});

app.put("/api/trips/:code/meta", async (req, res) => {
  const trip = await updateTrip(req.params.code, (t) => {
    const { title, city, startDate, endDate, tabLabels } = req.body || {};
    if (typeof title === "string") t.title = title.slice(0, 80);
    if (typeof city === "string") t.city = city.slice(0, 80);
    if (typeof startDate === "string") t.startDate = startDate;
    if (typeof endDate === "string") t.endDate = endDate;
    if (tabLabels && typeof tabLabels === "object") {
      t.tabLabels = {
        setup:  String(tabLabels.setup  ?? t.tabLabels?.setup  ?? "行程").slice(0, 8),
        album:  String(tabLabels.album  ?? t.tabLabels?.album  ?? "画册").slice(0, 8),
        money:  String(tabLabels.money  ?? t.tabLabels?.money  ?? "账单").slice(0, 8),
        photos: String(tabLabels.photos ?? t.tabLabels?.photos ?? "相册").slice(0, 8),
      };
    }
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(trip);
});

app.post("/api/trips/:code/people", async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 24);
  if (!name) return res.status(400).json({ error: "请填写姓名" });
  const trip = await updateTrip(req.params.code, (t) => {
    t.people.push({ id: crypto.randomUUID(), name });
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(trip);
});

app.delete("/api/trips/:code/people/:id", async (req, res) => {
  const trip = await updateTrip(req.params.code, (t) => {
    t.people = t.people.filter((p) => p.id !== req.params.id);
    t.expenses = t.expenses.map((e) => {
      const amounts = { ...e.amounts };
      delete amounts[req.params.id];
      return { ...e, amounts };
    });
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(trip);
});

app.post("/api/trips/:code/itinerary", async (req, res) => {
  const { date, hour, title, note } = req.body || {};
  if (!date || hour === undefined || hour === null) {
    return res.status(400).json({ error: "缺少日期或时间" });
  }
  const trip = await updateTrip(req.params.code, (t) => {
    t.itinerary.push({
      id: crypto.randomUUID(),
      date,
      hour: Number(hour),
      title: String(title || "").slice(0, 80),
      note: String(note || "").slice(0, 400),
    });
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(trip);
});

app.put("/api/trips/:code/itinerary/:id", async (req, res) => {
  const trip = await updateTrip(req.params.code, (t) => {
    t.itinerary = t.itinerary.map((item) =>
      item.id === req.params.id
        ? {
            ...item,
            title: String(req.body?.title ?? item.title).slice(0, 80),
            note:  String(req.body?.note  ?? item.note).slice(0, 400),
            hour:  Number(req.body?.hour ?? item.hour),
            date:  String(req.body?.date ?? item.date),
          }
        : item,
    );
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(trip);
});

app.delete("/api/trips/:code/itinerary/:id", async (req, res) => {
  const trip = await updateTrip(req.params.code, (t) => {
    t.itinerary = t.itinerary.filter((item) => item.id !== req.params.id);
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(trip);
});

app.post("/api/trips/:code/expenses", async (req, res) => {
  const { category, date, note, amounts, paidBy } = req.body || {};
  const trip = await updateTrip(req.params.code, (t) => {
    t.expenses.push({
      id: crypto.randomUUID(),
      category: String(category || "其他"),
      date: String(date || t.startDate || ""),
      note: String(note || "").slice(0, 80),
      amounts: amounts && typeof amounts === "object" ? amounts : {},
      paidBy: String(paidBy || ""),
    });
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(trip);
});

app.put("/api/trips/:code/expenses/:id", async (req, res) => {
  const trip = await updateTrip(req.params.code, (t) => {
    t.expenses = t.expenses.map((e) =>
      e.id === req.params.id
        ? {
            ...e,
            category: String(req.body?.category ?? e.category),
            date:    String(req.body?.date    ?? e.date),
            note:    String(req.body?.note    ?? e.note).slice(0, 80),
            amounts: req.body?.amounts && typeof req.body.amounts === "object"
              ? req.body.amounts : e.amounts,
            paidBy:  String(req.body?.paidBy  ?? e.paidBy ?? ""),
          }
        : e,
    );
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(trip);
});

app.delete("/api/trips/:code/expenses/:id", async (req, res) => {
  const trip = await updateTrip(req.params.code, (t) => {
    t.expenses = t.expenses.filter((e) => e.id !== req.params.id);
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(trip);
});

// ─── 图片上传：本地 tmp → Supabase Storage ────────────────────
async function handleImageUpload(req, res, fieldName) {
  if (!req.file) return res.status(400).json({ error: `请选择${fieldName === "map" ? "地图" : "图片"}` });
  const shareCode = normalizeCode(req.params.code);

  try {
    // 读取本地临时文件，上传到 Supabase Storage
    const fileBuffer = fs.readFileSync(req.file.path);
    const publicUrl2 = await uploadPhoto(fileBuffer, req.file.originalname);

    // 清理本地 tmp
    fs.unlinkSync(req.file.path);

    const fieldMap = { map: "mapPath", cover: "coverImagePath", photos: undefined };
    const trip = await updateTrip(shareCode, (t) => {
      if (fieldName === "map")    t.mapPath = publicUrl2;
      if (fieldName === "cover")  t.coverImagePath = publicUrl2;
      if (fieldName === "photos") {
        t.photos.unshift({
          id: crypto.randomUUID(),
          path: publicUrl2,
          caption: String(req.body?.caption || "").slice(0, 80),
          uploaderName: String(req.body?.uploaderName || "旅行者").slice(0, 24),
          takenAt: Number(req.body?.takenAt) || Date.now(),
          createdAt: Date.now(),
        });
      }
      return t;
    });

    if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
    res.json(trip);
  } catch (err) {
    console.error(`[${fieldName} upload] error:`, err);
    res.status(500).json({ error: err.message || "上传失败" });
  }
}

app.post("/api/trips/:code/map", upload.single("file"),    (req, res) => handleImageUpload(req, res, "map"));
app.post("/api/trips/:code/cover", upload.single("file"),  (req, res) => handleImageUpload(req, res, "cover"));
app.post("/api/trips/:code/photos", upload.single("file"), (req, res) => handleImageUpload(req, res, "photos"));

app.delete("/api/trips/:code/photos/:id", async (req, res) => {
  const trip = await readTrip(req.params.code);
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  const photo = trip.photos.find((p) => p.id === req.params.id);
  if (photo?.path) {
    await deletePhoto(photo.path);
  }
  const updated = await updateTrip(req.params.code, (t) => {
    t.photos = t.photos.filter((p) => p.id !== req.params.id);
    return t;
  });
  res.json(updated);
});

// ─── 生产模式：服务前端静态文件 ──────────────────────────────
if (process.env.NODE_ENV === "production") {
  // Railway 磁盘挂载路径存放 dist；本地开发时放仓库根目录 dist/
  const dist = RAILWAY_DISK_MOUNT
    ? path.join(RAILWAY_DISK_MOUNT, "dist")
    : path.join(__dirname, "..", "dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  } else {
    console.warn(`[prod] dist not found at ${dist} — API only mode`);
  }
}

// ─── 启动 ────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API http://127.0.0.1:${PORT}`);
  if (supabase) {
    console.log("Supabase Storage: enabled");
  } else {
    console.warn("Supabase: NOT connected (MOCK mode)");
  }
  for (const url of lanUrls()) console.log(`LAN  ${url}/`);
});
