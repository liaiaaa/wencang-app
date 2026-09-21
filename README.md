# 纹藏 · 非遗染织刺绣纹样数字化平台

面向蜡染、扎染、苗绣三类非物质文化遗产的数字化平台，包含 **纹样图库、AI 纹样工坊、守艺人展厅、体验预约、文创商城、用户系统** 六大模块。

本仓库为**本地演示版**：不依赖网络与云数据库即可完整运行，适用于答辩现场断网环境与源码材料存档。

---

## 一、快速开始（答辩现场照此操作）

```bash
# 1. 安装依赖（首次执行，约 1–2 分钟）
pnpm install

# 2. 启动本地演示（默认即演示模式，无需任何配置）
pnpm dev

# 3. 浏览器打开
#    http://localhost:5173
```

启动后控制台出现以下内容即表示成功：

```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

> **断网可用性说明**：演示模式的数据全部在本地内存中，无需数据库与网络。
> 页面中的纹样 / 守艺人配图来自图片 CDN，**断网时会显示为空白占位，但不影响任何功能流程**（浏览、筛选、预约、管理、下单均可正常演示）。

### 环境要求

| 项目 | 版本 |
| --- | --- |
| Node.js | ≥ 18（推荐 20 / 22 / 24） |
| 包管理器 | pnpm（推荐）/ npm |
| 浏览器 | Chrome / Edge 最新版 |

---

## 二、演示模式（mock）说明

项目支持两种运行模式，**默认走演示模式**：

| 模式 | 启动命令 | 数据来源 | 用途 |
| --- | --- | --- | --- |
| **演示模式** | `pnpm dev` | 本地内存（内置种子数据） | 断网答辩、功能演示 |
| 云端模式 | `pnpm dev:cloud` | 真实 Supabase | 联调云端数据库 |

切换方式（二选一）：

1. **用命令区分**（推荐）：`pnpm dev` 走演示模式，`pnpm dev:cloud` 走云端模式。
2. **用环境变量控制**：在 `.env.local` 中设置 `VITE_USE_MOCK=1`（演示）或 `0`（云端）。

演示模式内置数据：

- **15 条纹样**（蜡染 6 / 扎染 5 / 苗绣 4）
- **3 位守艺人** + 3 个体验项目 + 3 件文创商品
- 若干示例预约与订单，便于直接演示管理流程

> 演示模式的数据保存在浏览器 `localStorage`，刷新页面不会丢失。
> 如需恢复初始数据，在浏览器控制台执行：`__wenzangMock.reset()`

### 演示模式内置账号

| 角色 | 用户名 | 密码 | 说明 |
| --- | --- | --- | --- |
| **管理员** | `admin` | `wencang2026` | 个人中心额外出现「预约管理」，可查看并处理**全部**用户的预约 |
| 普通用户 | `demo` | `demo123456` | 只能查看**自己**的预约与订单 |

登录方式：进入 `/login`，输入上表中的用户名与密码（无需邮箱后缀），勾选用户协议后提交。

> 也可以在登录页点「立即注册」用任意新用户名注册，注册后即时可用（仅演示模式）。

---

## 三、演示动线建议（预约闭环）

一条能完整体现业务闭环的演示路径，约 2 分钟：

1. 用 **`demo / demo123456`** 登录
2. 进入 **体验预约**（`/booking`），选择守艺人、体验项目、日期与时段，填写联系人手机号，点击「提交预约」
3. 自动跳转到 **个人中心 → 我的预约**，可见该条预约状态为 **待确认**
4. 右上角 **退出登录**，改用 **`admin / wencang2026`** 登录
5. 进入 **个人中心 → 预约管理**，可见**全部用户**的预约及数量概览
6. 在刚提交的那条预约上点击 **「确认预约」**，状态变为 **已确认**
7. 退出登录，再次用 **`demo / demo123456`** 登录
8. 回到 **个人中心 → 我的预约**，该预约状态已变为 **已确认** ✅

其他可演示点：

- **AI 纹样工坊**（`/workshop`）：输入主题词如「蝴蝶妈妈 苗绣」，点击「生成纹样」。
  采用**三级降级链**：优先调用云端生图 → 不可用时由**本地程序化生成算法即时出图** → 仍异常才提示错误。
  本地生成产出真实的矢量纹样（蝴蝶 / 铜鼓 / 鱼纹 / 团花 / 几何 五组基元，中心对称 / 轴对称 / 四方连续 三种布局），
  结果卡标注 **「算法生成 · 种子XXXX」**、基元名与布局名；顶部有「本地程序化生成模式」诚实标注。
  **断网状态下"生成 → 保存 → 我的纹样查看"全流程可用。**
- **守艺人展厅**（`/artisans`）：卡片与详情页均带「示例档案」合规标注。
- **纹样详情页**（`/patterns/:id`）：**数字档案**式呈现，除图片与寓意外，还有四个深化区块 ——
  **工艺流程**（编号步骤条，移动端自动纵向排列）、**文化故事**（衬线长文，米白底卡片）、
  **传统应用场景**（徽章组）、**相关纹样**（横滑卡片，点击可跳转）。
  15 条纹样均已补齐内容；老数据缺字段时对应区块自动隐藏，不会出现空区块。
- **商品 ↔ 守艺人关联**（`/shop`、`/admin?tab=products`）：商品只关联一位守艺人，
  后台用**下拉**选择（选项为在架守艺人，显示姓名），保存时自动写入 `artisan_id` 并由其派生 `artisan_name`，
  两列不会各说各话。前台「出自 · 姓名」在关联有效时为可点击跳转的链接；
  关联缺失、指向已归档守艺人、或 id 已失效时**自动回落为纯文本**，不会出现点开报错的死链。
  早期只有 `artisan_name` 文本的老数据会按姓名反查补齐 id（反查不到则保持原样，不报错）。

### 运营后台演示（管理员专属）

用 `admin / wencang2026` 登录后，个人中心顶部出现 **「进入运营后台」**，或直接访问 `/admin`。
后台含五个区块，可现场演示"平台可运营"：

| 区块 | 可演示内容 |
| --- | --- |
| **概况看板** | 6 项指标卡 + **近 7 日预约/生成趋势折线图** + **热门纹样 TOP5** |
| **纹样管理** | 搜索、新建（含图片上传）、编辑、归档/恢复 |
| **守艺人管理** | 同上 |
| **商品管理** | 同上；**「关联守艺人」为下拉选择**，选项来自在架守艺人，保存后自动联动 `artisan_id` |
| **预约管理** | 全部预约与状态流转 |

**一条推荐的运营演示动线**（约 1 分钟）：

1. 后台「纹样管理」→ **新建**一条纹样，填名称/类别/地区/寓意，**上传一张图片** → 创建
2. 切到前台 **纹样图库**，新纹样已出现；回到 **首页**，统计条「收录纹样」**+1**
3. 回后台 → **编辑**该纹样寓意 → 打开其**详情页**，寓意已同步
4. 回后台 → **归档**该纹样 → 前台图库与首页均不再显示（后台仍可见并可「恢复」）
5. 到前台 **提交一次预约**、去 **AI 工坊生成一次纹样**
6. 回后台 **概况看板** → 折线图与「热门纹样 TOP5」已随刚才的行为变化
7. 后台 **商品管理** → 新建商品 → 用 **「关联守艺人」下拉** 选一位守艺人 → 到前台 **文创商城**
   点该商品的「出自 · 姓名」→ 直接跳到那位守艺人的档案页

> **权限**：普通用户（`demo`）访问 `/admin` 会被重定向到登录页；
> 数据层同样拦截——普通用户调用写接口返回 **403**，不只是前端隐藏入口。
>
> **埋点说明**：后台的趋势与 TOP5 来自本地轻量埋点（`localStorage` 键 `wc_events`，
> 环形缓冲保留最近 2000 条），**不接入任何第三方统计 SDK**，断网可用。
> 首次启动会**预置近 7 天演示数据**（看板标注「含演示数据」），保证后台首次进入即饱满；
> 该预置仅在完全没有埋点数据时写入，不会覆盖真实操作记录。
> 如需清空：控制台执行 `localStorage.removeItem('wc_events')` 后刷新，会重新预置一份。

---

## 四、自动截图与自检（可选）

仓库内置了零依赖的浏览器脚本（使用 Node 内置能力驱动本机 Chrome / Edge）：

```bash
# 终端 1：启动服务
pnpm dev

