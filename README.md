# File-Share

<div align="center">

**基于 Cloudflare Workers 的文件传输助手 — 安全、匿名、即时**

[![License](https://img.shields.io/github/license/miryuko/file-share)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-59%20passed-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)]()

</div>

## 功能

- **文件传输** — 拖拽上传，生成 6 位分享码，接收方输入码即可下载。支持多文件和分片上传
- **文本传输** — 粘贴文本（URL / 密码 / 笔记），一键分享，一键复制
- **P2P 直传** — WebRTC Data Channel 点对点传输，零服务器带宽（NAT 穿透失败自动降级 R2）
- **二维码** — 分享码自动生成 SVG 二维码，手机扫一扫即开
- **管理面板** — `/admin` 路由，PBKDF2 密码认证 + JWT，在线配置、监控、终止会话
- **自动清理** — 文件 1 小时后自动过期，Cron 每 5 分钟清理过期数据
- **速率限制** — IP 级别频率控制，防滥用

## 开发状态

所有核心功能均已实现 ✅

| 特性 | 状态 |
|------|------|
| Monorepo 脚手架 (worker + web) | ✅ 已完成 |
| 工程规范 (.claude/skills/) | ✅ 已完成 |
| 核心文件传输 (R2 分片上传/下载) | ✅ 已完成 |
| 6 位分享码 | ✅ 已完成 |
| 管理面板 (/admin) | ✅ 已完成 |
| 文本传输 | ✅ 已完成 |
| P2P WebRTC 信令 (Durable Objects) | ✅ 已完成 |
| 二维码生成 | ✅ 已完成 |
| 速率限制 | ✅ 已完成 |
| 单元/集成/E2E 测试 | ✅ 已完成 |
| E2E 加密 (AES-GCM) | 🔜 规划中 |

## 技术栈

| 层 | 选型 |
|----|------|
| 运行时 | Cloudflare Workers |
| 后端框架 | Hono (TypeScript) |
| 存储 | R2（无出口费）+ KV |
| 信令 | Durable Objects + WebSocket |
| 前端 | Vue 3 + Vite |
| P2P | WebRTC Data Channel |
| 加密 | Web Crypto API (PBKDF2 / HMAC-SHA256) |
| 测试 | Vitest + Miniflare + Playwright |
| 构建 | pnpm workspace monorepo |

## 快速开始

### 前置要求

- Node.js ^20.19.0 或 >=22.12.0
- pnpm >=9.0.0
- Cloudflare 账号（需 Workers Paid 计划）

### 安装

```bash
git clone https://github.com/miryuko/file-share.git
cd file-share
pnpm install
```

### 开发

```bash
# 终端 1：启动 Worker（后端 API）
pnpm dev:worker

# 终端 2：启动前端
pnpm dev:web
```

前端运行在 `http://localhost:5173`，自动代理 `/api` 请求到 Worker（`localhost:8787`）。

### 测试

```bash
pnpm test:unit        # 单元测试（59 tests）
pnpm test:integration # 集成测试（Miniflare v4）
pnpm test:e2e         # E2E 测试（Playwright）
pnpm typecheck        # TypeScript 类型检查
pnpm lint             # ESLint + Oxlint
```

### 部署

```bash
# 部署到生产环境
pnpm build:worker --env production

# 或直接使用 wrangler
cd packages/worker && npx wrangler deploy --env production
```

详见 [部署指南](docs/deployment.md)。

## 项目结构

```
file-share/
├── packages/
│   ├── worker/                    # Cloudflare Worker 后端
│   │   ├── src/
│   │   │   ├── api/               # 路由层（薄层：参数绑定 + 响应）
│   │   │   ├── services/          # 业务层（厚层：所有逻辑）
│   │   │   ├── models/            # 类型定义
│   │   │   ├── middleware/        # 中间件（错误处理、限流、日志、认证）
│   │   │   ├── utils/             # 工具（JWT、密码哈希、验证码、校验）
│   │   │   └── do/                # Durable Objects（WebRTC 信令）
│   │   ├── tests/
│   │   │   ├── unit/              # 单元测试
│   │   │   └── integration/       # 集成测试
│   │   └── wrangler.jsonc
│   └── web/                       # Vue 3 前端
│       ├── src/
│       │   ├── views/             # 页面（Send, Receive, Admin, TextShare）
│       │   ├── components/        # 组件（P2PTransfer）
│       │   ├── composables/       # 组合式函数（useFileUpload, useWebRTC）
│       │   ├── lib/               # 工具库（API 客户端、QR 码生成器）
│       │   └── router/            # 路由
│       └── tests/
│           ├── unit/
│           └── e2e/
├── docs/
│   └── features/                  # 设计文档
└── .claude/skills/                # AI 辅助开发规范
```

## 架构

```
api/      → 只做三件事：取参数、调 service、返回响应。不调 R2/KV/DO。
services/ → 所有业务逻辑、所有平台 API。不 import Hono。
models/   → 只有 interface/type。不写函数。
```

## API 参考

### 文件传输
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/session/create` | 创建传输会话 |
| GET | `/api/session/:code` | 查询会话信息 |
| POST | `/api/upload/:code/:fileId/part` | 上传文件分片 |
| POST | `/api/upload/:code/:fileId/complete` | 完成分片上传 |
| GET | `/api/download/:code/:fileId` | 下载文件 |

### 文本传输
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/text/create` | 创建文本分享 |
| GET | `/api/text/:code` | 获取文本内容 |

### 管理员
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 管理员登录 |
| GET/PUT | `/api/admin/config` | 获取/更新配置 |
| GET | `/api/admin/sessions` | 列出活跃会话 |
| DELETE | `/api/admin/sessions/:code` | 强制终止会话 |

### WebSocket
| 路径 | 说明 |
|------|------|
| `/ws/signaling/:code?role=sender\|receiver` | P2P WebRTC 信令 |

## 命令速查

| 命令 | 说明 |
|------|------|
| `pnpm dev:worker` | 启动 Worker 本地开发 (wrangler dev) |
| `pnpm dev:web` | 启动前端 Vite 开发服务器 |
| `pnpm build:worker` | 构建前端并部署到 Cloudflare |
| `pnpm test:unit` | 运行所有单元测试 |
| `pnpm test:integration` | Worker 集成测试 (Miniflare v4) |
| `pnpm test:e2e` | Playwright E2E 测试 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm lint` | ESLint + Oxlint |

## 设计文档

- [核心文件传输](docs/features/core-file-transfer.md)
- [管理员面板](docs/features/admin-panel.md)
- [P2P WebRTC](docs/features/p2p-webrtc.md)
- [文本传输](docs/features/text-transfer.md)
- [部署指南](docs/deployment.md)

## 许可

MIT © 2026
