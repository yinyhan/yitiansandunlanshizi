// services/mood.js
// 缝纫心情打卡服务层
// 数据结构：
// mood = [{ id, date: 'YYYY-MM-DD', mood: 'happy', note: '...', productId: 'prd_xxx', createdAt }]

const { get, set } = require('../utils/storage.js');
const { genId } = require('../utils/id.js');
const { today } = require('../utils/date.js');

const KEY = 'mood';

// 7 款心情定义（顺序：iconKey, 文字, 颜色）— 用户最新 v4 调色
const MOODS = [
  { key: 'tired',     label: '疲惫', color: '#F8DCD0' },
  { key: 'grumpy',    label: '烦躁', color: '#F0C0A8' },
  { key: 'normal',    label: '平常', color: '#C4D4E0' },
  { key: 'focus',     label: '专注', color: '#90D0B0' },
  { key: 'satisfied', label: '满足', color: '#F8D0A8' },
  { key: 'happy',     label: '欣喜', color: '#FFC2B8' },
  { key: 'inspired',  label: '灵感', color: '#C0A8D8' }
];

function list() { return get(KEY, []); }
function save(list) { set(KEY, list); }

function getByDate(date) {
  return list().find((x) => x.date === date) || null;
}

/**
 * 每天 1 条，覆盖式 upsert
 * @param {{date, mood, note, productId}} data
 */
function upsert({ date, mood, note = '', productId = '' }) {
  const all = list();
  const idx = all.findIndex((x) => x.date === date);
  if (idx > -1) {
    all[idx] = { ...all[idx], mood, note, productId, updatedAt: Date.now() };
  } else {
    all.unshift({ id: genId('mood'), date, mood, note, productId, createdAt: Date.now() });
  }
  save(all);
  return getByDate(date);
}

function removeByDate(date) {
  save(list().filter((x) => x.date !== date));
}

/**
 * 统计某月心情分布
 * @param {string} ym 'YYYY-MM'
 * @returns {moodKey: count}
 */
function statsByMonth(ym) {
  const result = MOODS.reduce((acc, m) => { acc[m.key] = 0; return acc; }, {});
  list()
    .filter((x) => x.date.startsWith(ym))
    .forEach((x) => {
      if (result[x.mood] !== undefined) result[x.mood]++;
    });
  return result;
}

module.exports = {
  MOODS,
  list,
  getByDate,
  upsert,
  removeByDate,
  statsByMonth
};
