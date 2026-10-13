// pages/clock/index.js
const { getThemeClass } = require('../../utils/theme.js');
const moodSvc = require('../../services/mood.js');
const productSvc = require('../../services/product.js');
const { today: todayFn, format } = require('../../utils/date.js');

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MOOD_BASE = '/assets/mood/';

function buildMoodList() {
  return moodSvc.MOODS.map((m) => ({
    ...m,
    icon: `${MOOD_BASE}${m.key}@96.png`
  }));
}

function iconFor(moodKey) {
  return `${MOOD_BASE}${moodKey}@96.png`;
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

/**
 * 生成某月日历数据：6 行 × 7 列
 * @param {number} year
 * @param {number} month (0-11)
 * @param {string} todayKey 'YYYY-MM-DD'
 * @param {object} moodMap {[date]: {mood, note, productId}}
 */
function buildCalendar(year, month, todayKey, moodMap) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  // leading empty
  for (let i = 0; i < startWeekday; i++) cells.push({ empty: true, date: '' });
  // days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    const m = moodMap[dateKey];
    const isFuture = dateKey > todayKey;
    cells.push({
      empty: false,
      date: dateKey,
      day: d,
      isToday: dateKey === todayKey,
      mood: m ? m.mood : '',
      moodIcon: m ? iconFor(m.mood) : '',
      future: isFuture
    });
  }
  // trailing empty（凑齐 42 格）
  while (cells.length < 42) cells.push({ empty: true, date: '' });
  return cells;
}

/**
 * 计算连续打卡天数（从今天往前数）
 */
