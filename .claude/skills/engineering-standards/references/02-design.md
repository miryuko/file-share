# 设计指南

## 概要设计

需求文档完成后，在同一份文件里追加设计内容。关注"模块怎么划分、API 长什么样、数据怎么存"，不写实现细节。

### API 变更

每个接口必须按以下格式定义：

```markdown
## API 变更

### POST /api/text/create
- 认证：匿名
- Body: `{ content: string, expiry?: number }`
- 200: `{ code: string, expiresAt: number }`
- 400: 内容为空或超长（>1MB）
- 429: 同一 IP 超过频率限制

### GET /api/text/{code}
- 认证：匿名
- 200: `{ content: string, expiresAt: number }`
- 404: 分享码不存在
- 410: 内容已过期
```

WebSocket 消息同样定义：type、方向（C→S / S→C）、payload、触发时机。

### 数据模型

```markdown
## 数据模型

KV 新增键空间 `text:`：
  text:{code} → {
    content: string,
    expiresAt: number,
    createdAt: number,
    maxViews: number,
    viewCount: number
  }

与现有 Session（code: 前缀）的关系：独立键空间，仅共享 Cron cleanup 的扫描逻辑。
```

必须说明：数据存在哪里（KV/R2/DO）、键名规则、和现有数据的关联（有则写，无则写"独立"）。

### 核心流程

用决策树风格描述路径选择逻辑：

```markdown
## 处理流程

GET /api/text/{code}
  │
  ├─ KV 中不存在 text:{code}
  │   └─ 404 "分享码无效"
  │
  ├─ Date.now() > expiresAt
  │   └─ 删除 KV → 410 "内容已过期"
  │
  └─ 正常
      └─ viewCount++，返回 content
          ├─ viewCount >= maxViews → 立即删除 KV（阅后即焚）
          └─ 否则保留
```

### 风险与降级

```markdown
## 降级

| 风险 | 处理 |
|------|------|
| KV 读超时 | 返回 503，提示重试，不吞异常 |
| KV 写入失败 | 重试 3 次，仍失败返回 503 |
| 分享码碰撞 | 概率极低（36^6 组合），碰撞时重试一次生成新码 |
```

不用"优雅降级"这种空话——每条写明具体返回什么状态码和提示。

## 详细设计

### 状态机

本项目有两个核心状态机，涉及状态变更时必须更新：

**Session 生命周期：**

```
uploading ──▶ ready ──▶ downloading ──▶ completed
     │              │
     └──▶ expired   └──▶ expired

触发条件：
  uploading → ready:    R2 multipart complete 成功
  uploading → expired:  Cron 发现 createdAt + TTL < now
  ready → downloading:  首次 GET /api/download/{code}/{fileId}
  downloading → completed: 全部下载完成 或 达到 maxDownloads
  downloading → expired: 同上行过期规则
```

**信令 DO 连接状态：**

```
waiting ──▶ connected ──▶ transferring ──▶ completed
    │           │
    └──▶ expired│
                └──▶ fallback (NAT 穿透失败)

触发条件：
  waiting → connected: 双方 peer 都已 join
  waiting → expired:   超时（24h）无第二个 peer
  connected → transferring: WebRTC Data Channel 建立
  connected → fallback: ICE 超时（30s）→ 通知双方降级到 R2
  transferring → completed: Data Channel 传完最后一块
```

### 函数 JSDoc

`services/` 层的每个公开函数必须写 JSDoc。不另建函数说明文档，代码即文档。

```ts
/**
 * 初始化 R2 分片上传并创建传输会话
 *
 * 调用链：校验参数 → 生成 6 位码 → R2 createMultipartUpload
 *        → 写入 KV Session → 返回 uploadId 和 chunkUrls
 *
 * @throws {AppError} VALIDATION_ERROR — 文件大小超限或文件名为空
 * @throws {AppError} RATE_LIMIT — 该 IP 超过 admin:config 中的限制频率
 * @throws {AppError} STORAGE_ERROR — KV 写入失败（重试 3 次后抛出）
 */
async function createSession(
  input: CreateSessionInput,
  env: Env,
  clientIP: string
): Promise<CreateSessionOutput> {
```

必须写 @throws——调用方需要知道这个函数在什么情况下会失败，以及失败后该怎么做。

## 完成标准

### 概要设计
- [ ] API 的请求/响应/错误码已完整定义，前端可据此并行开发
- [ ] 数据模型明确了存储介质和键名规则
- [ ] 核心流程的分支逻辑用决策树描述
- [ ] 降级方案对应到具体的 HTTP 状态码和用户提示

### 详细设计
- [ ] 涉及的状态机已更新，转移条件和触发时机明确
- [ ] 新增 service 函数的 JSDoc 写了 @throws
- [ ] 模块划分符合分层死规则（api→services→models）
