# 🚀 部署指南（Vercel + Supabase，永久免费）

## 架构概览

```
浏览器 ──→ Vercel（前端 React 静态站点）
              │
              ├── API 调用 → Supabase Edge Functions (Deno)
              │                  │
              │                  ├── 数据 → Supabase PostgreSQL
              │                  └── 图片直传 → Supabase Storage
              │
              └── 前端直传图片 → Supabase Storage CDN
```

**零成本、零运维。**

---

## 第一步：创建 Supabase 项目（约 5 分钟）

### 1.1 注册 & 新建项目

1. 打开 [supabase.com](https://supabase.com) → 用 GitHub 登录
2. Dashboard → **New project** → 随便起名（如 `travel-plan`）
3. 选区域：**Singapore**（离中国最近）
4. 数据库密码 → **保存好，稍后用到**
5. 点击 **Create new project**，等 2 分钟

### 1.2 获取连接信息

项目建好后，进 **Project Settings → API**，记录这三个值：

- `SUPABASE_URL`（类似 `https://xxxxx.supabase.co`）
- `SUPABASE_SERVICE_KEY`（`service_role` 那个，后端用，**保密**）
- `SUPABASE_ANON_KEY`（`anon public` 那个，前端用，可公开）

### 1.3 初始化数据库表

进 **SQL Editor**（左侧边栏），新建查询，分两次执行：

**第一次**：粘贴 `schema.sql` 的全部内容 → **Run**
**第二次**：粘贴 `schema_v2.sql` 的全部内容 → **Run**

执行成功后：
- `trips` / `people` / `itinerary` / `expenses` / `photos` 五张表
- 所有表新增了 `owner_token` 列（单密码保护用）
- `travel-photos` Storage bucket 已创建

### 1.4 设置 Storage 公开访问

进 **Storage → travel-photos → Policies**，确认有以下策略（或新建）：

```sql
create policy "public_read_photos"
  on storage.objects for select using (bucket_id = 'travel-photos');

create policy "public_insert_photos"
  on storage.objects for insert with check (bucket_id = 'travel-photos');

create policy "public_update_photos"
  on storage.objects for update using (bucket_id = 'travel-photos');

create policy "public_delete_photos"
  on storage.objects for delete using (bucket_id = 'travel-photos');
```

> 这样 bucket 里所有文件都能通过公开 URL 访问和上传。

---

## 第二步：部署 Edge Functions（约 5 分钟）

### 2.1 安装 Supabase CLI

```bash
# Mac
brew install supabase/tap/supabase

# 或用 npm
npm i -g supabase
```

### 2.2 登录

```bash
supabase login
```

### 2.3 链接项目

```bash
supabase link --project-ref xxxxx
# 填你的项目 ID（在 Supabase Settings → General 找）
```

### 2.4 推送 Edge Function

```bash
supabase functions deploy api --no-verify-jwt
```

> `--no-verify-jwt` 是因为我们用 `x-owner-token` header 鉴权，不要 Supabase JWT。

部署成功后，你会得到一个 URL，类似：
```
https://xxxxx.supabase.co/functions/v1/api
```

### 2.5 测试

```bash
curl https://xxxxx.supabase.co/functions/v1/api/health
# 应该返回 {"ok":true,"supabase":true}
```

---

## 第三步：部署前端到 Vercel（约 3 分钟）

### 3.1 注册 Vercel

打开 [vercel.com](https://vercel.com) → 用 GitHub 登录

### 3.2 导入项目

1. Dashboard → **Add New → Project**
2. 选择 `yinyhan/yitiansandunlanshizi` 仓库
3. Vercel 会自动识别为 Vite 项目

### 3.3 配置环境变量

进项目 → **Settings → Environment Variables**，添加：

| 变量名 | 值 |
|--------|---|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...`（anon public） |

**所有环境（Production / Preview / Development）都勾选。**

### 3.4 部署

点 **Deploy** 按钮，等 1 分钟。成功后你会得到：
```
https://travel-plan-xxx.vercel.app
```

---

## 第四步：验证

打开 Vercel 给你的 URL，测试：

1. ✅ 创建一场新旅行
   - 此时会**自动生成 32 位 owner token** 存 localStorage
2. ✅ 上传封面图 / 相册
   - 图片走前端直传 Supabase Storage
3. ✅ 添加行程、账单
4. ✅ 关闭浏览器再打开，**同 shareCode 应该自动验证通过**

### 跨设备/换浏览器

由于 token 只存在本地，**换浏览器或换电脑需要重新输入 token**。

如需跨设备访问：浏览器 DevTools → `localStorage` → 找到 `owner_token:XXXXXX` 的值，复制到新设备。

---

## 常见问题

### Q: 图片上传失败？
检查 Storage → travel-photos 的 Policies 是否齐全（见 1.4 节）。

### Q: 创建旅行时 401 错误？
Edge Function 没部署成功或环境变量没设。检查：
```bash
supabase functions env set SUPABASE_URL=... SUPABASE_SERVICE_KEY=... --project-ref xxxxx
supabase functions deploy api --no-verify-jwt
```

### Q: 数据被乱改？
查 `owner_token` 字段。**默认策略下，Edge Function 通过 service_role 鉴权**，所以 Edge Function 代码本身安全就没问题。如果怀疑 token 泄露：
1. Supabase SQL Editor 里 `select * from trips` 找到你的 trip
2. 改 `owner_token` 为新值
3. 前端 localStorage 里同步更新

### Q: Edge Function 部署失败？
确保 `supabase/config.toml` 在仓库根目录，且 `supabase functions deploy api` 能找到 `supabase/functions/api/index.ts`。

---

## 费用

| 服务 | 月费用 |
|------|--------|
| Vercel | **$0**（100GB 流量/月） |
| Supabase | **$0**（500MB 数据库 + 1GB Storage + 50万次函数调用） |
| 域名（可选）| ~$10/年 |

**永久免费。**
