import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { compressImage } from "./compress";
import { daysOf, money, personHue, weekday } from "./format";
import type { Expense, Photo, PlanItem, TabLabels, Trip } from "./types";
import { CATEGORIES } from "./types";

type Tab = "setup" | "album" | "money" | "photos";

const TAB_ORDER: Tab[] = ["setup", "album", "money", "photos"];
const DEFAULT_TAB_LABELS: TabLabels = { setup: "行程", album: "画册", money: "账单", photos: "相册" };

// ─── Settlement logic ───────────────────────────────────────────────────────

interface Settlement { from: string; to: string; amount: number; }

function settle(trip: Trip): Settlement[] {
  const p = trip.people;
  if (!p.length) return [];
  const paid: Record<string, number> = {};
  const owed: Record<string, number> = {};
  for (const person of p) { paid[person.id] = 0; owed[person.id] = 0; }
  for (const e of trip.expenses) {
    const total = Object.values(e.amounts).reduce((s, v) => s + Number(v || 0), 0);
    if (e.paidBy && paid[e.paidBy] !== undefined) paid[e.paidBy] += total;
    for (const person of p) owed[person.id] += Number(e.amounts[person.id] || 0);
  }
  const net: Record<string, number> = {};
  for (const person of p) net[person.id] = Math.round((paid[person.id] - owed[person.id]) * 100) / 100;
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];
  for (const person of p) {
    if (net[person.id] < -0.01) debtors.push({ id: person.id, amount: -net[person.id] });
    if (net[person.id] > 0.01) creditors.push({ id: person.id, amount: net[person.id] });
  }
  const settlements: Settlement[] = [];
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const amt = Math.min(debtors[di].amount, creditors[ci].amount);
    if (amt > 0.01) settlements.push({ from: debtors[di].id, to: creditors[ci].id, amount: amt });
    debtors[di].amount -= amt; creditors[ci].amount -= amt;
    if (debtors[di].amount < 0.01) di++;
    if (creditors[ci].amount < 0.01) ci++;
  }
  return settlements;
}

// ─── Theme state (saved to localStorage) ─────────────────────────────────────

interface ThemeVars {
  bg: string;
  surface: string;
  ink: string;
  accent: string;
  tint: number; // 0 cool, 100 warm
  hue: number;  // 0 green tint, 100 brown tint
}

const PRESETS: Record<string, ThemeVars> = {
  ivory:    { bg: "#f7f6f3", surface: "#ffffff", ink: "#1a1a1a", accent: "#2a2a2a", tint: 60, hue: 40 },
  coolgray: { bg: "#f0f1f3", surface: "#ffffff", ink: "#0e1216", accent: "#1f242c", tint: 0,  hue: 200 },
  forest:   { bg: "#f3f5f2", surface: "#ffffff", ink: "#0f1a13", accent: "#1f3a2a", tint: 30, hue: 130 },
  sepia:    { bg: "#f3eee5", surface: "#fbf6ec", ink: "#241a10", accent: "#3a2a18", tint: 80, hue: 30 },
};

function applyTheme(t: ThemeVars) {
  const r = document.documentElement;
  r.style.setProperty("--bg", t.bg);
  r.style.setProperty("--surface", t.surface);
  r.style.setProperty("--ink", t.ink);
  r.style.setProperty("--accent", t.accent);
  // tint / hue 影响 surface-2 & border（轻调）
  r.style.setProperty("--surface-2", mix(t.surface, t.bg, 0.55));
  r.style.setProperty("--border", "rgba(0,0,0," + (0.06 + (100 - t.tint) / 1000).toFixed(3) + ")");
}

