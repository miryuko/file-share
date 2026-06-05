---
name: engineering-standards
description: >
  File-Share 项目工程规范。当收到新需求、编写设计文档、写代码、写测试、
  或做代码评审时使用。覆盖从需求到交付的完整流程。
---

# File-Share 工程规范

## 项目上下文

### 我们做什么

一个基于 Cloudflare Workers 的文件传输工具。核心场景：跨设备自传（手机↔电脑）、分享给他人、大文件 P2P 直传。完全匿名，靠 6 位分享码标识传输会话，不需要用户系统。

### 技术栈

| 层 | 选型 | 关键约束 |
|----|------|---------|
| 运行时 | Cloudflare Workers（付费版） | 300s 超时，100MB body 限制 |
| 后端框架 | Hono (TypeScript) | — |
| 对象存储 | R2 | 无出口费，S3 兼容 |
| 元数据 | KV | 最终一致，读快写慢 |
| 信令 | Durable Objects + WebSocket | 单实例 128MB 内存 |
| 定时任务 | Cron Triggers | Workers 内置 |
| 前端 | Vue 3 + shadcn-vue + Tailwind CSS | — |
| P2P 传输 | WebRTC Data Channel | 浏览器原生 |
| 加密 | Web Crypto API (AES-GCM) | 客户端加解密 |
| 包管理 | pnpm（workspace monorepo） | — |
| 测试 | Vitest + Miniflare + Playwright | — |
| 部署 | Wrangler CLI | — |

### 架构约束

- **混合传输**：双方在线优先 P2P，离线/NAT 穿透失败自动降级到 R2。代码里每条传输路径都必须有 fallback。
- **完全匿名**：无用户系统，分享码即凭证。
- **管理员独立**：`/admin` 路由，单密码 + JWT 登录，配置站点参数。
- **分层架构**：`api/`（薄层，参数绑定+序列化）→ `services/`（厚层，所有业务逻辑和平台 API 调用）。`models/` 只放类型不放函数。
- **键名规范**：KV 键 `prefix:identifier`，R2 路径 `type/code/fileId`。
- **分享码**：6 位字母数字，排除易混淆字符（0/O/1/I/L）。

### 分层死规则

```
api/      → 只做三件事：取参数、调 service、返回响应。不调 R2/KV/DO。
services/ → 所有业务逻辑、所有平台 API。不 import Hono。
models/   → 只有 interface/type。不写函数。
```

### 当前开发阶段

Phase 1 (MVP) — 核心传输功能开发中。当前 `src/` 下仅有入口骨架 `index.ts`，功能模块（`api/`、`services/`、`models/`、`middleware/`、`utils/`）将随功能开发按需创建。

---

## 收到新需求时怎么做

### 判断要不要写设计文档

| 情况 | 怎么做 |
|------|--------|
| P0 / P1 新功能 | 写设计文档（需求 + 概要设计合并在一份文件里） |
| P2 小功能 | GitHub Issue 里写清楚场景和验收标准即可 |
| 修 bug | 直接修，补测试 |
| 改样式 / 调 UI | 直接改 |
| 依赖升级 | 直接升 |
| 重构（行为不变） | 直接改 |

### 设计文档写什么

一份文件放在 `docs/features/{功能名}.md`。必须回答六个问题：

1. **为什么做** — 不做的后果是什么
2. **场景** — 谁、什么前置条件、做了什么、期望看到什么（正常 + 异常，异常至少 3 个）
3. **API 变化** — 新增/改哪些路由？什么请求体？什么响应？什么错误码？
4. **数据流** — 数据走 R2 还是 KV 还是 DO？传输路径选择的决策逻辑？
5. **失败了会怎样** — 每个关键步骤失败时用户看到什么
6. **属于哪个 Phase** — Phase 1(MVP) / 2(大文件) / 3(P2P) / 4(体验打磨)

详细模板见 `references/01-requirements.md` 和 `references/02-design.md`。

### 设计文档写完后的流程

```
需求 + 设计文档 → 编码 → 单元测试 → 集成测试 → 代码审查 → 提交 commit
```

每个阶段的具体标准见对应的 references 文件。

---

## 快速索引

| 我要做什么 | 看哪个文件 |
|-----------|-----------|
| 写需求文档 | `references/01-requirements.md` |
| 做概要设计 / 详细设计 | `references/02-design.md` |
| 写代码 | `references/03-coding.md` |
| 写测试 | `references/04-testing.md` |
| 代码审查 | 使用 `/code-review` 命令 |
| Git 规范 | `references/05-git.md` |

## 常用命令

```sh
pnpm dev:worker          # 启动 Worker 本地开发 (wrangler dev)
pnpm dev:web             # 启动前端开发服务器 (vite)
pnpm build:worker        # 构建前端并部署 Worker
pnpm build:web           # 构建前端生产包
pnpm test:unit           # 所有单元测试
pnpm test:integration    # Worker 集成测试 (Miniflare)
pnpm test:e2e            # Playwright E2E
pnpm lint                # ESLint + Oxlint
pnpm typecheck           # TypeScript 类型检查
pnpm format              # Prettier 格式化
```
