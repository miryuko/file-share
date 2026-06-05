# 核心文件传输 (Phase 1 MVP)

## 为什么做

不做的后果：项目只有骨架，无法完成基本的"文件从 A 传到 B"这个项目存在的根本目的。这是 Phase 1 MVP 的最小可行产品，必须优先完成。

---

## 场景

### 场景 1：发送方上传文件

- 角色：发送方
- 前置条件：已打开首页
- 操作：选择本地文件（可多选），点击发送
- 期望：显示 6 位分享码，可一键复制；页面展示上传进度

### 场景 2：接收方下载文件

- 角色：接收方
- 前置条件：持有有效分享码
- 操作：在首页输入分享码，点击接收
- 期望：展示文件列表，可逐个下载或一键打包下载

### 异常场景

- 文件超过最大限制 → 提示"文件过大，单文件最大 {limit}MB，总大小最大 {limit}MB"
- 分享码不存在 → 提示"分享码无效，请检查后重试"
- 文件已过期 → 提示"文件已过期，文件保留 {ttl} 分钟后自动清理"
- 接收次数已用完 → 提示"该分享已达到下载次数上限"
- 上传过程中网络中断 → 提示"上传中断，请检查网络后重试"
- 服务不可用（KV/R2 故障）→ 提示"服务异常，请稍后重试"

---

## 功能边界

包含：
- 选择本地文件上传（支持多文件）
- 生成 6 位唯一分享码
- 分片上传大文件（单文件 > 5MB 时启用分片）
- 接收方输入分享码查看文件列表
- 接收方下载文件
- 文件/分享码过期自动清理

不包含：
- P2P WebRTC 直传（Phase 3）
- 剪贴板文本传输（Phase 4）
- 二维码展示（Phase 4）
- 文件预览（Phase 4）
- 自定义过期时间（Phase 2）
- 密码保护分享（Phase 2）
- 管理员面板（Phase 2）

限制：
- 单文件 ≤ 100MB（CF Workers body 限制）
- 单次分享总大小 ≤ 500MB
- 单次分享文件数 ≤ 20 个
- 文件保留 1 小时后自动过期
- 单次分享最大下载次数 20 次
- 单 IP 每分钟最多创建 10 个分享

---

## 验收标准

- [ ] 选择 1 个 1MB 文件上传，获得 6 位分享码，文件成功存入 R2
- [ ] 选择 3 个文件同时上传，获得同一个分享码，3 个文件均成功
- [ ] 上传 50MB 文件（触发分片），分片上传完成后文件完整
- [ ] 接收方输入正确分享码，看到文件列表（文件名 + 大小）
- [ ] 接收方点击下载，文件内容与原文件完全一致（SHA-256 校验）
- [ ] 输入不存在的分享码，提示"分享码无效"
- [ ] 上传 > 100MB 文件，提示"文件过大"
- [ ] 分享码过期后（手动改 KV TTL 模拟），下载提示"文件已过期"
- [ ] 超过下载次数后，下载提示"已达到下载次数上限"
- [ ] 同 IP 1 分钟内创建 > 10 个分享，第 11 次返回 429

---

## 架构对齐

- 存储位置：
  - 文件数据 → R2，路径 `files/{code}/{fileId}`
  - 会话元数据 → KV，键前缀 `code:`（如 `code:A3K9M2`）
  - 下载计数 → KV，与 session 数据同键
- 传输路径：纯服务端中转（R2），Phase 3 再加 P2P fallback
- 清理机制：Cron Trigger 每 5 分钟扫描过期 KV 键 → 删除对应 R2 文件
- 所属 Phase：Phase 1 (MVP)

---

## API 变更

### POST /api/session/create

- 认证：匿名（按 IP 限流）
- Body: `{ files: [{ filename: string, size: number, contentType?: string }] }`
- 201: `{ code: string, files: [{ fileId: string, uploadUrl: string, expiresAt: number }], expiresAt: number }`
- 400: 文件列表为空、文件名非法、文件数超限
- 413: 单个文件或总大小超限
- 429: IP 频率限制

### POST /api/upload/{code}/{fileId}/complete

- 认证：匿名
- Body: `{ uploadId: string, parts: [{ partNumber: number, etag: string }] }`
- 200: `{ fileId: string, size: number }`
- 404: 分享码或文件不存在
- 409: 上传未完成（parts 不匹配）

### GET /api/session/{code}

- 认证：匿名
- 200: `{ code: string, files: [{ fileId: string, filename: string, size: number, contentType: string }], expiresAt: number, remainingDownloads: number }`
- 404: 分享码不存在
- 410: 已过期

### GET /api/download/{code}/{fileId}

- 认证：匿名
- 200: 文件二进制流（Content-Disposition: attachment）
- 302: 重定向到 R2 预签名 URL
- 404: 分享码或文件不存在
- 410: 已过期或下载次数用尽
- 429: 单文件并发下载限制

### WebSocket /ws/signaling/{code}

- Phase 3 引入，Phase 1 暂不实现

---

## 数据模型

### KV 键空间 `code:`

