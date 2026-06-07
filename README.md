# 深读 Deepread

> 这里存放的不是书，而是你的时间与智慧。

一个沉浸式 EPUB 阅读器，核心理念：**深度思考，而非消费内容**。

在这个信息过载的时代，我们习惯性地「读完」一本书，却很少真正「读进去」。深读试图改变这一点——它不是一个电子书管理器，而是一个思考的空间。

---

## ✦ 产品理念

传统阅读器追求「读得快」，深读追求「想得深」。

每打开一本书，你必须先回答一个问题：**「今天，你为了什么翻开这本书？」**——这不是形式主义，而是帮你锚定注意力的方向。

阅读过程中，你可以随时拖拽一段触动你的文字，生成一张思维卡片，写下当下的思考。AI 会从三个维度回应你：

- **释义** — 深度剖析这段话的哲学、逻辑或社会学背景
- **反驳** — 作为魔鬼代言人，挑战这个观点的盲区
- **联想** — 跨学科连接，从心理学、经济学、设计等领域找到映射

读完一本书后，你会看到自己最初的意图、沿途的摘录、和最终的收获——这是一次完整的认知闭环。

---

## ✦ 功能亮点

### 📖 沉浸阅读

- epub.js 连续滚动模式，章节之间无缝衔接
- 自动保存阅读位置，下次打开回到上次停留处
- 实时进度追踪 + 累计阅读时长
- 目录侧栏一键跳转
- 全文搜索 + 关键词高亮

### 💡 思维卡片

- 选中文字 → 拖拽到右侧 → 生成思维卡片
- 在卡片上写下你的思考，600ms 防抖自动保存
- 所有卡片可导出为 Markdown 文件

### 🤖 AI 三种反思

每张卡片支持三种 AI 反思模式（流式输出）：

| 模式 | 视角 | 作用 |
|------|------|------|
| 释义 | 学者 | 从哲学、逻辑、社会学角度深度解析 |
| 反驳 | 魔鬼代言人 | 挑战观点盲区，激发多维思考 |
| 联想 | 跨界学家 | 连接其他学科，提供新奇灵感 |

### 📊 阅读完成回顾

- 读到 95% 自动触发完成回顾
- 对比最初阅读意图 vs 实际摘录 vs 最终收获
- 已读完的书变成「知识沉淀」堆叠在书桌上

---

## ✦ 快速开始

### 环境要求

- Node.js 18+
- 一个 OpenAI 兼容的 API 服务（小米 MIMO、OpenAI、DeepSeek 等）

### 安装

```bash
git clone https://github.com/AyingAI/deepread.git
cd deepread
npm install
```

### 配置 AI

有两种方式配置 AI API：

**方式一：启动后在界面配置（推荐）**

启动应用后，点击书桌右上角的齿轮图标，填入你的 API Key、Base URL 和模型名称，保存即可。

**方式二：手动创建 .env.local**

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```
MIMO_API_KEY=your-api-key-here
MIMO_API_BASE=https://api.openai.com/v1
MIMO_MODEL=gpt-4o-mini
```

### 启动

```bash
npm run dev
```

打开浏览器访问 `http://localhost:3000`，默认登录账号 `myreader` / `123456`。

---

## ✦ AI 配置说明

深读的 AI 功能通过 OpenAI 兼容接口实现，支持任何符合该规范的服务：

| 服务 | API Base URL | 模型示例 |
|------|-------------|---------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-7B-Instruct` |

API Key 仅保存在本地 `.env.local` 文件中，不会上传到任何服务器。

---

## ✦ 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 + TypeScript + Vite 6 |
| 服务端 | Express 5（API 代理） |
| EPUB 渲染 | epub.js 0.3.93（CDN 加载） |
| 样式 | Tailwind CSS（CDN） |
| 动画 | framer-motion |
| 本地存储 | IndexedDB（books / content / cards） |
| AI | OpenAI 兼容接口（流式 SSE） |

---

## ✦ 项目结构

```
deepread/
  index.html              # SPA 入口
  index.css               # epub iframe 样式
  index.tsx               # React 挂载
  App.tsx                 # 根组件，状态机：登录 → 书桌 → 意图仪式 → 阅读
  server.ts               # Express 服务，AI 代理 + 设置 API
  types.ts                # 类型定义
  utils/
    db.ts                 # IndexedDB 封装
  components/
    LoginView.tsx          # 登录页
    DeskView.tsx           # 书桌视图（书籍管理 + AI 配置）
    RitualView.tsx         # 阅读意图仪式
    ReadingView.tsx        # 阅读器 + 思维卡片面板
```

---

## ✦ 构建部署

```bash
# 开发模式
npm run dev

# 生产构建
npm run build
npm start
```

生产模式下，前端静态文件由 Express 直接提供服务，无需额外的 Web 服务器。

---

## ✦ 许可证

MIT

---

<p align="center">
  <em>深读——不是读完一本书，而是想明白一件事。</em>
</p>
