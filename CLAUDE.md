# Deepread 深读

沉浸式 EPUB 阅读器，核心理念：深度思考而非消费内容。

## 产品逻辑链

上传 EPUB → 阅读意向仪式（"为什么打开这本书？"）→ 上下滚动阅读 → 拖拽摘录生成思考卡片 → AI 三种模式反思（释义/反驳/联想）→ 读完的书变成「知识沉淀」堆叠

## 技术栈

- React 19 + TypeScript + Vite
- Express 5（server.ts，API 代理）
- epub.js（CDN 加载，全局 `ePub`）
- framer-motion（动画）
- IndexedDB（本地持久化：books / content / cards）
- Tailwind CSS（CDN）
- MIMO API（小米，mimo-v2.5 模型）

## 项目结构

```
deepread/
  index.html          # SPA 入口，CDN 加载 Tailwind/epub.js/fonts
  index.css           # epub iframe 样式
  index.tsx           # React root mount
  App.tsx             # 根组件，状态机：ENTRY → DESK → RITUAL → READING
  server.ts           # Express 5，POST /api/ai/reflect 代理 MIMO API
  types.ts            # AppState / Book / ThoughtCard 类型定义
  constants.ts        # 占位（mock 数据已清理）
  utils/db.ts         # IndexedDB 封装（DeepreadDB v2）
  components/
    EntryView.tsx      # 入口仪式页（夜景点灯动效，无认证）
    DeskView.tsx       # 书桌视图，EPUB 上传，活跃书+沉淀堆叠
    RitualView.tsx     # 阅读意向仪式
    ReadingView.tsx    # EPUB 阅读器 + 思维流卡片面板
```

## 启动

```bash
npm run dev    # tsx server.ts，端口 3000，Vite 中间件模式
npm run build  # vite build + esbuild 打包 server
npm start      # 生产模式 dist/server.cjs
```

## 环境变量

`.env.local` 中配置：
- `MIMO_API_KEY` — 必填
- `MIMO_API_BASE` — 默认小米 MIMO 端点
- `MIMO_MODEL` — 默认 mimo-v2.5

## 当前进度

### 阶段一（核心闭环）— 已完成

- [x] EPUB 渲染：epub.js native continuous scroll（`manager: "continuous"`, `flow: "scrolled"`），上下自由滚动
- [x] continuous manager 稳定化：patch `createView` / trim / erase / `view.destroy`，扩大预加载窗口，保留离屏 iframe，避免章节边界跳闪
- [x] 位置恢复：CFI 持久化到 IndexedDB，下次打开恢复到上次位置
- [x] 真实进度：`book.locations.generate(1024)` 后用 `percentageFromCfi` 计算百分比
- [x] 完成判定：progress >= 95 时标记为 100，书进入沉淀堆叠
- [x] 进度条 UI：书名旁显示细进度条、百分比、当前章节名
- [x] 目录侧栏：点击目录按钮弹出章节目录，可跳转
- [x] IndexedDB：连接池复用，updateBookMetadata O(1) 直接 key 查找
- [x] 补 index.css / 清理死代码 / 修复 server.ts 智能引号
- [x] 代码质量审计修复（闭包泄漏、stale state、多余写入等）

### 协作分工

- **Codex**（项目负责人）：编排计划、派发任务、验收结果
- **Claude Code**（执行者）：代码实现、具体改动、跑验证

后续开发流程：Codex 明确目标和范围 → Claude Code 执行 → Codex 验收。

### 推进策略

先固化阅读体验基线，再补可管理、可带走、可复盘，最后做增强。

### 路线图

#### A. 固化阅读体验基线

- [x] CLAUDE.md 文档同步（本次）
- [x] 阅读体验回归检查清单确认（见下方）
- [x] 确保后续改动不破坏 reading flow

**回归检查清单（每次改 ReadingView 前核对）：**

1. 连续上下滚动流畅，无章节边界跳闪
2. 位置恢复准确（关闭再打开，停在上次位置）
3. 进度百分比正确递增
4. 目录跳转后位置正确
5. 拖拽摘录生成卡片正常
6. AI 反思请求正常返回

#### B. 可管理

- [x] 书籍删除 UI（db.ts 已有 `deleteBookFromDB`，接入 DeskView）
- [x] 思维流卡片删除
- [x] 卡片保存 debounce（避免频繁写 IndexedDB）
  - 验收：TypeScript 类型检查 + npm run build 通过；Codex 浏览器复验发现旧实现未落库，已改为 cardsRef 同步镜像后修复；当前浏览器页没有卡片/输入自动化受限，真实输入落库仍建议在有卡片场景人工复测一次。实现：`updateCardNote` 改为同步即时更新 UI + 600ms debounce 写 IndexedDB；`flushCardNote` 在 textarea 失焦时立即保存；删除卡片时清理 timer/pending；组件卸载时 fire-and-forget 保存所有 pending 卡片。

