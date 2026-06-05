# 编码规范

## 分层死规则

本项目只有两层：**api（薄）→ services（厚）**。

```
api/ 可以做：
  ✅ import services 里的函数
  ✅ import models 里的类型
  ✅ 调用 c.req.param() / c.req.json() 做参数绑定
  ✅ 调用 c.json() 返回响应

api/ 不能做：
  ❌ 直接调 R2 SDK、KV API、DO stub
  ❌ 写超过 3 行的 if/switch 业务判断——提取到 service

services/ 可以做：
  ✅ import models 里的类型
  ✅ 调用 R2、KV、DO、fetch 等平台 API
  ✅ 抛 AppError

services/ 不能做：
  ❌ import Hono 的任何东西
  ❌ 读 c.req 或构造 c.json
```

**为什么：** 换框架只改 api/，换存储只改 services/。两层各管各的，互不污染。

## 路由函数模板

```ts
// 每个路由函数严格按这个三行模式写：
app.post("/api/session/create", async (c) => {
  // 1. 取参数
  const body = await c.req.json<CreateSessionRequest>();
  const clientIP = c.req.header("CF-Connecting-IP") || "unknown";

  // 2. 调 service
  const result = await createSession(body, c.env, clientIP);

  // 3. 返回
  return c.json(result, 201);
});
```

不允许在路由里写超过这个模式以外的逻辑。如果"取参数"那一步需要校验，写一个 `validate` 工具函数调用，不能直接在路由里写 if/throw。

## 错误处理

```ts
// 一个自定义错误类走天下：
class AppError extends Error {
  constructor(
    public code: string,    // 机器可读，前端据此做分支逻辑
    public status: number,  // HTTP 状态码
    message: string         // 用户可读（中文 OK）
  ) {
    super(message);
    this.name = "AppError";
  }
}

// services 层抛出：
throw new AppError("SESSION_EXPIRED", 410, "文件已过期，请重新上传");
throw new AppError("FILE_TOO_LARGE", 413, `文件 ${size}MB 超过 ${limit}MB 限制`);

// 全局统一捕获——在 middleware/error-handler.ts：
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ code: err.code, message: err.message }, err.status);
  }
  // 未预期的错误：记录完整现场，对用户模糊化
  console.error(JSON.stringify({
    event: "unhandled",
    error: err.message,
    stack: err.stack,
    url: c.req.url,
    method: c.req.method,
  }));
  return c.json(
    { code: "INTERNAL", message: "服务异常，请稍后重试" },
    500
  );
});
```

**原则：**
- API 层不吞异常。让异常冒泡到 `onError`，统一序列化。
- 永远不向用户暴露 `err.message`（未预期的）、堆栈、内部路径。
- service 层抛 AppError 时，message 必须是用户能看懂的。

## 日志

```ts
// 全项目统一使用结构化 JSON——wrangler tail 和 Logpush 直接解析
console.log(JSON.stringify({
  event: "session.created",
  code: session.code,
  fileCount: session.files.length,
  totalSize: session.totalSize,
}));

console.warn(JSON.stringify({
  event: "nat.traversal.failed",
  code,
  fallback: "r2",
}));

console.error(JSON.stringify({
  event: "r2.write.failed",
  code,
  r2Key,
  error: err.message,
}));
```

| 级别 | 什么时候用 | 示例 |
|------|-----------|------|
| `log` | 正常业务流程的关键节点 | 会话创建、分片上传完成、P2P 连接建立 |
| `warn` | 预期内的异常 | 速率限制触发、NAT 穿透失败降级、分享码碰撞重试 |
| `error` | 需要告警的故障 | R2 操作失败、DO 不可达、未捕获异常 |

每条约等于一行 JSON。不在循环里打 event 相同的日志。

## 命名

| 类别 | 规则 | 正确 | 错误 |
|------|------|------|------|
| Worker 源文件 | kebab-case | `session.service.ts` | `SessionService.ts` |
| Vue 组件文件 | PascalCase | `FileUploader.vue` | `fileUploader.vue` |
| 类 / DO | PascalCase | `SignalingDO` | `signalingDO` |
| 函数 / 变量 | camelCase | `createSession` | `create_session` |
| 常量 / 环境变量 | UPPER_SNAKE_CASE | `MAX_CHUNK_SIZE` | `maxChunkSize` |
| KV 键 | `prefix:id` | `code:A3K9M2`, `admin:config` | 无前缀的裸键 |
| R2 路径 | `type/code/fileId` | `files/A3K9M2/file_0` | 自定义路径 |
| API 路由 | kebab-case | `/api/upload/complete` | `/api/uploadComplete` |
| 布尔变量 | `is/has/can/should` 前缀 | `isUploading`, `hasExpired` | `uploading`, `expired` |

KV 键必须加前缀——方便 `kv.list({ prefix: "code:" })` 列出所有活跃 session，也方便 Cron cleanup 按前缀扫描。

## TypeScript

三条铁律：

1. `strict: true`，不允许 `any`。除非有注释解释为什么 `unknown` 不适用。
2. 能用联合类型就不用 enum。联合类型运行时零开销，switch 有 exhaustiveness check。

   ```ts
   // ✅ 联合类型
   type SessionStatus = "uploading" | "ready" | "downloading" | "expired";

   // ❌ enum
   enum SessionStatus { Uploading, Ready, Downloading, Expired }
   ```

3. API 的 request/response 必须有显式类型，类型定义放在 `models/api.ts`。

## 导入顺序

四组，用空行分隔——ESLint `import/order` 规则自动校验：

```ts
// 1. 框架 / 平台
import { Hono } from "hono";

// 2. 内部模块
import { createSession } from "../services/session.service";

// 3. 类型（type 关键字，编译后消除）
import type { Session, CreateSessionRequest } from "../models/session";

// 4. 工具
import { validateFileSize } from "../utils/validation";
```

## 完成标准

- [ ] `tsc --noEmit` 零错误（strict mode）
- [ ] ESLint 零警告
- [ ] api/ 层无业务逻辑，services/ 层无 Hono 引用
- [ ] 新增 service 函数有 JSDoc，写了 @throws
- [ ] 关键节点有结构化日志
- [ ] 无 `any`（除非有注释）
- [ ] 无魔法数字——所有阈值从 `admin:config` 读取或定义为具名常量
- [ ] 每个函数不超过 50 行（工具函数不超过 30 行）
