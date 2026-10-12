// pages/product/list.js
const { getThemeClass } = require('../../utils/theme.js');
const productSvc = require('../../services/product.js');
const { today: todayFn, pad } = require('../../utils/date.js');

Page({
  data: {
    themeClass: 'theme-mint',
    keyword: '',
    list: [],
    filtered: [],
    stats: { monthCount: 0, totalCount: 0, totalHours: 0 }
  },

  onLoad() { this.setData({ themeClass: getThemeClass() }); },
  onShow() {
    // 兜底：每次显示时重新应用 tabBar 主题
    const app = getApp();
    if (app && app.globalData.themeClass) {
      app.applyTabBarTheme(app.globalData.themeClass);
    }
    this.refresh();
  },
  onThemeChange(t) { this.setData({ themeClass: t }); },

  refresh() {
    const list = productSvc.list();
    const monthKey = todayFn().slice(0, 7);
    const monthCount = list.filter((x) => (x.finishedAt || '').startsWith(monthKey)).reduce((s, x) => s + (x.qty || 0), 0);
    const totalCount = list.reduce((s, x) => s + (x.qty || 0), 0);
    const totalHours = list.reduce((s, x) => s + (x.hours || 0), 0).toFixed(1);
    this.setData({ list, filtered: this.applyFilter(list, this.data.keyword), stats: { monthCount, totalCount, totalHours } });
  },

  applyFilter(list, keyword) {
    if (!keyword) return list;
    const k = keyword.toLowerCase();
    return list.filter((x) => [x.styleName, x.orderSource, x.status].join(' ').toLowerCase().includes(k));
  },

  onSearch(e) {
    const keyword = e.detail.value;
    this.setData({ keyword, filtered: this.applyFilter(this.data.list, keyword) });
  },

  onAdd() { wx.navigateTo({ url: '/pages/product/edit' }); },
  onOpen(e) { wx.navigateTo({ url: '/pages/product/edit?id=' + e.currentTarget.dataset.id }); }
});
