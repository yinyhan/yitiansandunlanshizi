# 图标资源目录

## 当前状态

一期版本**未使用图标**，TabBar 已在 `app.json` 中简化为「纯文字模式」：
```json
"tabBar": {
  "color": "#666666",
  "selectedColor": "#48A9A6",
  "list": [
    { "pagePath": "pages/index/index",  "text": "首页" },
    { "pagePath": "pages/fabric/list",  "text": "布库辅料" },
    { "pagePath": "pages/pattern/list", "text": "纸样搭配" },
    { "pagePath": "pages/product/list", "text": "成品统计" },
    { "pagePath": "pages/clock/index",  "text": "缝纫打卡" }
  ]
}
```
- 未选中文字：#666666
- 选中文字：当前主题 `--primary`（由 `app.js → applyTabBarTheme` 动态设置）

## 后续补图标步骤

如需加上图标：

1. 在 `images/` 下放置 10 个 PNG（5 个 Tab × 普通/选中）：
   ```
   tab-home.png          tab-home-active.png
   tab-fabric.png        tab-fabric-active.png
   tab-pattern.png       tab-pattern-active.png
   tab-product.png       tab-product-active.png
   tab-clock.png         tab-clock-active.png
   ```
   - 尺寸 81×81 px
   - PNG 透明背景
   - 普通态使用 #666666，选中态使用 #48A9A6（默认薄荷色）
   - 推荐工具：Figma / Sketch / 阿里 iconfont

2. 在 `app.json` 的 `tabBar.list` 中每项加回：
   ```json
   {
     "pagePath": "pages/index/index",
     "text": "首页",
     "iconPath": "images/tab-home.png",
     "selectedIconPath": "images/tab-home-active.png"
   }
   ```

3. 因为有图标后**选中色会跟随图标视觉变化**，建议把 `app.js` 里的 `THEME_TAB_COLOR` 同步改成更柔和的色值（因为图标通常较深，文字色可以略浅）。
