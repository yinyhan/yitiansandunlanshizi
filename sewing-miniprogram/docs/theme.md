# 主题切换系统详解

## 1. 4 套主题对应的 CSS 变量

每个主题在 `app.wxss` 中以 `.theme-{id}` 形式定义，注入到 page 根节点后，全局所有 `var(--xxx)` 都会取该主题的值。

| 变量 | 用途 |
| --- | --- |
| `--primary` | 主色（按钮、Tab 选中、关键文字） |
| `--primary-light` | 主色浅版（标签背景、卡片高亮） |
| `--text-main` | 主要文字 |
| `--text-secondary` | 次要文字 / 占位 |
| `--bg-page` | 页面底色 |
| `--bg-card` | 卡片底色 |
| `--border` | 描边、分割线 |
| `--warning` | 警告、库存不足 |

## 2. 切换流程

```
用户点击设置页主题卡片
        ↓
pages/settings/index.js onSelectTheme(id)
        ↓
utils/theme.setTheme(id)
        ├─ wx.setStorageSync(THEME_KEY, id)   ← 持久化
        └─ getApp().switchTheme(id)           ← 通知 app
                ↓
app.js switchTheme(themeClass)
        ├─ globalData.themeClass = themeClass
        └─ pages.forEach(p => p.onThemeChange?.(themeClass))
                ↓
各页面 onThemeChange(themeClass) -> setData({ themeClass })
        ↓
WXML {{themeClass}} 重新求值，page 根节点 class 变化
        ↓
CSS 变量重新解析，整页配色刷新
```

## 3. 新增第 5 套主题

1. 在 `utils/theme.js` 的 `THEMES` 数组追加一项（含 `id / name / desc / preview`）
2. 在 `app.wxss` 增加一个 `.theme-newid { ... }` 块定义 8 个变量
3. 完成。设置页会自动多出一个主题选项，点击即生效。

## 4. 主题缓存 key

`THEME_KEY = 'sewing_theme_class'`

如需清除主题： `wx.removeStorageSync('sewing_theme_class')` 即可恢复默认薄荷色。

## 5. 调试小技巧

- 在微信开发者工具「控制台」输入：
  ```js
  wx.setStorageSync('sewing_theme_class', 'theme-vintage')
  // 然后在设置页点击任意主题即可看到该主题
  ```
- 想强制刷新当前主题： `getApp().switchTheme('theme-apricot')`
