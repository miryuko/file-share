# 管理员功能增强 (Phase 2)

## 1. 场景

### 场景 1：管理员修改站点配置
- 角色：管理员（已登录）
- 前置条件：已进入管理面板
- 操作：切换到"站点配置"标签，修改上传限制、文本大小限制、站点标题等参数，点击保存
- 期望：提示"配置已保存"，新创建的分享立即使用新配置

### 场景 2：管理员修改密码
- 角色：管理员（已登录）
- 前置条件：已进入管理面板
- 操作：切换到"安全设置"标签，输入当前密码、新密码、确认新密码，点击修改
- 期望：提示"密码已修改"，下次登录需使用新密码

### 场景 3：首次使用默认密码登录
- 角色：管理员
- 前置条件：站点刚部署，尚未修改过默认密码
- 操作：使用默认密码 123456 登录（可通过 ADMIN_DEFAULT_PASSWORD 环境变量配置）
- 期望：成功登录后，强制进入安全设置标签页，提示"您正在使用默认密码！"，禁止访问其他功能直到修改密码

### 场景 4：公众页面读取站点外观配置
- 角色：任意访客
- 前置条件：管理员已自定义站点标题
- 操作：打开网站首页
- 期望：浏览器标签页显示管理员自定义的标题（而非默认的"File Share"）

### 异常场景
- 修改密码时当前密码错误 → 提示"当前密码错误"
- 修改密码时新密码与确认密码不一致 → 提示"两次输入的密码不一致"
- 修改密码时新密码与当前密码相同 → 提示"新密码不能与当前密码相同"
- 修改密码时新密码为空 → 提示"新密码不能为空"
- 保存配置时网络异常 → 提示"保存失败，请检查网络后重试"
- 登录被锁定 → 提示"登录尝试过多，请 X 分钟后重试"（显示剩余分钟数）
- Token 过期后操作 → 返回 401，前端跳转到登录页
- 配置 JSON 损坏 → 静默回退到默认值，不影响正常使用

## 2. 功能边界

包含：
- 管理面板多标签布局（会话管理 / 站点配置 / 安全设置）
- 站点配置编辑表单（上传限制、文本限制、外观设置）
- 公开站点配置接口（供首页读取标题等外观参数）
- 文本分享大小纳入管理员配置管理
- 管理员密码修改
- 默认密码检测与提示
- 登录失败时展示具体错误信息

不包含：
- 多管理员 / 角色权限
- 图形化统计仪表板
- 审计日志
- 自定义 CSS / 自定义域名
- Favicon 文件上传（URL 引用仍可支持，但暂不实现）
- 密码重置（无邮箱系统）

## 3. 验收标准

- [ ] 管理员登录后看到三个标签：会话管理、站点配置、安全设置
- [ ] 站点配置标签下可编辑 maxFileSize、maxTotalSize、maxFiles、ttlSeconds、maxDownloads、rateLimitPerMinute、maxTextSize、siteTitle、siteDescription、footerNotice，点击保存后成功写入
- [ ] 修改 maxFileSize 后，新上传的文件按新限制校验
- [ ] 修改 maxTextSize 后，新的文本分享按新限制校验
- [ ] 修改 siteTitle 后，首页浏览器标题栏显示新标题
- [ ] GET /api/site/config 无需认证即可返回站点外观配置
- [ ] 安全设置标签下可修改密码，当前密码错误时提示明确
- [ ] 使用默认密码登录后，安全设置标签显示警告提示
- [ ] 登录失败时前端展示具体错误原因（密码错误/账户锁定及剩余时间）
- [ ] 11 种语言的 i18n 翻译完整

## 4. 架构对齐

- 存储位置：KV 键 `admin:config`（扩展现有键，向后兼容）、`admin:password`（现有，不变）、`admin:login_lock`（现有，不变）
- 传输路径：无 P2P 和 R2 涉及，纯 HTTP + KV
- 与现有功能的关系：text.service.ts 改为从 `getAdminConfig()` 读取 maxTextSize；validation.ts 已接受 config 参数无需改动
- 所属 Phase：Phase 2

---

## API 变更

### 新增：GET /api/site/config
- 认证：匿名（公开）
- 200: `{ siteTitle: string, siteDescription: string, footerNotice: string }`
- 用途：前端首页读取站点外观配置，无需管理员认证

