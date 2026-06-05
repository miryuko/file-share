# 管理员站点配置界面优化 (Phase 1 补全)

## 1. 场景

### 场景 1：管理员用 GB 配置单文件大小限制
- 角色：管理员（已登录）
- 前置条件：已进入管理面板→站点配置标签
- 操作：将单文件大小限制的单位从 MB 切换到 GB，输入 2
- 期望：保存后，单文件大小限制生效为 2GB（2147483648 bytes）

### 场景 2：管理员设置下载次数无限制
- 角色：管理员（已登录）
- 前置条件：已进入站点配置标签
- 操作：勾选"最大下载次数"旁的"无限制"复选框，输入框自动禁用，点击保存
- 期望：保存后，新创建的分享无下载次数限制

### 场景 3：管理员设置文本分享限制为 5000 字符
- 角色：管理员（已登录）
- 前置条件：已进入站点配置标签
- 操作：在"文本最大字符数"输入框输入 5000，点击保存
- 期望：用户发送文本时，超过 5000 字符的文本被拒绝，提示显示字符数

### 场景 4：管理员在无限制和有限制之间切换
- 角色：管理员（已登录）
- 前置条件：之前设置了"单文件大小 = 无限制"
- 操作：重新打开配置页，取消"无限制"复选框，输入 500，单位选 MB，点击保存
- 期望：单文件大小限制恢复为 500MB

### 异常场景
- 管理员输入负数 → 前端过滤，不允许输入负号
- 输入非数字内容 → 前端用 `inputmode="numeric"` + 手动过滤非数字字符
- 保存时网络异常 → 提示"保存失败，请检查网络后重试"
- 后端收到 `-1` 但某个 service 未适配 → 默认值兜底（`-1` 转为跳过校验）
- 旧配置中 `maxTextSize` 仍是字节数 → 管理面板加载时显示异常大的数值（>10M），管理员需手动调整为合理字符数

## 2. 功能边界

包含：
- Input 组件不再传递 `type="number"`，使用 `inputmode="numeric"` + 手动过滤
- 大小限制字段（maxFileSize、maxTotalSize）添加单位选择器：Bytes / KB / MB / GB
- 每个限制字段添加"无限制"复选框，勾选时值为 `-1`
- 文本分享改为按字符计数（`[...content].length`）
- `maxTextSize` 默认值从 1MB（1048576 bytes）改为 100000 字符
- 后端 `validation.ts` 和 `text.service.ts` 支持 `-1` 哨兵值
- i18n 文本大小相关文案更新

不包含：
- `ttlSeconds` 和 `rateLimitPerMinute` 的无限制支持（有安全和资源考量）
- 前端 SendView/ReceiveView 的单位选择器（用户侧不需要选择单位）
- 配置迁移自动化（需管理员手动调整 `maxTextSize`）
- Favicon / 自定义 CSS 等外观配置

## 3. 验收标准

- [ ] 管理面板配置表单中所有 Input 移除 `type="number"`，不再出现原生数字输入框样式
- [ ] 大小限制字段旁有单位选择器（Bytes/KB/MB/GB），切换后换算正确
- [ ] 加载配置时自动选择最佳单位（如 1GB 显示为 "1" + "GB"）
- [ ] "无限制"复选框勾选后输入框和单位选择器禁用，保存时发送 `-1`
- [ ] "无限制"取消勾选后输入框恢复，可正常输入
- [ ] 文本分享配置显示为"字符数"而非 MB
- [ ] 发送文本超过字符限制时提示使用字符数单位
- [ ] 后端文件校验在 `-1` 时跳过对应检查
- [ ] 后端文本校验在 `-1` 时跳过大小检查
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test:unit` 全部通过

## 4. 架构对齐

- 存储位置：KV 键 `admin:config`（扩展现有键，`-1` 为新有效值）
- 传输路径：纯 HTTP，不涉及 P2P / R2 / DO
- 与现有功能的关系：`validation.ts` 和 `text.service.ts` 已从 `admin:config` 读取限制，仅需添加 `-1` 判断
- 所属 Phase：Phase 1（MVP 补全）
- **向后不兼容**：`-1` 哨兵值不能被旧版本代码理解，需一次性部署全部 Worker 实例

---

## API 变更

### 修改：PUT /api/admin/config / GET /api/admin/config

所有限制字段新增哨兵值 `-1` 支持，`maxTextSize` 语义从字节改为字符数：

```json
{
  "maxFileSize": -1,
  "maxTotalSize": -1,
  "maxFiles": -1,
  "maxDownloads": -1,
  "maxTextSize": 100000,
  "ttlSeconds": 3600,
  "rateLimitPerMinute": 10
}
```

### 修改：GET /api/site/config

响应体中 `maxTextSize` 同样为字符数。

### 修改：POST /api/text/create

校验从字节计数改为 Unicode 码点计数（`[...content].length`），错误消息改为字符表示。

## 数据模型

### AdminConfig 注释更新

```typescript
interface AdminConfig {
  maxFileSize: number;     // -1 = 无限制，默认 100MB
  maxTotalSize: number;    // -1 = 无限制，默认 500MB
  maxFiles: number;        // -1 = 无限制，默认 20
  maxDownloads: number;    // -1 = 无限制，默认 20
  maxTextSize: number;     // -1 = 无限制，默认 100000 字符
  // 以下字段不支持 -1
  ttlSeconds: number;
  rateLimitPerMinute: number;
}
```

KV 键无变更，`admin:config` 现有键扩展。

## 处理流程

```
PUT /api/admin/config
  │
  ├─ AdminView 前端处理
  │   ├─ 加载：bytes → 自动选单位 → 渲染
  │   │   └─ 值 = -1 → 勾选"无限制" + 禁用输入框
  │   ├─ 编辑：用户输入 + 选单位 / 勾选无限制
  │   └─ 保存前转换
  │       ├─ 无限制 → -1
  │       └─ 正常 → 输入值 × 单位倍数 → bytes

POST /api/session/create
  │
  ├─ validation.ts: validateFiles(files, config)
  │   ├─ config.maxFiles !== -1 && files.length > config.maxFiles → 400
  │   ├─ config.maxTotalSize !== -1 && total > config.maxTotalSize → 413
  │   └─ config.maxFileSize !== -1 && file.size > config.maxFileSize → 413

POST /api/text/create
  │
  ├─ text.service.ts: createTextShare()
  │   ├─ charCount = [...content].length
  │   └─ maxTextSize !== -1 && charCount > maxTextSize → 400
```

## 降级

| 风险 | 处理 |
|------|------|
| Select 组件未安装 | CLI 安装 shadcn-vue select |
| 旧 maxTextSize 值与新语义冲突 | AdminView 检测 >10M 值，提示迁移 |
| `-1` 被旧版本代码读取 | `file.size > -1` 恒 true，拒绝所有文件。需一次性全量部署 |
| 前端 site config 未加载 | useSiteConfig 已有默认值兜底 |
| 单位换算精度丢失 | 内部始终存 bytes，UI 层只做展示转换 |