```
code:{code} → {
  code: string,
  files: [{ fileId: string, filename: string, size: number, contentType: string }],
  status: "uploading" | "ready" | "downloading" | "expired",
  totalSize: number,
  createdAt: number,
  expiresAt: number,
  maxDownloads: number,
  downloadCount: number,
  creatorIP: string
}
```

TTL: `expiresAt` 对应的 Unix 时间戳通过 KV 的 `expiration` 设置（KV 自动删除）。

### R2 路径 `files/`

```
files/{code}/{fileId}  → 原始文件内容
```

上传时使用 R2 multipart upload（大文件自动分片），下载时直读对象。

### 与现有数据的关系

独立键空间，与后续功能的扩展关系：
- `text:` 前缀（Phase 4 文本传输）— 共享 Cron cleanup 扫描逻辑
- `admin:config`（Phase 2 管理员）— 读取站点配置参数

---

## 处理流程

### POST /api/session/create

```
校验文件列表
  │
  ├─ 文件数为 0 或超限 → 400 "文件数量无效"
  ├─ 单文件 > maxFileSize → 413 "文件过大"
  ├─ 总大小 > maxTotalSize → 413 "总大小超限"
  └─ 通过
      │
      ├─ 检查 IP 频率
      │   └─ 超限 → 429 "操作过于频繁"
      │
      └─ 生成 6 位分享码
          │
          ├─ 碰撞检查（KV 中已存在该 code）
          │   └─ 碰撞 → 重试生成新码（最多 3 次）
          │
          └─ 写入 KV Session
              │
              ├─ KV 写入失败 → 503 "服务异常，请稍后重试"
              │
              └─ 返回 code + 文件列表
```

### GET /api/session/{code}

```
查找 KV code:{code}
  │
  ├─ 不存在 → 404 "分享码无效，请检查后重试"
  │
  ├─ status === "expired" 或 Date.now() > expiresAt
  │   └─ 410 "文件已过期，文件保留 1 小时后自动清理"
  │
  ├─ downloadCount >= maxDownloads
  │   └─ 410 "该分享已达到下载次数上限"
  │
  └─ 正常 → 返回文件列表
```

### GET /api/download/{code}/{fileId}

```
查找 KV code:{code}
  │
  ├─ 不存在 → 404
  ├─ 已过期 → 410
  ├─ 下载次数用尽 → 410
  │
  └─ 正常
      │
      ├─ 从 R2 读取 files/{code}/{fileId}
      │   └─ R2 读取失败 → 503 "文件读取失败，请稍后重试"
      │
      ├─ downloadCount++（原子递增）
      │   └─ downloadCount >= maxDownloads → 标记 status = "expired"
      │
      └─ 返回文件流（Content-Disposition: attachment）
```

---

## 降级

| 风险 | 处理 |
|------|------|
| KV 读超时 | 返回 503 `{ code: "STORAGE_ERROR", message: "服务异常，请稍后重试" }` |
| KV 写入失败 | 重试 3 次（间隔 200ms/400ms/800ms），仍失败返回 503 |
| R2 上传失败 | 清理已上传分片，返回 503 |
| R2 下载失败 | 返回 503，记录 error 日志 |
| 分享码碰撞 | 概率 ~1/36^6，碰撞时重试生成新码（最多 3 次），仍碰撞返回 503 |
| IP 频率计数器不准（KV 最终一致）| 允许轻微超限（最终一致性容忍窗口约 10s） |

---

## 状态机

### Session 生命周期

```
uploading ──▶ ready ──▶ downloading ──▶ expired
     │              │
     └──▶ expired    └──▶ expired

触发条件：
  uploading → ready:    R2 multipart complete 全部文件成功
  uploading → expired:  Cron 发现 createdAt + TTL < now（上传中断超时）
  ready → downloading:  首次 GET /api/download/{code}/{fileId}
  downloading → expired: downloadCount >= maxDownloads
  ready/downloading → expired: Date.now() > expiresAt（Cron 清理）
```

---

## 模块划分（目录结构）

```
packages/worker/src/
├── index.ts              # Hono 入口，组装路由
├── api/
│   ├── session.api.ts    # POST /api/session/create, GET /api/session/:code
│   ├── upload.api.ts     # POST /api/upload/:code/:fileId/complete
│   └── download.api.ts   # GET /api/download/:code/:fileId
├── services/
│   ├── session.service.ts # 创建/查询 session，生成分享码
│   ├── upload.service.ts  # R2 multipart upload 管理
│   └── download.service.ts# R2 下载 + 计数管理
├── models/
│   ├── session.ts        # Session, FileInfo, SessionStatus 类型
│   └── api.ts            # 请求/响应 DTO 类型
├── middleware/
│   ├── error-handler.ts  # 全局 onError
│   ├── rate-limiter.ts   # IP 频率限制中间件
│   └── logger.ts         # 请求日志中间件
├── utils/
│   ├── code.ts           # 6 位分享码生成（排除 0/O/1/I/L）
│   ├── validation.ts     # 文件大小/数量/文件名校验
│   └── error.ts          # AppError 类定义
└── do/                   # Phase 3 引入
    └── signaling.do.ts   # WebRTC 信令 DO
```