# 终端 2：按需执行（需本机安装 Chrome 或 Edge）
node scripts/demo-screenshots.mjs    # 跑完整条预约闭环并截图 → docs/screenshots/
node scripts/verify-routes.mjs       # 逐路由自检：正文关键文本 + 控制台报错
node scripts/verify-patterns.mjs     # 程序化纹样生成：出图 / 可复现 / 变体
node scripts/verify-save-chain.mjs   # 离线全链路：生成 → 保存 → 我的纹样可见
node scripts/verify-admin.mjs        # 运营后台 8 项验收标准（21 个检查点）
node scripts/verify-offline.mjs      # 断网验收：阻断外网后跑后台与生成全流程
node scripts/verify-archive.mjs      # 纹样档案深化 7 项验收（含 375px 移动端）
node scripts/verify-product-link.mjs # 商品关联守艺人：下拉联动 / 前台跳转 / 老数据与失效关联降级
```

`verify-patterns.mjs`、`verify-save-chain.mjs` 的产物输出到 `docs/screenshots/patterns/`，
`verify-admin.mjs`、`verify-offline.mjs` 输出到 `docs/screenshots/admin/`，
`verify-archive.mjs` 输出到 `docs/screenshots/archive/`，
`verify-product-link.mjs` 输出到 `docs/screenshots/product-link/`。

---

## 五、技术栈

| 分类 | 技术 |
| --- | --- |
| 构建 | Vite 5 |
| 框架 | React 19 + TypeScript 5 |
| 路由 | React Router 6 |
| 样式 | Tailwind CSS 3 + shadcn/ui（Radix UI） |
| 动效 | motion（framer-motion） |
| 图标 | lucide-react |
| 数据 / 鉴权 | Supabase（PostgreSQL + Auth + Storage + Edge Function） |
| 演示数据层 | 本地内存实现（`src/db/supabase.mock.ts`） |
| 测试 | Vitest + Testing Library |

### 演示模式的实现方式

演示模式**不改动任何业务代码**：通过 Vite 的路径别名，在演示模式下把 `@/db/supabase` 指向本地实现 `src/db/supabase.mock.ts`。
该文件实现了一个内存版的 Supabase 客户端（含 PostgREST 查询构造器、Auth、Storage、Edge Function 调用），并模拟了云端 RLS 行为（普通用户只能读写自己的预约/订单，管理员可见全部）。

因此 `src/lib/api.ts`、`src/contexts/AuthContext.tsx`、各页面组件**均与云端版本完全一致**，切换模式无需修改一行代码。

---

## 六、目录结构

```
├── src/
│   ├── components/       # 组件（layouts 布局 / ui 基础组件 / common 通用 / admin 后台）
│   ├── contexts/         # AuthContext 鉴权上下文
│   ├── db/
│   │   ├── supabase.ts        # 云端 Supabase 客户端
│   │   ├── supabase.mock.ts   # 演示模式内存客户端
│   │   ├── mockData.ts        # 演示种子数据
│   │   └── patternArchive.ts  # 纹样档案深化内容（工艺/故事/场景/相关）
│   ├── hooks/            # 自定义 hooks
│   ├── lib/
│   │   ├── api.ts        # 数据访问层（所有读写入口）
│   │   ├── analytics.ts  # 轻量运营埋点（localStorage）
│   │   ├── patternGen.ts # 纹样命名与寓意文案生成
│   │   ├── patternArt.ts # 程序化纹样生成器（SVG，5 基元 / 3 布局）
│   │   ├── productLink.ts# 商品 ↔ 守艺人关联（派生 / 反查补齐 / 有效性校验）
│   │   ├── related.ts    # 相关纹样推荐（三级回退）
│   │   └── role.ts       # 角色判定（管理员/普通用户）
│   ├── pages/            # 页面组件
│   ├── types/            # TypeScript 类型
│   ├── App.tsx           # 应用入口与路由挂载
│   ├── routes.tsx        # 路由表
│   └── index.css         # 主题变量与全局样式
├── supabase/
│   ├── migrations/       # 数据库迁移脚本
│   └── functions/        # Edge Function（AI 生图）
├── scripts/
│   └── demo-screenshots.mjs  # 演示截图脚本
├── docs/
│   └── screenshots/      # 演示截图产物
├── .env.example          # 环境变量模板
├── tailwind.config.js    # Tailwind 配置
└── vite.config.ts        # Vite 配置（含演示模式别名开关）
```

---

## 七、常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动本地演示模式（默认） |
| `pnpm dev:cloud` | 启动云端模式（需配置 `.env.local`） |
| `pnpm build` | 类型检查 + 生产构建 |
| `pnpm typecheck` | 仅做 TypeScript 类型检查 |
| `pnpm test` | 运行测试（含预约闭环与路由冒烟） |
| `pnpm preview` | 预览构建产物 |

---

## 八、连接真实 Supabase（可选）

1. 复制环境变量模板并填写连接信息：

   ```bash
   cp .env.example .env.local
   ```

   ```dotenv
   VITE_USE_MOCK=0
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

