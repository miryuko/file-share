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

### 设置生产密钥

```sh
# 设置管理员 JWT 签名密钥
npx wrangler secret put ADMIN_JWT_SECRET --env production
# 输入一个随机长字符串（推荐 64 字符以上）
```

### 部署

```sh
# 部署到生产环境
pnpm build:worker --env production
# 或
cd packages/worker && npx wrangler deploy --env production
```

## 首次管理员登录

1. 访问 `https://your-domain/admin`
2. 使用默认密码 `admin123` 登录
3. 首次登录后密码会被哈希存储
4. 建议通过 API 修改默认密码

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