function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const r = Math.round(pa[0] * (1 - t) + pb[0] * t);
  const g = Math.round(pa[1] * (1 - t) + pb[1] * t);
  const bl = Math.round(pa[2] * (1 - t) + pb[2] * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function hexToRgb(h: string): [number, number, number] {
  const m = h.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
function hueToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

const DEFAULT_THEME: ThemeVars = PRESETS.ivory;
const THEME_STORAGE_KEY = "travelPlan.theme";

function loadTheme(): ThemeVars {
  try {
    const s = localStorage.getItem(THEME_STORAGE_KEY);
    if (s) return { ...DEFAULT_THEME, ...JSON.parse(s) };
  } catch {}
  return DEFAULT_THEME;
}

// ─── Custom Date Picker ────────────────────────────────────────────────────

interface DatePickerProps {
  value: string;       // YYYY-MM-DD or ""
  onChange: (v: string) => void;
  label?: string;
}

function DatePicker({ value, onChange, label }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const initial = value ? new Date(value + "T00:00:00") : today;
  const [viewY, setViewY] = useState(initial.getFullYear());
  const [viewM, setViewM] = useState(initial.getMonth());

  const triggerRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => { applyThemeVars(loadTheme()); }, []);

  function openPicker() {
    if (!value) {
      const d = new Date();
      setViewY(d.getFullYear()); setViewM(d.getMonth());
    } else {
      const d = new Date(value + "T00:00:00");
      setViewY(d.getFullYear()); setViewM(d.getMonth());
    }
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const popH = 280, popW = 280;
      let top = r.bottom + 6;
      if (top + popH > window.innerHeight - 8) top = Math.max(8, r.top - popH - 6);
      let left = r.left;
      if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
      setPos({ top, left: Math.max(8, left) });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)
        && triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const out: number[] = [];
    for (let y = now - 5; y <= now + 10; y++) out.push(y);
    return out;
  }, []);
  const months = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const days = useMemo(() => {
    const count = new Date(viewY, viewM + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [viewY, viewM]);

  function selectDate(d: number) {
    const ds = `${viewY}-${String(viewM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    onChange(ds);
    setOpen(false);
  }

  function selectToday() {
    const d = new Date();
    onChange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
    setOpen(false);
  }

  const display = value ? `${value} · 周${weekday(value)}` : label || "选择日期";
  const currentDay = value ? Number(value.slice(8, 10)) : null;
  const currentMonth = value ? Number(value.slice(5, 7)) - 1 : null;
  const currentYear = value ? Number(value.slice(0, 4)) : null;

  return (
    <>
      <div
        ref={triggerRef}
        className={`dp-trigger ${value ? "" : "is-empty"}`}
        onClick={openPicker}
      >
        <span>{display}</span>
        {value ? (
          <span className="clear" onClick={(e) => { e.stopPropagation(); onChange(""); }}>✕</span>
        ) : (
          <span>📅</span>
        )}
      </div>
      {open && (
        <div className="dp-popover" ref={popRef} style={{ top: pos.top, left: pos.left }}>
          <div className="dp-header">
            <div className="dp-nav">
              <button onClick={() => {
                const m = viewM - 1;
                if (m < 0) { setViewM(11); setViewY(viewY - 1); } else setViewM(m);
              }}>‹</button>
            </div>
            <div className="dp-title">{viewY} 年 {viewM + 1} 月</div>
            <div className="dp-nav">
              <button onClick={() => {
                const m = viewM + 1;
                if (m > 11) { setViewM(0); setViewY(viewY + 1); } else setViewM(m);
              }}>›</button>
            </div>
          </div>
          <div className="dp-cols">
            <div className="dp-col">
              <div className="dp-col-label">年</div>
              {years.map((y) => (
                <div key={y}
                  className={`dp-col-item ${y === viewY ? "on" : ""}`}
                  onClick={() => setViewY(y)}
                >{y}</div>
              ))}
            </div>
            <div className="dp-col">
              <div className="dp-col-label">月</div>
              {months.map((_, i) => (
                <div key={i}
                  className={`dp-col-item ${i === viewM ? "on" : ""}`}
                  onClick={() => setViewM(i)}
                >{i + 1}</div>
              ))}
            </div>
            <div className="dp-col">
              <div className="dp-col-label">日</div>
              {days.map((d) => (
                <div key={d}
                  className={`dp-col-item ${d === currentDay && currentMonth === viewM && currentYear === viewY ? "on" : ""}`}
                  onClick={() => selectDate(d)}
                >{d}</div>
              ))}
            </div>
          </div>
          <div className="dp-footer">
            <span className="today" onClick={selectToday}>今天</span>
            <span className="today" onClick={() => setOpen(false)}>关闭</span>
          </div>
        </div>
      )}
    </>
  );
}

function applyThemeVars(_t: ThemeVars) { /* placeholder hook for DatePicker lifecycle */ }

// ─── App entry ──────────────────────────────────────────────────────────────

export function App() {
  const code = location.pathname.match(/\/t\/([A-Za-z0-9]+)/i)?.[1] || "";
  if (!code) return <Landing />;
  return <TripApp code={code.toUpperCase()} />;
}

function Landing() {
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [lan, setLan] = useState<string[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.health().then((h) => setLan(h.lan || [])).catch(() => {});
  }, []);

  async function create() {
    setErr("");
    try {
      const trip = await api.createTrip(title || "未命名旅程");
      location.href = `/t/${trip.shareCode}`;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "创建失败");
    }
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <p className="kicker">Folded Atlas</p>
        <h1>折页旅行</h1>
        <p className="lede">
          像一本可以横着翻的手帐：先钉住城市与同行的人，再按 24 小时铺开每天的路，账单和拍下的光都写在同一本里。
        </p>
        <div className="field" style={{ marginBottom: 12 }}>
          <span className="field-label">主标题</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：京都春日慢行" />
        </div>
        <button className="btn btn-primary btn-block" style={{ marginBottom: 6 }} onClick={create}>
          开一本新折页
        </button>
        <div className="join">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="输入分享码"
            onKeyDown={(e) => { if (e.key === "Enter" && code.trim()) location.href = `/t/${code.trim()}`; }}
          />
          <button className="btn btn-ghost" onClick={() => code.trim() && (location.href = `/t/${code.trim()}`)}>
            加入
          </button>
        </div>
        <p className="hint">
          同一 Wi‑Fi 下，手机可打开：{lan[0] || "本机局域网地址"}。
          把分享码发给同伴，即可共同改行程、记花费、看美图。
        </p>
        {err && <p className="error" style={{ marginTop: 8 }}>{err}</p>}
      </div>
    </div>
  );
}

// ─── Main trip app ─────────────────────────────────────────────────────────

function TripApp({ code }: { code: string }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tab, setTab] = useState<Tab>("setup");
  const [err, setErr] = useState("");
  const busy = useRef(false);
  const [myName, setMyName] = useState(() => localStorage.getItem("myName") || "");

  // Theme
  const [theme, setThemeState] = useState<ThemeVars>(() => loadTheme());
  const [themeOpen, setThemeOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string>(() => {
    const t = loadTheme();
    const entry = Object.entries(PRESETS).find(([, p]) =>
      p.bg === t.bg && p.surface === t.surface && p.ink === t.ink && p.accent === t.accent);
    return entry ? entry[0] : "custom";
  });

  const setTheme = (t: ThemeVars) => setThemeState(t);

  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  function handleSetMyName(name: string) {
    setMyName(name);
    localStorage.setItem("myName", name);
  }

  async function refresh() {
    const next = await api.getTrip(code);
    setTrip(next);
  }

  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
    const t = setInterval(() => { if (busy.current) return; refresh().catch(() => {}); }, 4000);
    return () => clearInterval(t);
  }, [code]);

  async function mutate(fn: () => Promise<Trip>) {
    busy.current = true;
    try { setTrip(await fn()); setErr(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "操作失败"); }
    finally { busy.current = false; }
  }

  if (!trip && err) {
    return (
      <div className="landing">
        <div className="landing-card">
          <h1 style={{ fontSize: 26 }}>没找到这本折页</h1>
          <p className="lede">{err}</p>
          <button className="btn btn-primary" onClick={() => (location.href = "/")}>回封面</button>
        </div>
      </div>
    );
  }
  if (!trip) return <div className="landing">正在摊开纸页…</div>;

  const tabLabels = { ...DEFAULT_TAB_LABELS, ...(trip.tabLabels || {}) };

  return (
    <div className="app">
      <ThemePanel open={themeOpen} onClose={() => setThemeOpen(false)} theme={theme} setTheme={(t) => { setTheme(t); }}
        activePreset={activePreset} setActivePreset={setActivePreset} />
      <button className="theme-btn" onClick={() => setThemeOpen(!themeOpen)} title="主题面板" aria-label="主题面板">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="7" cy="8" r="5" fill="#3B82F6" opacity="0.9"/>
          <circle cx="13" cy="8" r="5" fill="#F472B6" opacity="0.85"/>
          <circle cx="10" cy="13" r="5" fill="#FB923C" opacity="0.88"/>
        </svg>
      </button>

      <header className="masthead">
        {trip.coverImageUrl ? <img className="masthead-cover" src={trip.coverImageUrl} alt="" /> : null}
        <div className="masthead-bg" style={trip.coverImageUrl ? { display: "none" } : undefined} />
        <div className="masthead-veil" />
        <div className="masthead-inner">
          <div className="masthead-city">{trip.city || "尚未落点"}</div>
          <div className="masthead-title">{trip.title || "未命名旅程"}</div>
          <div className="masthead-meta">
            <span>{trip.startDate && trip.endDate ? `${trip.startDate} → ${trip.endDate}` : "日期未定"}</span>
            <span>{trip.people.length ? trip.people.map((p) => p.name).join(" · ") : "还没有同行人"}</span>
          </div>
          <div className="masthead-share">
            <span className="stamp">{trip.shareCode}</span>
            <label className="masthead-cover-link" title={trip.coverImageUrl ? "更换封面图" : "上传封面图"}>
              <span className="icon">🖼</span>
              <span>{trip.coverImageUrl ? "换封面" : "上传封面"}</span>
              <input hidden type="file" accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = "";
                  if (!f) return;
                  try {
                    const packed = await compressImage(f, 2400);
                    await mutate(() => api.upload(trip.shareCode, "cover", packed));
                  } catch (err) {
                    console.error("[cover upload]", err);
                    setErr(err instanceof Error ? err.message : "上传失败");
                  }
                }}
              />
            </label>
            <button className="btn btn-tiny"
              style={{ background: "rgba(255,255,255,0.18)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}
              onClick={() => navigator.clipboard.writeText(location.href)}>
              复制链接
            </button>
          </div>
        </div>
      </header>

      <nav className="tabs">
        {TAB_ORDER.map((id) => (
          <Tab key={id} label={tabLabels[id]} active={tab === id}
            onClick={() => setTab(id)}
            onRename={async (newLabel) => {
              const nextTabLabels = { ...tabLabels, [id]: newLabel };
              await mutate(() => api.saveMeta(trip.shareCode, { tabLabels: nextTabLabels }));
            }}
          />
        ))}
      </nav>

      {err && <p className="error">{err}</p>}
      {tab === "setup" && <Setup trip={trip} mutate={mutate} myName={myName} onSetMyName={handleSetMyName} />}
      {tab === "album" && <Album trip={trip} mutate={mutate} />}
      {tab === "money" && <Money trip={trip} mutate={mutate} myName={myName} />}
      {tab === "photos" && <Photos trip={trip} mutate={mutate} myName={myName} />}
    </div>
  );
}

// ─── Tab with long-press rename ───────────────────────────────────────────

function Tab({ label, active, onClick, onRename }: {
  label: string; active: boolean;
  onClick: () => void;
  onRename: (newLabel: string) => void | Promise<void>;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [draft, setDraft] = useState(label);
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  useEffect(() => { setDraft(label); }, [label]);

  function startPress() {
    longPressedRef.current = false;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      setRenameOpen(true);
      setDraft(label);
    }, 500);
  }
  function cancelPress() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }
  function handleClick() {
    if (longPressedRef.current) { longPressedRef.current = false; return; }
    onClick();
  }

  function commit() {
    const v = draft.trim().slice(0, 8);
    if (v && v !== label) onRename(v);
    setRenameOpen(false);
  }

  return (
    <>
      <div
        className={`tab ${active ? "on" : ""}`}
        onClick={handleClick}
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchCancel={cancelPress}
        title="长按可重命名"
      >
        {label}
      </div>
      {renameOpen && (
        <div className="sheet" onClick={() => setRenameOpen(false)} style={{ alignItems: "center" }}>
          <div className="tab-rename-popover" onClick={(e) => e.stopPropagation()}>
            <div className="label">把「{label}」改成（最长 8 字）</div>
            <input value={draft} onChange={(e) => setDraft(e.target.value)}
              maxLength={8}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
              autoFocus />
            <div className="actions">
              <button className="btn btn-ghost" onClick={() => setRenameOpen(false)}>取消</button>
              <button className="btn btn-primary" onClick={commit}>保存</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Setup: combined card ──────────────────────────────────────────────────

function Setup({ trip, mutate, myName, onSetMyName }: {
  trip: Trip;
  mutate: (fn: () => Promise<Trip>) => Promise<void>;
  myName: string;
  onSetMyName: (name: string) => void;
}) {
  const [title, setTitle] = useState(trip.title);
  const [city, setCity] = useState(trip.city);
  const [startDate, setStart] = useState(trip.startDate);
  const [endDate, setEnd] = useState(trip.endDate);
  const [name, setName] = useState("");

  // 同步只在挂载/分享码变化时执行一次。后续不再覆盖本地编辑状态，
  // 避免父组件的 4 秒轮询把用户输入覆盖回后端旧值。
  // 保存成功由 mutate 内 setTrip 触发，本组件因 props 更新自动重渲染，新值会展示。
  const initSyncRef = useRef(false);
  useEffect(() => {
    if (initSyncRef.current) return;
    initSyncRef.current = true;
    setTitle(trip.title); setCity(trip.city);
    setStart(trip.startDate); setEnd(trip.endDate);
  }, [trip.shareCode]);

  // 自动保存行程信息（800ms debounce），无需手动点保存按钮
  // lastSaved 用 lazy init 确保只在挂载时设置一次
  const lastSaved = useRef<{title:string;city:string;startDate:string;endDate:string}|null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (lastSaved.current === null) {
    lastSaved.current = { title: trip.title, city: trip.city, startDate: trip.startDate, endDate: trip.endDate };
  }
  useEffect(() => {
    if (title === lastSaved.current!.title &&
        city === lastSaved.current!.city &&
        startDate === lastSaved.current!.startDate &&
        endDate === lastSaved.current!.endDate) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (title === lastSaved.current!.title &&
          city === lastSaved.current!.city &&
          startDate === lastSaved.current!.startDate &&
          endDate === lastSaved.current!.endDate) return;
      lastSaved.current = { title, city, startDate, endDate };
      try {
        const result = await mutate(() => api.saveMeta(trip.shareCode, { title, city, startDate, endDate }));
        console.log("[auto-save] 成功! city=", result?.city);
      } catch (e) {
        console.error("[auto-save] 失败:", e);
      }
    }, 800);
  }, [title, city, startDate, endDate]);

  return (
    <section className="panel">
      <div className="combined-card">
        {/* Cover area */}
        <label className={`cover-upload-area ${trip.coverImageUrl ? "has-cover" : ""}`} title="封面图">
          {trip.coverImageUrl ? (
            <img src={trip.coverImageUrl} alt="封面" />
          ) : (
            <div className="cover-placeholder">
              <span className="icon">🖼</span>
              <span>上传封面图</span>
              <span style={{ fontSize: 10, color: "var(--ink-4)" }}>风景照，或留空显示默认</span>
            </div>
          )}
          <input hidden type="file" accept="image/*"
            onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = "";
              if (!f) return;
              const packed = await compressImage(f, 2400);
              await mutate(() => api.upload(trip.shareCode, "cover", packed));
            }}
          />
          {trip.coverImageUrl && (
            <div className="cover-overlay">更换封面图</div>
          )}
        </label>

        {/* Trip info */}
        <div className="combined-body">
          <div className="combined-section">
            <div className="combined-section-title">行程信息</div>
            <div className="combined-grid-3">
              <div className="field">
                <span className="field-label">标题</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="京都春日" />
              </div>
              <div className="field">
                <span className="field-label">目的地</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="京都" />
              </div>
              <div className="field">
                <span className="field-label">我的名字</span>
                <input value={myName} onChange={(e) => onSetMyName(e.target.value)} placeholder="给自己起名" />
              </div>
            </div>
          </div>

          <div className="combined-section">
            <div className="combined-section-title">日期与地图</div>
            <div className="combined-grid">
              <div className="field">
                <span className="field-label">出发</span>
                <DatePicker value={startDate} onChange={setStart} label="选出发日期" />
              </div>
              <div className="field">
                <span className="field-label">返程</span>
                <DatePicker value={endDate} onChange={setEnd} label="选返程日期" />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="map-inline-card" title="城市地图">
                {trip.mapUrl ? (
                  <img src={trip.mapUrl} alt="地图" />
                ) : (
                  <>
                    <span className="map-icon">🗺</span>
                    <span className="map-text">上传城市地图</span>
                  </>
                )}
                <input hidden type="file" accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]; e.target.value = "";
                    if (!f) return;
                    const packed = await compressImage(f, 2000);
                    await mutate(() => api.upload(trip.shareCode, "map", packed));
                  }}
                />
                {trip.mapUrl && <div className="map-overlay">更换地图</div>}
              </label>
            </div>
          </div>

          <div className="combined-section">
            <div className="combined-section-title">同行的人</div>
            <div className="people">
              {trip.people.map((p) => (
                <span className="chip" key={p.id}>
                  <i className="dot" style={{ background: `hsl(${personHue(p.id)} 42% 42%)` }} />
                  {p.name}
                  <button className="remove-btn" title={`移除 ${p.name}`}
                    onClick={() => mutate(() => api.removePerson(trip.shareCode, p.id))}>×</button>
                </span>
              ))}
              {trip.people.length === 0 && (
                <span style={{ color: "var(--ink-3)", fontSize: 12 }}>还没有成员</span>
              )}
            </div>
            <div className="join">
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    mutate(() => api.addPerson(trip.shareCode, name.trim()));
                    setName("");
                  }
                }}
                placeholder="输入名字后回车"
              />
              <button className="btn btn-ghost" onClick={() => {
                if (!name.trim()) return;
                mutate(() => api.addPerson(trip.shareCode, name.trim()));
                setName("");
              }}>添加</button>
            </div>
          </div>

          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled
            title="标题、目的地、日期会自动保存，无需手动点击">
            行程信息已自动保存
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Album / Daily plan ────────────────────────────────────────────────────

function Album({ trip, mutate }: { trip: Trip; mutate: (fn: () => Promise<Trip>) => Promise<void> }) {
  const days = daysOf(trip.startDate, trip.endDate);
  const [focus, setFocus] = useState(days[0] || "");
  const rail = useRef<HTMLDivElement>(null);
  const [edit, setEdit] = useState<null | { date: string; hour: number; item?: PlanItem }>(null);
  // 防止 scroll handler 在用户点 chip 滚动期间抢走 focus
  const ignoreScrollRef = useRef(false);

  useEffect(() => {
    if (days.length && !days.includes(focus)) setFocus(days[0]);
  }, [days, focus]);

  // observe scroll → update focus chip (no auto-scroll)
  useEffect(() => {
    const el = rail.current; if (!el) return;
    function handler() {
      // 用户点 chip 滚动期间跳过，避免边角卡片算错 nearest
      if (ignoreScrollRef.current) return;
      if (!el) return;
      const center = el.scrollLeft + el.clientWidth / 2;
      let nearest = 0; let minDist = Infinity;
      const cards = el.querySelectorAll<HTMLElement>("[data-day]");
      cards.forEach((card, i) => {
        const cLeft = card.offsetLeft + card.offsetWidth / 2;
        const d = Math.abs(cLeft - center);
        if (d < minDist) { minDist = d; nearest = i; }
      });
      const newDate = days[nearest];
      if (newDate && newDate !== focus) setFocus(newDate);
    }
    el.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => el.removeEventListener("scroll", handler);
  }, [days, focus]);

  function clickChip(date: string) {
    setFocus(date);  // 只高亮，不滚动
    scrollToDate(date);
  }

  function scrollToDate(date: string) {
    const el = rail.current; if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-day="${date}"]`);
    if (!target) return;
    // 禁止 scroll handler 在滚动期间抢走 focus
    ignoreScrollRef.current = true;
    const left = target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2;
    el.scrollTo({ left, behavior: "smooth" });
    // 滚动结束后恢复（scrollend 支持则用它，不支持则 fallback 到 rAF 后直接关）
    const release = () => { ignoreScrollRef.current = false; el.removeEventListener("scrollend", release); };
    el.addEventListener("scrollend", release, { once: true });
    // Safari / 不支持 scrollend 的 fallback：300ms 后强制关掉
    setTimeout(() => { ignoreScrollRef.current = false; }, 300);
  }

  function goto(delta: number) {
    const i = days.indexOf(focus);
    const next = i + delta;
    if (next < 0 || next >= days.length) return;
    const d = days[next];
    setFocus(d);
    scrollToDate(d);
  }

  if (!days.length) {
    return <p className="empty">先在「行程」里填上出发与返程日期，画册才会出现。</p>;
  }

  return (
    <section className="panel album-wrap">
      <div className="day-chips">
        {days.map((d, i) => (
          <button key={d} className={`day-chip ${focus === d ? "on" : ""}`} onClick={() => clickChip(d)}>
            D{i + 1} · 周{weekday(d)}
          </button>
        ))}
      </div>
      <div className="album" ref={rail}>
        {days.map((date, i) => {
          const dayIndex = i;
          return (
            <article className="day-page" data-day={date} key={date}>
              <div className="day-head">
                <div>
                  <b>第 {i + 1} 天</b>
                  <div className="date-sub">{date} · 周{weekday(date)}</div>
                </div>
                <span className="day-nav">
                  <button className="day-nav-btn"
                    onClick={() => goto(-1)} disabled={dayIndex === 0}>‹</button>
                  <span className="day-badge">{dayIndex + 1}/{days.length}</span>
                  <button className="day-nav-btn"
                    onClick={() => goto(1)} disabled={dayIndex === days.length - 1}>›</button>
                </span>
              </div>
              <div className="hours">
                {Array.from({ length: 24 }, (_, hour) => {
                  const items = trip.itinerary.filter((x) => x.date === date && x.hour === hour);
                  return (
                    <div className="hour" key={hour}>
                      <time>{String(hour).padStart(2, "0")}:00</time>
                      <div className="slot">
                        {items.map((item) => (
                          <button key={item.id} className="plan" onClick={() => setEdit({ date, hour, item })}>
                            <b>{item.title || "未命名"}</b>
                            {item.note ? <span>{item.note}</span> : null}
                          </button>
                        ))}
                        <button className="add" onClick={() => setEdit({ date, hour })}>
                          ＋ 写进这一小时
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
      {edit && <PlanSheet trip={trip} draft={edit} onClose={() => setEdit(null)} mutate={mutate} />}
    </section>
  );
}

function PlanSheet({ trip, draft, onClose, mutate }: {
  trip: Trip; draft: { date: string; hour: number; item?: PlanItem };
  onClose: () => void; mutate: (fn: () => Promise<Trip>) => Promise<void>;
}) {
  const [title, setTitle] = useState(draft.item?.title || "");
  const [note, setNote] = useState(draft.item?.note || "");

  return (
    <div className="sheet" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={async (e) => {
        e.preventDefault();
        if (draft.item) {
          await mutate(() => api.updatePlan(trip.shareCode, draft.item!.id, { title, note, hour: draft.hour, date: draft.date }));
        } else {
          await mutate(() => api.addPlan(trip.shareCode, { date: draft.date, hour: draft.hour, title, note }));
        }
        onClose();
      }}>
        <h3>{String(draft.hour).padStart(2, "0")}:00 · {draft.date}</h3>
        <div className="field">
          <span className="field-label">活动</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="去哪儿 / 做什么" />
        </div>
        <div className="field">
          <span className="field-label">备注</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="集合点、预约号…" />
        </div>
        <div className="actions">
          {draft.item && (
            <button type="button" className="btn btn-danger" style={{ marginRight: "auto" }}
              onClick={async () => { await mutate(() => api.removePlan(trip.shareCode, draft.item!.id)); onClose(); }}>
              删除
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" type="submit">保存</button>
        </div>
      </form>
    </div>
  );
}

// ─── Money panel ────────────────────────────────────────────────────────────

function Money({ trip, mutate, myName }: {
  trip: Trip;
  mutate: (fn: () => Promise<Trip>) => Promise<void>;
  myName: string;
}) {
  const days = daysOf(trip.startDate, trip.endDate);
  const [cat, setCat] = useState("全部");
  const [day, setDay] = useState("全部");

  const visible = trip.expenses.filter((e) => {
    if (cat !== "全部" && e.category !== cat) return false;
    if (day !== "全部" && e.date !== day) return false;
    return true;
  });

  const personTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of trip.people) map[p.id] = 0;
    for (const e of visible) for (const p of trip.people) map[p.id] += Number(e.amounts[p.id] || 0);
    return map;
  }, [visible, trip.people]);

  const grand = Object.values(personTotals).reduce((a, b) => a + b, 0);

  const personPaid = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of trip.people) map[p.id] = 0;
    for (const e of trip.expenses) {
      const total = Object.values(e.amounts).reduce((s, v) => s + Number(v || 0), 0);
      if (e.paidBy && map[e.paidBy] !== undefined) map[e.paidBy] += total;
    }
    return map;
  }, [trip.expenses, trip.people]);

  const dailySubtotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of days) map[d] = 0;
    for (const e of trip.expenses) {
      if (map[e.date] !== undefined) map[e.date] += Object.values(e.amounts).reduce((s, v) => s + Number(v || 0), 0);
    }
    return map;
  }, [trip.expenses, days]);

  const settlements = useMemo(() => settle(trip), [trip]);

  function catSum(category: string) {
    return trip.expenses
      .filter((e) => e.category === category && (day === "全部" || e.date === day))
      .reduce((sum, e) => sum + Object.values(e.amounts).reduce((a, b) => a + Number(b || 0), 0), 0);
  }

  async function addRow() {
    const amounts: Record<string, number> = {};
    for (const p of trip.people) amounts[p.id] = 0;
    // 默认填入我的名字为付款人
    const myId = trip.people.find((p) => p.name === myName)?.id || "";
    await mutate(() =>
      api.addExpense(trip.shareCode, {
        category: cat === "全部" ? "吃饭" : cat,
        date: day === "全部" ? trip.startDate || days[0] || "" : day,
        note: "", amounts, paidBy: myId,
      }),
    );
  }

  return (
    <section className="panel">
      {trip.people.length > 0 && (
        <div className="stat-cards">
          <div className="stat-card highlight">
            <div className="stat-label">总花费</div>
            <div className="stat-value">¥ {money(grand)}</div>
          </div>
          {trip.people.map((p) => (
            <div className="stat-card" key={p.id}>
              <div className="stat-label">{p.name}</div>
              <div className="stat-value">¥ {money(personTotals[p.id] || 0)}</div>
              <div className="stat-sub">已付 ¥{money(personPaid[p.id] || 0)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="cat-filters">
        {["全部", ...CATEGORIES].map((c) => (
          <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>
            {c}{c !== "全部" ? ` ¥${money(catSum(c))}` : ""}
          </button>
        ))}
      </div>

      <div className="day-filters">
        <button className={day === "全部" ? "on" : ""} onClick={() => setDay("全部")}>全部天</button>
        {days.map((d, i) => (
          <button key={d} className={day === d ? "on" : ""} onClick={() => setDay(d)}>
            D{i + 1} · 周{weekday(d)} ¥{money(dailySubtotals[d] || 0)}
          </button>
        ))}
      </div>

      {!trip.people.length ? (
        <p className="empty">先添加成员，才能记录花费。</p>
      ) : (
        <>
          <div className="expense-table">
            <table>
              <thead>
                <tr>
                  <th>类别</th>
                  <th>日期</th>
                  <th>付款人</th>
                  <th>备注</th>
                  {trip.people.map((p) => <th key={p.id}>{p.name}</th>)}
                  <th>小计</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <ExpenseRow key={e.id} trip={trip} expense={e} mutate={mutate} />
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={addRow}>＋ 记一笔</button>
          </div>

          {day === "全部" && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div className="totals-title">每天小计</div>
              {days.map((d, i) => (
                <div className={`line ${i > 0 && i % 4 === 0 ? "line-group" : ""}`} key={d}>
                  <span className="label">D{i + 1} · {d} · 周{weekday(d)}</span>
                  <b className="amount">¥ {money(dailySubtotals[d] || 0)}</b>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ marginBottom: 10 }}>
            <div className="totals-title">个人小计</div>
            {trip.people.map((p, i) => (
              <div className={`line ${i > 0 && i % 4 === 0 ? "line-group" : ""}`} key={p.id}>
                <span className="label">
                  {p.name}
                  <span className="sub">（付了 ¥{money(personPaid[p.id] || 0)}，花了 ¥{money(personTotals[p.id] || 0)}）</span>
                </span>
                <b className="amount">¥ {money(personTotals[p.id] || 0)}</b>
              </div>
            ))}
            <div className="line grand">
              <span className="label">所有人总计</span>
              <b className="amount">¥ {money(grand)}</b>
            </div>
          </div>

          {settlements.length > 0 && (
            <div className="card settlement-card">
              <div className="totals-title">结算建议</div>
              {settlements.map((s, i) => {
                const from = trip.people.find((p) => p.id === s.from);
                const to = trip.people.find((p) => p.id === s.to);
                return (
                  <div className="line settle-line" key={i}>
                    <span>
                      <b>{from?.name ?? "?"}</b>
                      <span className="arrow"> 付给 </span>
                      <b>{to?.name ?? "?"}</b>
                    </span>
                    <b className="settle-amt">¥ {money(s.amount)}</b>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ExpenseRow({ trip, expense, mutate }: {
  trip: Trip; expense: Expense;
  mutate: (fn: () => Promise<Trip>) => Promise<void>;
}) {
  const subtotal = trip.people.reduce((s, p) => s + Number(expense.amounts[p.id] || 0), 0);
  const days = daysOf(trip.startDate, trip.endDate);

  function patch(next: Partial<Expense> & { amounts?: Record<string, number> }) {
    mutate(() => api.updateExpense(trip.shareCode, expense.id, { ...expense, ...next }));
  }

  function split() {
    if (!trip.people.length || subtotal === 0) return;
    const each = Math.round((subtotal / trip.people.length) * 100) / 100;
    const amounts: Record<string, number> = {};
    trip.people.forEach((p, i) => {
      amounts[p.id] = i === trip.people.length - 1
        ? Math.round((subtotal - each * (trip.people.length - 1)) * 100) / 100
        : each;
    });
    patch({ amounts });
  }


  return (
    <tr>
      <td>
        <select value={expense.category} onChange={(e) => patch({ category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </td>
      <td>
        <select value={expense.date} onChange={(e) => patch({ date: e.target.value })}>
          {days.map((d) => <option key={d} value={d}>{d.slice(5)}</option>)}
        </select>
      </td>
      <td>
        <PersonDropdown
          people={trip.people}
          value={expense.paidBy || ""}
          placeholder="—"
          onChange={(id) => patch({ paidBy: id })}
        />
      </td>
      <td>
        <input value={expense.note} onChange={(e) => patch({ note: e.target.value })} placeholder="备注" />
      </td>
      {trip.people.map((p) => (
        <td key={p.id}>
          <input type="number" min={0} step="0.01"
            value={expense.amounts[p.id] ?? 0}
            onChange={(e) => patch({ amounts: { ...expense.amounts, [p.id]: Number(e.target.value) } })} />
        </td>
      ))}
      <td className="subtotal-cell">¥ {money(subtotal)}</td>
      <td className="expense-actions-cell">
        <button className="action-chip" onClick={split}>
          <span className="icon">⚖</span><span>均分</span>
        </button>
        <button className="action-chip action-danger"
          onClick={() => mutate(() => api.removeExpense(trip.shareCode, expense.id))}>
          <span className="icon">🗑</span><span>删除</span>
        </button>
      </td>
    </tr>
  );
}

// ─── Person Dropdown (custom, replaces native select) ────────

function PersonDropdown({ people, value, onChange, placeholder = "选择" }: {
  people: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const current = people.find((p) => p.id === value);

  function openPanel() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={`dp-dropdown ${open ? "open" : ""}`} ref={ref}>
      <button type="button"
        className={`dp-dropdown-trigger ${current ? "" : "is-empty"}`}
        onClick={() => open ? setOpen(false) : openPanel()}>
        <span>{current ? current.name : placeholder}</span>
        <span className="chev">▾</span>
      </button>
      {open && pos && (
        <div className="dp-dropdown-panel" style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          minWidth: pos.width,
        }}>
          {people.length === 0 && <div className="dp-dropdown-empty">尚未添加成员</div>}
          {people.map((p) => (
            <div key={p.id}
              className={`dp-dropdown-item ${p.id === value ? "on" : ""}`}
              onClick={() => { onChange(p.id); setOpen(false); }}>
              {p.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Photos with top upload area ───────────────────────────────────────────

function Photos({ trip, mutate, myName }: {
  trip: Trip;
  mutate: (fn: () => Promise<Trip>) => Promise<void>;
  myName: string;
}) {
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState(Date.now());
  const [pickedPreset, setPickedPreset] = useState<string>("现在");
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!lightbox) return;
    const current = lightbox;
    function handler(e: KeyboardEvent) {
      const photos = trip.photos;
      const idx = photos.findIndex((p) => p.id === current.id);
      if (e.key === "ArrowRight" && idx < photos.length - 1) setLightbox(photos[idx + 1]);
      if (e.key === "ArrowLeft" && idx > 0) setLightbox(photos[idx - 1]);
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, trip.photos]);

  function pickPreset(label: string) {
    setPickedPreset(label);
    const now = Date.now();
    if (label === "现在") { setTakenAt(now); }
    else if (label === "10分钟前") { setTakenAt(now - 10 * 60 * 1000); }
    else if (label === "半小时前") { setTakenAt(now - 30 * 60 * 1000); }
    else if (label === "一小时前") { setTakenAt(now - 60 * 60 * 1000); }
    else if (label === "三小时前") { setTakenAt(now - 3 * 60 * 60 * 1000); }
    else if (label === "今早") {
      const d = new Date(); d.setHours(8, 0, 0, 0); setTakenAt(d.getTime());
    }
    else if (label === "昨晚") {
      const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(20, 30, 0, 0); setTakenAt(d.getTime());
    }
    else if (label === "今天上午") {
      const d = new Date(); d.setHours(9, 0, 0, 0); setTakenAt(d.getTime());
    }
    else if (label === "昨天上午") {
      const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(10, 0, 0, 0); setTakenAt(d.getTime());
    }
    setCustomOpen(false);
  }

  function applyCustom() {
    if (!customVal) return;
    const t = new Date(customVal).getTime();
    if (!isNaN(t)) { setTakenAt(t); setPickedPreset("自定义"); }
    setCustomOpen(false);
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      const packed = await compressImage(f);
      await mutate(() => api.upload(trip.shareCode, "photos", packed, caption, myName, takenAt));
    }
    setCaption("");
    setPickedPreset("现在");
    setTakenAt(Date.now());
    if (fileRef.current) fileRef.current.value = "";
  }

  const presets = ["现在", "10分钟前", "半小时前", "一小时前", "三小时前", "今天上午", "今早", "昨晚", "昨天上午"];

  return (
    <>
      <section className="panel">
        <div className="photo-upload-area">
          <div className="upload-fields">
            <div className="field">
              <span className="field-label">这张想写的话（可选）</span>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="一句话…" />
            </div>
            <div className="field">
              <span className="field-label">拍照时间（点一下时间）</span>
              <div className="time-presets">
                {presets.map((p) => (
                  <button key={p}
                    className={`time-presets-chip ${pickedPreset === p ? "on" : ""}`}
                    onClick={() => pickPreset(p)}>
                    {p}
                  </button>
                ))}
                <button className={`time-presets-chip ${pickedPreset === "自定义" ? "on" : ""}`}
                  onClick={() => { setCustomVal(toLocalISO(takenAt)); setCustomOpen(!customOpen); }}>
                  自定义
                </button>
              </div>
              {customOpen && (
                <div className="time-custom-form">
                  <input type="datetime-local"
                    value={customVal}
                    onChange={(e) => setCustomVal(e.target.value)} />
                  <div className="actions">
                    <button className="btn btn-tiny" onClick={() => setCustomOpen(false)}>取消</button>
                    <button className="btn btn-primary btn-tiny" onClick={applyCustom}>确定</button>
                  </div>
                </div>
              )}
              <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4 }}>
                拍照时间被记为：{new Date(takenAt).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" })}
              </div>
            </div>
          </div>
          <div className="upload-buttons">
            <input ref={fileRef} hidden type="file" accept="image/*" multiple capture="environment"
              onChange={(e) => handleFiles(e.target.files)} />
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} style={{ flex: 1 }}>
              📷 拍照上传
            </button>
            <button className="btn btn-ghost" onClick={() => {
              if (fileRef.current) { fileRef.current.removeAttribute("capture"); fileRef.current.click(); fileRef.current.setAttribute("capture", "environment"); }
            }}>🖼 相册选图</button>
          </div>
        </div>

        {trip.photos.length === 0 ? (
          <p className="empty">还没有照片。在上方拍照或选择图片上传，同伴刷新就能看见。</p>
        ) : (
          <div className="gallery">
            {trip.photos.map((p) => {
              const ts = p.takenAt || p.createdAt;
              const dateStr = ts ? new Date(ts).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" }) : "";
              const timeStr = ts ? new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "";
              return (
                <figure className="photo" key={p.id}>
                  <div className="photo-inner">
                    <div className="photo-img-wrap">
                      <img src={p.url} alt={p.caption} onClick={() => setLightbox(p)} />
                      <button className="photo-del"
                        onClick={() => mutate(() => api.removePhoto(trip.shareCode, p.id))}>✕</button>
                    </div>
                    <div className="photo-strip">
                      {p.caption ? <p className="photo-caption">{p.caption}</p>
                        : <p className="photo-caption" style={{ opacity: 0.3 }}>无题</p>}
                      <div className="photo-meta">
                        <span>{dateStr} {timeStr}</span>
                        {p.uploaderName && <span className="photo-watermark-uploader">by {p.uploaderName}</span>}
                      </div>
                    </div>
                  </div>
                </figure>
              );
            })}
          </div>
        )}
      </section>

      {lightbox && (
        <Lightbox photo={lightbox} photos={trip.photos}
          onClose={() => setLightbox(null)} onNavigate={(p) => setLightbox(p)} />
      )}
    </>
  );
}

function toLocalISO(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Lightbox({ photo, photos, onClose, onNavigate }: {
  photo: Photo; photos: Photo[];
  onClose: () => void; onNavigate: (p: Photo) => void;
}) {
  const idx = photos.findIndex((p) => p.id === photo.id);
  const ts = photo.takenAt || photo.createdAt;
  const dateStr = ts ? new Date(ts).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" }) : "";
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>✕</button>
      {idx > 0 && (
        <button className="lightbox-prev" onClick={(e) => { e.stopPropagation(); onNavigate(photos[idx - 1]); }}>‹</button>
      )}
      {idx < photos.length - 1 && (
        <button className="lightbox-next" onClick={(e) => { e.stopPropagation(); onNavigate(photos[idx + 1]); }}>›</button>
      )}
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <img src={photo.url} alt={photo.caption} />
        <div className="lightbox-caption">
          <div>
            {photo.caption && <p>{photo.caption}</p>}
            <p style={{ fontSize: 11, opacity: 0.7 }}>{dateStr} {photo.uploaderName && `· by ${photo.uploaderName}`}</p>
          </div>
          <span>{idx + 1} / {photos.length}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Theme Panel ───────────────────────────────────────────────────────────

function ThemePanel({ open, onClose, theme, setTheme, activePreset, setActivePreset }: {
  open: boolean;
  onClose: () => void;
  theme: ThemeVars;
  setTheme: (t: ThemeVars) => void;
  activePreset: string;
  setActivePreset: (s: string) => void;
}) {
  if (!open) return null;

  function setPreset(name: keyof typeof PRESETS) {
    setActivePreset(name);
    setTheme(PRESETS[name]);
  }

  function update(key: keyof ThemeVars, val: number | string) {
    setActivePreset("custom");
    setTheme({ ...theme, [key]: val });
  }

  function autoBg() {
    const bg = hueToHex(theme.hue, 8 + (100 - theme.tint) / 4, 96);
    const surface = "#ffffff";
    const ink = hueToHex(theme.hue, 25, 12);
    const accent = hueToHex(theme.hue, 35, 18);
    setActivePreset("custom");
    setTheme({ ...theme, bg, surface, ink, accent });
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 59 }} />
      <div className="theme-panel">
        <div className="theme-title">
          <span>🎨 配色面板</span>
          <span className="close" onClick={onClose}>✕</span>
        </div>

        <div className="theme-presets">
          {Object.keys(PRESETS).map((p) => (
            <div key={p} className={`theme-preset ${activePreset === p ? "on" : ""}`} onClick={() => setPreset(p as keyof typeof PRESETS)}>
              {p === "ivory" && "米白暖"}
              {p === "coolgray" && "冷灰"}
              {p === "forest" && "森林"}
              {p === "sepia" && "复古"}
            </div>
          ))}
        </div>

        <div className="theme-color-row">
          <label>背景</label>
          <input type="color" value={theme.bg} onChange={(e) => update("bg", e.target.value)} />
          <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{theme.bg}</span>
        </div>
        <div className="theme-color-row">
          <label>卡片</label>
          <input type="color" value={theme.surface} onChange={(e) => update("surface", e.target.value)} />
          <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{theme.surface}</span>
        </div>
        <div className="theme-color-row">
          <label>文字</label>
          <input type="color" value={theme.ink} onChange={(e) => update("ink", e.target.value)} />
          <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{theme.ink}</span>
        </div>
        <div className="theme-color-row">
          <label>强调</label>
          <input type="color" value={theme.accent} onChange={(e) => update("accent", e.target.value)} />
          <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{theme.accent}</span>
        </div>

        <div className="theme-row">
          <label>色调</label>
          <input type="range" min={0} max={360} value={theme.hue}
            onChange={(e) => update("hue", Number(e.target.value))} />
          <span className="theme-val">{theme.hue}°</span>
        </div>
        <div className="theme-row">
          <label>冷暖</label>
          <input type="range" min={0} max={100} value={theme.tint}
            onChange={(e) => update("tint", Number(e.target.value))} />
          <span className="theme-val">{theme.tint}</span>
        </div>

        <button className="theme-reset" onClick={autoBg}>按滑块重新生成色</button>
        <button className="theme-reset" style={{ marginTop: 4 }}
          onClick={() => { setPreset("ivory"); }}>重置为米白</button>
      </div>
    </>
  );
}
