# Travel Plan（折页旅行）SPEC

> 最后更新：2026-09-03

## 1. 项目概述

**项目名称**: 折页旅行（Folded Atlas / Travel Plan）
**项目类型**: 响应式 SPA（适配手机 + PC）
**核心功能**: 帮助多人团队规划旅行，包含行程安排、消费分摊、图片共享
**分享机制**: 6 位分享码，同一局域网或同一码的所有用户实时共享数据

---

## 2. 技术架构

| 层 | 技术 |
|---|---|
| 前端框架 | React 19 + Vite（TypeScript） |
| 样式 | 原生 CSS（手帐/纸品质感） |
| 后端 | Express 5（Node.js） |
| 数据存储 | 本地 JSON 文件（`data/*.json`） |
| 文件存储 | 本地磁盘（`uploads/`） |
| 代理 | Vite dev proxy → Express API |

**无需 Firebase，无需登录账号。** 同一 Wi-Fi 或同一分享码的用户天然共享同一份数据。

---

## 3. 数据模型

### Trip（行程）
```
{
  shareCode: string       // 6位分享码，如 "KLM3X7"
  title: string           // 主标题
  city: string            // 城市
  mapPath: string         // 地图图片相对路径
  startDate: string       // YYYY-MM-DD
  endDate: string         // YYYY-MM-DD
  people: Person[]
  itinerary: PlanItem[]
  expenses: Expense[]
  photos: Photo[]
  updatedAt: number
}
```

### Person（人员）
```
{ id: string; name: string }
```

### PlanItem（行程条目）
```
{ id: string; date: string; hour: number; title: string; note: string }
```

### Expense（消费记录）
```
{
  id: string
  category: string        // 交通 | 住宿 | 吃饭 | 门票 | 购物 | 其他
  date: string            // YYYY-MM-DD
  note: string
  amounts: Record<personId, number>  // 每人分摊金额
  paidBy: string          // personId，付款人
}
```

### Photo（照片）
```
{ id: string; path: string; caption: string; uploaderName: string; createdAt: number }
```

---

## 4. API 设计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| POST | `/api/trips` | 创建行程（body: { title }） |
| GET | `/api/trips/:code` | 获取行程 |
| PUT | `/api/trips/:code/meta` | 更新主标题、城市、日期 |
| POST | `/api/trips/:code/people` | 添加人员 |
| DELETE | `/api/trips/:code/people/:id` | 删除人员 |
| POST | `/api/trips/:code/itinerary` | 添加行程条目 |
| PUT | `/api/trips/:code/itinerary/:id` | 更新行程条目 |
| DELETE | `/api/trips/:code/itinerary/:id` | 删除行程条目 |
| POST | `/api/trips/:code/expenses` | 添加消费记录 |
| PUT | `/api/trips/:code/expenses/:id` | 更新消费记录 |
| DELETE | `/api/trips/:code/expenses/:id` | 删除消费记录 |
| POST | `/api/trips/:code/map` | 上传城市地图（multipart） |
| POST | `/api/trips/:code/photos` | 上传照片（multipart） |
| DELETE | `/api/trips/:code/photos/:id` | 删除照片 |

---

## 5. 页面与模块

### 5.1 Landing 封面
- 输入主标题 → 创建新行程
- 输入分享码 → 加入已有行程
- 显示局域网地址（用于手机访问）

### 5.2 主标题栏（Masthead）
- 城市名（副标题）
- 主标题（大事显示）
- 日期范围 + 人员名单
- 分享码印章 + 复制链接按钮

### 5.3 Tab 导航（毛玻璃 sticky）
四个标签：**行程** | **画册** | **账单** | **相册**

### 5.4 行程信息（Setup）
- 标题、目的地、出发/返程日期（在同一卡片内紧凑编辑）
- 城市地图作为右侧缩略卡片（非头图），点击上传
- 我的名字（localStorage 存储，用于照片署名）
- 人员管理：chip 悬浮显示 × 图标删除

### 5.5 画册式每日计划（Album）
- 横向滑动，每天一张卡片（scroll-snap）
- 顶部 Tag 固定切换（D1 · 周一 / D2 · 周二 / …）
- 每张卡片：顶部森林绿渐变装饰条 + 日期大标题 + 24小时时间轴
- 每小时可写多个活动卡片，支持增删改

### 5.6 消费计算（Money）
- **顶部统计卡**：总花费（绿色高亮）+ 每人花费 + 每人已付金额
- 分类筛选（Pill 按钮式，绿色选中态）
- 日期筛选（Pill 按钮式，带每天小计金额）
- 表格列：类别 | 日期 | **付款人**（绿色高亮下拉，可点击）| 备注 | 每人金额 | 小计 | ⚖/✕ 图标操作
- **"平分"**：⚖ 图标按钮代替文字
- **每人小计**：卡片式显示（付了 / 花了两列）
- **每天小计**：切换"全部天"时显示
- **结算建议**：绿色强调卡片，显示谁付给谁 + 金额

### 5.7 美图上传（Photos）
- 拍立得风格：白色底边条（模拟相纸） + 旋转随机微倾角
- 底部水印：**上传日期** + **by 上传人名字**
- 悬浮显示删除按钮 ✕
- 点击放大全屏（Lightbox，支持键盘左右箭头）
- 瀑布流网格（手机 2 列，PC 3-4 列）
- Lightbox 支持：左右滑动、键盘方向键、ESC 关闭
- 支持拍照（`capture="environment"`）或相册上传
- 上传时自动压缩（JPEG 82% 质量，最大 1600px）
- 删除本人上传的图片

---

## 6. 视觉风格

| 变量 | 值 | 用途 |
|---|---|---|
| `--paper` | `#efe4cf` | 米黄色纸张背景 |
| `--paper-2` | `#f7f0e2` | 卡片背景 |
| `--ink` | `#241910` | 深棕墨水文字 |
| `--muted` | `#6d5c4b` | 辅助文字 |
| `--terracotta` | `#b44528` | 赤陶橙强调 |
| `--moss` | `#335544` | 苔绿强调 |
| `--gold` | `#b8924a` | 金色辅助 |
| 字体 | Noto Serif SC + Fraunces + Noto Sans SC | 纸品手帐风 |

---

## 7. 启动方式

```bash
# 开发（前后端同时运行）
npm run dev

# 打包前端
npm run build

# 生产（Express 静态服务）
npm start
```

手机访问：在同一 Wi-Fi 下，浏览器打开后端启动时显示的局域网地址（如 `http://192.168.x.x:5173`）。
