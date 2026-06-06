# 部署指南

## 前置准备

1. [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（付费计划，Workers Paid）
2. 安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
3. 登录：`npx wrangler login`

## 创建资源

### R2 存储桶

```sh
npx wrangler r2 bucket create file-share-files
```

### KV 命名空间

```sh
npx wrangler kv namespace create file-share-kv
npx wrangler kv namespace create file-share-kv --preview
```

将输出的 ID 填入 `wrangler.jsonc` 的 `kv_namespaces` 配置中。

### 设置生产密钥（一次性）

Secrets 是持久化的加密环境变量，设置后永久保存在 Cloudflare，不会随代码部署被覆盖。

```sh
# 仅需执行一次：
npx wrangler secret put ADMIN_JWT_SECRET
# 输入一个随机长字符串（推荐 64 字符以上）

npx wrangler secret put ADMIN_DEFAULT_PASSWORD
# 输入管理员默认密码
```

> [!IMPORTANT]
> `wrangler.jsonc` 已配置 `secrets.required`，部署前必须已设置以上两个密钥，
> 否则 `wrangler deploy` 会报错并列出缺失的密钥。
>
> Secrets 只需设置一次，CI 部署不会重新上传它们。
>
> 如需更新 secret 值：`npx wrangler secret put <KEY>` 再次执行即可覆盖。

### 从 vars 迁移到 secrets（仅首次需要）

如果 Worker 之前用 `vars` 配置了同名环境变量，需要先清除旧的 vars 绑定：

```sh
# 1. 临时注释掉 wrangler.jsonc 中的 "secrets" 块
# 2. 部署一次，清除旧的 vars 绑定
npx wrangler deploy

# 3. 设置 secrets
npx wrangler secret put ADMIN_JWT_SECRET
npx wrangler secret put ADMIN_DEFAULT_PASSWORD

# 4. 恢复 wrangler.jsonc 中的 "secrets" 块
# 5. 再次部署，验证 secrets.required 通过
npx wrangler deploy
```

### 部署

```sh
# 部署到生产环境
pnpm build:worker --env production
# 或
cd packages/worker && npx wrangler deploy --env production
```

## 本地开发

本地开发使用 `.dev.vars` 文件存放密钥（已加入 `.gitignore`，不会提交到仓库）：

```sh
# 复制模板文件
cp packages/worker/.dev.vars.example packages/worker/.dev.vars

# 编辑 .dev.vars，填入本地开发用的值
# 模板中的默认值可直接用于本地开发
```

## 首次管理员登录

1. 访问 `https://your-domain/admin`
2. 使用 `ADMIN_DEFAULT_PASSWORD` 设置的值（默认 `123456`）登录
3. 首次登录后密码会被哈希存储
4. 建议立即通过管理面板修改密码

## 环境说明

| 环境 | 命令 | 用途 |
|------|------|------|
| dev | `pnpm dev:worker` | 本地开发 |
| preview | `pnpm deploy:preview` | 预览测试 |
| production | `pnpm deploy:prod` | 生产环境 |

## 资源清理

过期文件和文本由 Cron Trigger 自动清理（每 5 分钟一次）。KV 中的 session 过期后自动删除，R2 文件同步删除。

## 监控

- Workers 日志：`npx wrangler tail`
- Cloudflare Dashboard → Workers & Pages → file-share → Metrics
