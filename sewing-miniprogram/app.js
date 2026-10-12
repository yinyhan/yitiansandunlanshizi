// app.js
// 小程序全局入口
// 启动流程：
//   1. 读取本地缓存中的主题键（utils/theme.js 暴露的 THEME_KEY）
//   2. 把当前主题 class 挂到 globalData 与 wx globals 上
//   3. 各页面 onLoad 优先用 getApp().globalData.themeClass 渲染
//   4. 用户在【设置】页切换主题 -> utils/theme.setTheme -> 写缓存 + 广播 -> 所有页面响应
//   5. 同时通过 wx.setTabBarStyle 动态更新原生 tabBar 选中色
const { getThemeClass, getThemes, THEMES } = require('./utils/theme.js');

// 主题 ID -> tabBar 选中色（与 app.wxss 中 4 套主题 --primary 一致）
const THEME_TAB_COLOR = {
  'theme-mint':    '#48A9A6',
  'theme-indigo':  '#365F91',
  'theme-apricot': '#C88A65',
  'theme-vintage': '#594B41'
};

// tabBar 5 个标签的固定顺序
const TAB_KEYS = ['home', 'fabric', 'pattern', 'product', 'clock'];
// tabBar 5 个标签的 pagePath
const TAB_PAGES = [
  'pages/index/index',
  'pages/fabric/list',
  'pages/pattern/list',
  'pages/product/list',
  'pages/clock/index'
];

App({
  /**
   * 全局数据
   * themeClass: 当前主题对应的 page-level class（如 theme-mint / theme-indigo 等）
   * themeList : 4 套主题的元数据，供设置页渲染
   */
  globalData: {
    themeClass: 'theme-mint',
    themeList: getThemes(),
    systemInfo: null
  },

  onLaunch() {
    // 1. 读取上次选择的主题（默认清爽薄荷）
    const themeClass = getThemeClass();
    this.globalData.themeClass = themeClass;

    // 2. 同步系统信息，便于后续做 rpx / 安全区适配
    try {
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.globalData.systemInfo = windowInfo;
    } catch (e) {
      console.warn('[app] 获取系统信息失败', e);
    }

    // 3. 应用 tabBar 主题色（首次启动）
    this.applyTabBarTheme(themeClass);

    console.log('[app] 启动完成，当前主题：', themeClass);
  },

  /**
   * 切换主题（被设置页调用）
   * @param {string} themeClass 新的主题 class
   */
  switchTheme(themeClass) {
    this.globalData.themeClass = themeClass;

    // 1. 强制通知所有已加载页面更新 themeClass
    //    关键：page 根 view 上的 themeClass 一旦变化，CSS 变量就会重新解析
    //    所以"切主题后只有首页变"的问题就是这里没有强制 setData
    const pages = getCurrentPages();
    pages.forEach((page) => {
      if (page && typeof page.onThemeChange === 'function') {
        page.onThemeChange(themeClass);
      } else if (page && typeof page.setData === 'function' && page.data.themeClass !== themeClass) {
        page.setData({ themeClass });
      }
    });

    // 2. 同步原生 tabBar 选中色 + 替换 5 个图标
    this.applyTabBarTheme(themeClass);
  },

  /**
   * 把主题 class 注入到 wxss 全局选择器
   * 实际靠 switchTheme 里的 setData 触发 page 重渲染
   */
  injectPageTheme(themeClass) {
    const pages = getCurrentPages();
    pages.forEach((page) => {
      if (page && typeof page.setData === 'function' && page.data.themeClass !== themeClass) {
        page.setData({ themeClass });
      }
    });
  },

  /**
   * 把当前主题的 --primary 应用到原生 tabBar 的 selectedColor
   * 必须在 tabBar 页面栈内调用，否则会失败
   */
  applyTabBarTheme(themeClass) {
    const color = THEME_TAB_COLOR[themeClass] || THEME_TAB_COLOR['theme-mint'];
    try {
      // 1. 改选中色
      wx.setTabBarStyle({
        selectedColor: color,
        backgroundColor: '#ffffff',
        borderStyle: 'white'
      });
      // 2. 替换 5 个 tabBar 图标为当前主题对应的图标
      const themeKey = themeClass.replace('theme-', '');
      TAB_KEYS.forEach((key, idx) => {
        wx.setTabBarItem({
          index: idx,
          iconPath: `assets/tabbar/${themeKey}/${key}.png`,
          selectedIconPath: `assets/tabbar/${themeKey}/${key}-active.png`
        });
      });
    } catch (e) {
      // 在非 tabBar 页面或启动早期调用会失败，忽略即可
      console.warn('[app] applyTabBarTheme 失败', e.message);
    }
  }
});