#### C. 可带走

- [x] 卡片导出为 Markdown

#### D. 可复盘

- [x] 阅读完成回顾：回看当初阅读意图 vs 实际摘录 vs 收获总结
  - 验收：build 通过，浏览器验证回顾入口、弹窗和关闭正常；关闭存在退出动画延迟但状态正常。未达 95% 点击按钮会显示轻量提示说明当前进度，避免死按钮。

#### E. 增强

- [x] 书籍封面提取：上传 EPUB 时尽量提取 coverImage，失败回落 coverColor
  - 验收：npm run build 通过；封面提取失败不会阻塞上传；metadata.title 缺失时用文件名兜底。
- [x] AI 反思流式输出
  - 验收：npx tsc --noEmit + npm run build 通过；curl 真实 MIMO 请求通过，/api/ai/reflect 返回纯文本；in-app Browser 点击卡片"解释"后最终显示 AI 文本、无错误、spinner 结束。server.ts 流式解析 OpenAI SSE + AbortController；前端 ReadableStream 逐块 setAiResponse + requestSeqRef 防旧响应覆盖。
  - 观察：MIMO 首 token 偏慢，前几秒仍会显示等待状态，后续可优化首字等待提示。
- [x] AI 配置 / 模型获取
  - 排障记录：新增 AI 配置后，模型获取错误不是 CORS。Codex 验收发现 3000 服务未启动会导致 `Failed to fetch`；服务启动后 `/api/settings/models` 返回 400 "请先填写 API Key"。进一步定位旧 `server.ts` 的 `POST /api/settings` 会在 API Key 留空保存 `apiBase`/`model` 时重写 `.env.local` 并清空原 Key。
  - 修复：`server.ts` 启动自动读取 `.env.local`；保存设置时合并旧 `MIMO_API_KEY`/`MIMO_API_BASE`/`MIMO_MODEL`，未传字段保留；`GET /api/settings` 返回 `hasApiKey`，不返回真实 Key；DeskView API Key 输入框根据 `hasApiKey` 显示"已配置 API Key，留空不更新"。
  - 验收：`npx tsc --noEmit`、`npm run build` 通过；当前 `.env.local` 的 `MIMO_API_KEY` length=0，需要用户重新填一次真实 Key 后才能获取模型。
- [x] 阅读统计（累计时长完成，卡片数量阅读页已有实时展示；书桌统计暂未做）
  - 验收：npm run build 通过；Codex 浏览器 smoke 通过，阅读器 iframe 正常，header 显示累计阅读时长，右侧卡片数量正常。
- [x] 全文 / 卡片搜索
  - 实现：基于 spine item find 遍历全书（`book.spine.spineItems` → `item.load` → `item.find` → `item.unload`），最大取 50 条正文结果，UI 展示前 20 条；卡片搜索 quote/note lowercase 比较；`searchSeqRef` 防旧搜索覆盖新输入；失败时 `console.warn` 但仍展示卡片结果。
  - 搜索高亮：抽出 `applySearchHighlightToDocument` / `removeSearchHighlightsFromDocument` 纯函数；content hook 对新加载 iframe 调用；`navigateToResult` async 化后对 `rendition.getContents()` + viewerRef 所有 iframe 双重调用，修复已加载/保留 iframe 不触发 hook 导致跳转无高亮的生命周期漏洞；`clearHighlights` 无条件扫 viewer iframe（先清 highlightQueryRef，再尝试清 rendition contents，最后无论 rendition 是否存在都遍历 viewerRef 全部 iframe），避免 renditionRef 瞬时为空时残留高亮。
  - 验收：npm run build 通过；in-app Browser 使用《工作、消费主义和新穷人》搜索"工作伦理"得到 52 条结果，点击第一条后搜索面板关闭、正文正常显示、关键词黄色高亮可见；再次打开搜索并关闭后，高亮清除。Codex 复验发现并修复两个问题：1) `display(cfi)` 前 content hook 高亮会破坏 epub.js CFI offset；2) continuous scroll 稳定补丁禁用 `createView`/`trim`/`erase`/`destroy` 后会影响搜索/目录程序化跳转，新增 `safeProgrammaticDisplay` 在程序化跳转期间临时恢复 `createView`/`trim`/`erase`/`destroy`，跳完后重新 stabilize。

### 风险与取舍

- **iframe 内存**：continuous manager 保留更多离屏 iframe 会增加内存占用。桌面本地阅读器优先顺滑阅读，当前策略可接受。超大 EPUB（数千章）后续再做上限策略（如限制同时存活的 iframe 数）。

## 约束

- 纯桌面端应用，不考虑移动端
- 不部署 AI Studio，本地运行
- 入口仪式为纯 UI 动效，无认证/无账号密码
- epub.js 通过 CDN `<script>` 加载，用 `(window as any).ePub` 访问