2. 在 Supabase SQL Editor 中按顺序执行 `supabase/migrations/` 下的迁移脚本。

3. 启动云端模式：

   ```bash
   pnpm dev:cloud
   ```

4. **启用管理员**：执行迁移 `00008_add_role_and_admin.sql` 后，将目标账号提升为管理员：

   ```sql
   update public.profiles p
   set role = 'admin'
   from auth.users u
   where p.id = u.id and u.email = 'admin@miaoda.com';
   ```

---

## 九、合规与素材说明

- 平台中的**守艺人档案均为虚构的示例数据**，用于功能演示；相关页面已标注「示例档案」，详情页注明「本档案为平台示例数据，图片为示意用途」。
- 演示配图来源于公开网络，仅作示意用途；正式发布前应替换为自有或已获授权的素材。
- 纹样文化背景描述（蜡染、扎染、苗绣）整理自公开的非遗科普资料，仅用于教学与展示。

---

## 十、常见问题

**Q：`pnpm install` 报错 `ERR_PNPM_IGNORED_BUILDS`（esbuild）？**
A：`pnpm-workspace.yaml` 中已配置 `allowBuilds: esbuild: true`。若仍报错，执行 `pnpm approve-builds` 并选择 esbuild。

**Q：页面能打开但图片是空白？**
A：图片来自外部 CDN，断网时无法加载，属预期现象，不影响功能演示。可在联网环境下预先打开一次以命中浏览器缓存。

**Q：端口 5173 被占用？**
A：`pnpm dev --port 5174` 换端口启动。

**Q：忘记管理员密码 / 想重置演示数据？**
A：演示模式数据存于浏览器 `localStorage`。在控制台执行 `__wenzangMock.reset()` 可恢复初始种子数据；清除该站点数据可同时重置登录状态。
