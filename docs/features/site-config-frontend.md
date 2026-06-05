# 前端读取站点配置 (Phase 1 补全)

## 1. 场景

### 场景 1：访客看到管理员自定义的站点标题
- 角色：任意访客
- 前置条件：管理员已通过管理面板自定义 `siteTitle` 为 "我的文件站"
- 操作：打开网站首页
- 期望：浏览器标签页显示 "我的文件站"，且发送页标题显示 "我的文件站"

### 场景 2：访客看到自定义页脚公告
- 角色：任意访客
- 前置条件：管理员已设置 `footerNotice` 为 "本站仅用于临时文件传输，请勿上传敏感信息"
- 操作：打开任意页面
- 期望：页脚显示该自定义公告，而非内置 i18n 默认文案

### 场景 3：发送者受到管理员配置的传输限制
- 角色：发送方
- 前置条件：管理员已将 `maxFileSize` 修改为 200MB、`maxTotalSize` 修改为 1GB
- 操作：选择文件准备发送
- 期望：前端客户端校验使用管理员的限制值（200MB/1GB），超限文件被拒绝并提示正确限额

### 场景 4：配置未加载时的降级行为
- 角色：任意访客
- 前置条件：`GET /api/site/config` 请求超时或网络异常
- 操作：打开网站首页
- 期望：前端使用内置默认值（与 `DEFAULT_ADMIN_CONFIG` 一致），页面功能正常可用

### 异常场景
- 站点配置 API 返回 500 → 静默降级为内置默认值，页面标题显示 "File Share"，页脚显示 i18n 默认文案，不影响文件传输功能
- 站点配置 JSON 解析失败 → 静默降级为内置默认值，控制台打印 warn，不阻塞页面渲染
- 管理员将 `siteTitle` 设为空 → 前端回退为 i18n `app.title` 默认值（"File Share"）
- 管理员将限制设为 0 或负数（无效值）→ 前端忽略无效配置值，使用内置默认值兜底

## 2. 功能边界

包含：
- 前端 `App.vue` 启动时拉取 `GET /api/site/config` 获取站点配置
- 用站点配置动态设置 `document.title`
- 页脚优先使用 `footerNotice`，为空时回退 i18n 默认文案
- 发送页 `SendView.vue` 用站点配置的限制字段替换硬编码常量（`MAX_FILE_SIZE`、`MAX_TOTAL_SIZE`、`MAX_FILES`、`MAX_TEXT_SIZE`）
- 发送页限制提示文案参数化，显示实际配置值
- 后端 `SiteConfig` 接口扩展，包含限制字段（供前端校验和展示）
- `api.ts` 新增 `getSiteConfig()` 函数和 `SiteConfig` 类型
- 新建 `useSiteConfig` composable，模块级缓存，避免重复请求

不包含：
- 配置实时推送（配置仅在页面刷新时重新加载）
- 管理员面板本身的改动（已是功能完整的管理面板）
- 后端校验逻辑改动（后端已从 `admin:config` 读取限制，本次只改前端读取链路）
- 历史配置版本管理

## 3. 验收标准

- [ ] 管理员修改 `siteTitle` 后，访客刷新页面，浏览器标签页标题更新为自定义标题
- [ ] 管理员清空 `siteTitle` 后，访客页面标题显示默认 "File Share"（i18n 兜底）
- [ ] 管理员设置 `footerNotice` 后，访客页面页脚显示自定义公告
- [ ] 管理员清空 `footerNotice` 后，访客页面页脚显示 i18n 默认文案
- [ ] 管理员修改 `maxFileSize` 为 200MB 后，访客尝试上传 150MB 文件时客户端校验通过，上传 250MB 文件时被拒绝并提示 "超过 200MB 限制"
- [ ] `GET /api/site/config` 返回的新字段（`maxFileSize`、`maxTotalSize`、`maxFiles`、`maxTextSize`）完整且与 admin 配置一致
- [ ] 网络断开时前端仍可正常加载（使用内置默认值），不出现白屏或阻塞
- [ ] `pnpm typecheck` + `pnpm lint` 零错误
- [ ] 现有单元测试全部通过

## 4. 架构对齐

- 存储位置：KV 键 `admin:config`（仅读取，不写入），`GET /api/site/config` 公开接口
- 传输路径：纯 HTTP GET，不涉及 P2P / R2 / DO
- 与现有功能的关系：扩展到现有 `SiteConfig` 接口；前端新增 `useSiteConfig` composable，遵循现有 composable 模式（`useFileUpload`、`useWebRTC`）
- 所属 Phase：Phase 1（MVP 补全 — 虽然 admin-enhancement 是 Phase 2，但前端读取配置是 Phase 1 就应有的基础能力）

---

## API 变更

### 修改：GET /api/site/config
- 认证：匿名（公开，不变）
- 200 响应体新增字段：
  ```json
  {
    "siteTitle": "File Share",
    "siteDescription": "",
    "footerNotice": "",
    "maxFileSize": 104857600,
    "maxTotalSize": 524288000,
    "maxFiles": 20,
    "maxTextSize": 1048576
  }
  ```
- 向后兼容：前端用可选字段 + 默认值兜底

## 数据模型

### SiteConfig 扩展

```typescript
interface SiteConfig {
  // 现有字段（不变）
  siteTitle: string;
  siteDescription: string;
  footerNotice: string;
  // 新增 — 前端校验所需
  maxFileSize: number;
  maxTotalSize: number;
  maxFiles: number;
  maxTextSize: number;
}
```

KV 无变更。`admin:config` 已包含这些字段，`getSiteConfig()` 仅多返回 4 个字段。

## 处理流程

```
前端 App.vue onMounted
  │
  ├─ useSiteConfig().load()
  │   ├─ 已缓存 → 直接返回
  │   └─ 未缓存 → fetch GET /api/site/config
  │       ├─ 成功 → 缓存 config，resolve
  │       └─ 失败 → 使用内置默认值，打印 warn，不阻塞页面
  │
  ├─ watch config.siteTitle
  │   ├─ 有值 → document.title = config.siteTitle
  │   └─ 空 → document.title = i18n app.title ("File Share")
  │
  └─ 页脚渲染
      ├─ config.footerNotice 非空 → 显示 config.footerNotice
      └─ config.footerNotice 为空 → 显示 i18n app.footer.notice

SendView.vue validateFiles()
  │
  ├─ useSiteConfig().config 已加载
  │   ├─ maxFileSize 有效 → 用配置值校验
  │   └─ 未加载/无效 → 用 DEFAULT_ADMIN_CONFIG 值兜底
  │
  └─ 校验通过 → 调用 uploadFiles()
```

## 降级

| 风险 | 处理 |
|------|------|
| GET /api/site/config 网络超时 | 前端 catch 后使用 `DEFAULT_ADMIN_CONFIG` 默认值，打印 `console.warn("site config unavailable, using defaults")` |
| 响应 JSON 解析失败 | try-catch，降级为默认值 |
| 配置中某字段为 undefined/null | 每个字段读取时用 `??` 加默认值，确保 UI 不崩溃 |
| 限制字段为 0 或负数 | useSiteConfig 中做合法性校验，无效值替换为默认值 |
| KV 读超时 | `getAdminConfig()` 已返回默认值，前端收到默认值正常渲染 |
