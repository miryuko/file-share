# 贡献指南

## 开发环境

Node.js 20+，pnpm 9+：

```bash
pnpm install
```

## 开发流程

1. 从 `main` 拉分支
2. 写代码 + 写测试
3. `pnpm lint && pnpm typecheck && pnpm test:unit` 通过后提交 commit

## Commit 规范

```
<type>(<scope>): <subject>
```

type: `feat` / `fix` / `refactor` / `test` / `docs` / `chore`
scope: `worker` / `web` / `docs` / `config`

## 测试

```bash
pnpm test:unit         # 单元测试
pnpm test:integration  # 集成测试（仅 worker）
pnpm test:e2e          # E2E 测试（仅 web）
pnpm lint              # ESLint + Oxlint
pnpm typecheck         # TypeScript 类型检查
```
