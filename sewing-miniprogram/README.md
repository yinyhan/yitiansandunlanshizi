# 缝纫工作者专用微信小程序

> 面向裁缝、服装缝纫工人、手工缝纫从业者的轻量化工具箱
> **核心亮点：4 套主题配色自由切换，全程 CSS 变量驱动**

## 功能模块

1. **布库辅料** — 面料 / 辅料库存、分类、检索、库存预警
2. **纸样搭配** — 纸样收集 + 部位级面料联动搭配 + 多方案对比
3. **成品统计** — 成品台账、日 / 周 / 月件数、耗时统计
4. **缝纫打卡** — 一键上下班、工时统计、记录查询
5. **主题切换** — 4 套配色实时切换，配置中心选择

## 4 套主题

| ID | 名称 | 风格 |
| --- | --- | --- |
| `theme-mint` | 清爽薄荷 | 高效工具风，长时间看不累眼 |
| `theme-indigo` | 专业靛蓝 | 稳重台账风，突出数据统计 |
| `theme-apricot` | 暖手作杏色 | 手作温柔风，**推荐首选** |
| `theme-vintage` | 复古裁缝铺 | 复古文艺风，强品牌氛围感 |

切换方式：进入【首页 → 设置 → 主题配色】，点击任意主题卡片即生效。

## 目录结构

```
sewing-miniprogram/
├── app.js / app.json / app.wxss           # 全局入口 + 4 套主题 CSS 变量
├── pages/
│   ├── index/                              # 首页
│   ├── fabric/    list + edit             # 布库辅料
│   ├── pattern/   list + edit             # 纸样搭配
│   ├── product/   list + edit             # 成品统计
│   ├── clock/                              # 缝纫打卡
│   └── settings/                           # 主题切换
├── services/                               # 业务层
│   ├── fabric.js / pattern.js / product.js / clock.js
├── utils/
│   ├── theme.js                            # 主题管理（核心）
│   ├── storage.js / date.js / id.js
├── project.config.json / sitemap.json
└── docs/                                   # 主题 / 部署说明
```

## 部署到微信开发者工具

1. 打开**微信开发者工具**，选择「导入项目」
2. 项目目录：选择本仓库的 `sewing-miniprogram/`
3. AppID：可选择「测试号」或填入自己的 AppID
4. 点击「导入」即可运行

## 主题切换实现原理

### 1. CSS 变量定义（`app.wxss`）
每个主题对应一个 `.theme-xxx` class，包含 8 个 CSS 变量：
```css
.theme-mint {
  --primary: #48A9A6;
  --primary-light: #DBF2F1;
  --text-main: #2C3E50;
  --text-secondary: #667788;
  --bg-page: #F8FBFB;
  --bg-card: #FFFFFF;
  --border: #E2EAEA;
  --warning: #E67E22;
}
/* 同样定义 theme-indigo / theme-apricot / theme-vintage */
```

### 2. 页面根节点注入主题 class
每个页面的 WXML 根节点都使用 `<view class="page {{themeClass}}">`，JS 在 `onLoad` 时从 `getThemeClass()` 读取上次选择。

### 3. 切换主题
`utils/theme.js` 提供 `setTheme(id)`：
1. 写入 `wx.setStorageSync('sewing_theme_class', id)`
2. 调用 `app.switchTheme(id)` 更新 `globalData`
3. `app.switchTheme` 遍历 `getCurrentPages()`，调用每个页面的 `onThemeChange(class)`
4. 页面在 `onThemeChange` 内 `setData({ themeClass })`，UI 实时刷新

### 4. 组件颜色全部走 CSS 变量
所有按钮、卡片、标签、Tab 选中态、进度条等组件均使用 `var(--primary)` 等变量，无任何硬编码颜色。切换主题时整页颜色平滑过渡。

## 数据存储

- 一期：所有数据通过 `wx.setStorageSync` 本地存储，Key 前缀 `sewing_`
- 二期：可平滑迁移到后端 — `services/*.js` 暴露的接口与 REST 设计一致，替换内部实现即可

## 开发

- 语言：原生 JS（无 TypeScript 依赖）
- 基础库：3.4.0
- 适配：iPhone / 安卓全机型（含安全区）

## 配色无障碍说明

4 套主题的正文与背景对比度均满足 WCAG AA 级：

| 主题 | text-main vs bg-card | 通过 |
| --- | --- | --- |
| 薄荷 | #2C3E50 vs #FFFFFF | ✓ |
| 靛蓝 | #222933 vs #FFFFFF | ✓ |
| 杏色 | #3D3530 vs #FFFFFF | ✓ |
| 复古 | #2E2823 vs #FAF7F4 | ✓ |

## License

MIT
