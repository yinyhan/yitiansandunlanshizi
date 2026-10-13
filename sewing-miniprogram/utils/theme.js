// utils/theme.js
// 主题管理工具：负责「主题元数据」「持久化」「全局广播」三件事
//
// 设计要点：
// 1. 主题存储在本地缓存 THEME_KEY 中，存的是 class 字符串（如 'theme-apricot'）
// 2. 切换主题三步：写缓存 -> 更新 app.globalData -> 通知所有页面
// 3. 6 套主题配色集中在一个文件里维护，方便后续增删
// 4. 每套主题含 8 个语义变量：theme-main/assist/accent + page-bg/card-bg
//    + text-primary/text-secondary + border
// 5. 实际驱动 wxss 的 9 个内部变量（--primary 等）由 app.wxss 的主题块
//    用 var(--theme-main) 等映射过去——本文件只维护语义变量

const THEME_KEY = 'sewing_theme_class';   // 本地缓存 key
const DEFAULT_THEME = 'theme-apricot';    // 默认主题：暖手作杏色（贴合手作场景）

/**
 * 6 套主题的元数据
 * 每一项对应 app.wxss 里一个 .theme-xxx 的 CSS 变量集合
 * 保持顺序 = 设置页的展示顺序
 *
 * 字段说明：
 *   id        : 主题 class，挂到 page 根 view
 *   name      : 设置页显示的主题名
 *   desc      : 主题简介
 *   recommended : 是否推荐（设置页显示「推荐」徽标）
 *   preview   : 设置页的预览色块（primary + 背景 + 辅助）
 *   palette   : 8 个语义变量（与 app.wxss 对应主题块的 CSS 变量一一对应）
 */
const THEMES = [
  {
    id: 'theme-apricot',
    name: '暖手作杏色',
    desc: '手作温柔风，贴合缝纫布艺场景',
    recommended: true,
    preview: { primary: '#C88A65', bg: '#FFF9F2', assist: '#D4B59E' },
    palette: {
      'theme-main':      '#C88A65',
      'theme-assist':    '#D4B59E',
      'theme-accent':    '#A05B37',
      'page-bg':         '#FFF9F2',
      'card-bg':         '#FFFFFF',
      'text-primary':    '#4A382C',
      'text-secondary':  '#8C786A',
      'border':          '#EAE0D5'
    }
  },
  {
    id: 'theme-redblack',
    name: '复古红黑',
    desc: '复古红黑撞色，戏剧张力强',
    preview: { primary: '#9C2C2C', bg: '#1F1F1F', assist: '#D44A4A' },
    palette: {
      'theme-main':      '#9C2C2C',
      'theme-assist':    '#D44A4A',
      'theme-accent':    '#591616',
      'page-bg':         '#1F1F1F',
      'card-bg':         '#2D2D2D',
      'text-primary':    '#FFFFFF',
      'text-secondary':  '#B8B8B8',
      'border':          '#444444'
    }
  },
  {
    id: 'theme-navyorange',
    name: '藏青橘撞色',
    desc: '藏青底 + 橘色高亮，对比鲜明',
    preview: { primary: '#1A365D', bg: '#F7F9FC', assist: '#FF7D29' },
    palette: {
      'theme-main':      '#1A365D',
      'theme-assist':    '#FF7D29',
      'theme-accent':    '#0F243E',
      'page-bg':         '#F7F9FC',
      'card-bg':         '#FFFFFF',
      'text-primary':    '#222222',
      'text-secondary':  '#666666',
      'border':          '#DCE3ED'
    }
  },
  {
    id: 'theme-greenorange',
    name: '墨绿橙黄',
    desc: '墨绿底 + 橙黄点缀，温润复古',
    preview: { primary: '#285943', bg: '#F6F9F7', assist: '#FFB037' },
    palette: {
      'theme-main':      '#285943',
      'theme-assist':    '#FFB037',
      'theme-accent':    '#1A3D2D',
      'page-bg':         '#F6F9F7',
      'card-bg':         '#FFFFFF',
      'text-primary':    '#242424',
      'text-secondary':  '#596B62',
      'border':          '#D8E2DD'
    }
  },
  {
    id: 'theme-bright',
    name: '明亮撞色',
    desc: '蓝/绿/红高饱和，活泼亮眼',
    preview: { primary: '#0088EE', bg: '#FAFDFF', assist: '#32DD32' },
    palette: {
      'theme-main':      '#0088EE',
      'theme-assist':    '#32DD32',
      'theme-accent':    '#FF4444',
      'page-bg':         '#FAFDFF',
      'card-bg':         '#FFFFFF',
      'text-primary':    '#111111',
      'text-secondary':  '#555555',
      'border':          '#D8EFFF'
    }
  },
  {
    id: 'theme-pinkgreen',
    name: '清甜粉绿',
    desc: '粉/绿/橙高饱和，糖果感强',
    preview: { primary: '#E63980', bg: '#FFF8FB', assist: '#36D377' },
    palette: {
      'theme-main':      '#E63980',
      'theme-assist':    '#36D377',
      'theme-accent':    '#FF7A30',
      'page-bg':         '#FFF8FB',
      'card-bg':         '#FFFFFF',
      'text-primary':    '#222222',
      'text-secondary':  '#666666',
      'border':          '#F2DDE7'
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
  THEMES,        // 主题元数据（供 app.js / 设置页使用）
  getThemeClass,
  getThemes,
  setTheme,
  getCurrentTheme
};
