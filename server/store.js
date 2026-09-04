import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const dataDir = path.join(root, "data");
export const uploadDir = path.join(root, "uploads");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const queues = new Map();

function tripPath(code) {
  return path.join(dataDir, `${code}.json`);
}

function runExclusive(code, fn) {
  const prev = queues.get(code) || Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(
    code,
    next.catch(() => {}),
  );
  return next;
}

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
  return fs.existsSync(tripPath(code)) ? newShareCode() : code;
}

export function emptyTrip(shareCode, title) {
  return {
    shareCode,
    title: title || "未命名旅程",
    city: "",
    mapPath: "",
    coverImagePath: "",
    startDate: "",
    endDate: "",
    people: [],
    itinerary: [],
    expenses: [],
    photos: [],
    tabLabels: { setup: "行程", album: "画册", money: "账单", photos: "相册" },
    updatedAt: Date.now(),
  };
}

export async function createTrip(title) {
  const shareCode = newShareCode();
  const trip = emptyTrip(shareCode, title);
  await saveTrip(trip);
  fs.mkdirSync(path.join(uploadDir, shareCode), { recursive: true });
  return trip;
}

export function readTrip(code) {
  const shareCode = normalizeCode(code);
  const file = tripPath(shareCode);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export async function saveTrip(trip) {
  trip.updatedAt = Date.now();
  const file = tripPath(trip.shareCode);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(trip, null, 2));
  fs.renameSync(tmp, file);
  return trip;
}

export async function updateTrip(code, mutator) {
  const shareCode = normalizeCode(code);
  return runExclusive(shareCode, async () => {
    const trip = readTrip(shareCode);
    if (!trip) return null;
    try {
      const next = (await mutator(trip)) || trip;
      next.shareCode = shareCode;
      return saveTrip(next);
    } catch (err) {
      console.error(`[updateTrip ${shareCode}]`, err);
      throw err;
    }
  });
}

export function publicUrl(relPath) {
  if (!relPath) return "";
  return `/uploads/${relPath.replace(/\\/g, "/")}`;
}
