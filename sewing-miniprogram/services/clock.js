// services/clock.js
// 缝纫打卡服务层
// 数据结构：
// clock = [{ id, date, startTime, endTime, hours, remark, productIds[], createdAt }]

const { get, set } = require('../utils/storage.js');
const { genId } = require('../utils/id.js');
const { today } = require('../utils/date.js');

const KEY = 'clock';
const ACTIVE_KEY = 'clock_active'; // 当前未下班打卡

function list() { return get(KEY, []); }
function save(list) { set(KEY, list); }

function getActive() {
  return get(ACTIVE_KEY, null);
}
function setActive(item) {
  set(ACTIVE_KEY, item);
}
function clearActive() {
  set(ACTIVE_KEY, null);
}

/** 一键上班打卡 */
function clockIn(force = false) {
  // 防误打卡：如果今天已经有打卡记录，弹 modal 提示
  if (!force) {
    const todayKey = today();
    const todayRecords = list().filter(r => r.date === todayKey);
    if (todayRecords.length > 0) {
      return { needConfirm: true, todayRecords };
    }
  }
  const now = Date.now();
  const item = { id: genId('clk'), date: today(), startTime: now, endTime: null, hours: 0, remark: '', productIds: [] };
  setActive(item);
  return { success: true, item };
}

/** 一键下班打卡：完成今日记录 */
function clockOut(remark = '') {
  const active = getActive();
  if (!active) return null;
  const end = Date.now();
  const hours = Math.max(0, (end - active.startTime) / (1000 * 60 * 60));
  const record = { ...active, endTime: end, hours: Number(hours.toFixed(2)), remark };
  const listData = [record, ...list()];
  save(listData);
  clearActive();
  return record;
}

function remove(id) {
  save(list().filter((x) => x.id !== id));
}

/** 统计：今日/本周/本月工时 + 真实打卡天数 */
function stats() {
  const data = list();
  const now = new Date();
  const todayKey = today();

  // 关键：用 Set 按 date 去重，得到"打过卡的天数"（一天打多次算 1 天）
  const daySet = new Set();
  data.forEach(r => daySet.add(r.date));
  const totalDays = daySet.size;
  // 累计打卡次数（原始 list 长度，用于 UI 提示「N 天 / M 次」）
  const totalSessions = data.length;

  let todayHours = 0;
  let weekHours = 0;
  let monthHours = 0;

  // 本周一开始
  const weekStart = new Date(now);
  const day = (weekStart.getDay() + 6) % 7; // 周一为 0
  weekStart.setDate(weekStart.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);

  // 本月一号
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  data.forEach((r) => {
    const d = new Date(r.startTime);
    if (r.date === todayKey) todayHours += r.hours;
    if (d >= weekStart) weekHours += r.hours;
    if (d >= monthStart) monthHours += r.hours;
  });

  return {
    todayHours: todayHours.toFixed(2),
    weekHours: weekHours.toFixed(2),
    monthHours: monthHours.toFixed(2),
    totalDays,       // 实际「打卡天数」（去重后）
    totalSessions    // 「打卡次数」（不去重）
  };
}

module.exports = { list, getActive, clockIn, clockOut, remove, stats };
