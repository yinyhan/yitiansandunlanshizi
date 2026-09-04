# 🚀 部署指南（Railway + Supabase）

## 架构概览

```
浏览器 ──→ Railway (Node.js API + 前端静态文件)
              │
              ├── 前端 API 调用 → 同一个 Railway 实例 (同进程)
              └── 图片/数据存储  → Supabase PostgreSQL + Storage CDN
```

---

## 第一步：创建 Supabase 项目（约 5 分钟）

### 1.1 注册 & 新建项目

1. 打开 [supabase.com](https://supabase.com) → 用 GitHub 登录
2. Dashboard → **New project** → 随便起名（如 `travel-plan`）
3. 选区域：**Singapore**（离中国最近）
4. 数据库密码 → **保存好，稍后用到**
5. 点击 **Create new project**，等 2 分钟

### 1.2 获取连接信息

项目建好后，进 **Project Settings → API**，记录这两个值：

- `SUPABASE_URL`（类似 `https://xxxxx.supabase.co`）
- `SUPABASE_SERVICE_KEY`（`service_role` 那个，不是 `anon`）

> ⚠️ `service_role` key 能绕过 RLS，本项目用于服务端写入，安全原因不放前端。

### 1.3 初始化数据库表

进 **SQL Editor**（左侧边栏），新建查询，粘贴 `schema.sql` 的全部内容，点击 **Run**。

执行成功后会看到：
- `trips` / `people` / `itinerary` / `expenses` / `photos` 五张表
- Row Level Security 已开启
- `travel-photos` Storage bucket 已创建

### 1.4 设置 Storage 公开访问

进 **Storage → travel-photos → Policies**，确认有以下策略（或新建）：
- `public_upload_photos`：允许所有人读写

---

## 第二步：部署到 Railway（约 10 分钟）

### 2.1 注册 Railway

打开 [railway.app](https://railway.app) → 用 GitHub 登录
Railway 每月送 **$5 免费额度**，足够本项目用很久。

### 2.2 新建项目

1. Dashboard → **New Project** → **Deploy from GitHub repo**
2. 选择 `yinyhan/yitiansandunlanshizi` 仓库
3. Railway 会自动检测到 Node.js 项目

### 2.3 配置构建命令

Railway 自动检测可能不对，手动改一下：

进入服务 → **Settings**：
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Root Directory**: 留空（从仓库根目录开始）

### 2.4 添加环境变量

进 **Variables**，点击 **Raw Editor**，粘贴以下内容（**替换成你的值**）：

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...（service_role key）
NODE_ENV=production
PORT=8080
```

> Railway 会自动把 `SUPABASE_URL` 注入给构建时的前端，所以前端也能读到。

### 2.5 添加磁盘（存放前端 dist）

1. Railway 服务页 → **Disks** → **Add Disk**
2. Name: `travel-data`
3. Size: **512 MB**（免费额度够用）
4. Mount Path: `/var/data`

Railway 会自动设置 `RAILWAY_DISK_MOUNT_PATH` 环境变量。

### 2.6 开启自动部署

进入项目 → **Settings → Deploy**：
- 开启 **Auto Deploy**
- 以后每次 push 到 GitHub main 分支，Railway 自动重新部署

### 2.7 等待部署完成

约 2-3 分钟后，Railway 会告诉你访问地址，如：
`https://travel-plan.up.railway.app`

---

## 第三步：验证

打开 Railway 给你的 URL，测试：
1. ✅ 创建一场新旅行
2. ✅ 上传封面图
3. ✅ 添加行程、账单
4. ✅ 重启 Railway 服务（Settings → Restart），数据是否还在

如果数据还在，说明部署成功！

---

## 常见问题

### Q: Railway 免费版会休眠吗？
Railway Starter 计划在 **500 小时/月** 后会休眠，但有磁盘的情况下休眠后重启数据还在。建议配合 GitHub Actions 定期 ping 防止休眠。

### Q: 怎么防止 Railway 休眠？
可以用 GitHub Actions 每 25 分钟 ping 一次服务：
```yaml
# .github/workflows/ping.yml
name: Ping Railway
on:
  schedule:
    - cron: "*/25 * * * *"
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping
        run: curl -sf https://你的服务地址.up.railway.app/api/health || true
```

### Q: 图片上传失败？
检查 Supabase Storage 的 **Policies** 是否允许公开上传，参考 1.4 节。

### Q: 想用自己的域名？
Railway → 服务 → **Settings → Networking → Custom Domain**，按提示配置 CNAME。

---

## 费用预估

| 服务 | 月费用 | 说明 |
|------|--------|------|
| Railway | $0–$5 | Starter 免费额度 $5/月 |
| Supabase | $0 | 免费版 500MB 数据库 + 1GB 存储 |
| 域名（可选）| ~$10/年 | 如需要 |

实际每月 **几乎为 0**。