### 新增：PUT /api/admin/password
- 认证：Bearer JWT
- Body: `{ currentPassword: string, newPassword: string }`
- 200: `{ success: true }`
- 400: `INVALID_PASSWORD` — 当前密码错误
- 400: `SAME_PASSWORD` — 新密码与当前密码相同
- 400: `EMPTY_PASSWORD` — 新密码为空

### 新增：GET /api/admin/check-default
- 认证：Bearer JWT
- 200: `{ isDefault: boolean }`
- 用途：前端判断是否使用默认密码，展示安全警告

### 修改：POST /api/admin/login
- 200 新增字段：`{ token: string, needsPasswordChange: boolean }`
- `needsPasswordChange` 为 `true` 时前端强制跳转安全设置标签，禁止访问其他功能

### 环境变量
- `ADMIN_DEFAULT_PASSWORD`：初始默认密码，未配置时默认为 `"123456"`
- 在 `wrangler.jsonc` 的 `vars` 中配置（开发环境），生产环境使用 `wrangler secret put` 设置
- 响应体新增字段：`maxTextSize`、`siteTitle`、`siteDescription`、`footerNotice`

### 修改：PUT /api/admin/config
- 请求体新增可选字段：同上

## 数据模型

### AdminConfig 扩展

```typescript
interface AdminConfig {
  // 现有字段（不变）
  maxFileSize: number;          // 默认 100MB
  maxTotalSize: number;         // 默认 500MB
  maxFiles: number;             // 默认 20
  ttlSeconds: number;           // 默认 3600
  maxDownloads: number;         // 默认 20
  rateLimitPerMinute: number;   // 默认 10

  // 新增 — 文本限制
  maxTextSize: number;          // 默认 1MB

  // 新增 — 站点外观
  siteTitle: string;            // 默认 "File Share"
  siteDescription: string;      // 默认 ""
  footerNotice: string;         // 默认 ""（空=使用内置 i18n）
}
```

### SiteConfig（从 AdminConfig 提取的公开子集）

```typescript
interface SiteConfig {
  siteTitle: string;
  siteDescription: string;
  footerNotice: string;
}
```

KV 新增键空间：无。所有配置仍存储在现有 `admin:config` 键中。

## 处理流程

```
PUT /api/admin/config
  │
  ├─ requireAdmin ─▶ 401 (未认证 / token 过期)
  │
  └─ updateAdminConfig(updates)
      │
      ├─ getAdminConfig() 读 KV admin:config
      │   ├─ 键不存在 → 返回 DEFAULT_ADMIN_CONFIG
      │   └─ JSON 损坏 → 返回 DEFAULT_ADMIN_CONFIG（静默降级）
      │
      ├─ { ...current, ...updates } 浅合并
      ├─ KV.put("admin:config", JSON.stringify(merged))
      └─ 200 返回 merged


PUT /api/admin/password
  │
  ├─ requireAdmin ─▶ 401
  │
  ├─ newPassword 为空 → 400 EMPTY_PASSWORD
  ├─ 读 KV admin:password
  ├─ verifyPassword(currentPassword, storedHash) 失败 → 400 INVALID_PASSWORD
  ├─ currentPassword === newPassword → 400 SAME_PASSWORD
  ├─ hashPassword(newPassword) → KV.put("admin:password", newHash)
  └─ 200 { success: true }


GET /api/site/config
  │
  ├─ getAdminConfig() 读 KV admin:config
  └─ 200 { siteTitle, siteDescription, footerNotice }  ← 仅提取外观字段
```

## 降级

| 风险 | 处理 |
|------|------|
| KV 读超时 | getAdminConfig 返回默认值，前端使用默认外观 |
| KV 写入失败（配置） | 返回 503 STORAGE_ERROR，前端提示"保存失败，请重试" |
| KV 写入失败（密码） | 返回 503 STORAGE_ERROR，前端提示"修改失败，请重试" |
| admin:config JSON 损坏 | 静默降级为 DEFAULT_ADMIN_CONFIG，打印 warn 日志 |
| 旧配置缺少新字段 | getAdminConfig 用 DEFAULT_ADMIN_CONFIG 做 spread 兜底（现有逻辑已支持） |
