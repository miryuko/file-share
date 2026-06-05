# File-Share

<div align="center">

**基于 Cloudflare Workers 的混合架构文件传输助手**

[![License](https://img.shields.io/github/license/miryuko/file-share)](./LICENSE)

</div>

## 特性

- **混合传输** — 双方在线时 P2P 直传，离线或 NAT 失败时自动降级到云存储
- **超大文件** — R2 分片上传，单文件理论支持 50TB
- **完全匿名** — 6 位分享码即凭证，无需注册登录
- **断点续传** — 上传和下载均支持中断恢复
- **管理后台** — `/admin` 路由，在线配置站点参数、监控传输状态
- **E2E 加密** — 客户端 AES-GCM 加密，服务端零知识

## 开发状态

项目处于 **Phase 1 (MVP)** 早期阶段，基础设施已就绪，功能开发中。

| 特性 | 状态 |
|------|------|
| Monorepo 脚手架 (worker + web) | ✅ 已完成 |
| 工程规范 (.claude/skills/) | ✅ 已完成 |
| CI/CD (lint / typecheck / build / tests / deploy) | ✅ 已完成 |
| 混合传输 (P2P + 云存储降级) | 🔜 规划中 |
| R2 分片上传 | 🔜 规划中 |
| 6 位分享码 | 🔜 规划中 |
| 断点续传 | 🔜 规划中 |
| 管理后台 /admin | 🔜 规划中 |
| E2E 加密 (AES-GCM) | 🔜 规划中 |

## 技术栈

| 层 | 选型 |
|----|------|
| 运行时 | Cloudflare Workers |
| 后端框架 | Hono (TypeScript) |
| 存储 | R2（无出口费）+ KV |
| 信令 | Durable Objects + WebSocket |
| 前端 | Vue 3 + shadcn-vue + Tailwind CSS |
| P2P | WebRTC Data Channel |
| 测试 | Vitest + Miniflare + Playwright |
| 构建 | pnpm monorepo |

## 快速开始

### 前置要求

- Node.js 20+
- pnpm 9+
- Cloudflare 账户

### 安装

```bash
# 克隆仓库
git clone https://github.com/miryuko/file-share.git
cd file-share

# 安装依赖
pnpm install
```

### 开发

```bash
# 启动 Worker（后端）
pnpm dev:worker

# 启动前端
pnpm dev:web
```

### 部署

```bash
# 部署 Worker 到 Cloudflare
pnpm --filter @file-share/worker deploy
```

## 项目结构

```
file-share/
├── packages/
│   ├── worker/              # Cloudflare Worker 后端
│   │   ├── src/
│   │   │   └── index.ts     # Hono 应用入口
│   │   ├── public/          # 前端构建产物（Cloudflare Assets）
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   ├── wrangler.jsonc   # Wrangler 配置
│   │   ├── vitest.config.ts
│   │   └── vitest.integration.config.ts
│   └── web/                 # Vue 3 前端
│       ├── src/
│       │   ├── components/  # UI 组件（含 icons/）
│       │   ├── router/      # Vue Router 路由
│       │   ├── stores/      # Pinia 状态管理
│       │   ├── views/       # 页面视图
│       │   ├── assets/      # CSS / SVG 资源
│       │   ├── App.vue      # 根组件
│       │   └── main.ts      # 应用入口
│       └── tests/
│           ├── unit/
│           └── e2e/
├── .claude/skills/           # AI 辅助开发规则
├── .github/workflows/        # GitHub Actions 工作流
└── .github/ISSUE_TEMPLATE/   # Issue 模板
```

## 命令速查

| 命令 | 说明 |
|------|------|
| `pnpm dev:worker` | 启动 Worker 本地开发服务器 (wrangler dev) |
| `pnpm dev:web` | 启动前端 Vite 开发服务器 |
| `pnpm build:worker` | 构建前端并部署 Worker 到 Cloudflare |
| `pnpm build:web` | 构建前端生产包 |
| `pnpm test:unit` | 运行前后端单元测试 (Vitest) |
| `pnpm test:integration` | 运行 Worker 集成测试 (Miniflare) |
| `pnpm test:e2e` | 运行 Playwright E2E 测试 |
| `pnpm lint` | ESLint + Oxlint 检查 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm format` | Prettier 格式化 |

## 开发流程

详见 [CONTRIBUTING.md](./CONTRIBUTING.md) 和 `.claude/skills/engineering-standards/`。

## 许可

MIT © 2026