function calcStreak(todayKey, moodMap) {
  let n = 0;
  const d = new Date(todayKey);
  while (true) {
    const k = format(d, 'YYYY-MM-DD');
    if (!moodMap[k]) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

Page({
  data: {
    themeClass: 'theme-apricot',
    weekDays: WEEK_DAYS,

    // 月历
    year: 0,
    month: 0, // 0-11
    monthLabel: '',
    calDays: [],
    monthTotal: 0,
    streakDays: 0,

    // 选中日
    selectedDate: '',
    detail: null,
    emptyTip: '今天还没有记录',

    // 7 款心情（用于统计 + 弹层）
    moods: [],
    moodStatsList: [],

    // 弹层
    popup: {
      show: false,
      date: '',
      dateLabel: '',
      mood: '',
      note: '',
      productId: '',
      productIndex: 0
    },
    productNames: ['（不关联）']
  },

  onLoad() {
    this.setData({ themeClass: getThemeClass(), moods: buildMoodList() });
  },

  onShow() {
    // 重新读主题：用户在「我的」页切换主题后，回到本页要立即生效
    const app = getApp();
    if (app && app.globalData.themeClass) {
      app.applyTabBarTheme(app.globalData.themeClass);
    }
    this.setData({ themeClass: getThemeClass() });
    this.refresh();
  },

  refresh() {
    const todayKey = todayFn();
    // 默认显示今天所在月；保持上次切月（除非是首次进入）
    if (!this.data.year) {
      const now = new Date();
      this.setData({ year: now.getFullYear(), month: now.getMonth(), selectedDate: todayKey });
    }

    const all = moodSvc.list();
    const moodMap = {};
    all.forEach((m) => { moodMap[m.date] = m; });

    const { year, month } = this.data;
    const calDays = buildCalendar(year, month, todayKey, moodMap);
    const ym = `${year}-${pad2(month + 1)}`;
    const monthTotal = all.filter((x) => x.date.startsWith(ym)).length;
    const monthLabel = `${year}年 ${pad2(month + 1)}月`;
    const streakDays = calcStreak(todayKey, moodMap);

    // 心情统计
    const stats = moodSvc.statsByMonth(ym);
    const moodStatsList = moodSvc.MOODS.map((m) => ({
      key: m.key,
      label: m.label,
      color: m.color,
      count: stats[m.key] || 0,
      icon: iconFor(m.key)
    }));

    // 详情
    const selectedDate = this.data.selectedDate || todayKey;
    this._renderDetail(selectedDate, moodMap);

    this.setData({ calDays, monthLabel, monthTotal, streakDays, moodStatsList });
  },

  _renderDetail(dateKey, moodMap) {
    const m = moodMap[dateKey];
    if (!m) {
      this.setData({
        selectedDate: dateKey,
        detail: null,
        emptyTip: dateKey === todayFn() ? '今天还没有记录' : '这一天没有记录哦'
      });
      return;
    }
    const def = moodSvc.MOODS.find((x) => x.key === m.mood);
    let productName = '';
    if (m.productId) {
      const p = productSvc.getById(m.productId);
      if (p) productName = p.styleName;
    }
    const d = new Date(dateKey);
    const dateLabel = `${dateKey} 周${WEEK_DAYS[d.getDay()]}`;
    this.setData({
      selectedDate: dateKey,
      detail: {
        mood: m.mood,
        moodIcon: iconFor(m.mood),
        moodLabel: def ? def.label : '',
        moodColor: def ? def.color : 'var(--primary)',
        note: m.note,
        productId: m.productId,
        productName,
        dateLabel
      }
    });
  },

  // ====== 月份切换 ======
  onPrevMonth() {
    let { year, month } = this.data;
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
    if (year < 2020) return; // 不让翻太早
    this.setData({ year, month, selectedDate: '' }, () => this.refresh());
  },
  onNextMonth() {
    let { year, month } = this.data;
    month += 1;
    if (month > 11) { month = 0; year += 1; }
    if (year > 2030) return;
    this.setData({ year, month, selectedDate: '' }, () => this.refresh());
  },
  onToday() {
    const now = new Date();
    this.setData({ year: now.getFullYear(), month: now.getMonth(), selectedDate: todayFn() }, () => this.refresh());
  },

  // ====== 日期交互 ======
  onPickDay(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;
    // 选中 → 渲染详情（不弹弹层）
    this.refresh();
    this.setData({ selectedDate: date });
    // 单独刷新详情
    const moodMap = {};
    moodSvc.list().forEach((m) => { moodMap[m.date] = m; });
    this._renderDetail(date, moodMap);
  },

  onLongPressDay(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;
    wx.showActionSheet({
      itemList: ['编辑这天', '删除记录'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this._openPopup(date);
        } else if (res.tapIndex === 1) {
          wx.showModal({
            title: '删除记录', content: `${date} 的心情将被删除`,
            success: (r) => {
              if (r.confirm) {
                moodSvc.removeByDate(date);
                wx.showToast({ title: '已删除', icon: 'success' });
                this.refresh();
              }
            }
          });
        }
      }
    });
  },

  onQuickAdd(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;
    this._openPopup(date);
  },
  onQuickAddToday() {
    this._openPopup(todayFn());
  },
  onEdit() {
    if (this.data.detail) this._openPopup(this.data.selectedDate);
  },

  onDeleteDetail() {
    if (!this.data.selectedDate) return;
    const date = this.data.selectedDate;
    wx.showModal({
      title: '删除记录', content: `${date} 的心情将被删除`,
      success: (r) => {
        if (r.confirm) {
          moodSvc.removeByDate(date);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.setData({ selectedDate: '' }, () => this.refresh());
        }
      }
    });
  },

  // ====== 弹层 ======
  _openPopup(date) {
    // 加载产品列表
    const products = productSvc.list();
    const productNames = ['（不关联）', ...products.map((p) => p.styleName)];
    // 已有记录 → 预填
    const existing = moodSvc.getByDate(date);
    let productIndex = 0;
    if (existing && existing.productId) {
      const idx = products.findIndex((p) => p.id === existing.productId);
      if (idx > -1) productIndex = idx + 1;
    }
    const d = new Date(date);
    const dateLabel = `${date} 周${WEEK_DAYS[d.getDay()]}`;
    this.setData({
      productNames,
      popup: {
        show: true,
        date,
        dateLabel,
        mood: existing ? existing.mood : '',
        note: existing ? existing.note : '',
        productId: existing ? existing.productId : '',
        productIndex
      }
    });
  },

  onClosePopup() {
    this.setData({ 'popup.show': false });
  },

  onNoop() {
    // 占位：用于 catchtap 阻止冒泡到 mask 背景
  },

  onPickMood(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ 'popup.mood': key });
  },

  onNoteInput(e) {
    this.setData({ 'popup.note': e.detail.value });
  },

  onProductPick(e) {
    const idx = Number(e.detail.value);
    const products = productSvc.list();
    const productId = idx === 0 ? '' : (products[idx - 1] ? products[idx - 1].id : '');
    this.setData({ 'popup.productIndex': idx, 'popup.productId': productId });
  },

  onSaveMood() {
    const { popup } = this.data;
    if (!popup.mood) {
      wx.showToast({ title: '请选一个心情', icon: 'none' });
      return;
    }
    moodSvc.upsert({
      date: popup.date,
      mood: popup.mood,
      note: (popup.note || '').trim(),
      productId: popup.productId || ''
    });
    wx.showToast({ title: '已记录', icon: 'success' });
    this.setData({ 'popup.show': false, selectedDate: popup.date }, () => this.refresh());
  }
});
