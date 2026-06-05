# 管理员面板 (Phase 2)

## 为什么做

站点需要人为管理能力：查看当前活跃传输、修改配置参数、强制终止异常传输。不做的后果：无法应对滥用、无法动态调整限制参数。

## 场景

### 场景 1：管理员登录
- 角色：管理员
- 前置条件：知道管理员密码
- 操作：访问 /admin，输入密码，点击登录
- 期望：获得 JWT token，进入管理面板

### 场景 2：查看活跃传输
- 角色：管理员（已登录）
- 操作：进入活跃传输列表页
- 期望：看到所有 status ≠ expired 的 session，包含分享码、文件数、创建时间、IP

### 场景 3：修改站点配置
- 角色：管理员（已登录）
- 操作：修改文件大小限制等参数，保存
- 期望：新创建的 session 使用新配置

### 异常场景
- 密码错误 → 提示"密码错误，请重试"（3 次后锁定 5 分钟）
- Token 过期 → 提示"登录已过期，请重新登录"
- 无 Token 访问受保护路由 → 返回 401

## 功能边界

包含：密码登录、JWT 认证、配置读写、活跃 session 列表
不包含：多管理员、图形化统计仪表板、审计日志、密码重置

## 架构对齐
- 存储：`admin:config` KV 键，`admin:password` KV 键（bcrypt hash）
- JWT secret 从环境变量 `ADMIN_JWT_SECRET` 读取
- API 路由：`POST /api/admin/login`, `GET /api/admin/sessions`, `GET/PUT /api/admin/config`
- 所属 Phase：Phase 2

## API 变更

### POST /api/admin/login
- Body: `{ password: string }`
- 200: `{ token: string }`
- 401: 密码错误

### GET /api/admin/config
- 认证：Bearer JWT
- 200: `AdminConfig`
- 401: 未认证

### PUT /api/admin/config
- 认证：Bearer JWT
- Body: `Partial<AdminConfig>`
- 200: `AdminConfig`
- 401: 未认证

### GET /api/admin/sessions
- 认证：Bearer JWT
- 200: `{ sessions: Session[], total: number }`
- 401: 未认证

### DELETE /api/admin/sessions/:code
- 认证：Bearer JWT
- 200: `{ code: string, status: "terminated" }`
- 401: 未认证
- 404: 会话不存在
