// pages/pattern/list.js
const { getThemeClass } = require('../../utils/theme.js');
const patternSvc = require('../../services/pattern.js');

Page({
  data: {
    themeClass: 'theme-mint',
    keyword: '',
    list: [],
    filtered: []
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
    const list = patternSvc.list();
    this.setData({ list, filtered: this.applyFilter(list, this.data.keyword) });
  },

  applyFilter(list, keyword) {
    if (!keyword) return list;
    const k = keyword.toLowerCase();
    return list.filter((x) => [x.name, x.style, (x.tags || []).join(' '), x.remark].join(' ').toLowerCase().includes(k));
  },

  onSearch(e) {
    const keyword = e.detail.value;
    this.setData({ keyword, filtered: this.applyFilter(this.data.list, keyword) });
  },

  onAdd() { wx.navigateTo({ url: '/pages/pattern/edit' }); },
  onOpen(e) { wx.navigateTo({ url: '/pages/pattern/edit?id=' + e.currentTarget.dataset.id }); }
});
