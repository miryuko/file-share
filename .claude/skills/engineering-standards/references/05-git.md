# Git 规范（AI 用）

## 何时提交

完成一个独立的功能单元后自动提交。判断标准：

| 情况 | 是否提交 |
|------|---------|
| 完整功能实现完成 + 测试通过 | ✅ 提交 |
| 单个 service/组件完成 + 对应测试通过 | ✅ 提交 |
| bug 修复完成 + 回归测试通过 | ✅ 提交 |
| 重构完成（行为不变）+ 现有测试全过 | ✅ 提交 |
| 功能只写了一半 | ❌ 不提交 |
| 测试未通过 | ❌ 不提交 |
| 有 lint/typecheck 错误 | ❌ 不提交 |

一次提交应包含一个完整、独立的变更。不要攒一堆无关修改一起提交。

## 提交前检查

提交前必须按顺序执行并通过：

1. 代码审查 — 使用 `/code-review` 检查当前变更，修复发现的问题
2. 自动化检查：

```
pnpm lint && pnpm typecheck && pnpm test:unit
```

## Commit Message 格式

```
<type>(<scope>): <subject>
```

### type 选择

| type | 什么时候用 |
|------|-----------|
| `feat` | 用户可感知的新功能 |
| `fix` | bug 修复 |
| `refactor` | 改结构不改行为 |
| `test` | 纯测试补充或修改 |
| `docs` | 文档变更 |
| `chore` | 构建、依赖、工具配置 |

### scope 选择

根据修改的文件路径决定：

| 路径 | scope |
|------|-------|
| `packages/worker/**` | `worker` |
| `packages/web/**` | `web` |
| `.claude/**`, `docs/**`, `*.md` | `docs` |
| `package.json`, 根目录配置文件 | `config` |
| 同时修改 worker + web | 拆成两次提交，各自带正确的 scope |

### subject 规则

- 英文，小写开头
- 用动词原形（add, fix, update, remove, refactor）
- 一句话说清楚做了什么
- 不超过 72 个字符
- 举例：`feat(worker): add multipart upload support`

## 提交方式

```bash
git add <changed-files>
git commit -m "feat(worker): add multipart upload support"
```

## 禁止事项

- ❌ 不要 `git commit --amend`（除非还没 push 且需要修正当前这个提交的 message）
- ❌ 不要 `git push --force`
- ❌ 不要 `git commit --no-verify`（跳过 hooks）
- ❌ 不要提交 `node_modules`、`.env`、构建产物
- ❌ 不要在 commit message 中附加 AI 署名（如 `Co-Authored-By: Claude`）。这是用户的项目，不是 AI 的项目
- ❌ 不要一次提交混合多个不相关的功能
