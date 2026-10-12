// utils/theme.js
// 主题管理工具：负责「主题元数据」「持久化」「全局广播」三件事
//
// 设计要点：
// 1. 主题存储在本地缓存 THEME_KEY 中，存的是 class 字符串（如 'theme-mint'）
// 2. 切换主题三步：写缓存 -> 更新 app.globalData -> 通知所有页面
// 3. 4 套主题配色集中在一个文件里维护，方便后续增删

const THEME_KEY = 'sewing_theme_class'; // 本地缓存 key
const DEFAULT_THEME = 'theme-mint';     // 默认主题：清爽薄荷

/**
 * 4 套主题的元数据
 * 每一项对应 app.wxss 里一个 .theme-xxx 的 CSS 变量集合
 * 保持顺序 = 设置页的展示顺序
 */
const THEMES = [
  {
    id: 'theme-mint',
    name: '清爽薄荷',
    desc: '高效工具风，长时间看不累眼',
    // 这两个色用于设置页的预览色块（不需要和 CSS 变量同步，纯粹给用户看）
    preview: {
      primary: '#48A9A6',
      bg: '#F8FBFB'
    }
  },
  {
    id: 'theme-indigo',
    name: '专业靛蓝',
    desc: '稳重台账风，突出数据统计',
    preview: {
      primary: '#365F91',
      bg: '#F5F7FA'
    }
  },
  {
    id: 'theme-apricot',
    name: '暖手作杏色',
    desc: '手作温柔风，贴合缝纫布艺场景',
    recommended: true,
    preview: {
      primary: '#C88A65',
      bg: '#FCF8F4'
    }
  },
  {
    id: 'theme-vintage',
    name: '复古裁缝铺',
    desc: '复古文艺风，强品牌氛围感',
    preview: {
      primary: '#594B41',
      bg: '#F3F0ED'
    }
  }
];

/**
 * 获取当前已选主题 class
 * 没有历史记录时返回默认主题
 */
function getThemeClass() {
  try {
    const stored = wx.getStorageSync(THEME_KEY);
    if (stored && THEMES.some((t) => t.id === stored)) {
      return stored;
    }
  } catch (e) {
    console.warn('[theme] 读取主题失败，使用默认主题', e);
  }
  return DEFAULT_THEME;
}

/**
 * 获取主题元数据列表（设置页用）
 */
function getThemes() {
  return THEMES.slice();
}

/**
 * 切换主题
 * @param {string} themeClass 新的主题 class
 * @returns {boolean} 是否切换成功
 */
function setTheme(themeClass) {
  if (!THEMES.some((t) => t.id === themeClass)) {
    console.warn('[theme] 未知主题：', themeClass);
    return false;
  }
  try {
    // 1. 持久化
    wx.setStorageSync(THEME_KEY, themeClass);

    // 2. 通知 app 更新全局状态 & 广播给所有页面
    const app = getApp();
    if (app && typeof app.switchTheme === 'function') {
      app.switchTheme(themeClass);
    } else {
      // app 还未就绪时，至少更新一下 storage
      console.warn('[theme] app 未就绪，仅写入缓存');
    }
    return true;
  } catch (e) {
    console.error('[theme] 切换主题失败', e);
    return false;
  }
}

/**
 * 当前主题的元数据
 */
function getCurrentTheme() {
  const id = getThemeClass();
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

module.exports = {
  THEME_KEY,
  DEFAULT_THEME,
  THEMES,        // 主题元数据（供 app.js / 其他模块使用）
  getThemeClass,
  getThemes,
  setTheme,
  getCurrentTheme
};
