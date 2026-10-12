// pages/index/index.js
const { getThemeClass } = require('../../utils/theme.js');
const { today: todayFn } = require('../../utils/date.js');
const fabricSvc = require('../../services/fabric.js');
const patternSvc = require('../../services/pattern.js');
const productSvc = require('../../services/product.js');
const clockSvc = require('../../services/clock.js');

Page({
  data: {
    themeClass: 'theme-mint',
    today: '',
    fabricCount: 0,
    patternCount: 0,
    productCount: 0,
    alertTotal: 0,
    activeClock: null,
    clockStats: { todayHours: '0.00', weekHours: '0.00', monthHours: '0.00', totalDays: 0 }
  },

  onLoad() {
    const theme = getThemeClass();
    console.log('[index] onLoad, themeClass =', theme);
    this.setData({ themeClass: theme });
  },

  onReady() {
    console.log('[index] onReady, WXML 渲染完成');
  },

  onShow() {
    // 兜底：每次显示时重新应用 tabBar 主题
    const app = getApp();
    if (app && app.globalData.themeClass) {
      app.applyTabBarTheme(app.globalData.themeClass);
    }
    this.refresh();
  },

  onThemeChange(themeClass) {
    this.setData({ themeClass });
  },

  refresh() {
    const fabricAlerts = fabricSvc.lowStockAlerts();
    this.setData({
      today: todayFn(),
      fabricCount: fabricSvc.listFabric().length + fabricSvc.listAux().length,
      patternCount: patternSvc.list().length,
      productCount: productSvc.list().length,
      alertTotal: fabricAlerts.total,
      activeClock: clockSvc.getActive(),
      clockStats: clockSvc.stats()
    });
  },

  onClockIn() {
    clockSvc.clockIn();
    wx.showToast({ title: '已上班打卡', icon: 'success' });
    this.refresh();
  },

  onClockOut() {
    clockSvc.clockOut('');
    wx.showToast({ title: '已下班打卡', icon: 'success' });
    this.refresh();
  },

  goFabric()   { wx.switchTab({ url: '/pages/fabric/list' }); },
  goPattern()  { wx.switchTab({ url: '/pages/pattern/list' }); },
  goProduct()  { wx.switchTab({ url: '/pages/product/list' }); },
  goClock()    { wx.switchTab({ url: '/pages/clock/index' }); },
  goSettings() { wx.navigateTo({ url: '/pages/settings/index' }); }
});
