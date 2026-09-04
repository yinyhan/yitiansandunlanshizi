export function daysOf(start: string, end: string) {
  if (!start || !end) return [];
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return [];
  const out: string[] = [];
  const cur = new Date(a);
  while (cur <= b && out.length < 31) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function weekday(date: string) {
  const names = ["日", "一", "二", "三", "四", "五", "六"];
  return names[new Date(`${date}T00:00:00`).getDay()];
}

export function money(n: number) {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function personHue(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
