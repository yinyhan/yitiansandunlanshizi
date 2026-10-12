// pages/settings/index.js
// 设置页
// 核心职责：
//   1. 展示 4 套主题选项
//   2. 点击切换：调用 utils/theme.setTheme -> 全局广播
//   3. 实现 onThemeChange 方法：被 app.switchTheme 调用，实时刷新 UI

const { getThemeClass, getThemes, setTheme } = require('../../utils/theme.js');

Page({
  data: {
    themeClass: 'theme-mint',
    themeList: getThemes(),
    currentThemeId: 'theme-mint'
  },

  onLoad() {
    this.refreshTheme();
  },

  /**
   * 被 app.switchTheme 调用，实现实时切换
   * 注意：app.js 内使用的是 setData 的同一份 data 结构
   */
  onThemeChange(themeClass) {
    this.setData({ themeClass, currentThemeId: themeClass });
    wx.showToast({ title: '已切换主题', icon: 'success', duration: 800 });
  },

  /** 兜底刷新（页面初次显示时） */
  refreshTheme() {
    const themeClass = getThemeClass();
    this.setData({ themeClass, currentThemeId: themeClass });
  },

  /** 点击主题卡片 */
  onSelectTheme(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.data.currentThemeId) return;
    const name = (this.data.themeList.find(t => t.id === id) || {}).name || '';

    // 1. 显示 loading
    wx.showLoading({ title: '切换中…', mask: true });

    // 2. 写缓存 + 通知 app（app.switchTheme 内部会 setData 所有页面 + 改 tabBar）
    setTimeout(() => {
      const ok = setTheme(id);
      wx.hideLoading();
      if (!ok) {
        wx.showToast({ title: '切换失败', icon: 'none' });
        return;
      }
      // 3. 本地立即刷新（不等广播）
      this.setData({ themeClass: id, currentThemeId: id });
      // 4. 成功提示
      wx.showToast({ title: `已切换到 ${name}`, icon: 'success', duration: 1000 });
    }, 150);
  }
});
