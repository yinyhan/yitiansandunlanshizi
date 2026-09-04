import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import multer from "multer";
import {
  createTrip,
  normalizeCode,
  publicUrl,
  readTrip,
  updateTrip,
  uploadDir,
} from "./store.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8787);
const RENDER_DISK_MOUNT = process.env.RENDER_DISK_MOUNT_PATH || "";

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const code = normalizeCode(req.params.code);
    const dir = path.join(uploadDir, code);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
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
app.use("/uploads", express.static(uploadDir));

// ─── Multer 错误处理 ────────────────────────────────────
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

function lanUrls() {
  try {
    const nets = os.networkInterfaces();
    const urls = [];
    for (const list of Object.values(nets || {})) {
      for (const net of list || []) {
        if ((net.family === "IPv4" || net.family === 4) && !net.internal) {
          urls.push(`http://${net.address}:5173`);
        }
      }
    }
    return urls;
  } catch {
    return [];
  }
}

function serialize(trip) {
  return {
    ...trip,
    mapUrl: publicUrl(trip.mapPath),
    coverImageUrl: publicUrl(trip.coverImagePath),
    photos: (trip.photos || []).map((p) => ({
      ...p,
      url: publicUrl(p.path),
    })),
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, lan: lanUrls() });
});

app.post("/api/trips", async (req, res) => {
  const trip = await createTrip(req.body?.title);
  res.json(serialize(trip));
});

app.get("/api/trips/:code", (req, res) => {
  const trip = readTrip(req.params.code);
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(serialize(trip));
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
        setup: String(tabLabels.setup ?? t.tabLabels?.setup ?? "行程").slice(0, 8),
        album: String(tabLabels.album ?? t.tabLabels?.album ?? "画册").slice(0, 8),
        money: String(tabLabels.money ?? t.tabLabels?.money ?? "账单").slice(0, 8),
        photos: String(tabLabels.photos ?? t.tabLabels?.photos ?? "相册").slice(0, 8),
      };
    }
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(serialize(trip));
});

app.post("/api/trips/:code/people", async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 24);
  if (!name) return res.status(400).json({ error: "请填写姓名" });
  const trip = await updateTrip(req.params.code, (t) => {
    t.people.push({ id: crypto.randomUUID(), name });
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(serialize(trip));
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
  res.json(serialize(trip));
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
  res.json(serialize(trip));
});

app.put("/api/trips/:code/itinerary/:id", async (req, res) => {
  const trip = await updateTrip(req.params.code, (t) => {
    t.itinerary = t.itinerary.map((item) =>
      item.id === req.params.id
        ? {
            ...item,
            title: String(req.body?.title ?? item.title).slice(0, 80),
            note: String(req.body?.note ?? item.note).slice(0, 400),
            hour: Number(req.body?.hour ?? item.hour),
            date: String(req.body?.date ?? item.date),
          }
        : item,
    );
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(serialize(trip));
});

app.delete("/api/trips/:code/itinerary/:id", async (req, res) => {
  const trip = await updateTrip(req.params.code, (t) => {
    t.itinerary = t.itinerary.filter((item) => item.id !== req.params.id);
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(serialize(trip));
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
  res.json(serialize(trip));
});

app.put("/api/trips/:code/expenses/:id", async (req, res) => {
  const trip = await updateTrip(req.params.code, (t) => {
    t.expenses = t.expenses.map((e) =>
      e.id === req.params.id
        ? {
            ...e,
            category: String(req.body?.category ?? e.category),
            date: String(req.body?.date ?? e.date),
            note: String(req.body?.note ?? e.note).slice(0, 80),
            amounts:
              req.body?.amounts && typeof req.body.amounts === "object"
                ? req.body.amounts
                : e.amounts,
            paidBy: String(req.body?.paidBy ?? e.paidBy ?? ""),
          }
        : e,
    );
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(serialize(trip));
});

app.delete("/api/trips/:code/expenses/:id", async (req, res) => {
  const trip = await updateTrip(req.params.code, (t) => {
    t.expenses = t.expenses.filter((e) => e.id !== req.params.id);
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(serialize(trip));
});

app.post("/api/trips/:code/map", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "请选择地图图片" });
  const rel = path.join(normalizeCode(req.params.code), req.file.filename);
  const trip = await updateTrip(req.params.code, (t) => {
    t.mapPath = rel;
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(serialize(trip));
});

app.post("/api/trips/:code/cover", upload.single("file"), async (req, res) => {
  console.log(`[cover] ${req.params.code} file=${req.file?.originalname} size=${req.file?.size} mime=${req.file?.mimetype}`);
  if (!req.file) return res.status(400).json({ error: "请选择封面图" });
  const rel = path.join(normalizeCode(req.params.code), req.file.filename);
  const trip = await updateTrip(req.params.code, (t) => {
    t.coverImagePath = rel;
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(serialize(trip));
});

app.post("/api/trips/:code/photos", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "请选择照片" });
  const rel = path.join(normalizeCode(req.params.code), req.file.filename);
  const uploaderName = String(req.body?.uploaderName || "旅行者").slice(0, 24);
  const caption = String(req.body?.caption || "").slice(0, 80);
  const takenAt = Number(req.body?.takenAt) || Date.now();
  const trip = await updateTrip(req.params.code, (t) => {
    t.photos.unshift({
      id: crypto.randomUUID(),
      path: rel,
      caption,
      uploaderName,
      takenAt,
      createdAt: Date.now(),
    });
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(serialize(trip));
});

app.delete("/api/trips/:code/photos/:id", async (req, res) => {
  const trip = await updateTrip(req.params.code, (t) => {
    const photo = t.photos.find((p) => p.id === req.params.id);
    if (photo?.path) {
      const full = path.join(uploadDir, photo.path);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
    t.photos = t.photos.filter((p) => p.id !== req.params.id);
    return t;
  });
  if (!trip) return res.status(404).json({ error: "找不到这场旅行" });
  res.json(serialize(trip));
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || "上传失败" });
});

if (process.env.NODE_ENV === "production") {
  // Render 磁盘挂载在 RENDER_DISK_MOUNT_PATH，预编译的 dist 放那里
  const dist = RENDER_DISK_MOUNT
    ? path.join(RENDER_DISK_MOUNT, "dist")
    : path.join(root, "dist");
  app.use(express.static(dist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API http://127.0.0.1:${PORT}`);
  for (const url of lanUrls()) console.log(`LAN  ${url}`);
});
