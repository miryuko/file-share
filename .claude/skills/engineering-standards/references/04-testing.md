# 测试指南

## 测试目录结构

测试文件放在顶层 `tests/` 目录，不与 `src/` 混放：

```
packages/worker/
├── src/
│   ├── api/
│   ├── services/
│   └── ...
└── tests/
    ├── unit/
    │   ├── services/
    │   │   └── session.service.test.ts
    │   ├── utils/
    │   │   └── code.test.ts
    │   └── middleware/
    │       └── auth.test.ts
    └── integration/
        ├── upload-flow.test.ts
        ├── p2p-fallback.test.ts
        └── session-lifecycle.test.ts

packages/web/
├── src/
│   ├── components/
│   ├── composables/
│   └── ...
└── tests/
    ├── unit/
    │   ├── composables/
    │   │   └── useFileUpload.test.ts
    │   └── lib/
    │       └── api.test.ts
    └── e2e/
        ├── send-file.spec.ts
        ├── receive-file.spec.ts
        └── admin.spec.ts
```

测试目录结构镜像 `src/` 结构。找到 `src/services/session.service.ts` 的测试就去 `tests/unit/services/session.service.test.ts`。

## 测试金字塔

```
        ┌─────┐
        │ E2E │  ← Playwright，3 条核心用户路径
        ├─────┤
        │ 集成 │  ← Miniflare，3 条全链路 + 边界
        ├──────┤
        │ 单元 │  ← Vitest，每个 service/util 函数
        └──────┘
```

| 层级 | 工具 | 覆盖对象 | 数量策略 |
|------|------|---------|---------|
| 单元 | Vitest | services/ utils/ middleware/ composables | 每个公开函数 3 类 case |
| 集成 | Vitest + Miniflare | 全链路（多模块协同） | 3 条核心链路 + 边界 |
| E2E | Playwright | 真实浏览器用户操作 | 只测 3 条路径 |

## 单元测试

### 每个测试三种 case

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Miniflare } from "miniflare";

let mf: Miniflare;

beforeEach(async () => {
  mf = new Miniflare({
    r2Buckets: ["FILE_BUCKET"],
    kvNamespaces: ["FILE_KV"],
    modules: true,
    scriptPath: "./src/index.ts",
  });
});

afterEach(async () => {
  await mf.dispose(); // 每个测试后重置，保证隔离
});

describe("createSession", () => {
  // 1. 正常路径
  it("给定合法文件名和大小，返回 6 位码和 uploadId", async () => {
    const res = await mf.dispatchFetch(
      "https://localhost/api/session/create",
      {
        method: "POST",
        body: JSON.stringify({
          filename: "test.png",
          size: 1024,
          totalChunks: 1,
        }),
      }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toMatch(/^[A-Z2-9]{6}$/); // 不含 0/O/1/I/L
    expect(body.uploadId).toBeTruthy();
  });

  // 2. 边界
  it("文件大小为 0 时仍能创建会话", async () => { ... });
  it("文件名 255 字符时不报错", async () => { ... });

  // 3. 异常
  it("文件超 maxFileSize 时返回 413", async () => { ... });
  it("IP 超过频率限制时返回 429", async () => { ... });
  it("R2 不可用时返回 503", async () => { ... });
});
```

**命名格式：** `给定X，当Y时，应Z`。

### Mock 策略

| 依赖 | Mock 方式 |
|------|---------|
| R2 / KV / DO | Miniflare（模拟完整 CF 环境） |
| 时间 | `vi.useFakeTimers()` |
| WebSocket | Miniflare DO stub + 手动触发消息 |
| fetch（外部 API） | `vi.fn()` mock |

**原则：单元测试不发起任何真实网络请求。**

### 覆盖率底线

| 目录 | 行覆盖率 | 为什么是这个数 |
|------|---------|---------------|
| `services/` | ≥ 80% | 所有传输路径的分支逻辑在这里 |
| `utils/` | ≥ 90% | 纯函数，不高说不过去 |
| `api/` | ≥ 60% | 薄层，主要逻辑 service 已测 |
| `middleware/` | ≥ 70% | 逻辑简单但每个请求都经过 |
| `do/` | ≥ 50% | WebSocket 生命周期难以完整模拟 |
| Vue composables | ≥ 60% | 核心交互逻辑 |

覆盖率是下限不是目标。100% 覆盖率配上弱断言等于没测。

## 集成测试

### 三条核心全链路（必须测）

| 测试 | 覆盖什么 |
|------|---------|
| R2 上传下载全链路 | `创建 session → 分片上传 → complete → 接收方查询 → 下载` |
| P2P 降级链路 | `WebSocket 连接 → NAT 穿透超时 → 自动回退 R2 → 正常完成` |
| 生命周期链路 | `创建 → 过期 → Cron cleanup 删除 R2 + KV` |

### 额外边界覆盖

| 场景 | 验证点 |
|------|--------|
| 下载次数限制 | 超过 maxDownloads 后返回 410 Gone |
| 上传中断续传 | 上传 3/5 片后断连 → 重连 → 从第 4 片继续 |
| 管理员干预 | 管理员强制删除 session → 上传方收到 error 消息 |
| KV 最终一致性 | 写入 KV 后立即读 → 可能 miss，重试逻辑生效 |
| 并发下载 | 多个接收方同时下载 → 计数器正确 |

## E2E 测试

只测三条核心用户路径——多了维护成本吃掉收益。

```
1. 发送方上传文件 → 获取分享码和二维码 → 接收方输入码 → 下载文件（验证内容一致）
2. 发送方粘贴文本 → 获取分享码 → 接收方查看并一键复制
3. 管理员登录 → 查看活跃传输列表 → 强制终止某传输
```

```ts
// packages/web/tests/e2e/send-file.spec.ts
import { test, expect } from "@playwright/test";

test.describe("文件发送流程", () => {
  test("上传文件并分享给他人下载", async ({ page }) => {
    // 发送方打开发送页 → 上传文件 → 获取分享码
    await page.goto("/");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("./fixtures/sample-1mb.bin");
    await expect(page.locator('[data-testid="share-code"]')).toBeVisible();
    const code = await page.locator('[data-testid="share-code"]').textContent();

    // 接收方打开接收页 → 输入分享码 → 下载
    const receiverPage = await page.context().newPage();
    await receiverPage.goto(`/receive?code=${code}`);
    const download = receiverPage.locator('[data-testid="download-btn"]');
    await expect(download).toBeVisible();
  });
});
```

## 测试数据

```
packages/worker/tests/fixtures/
├── sample-1mb.bin       # 单分片边界
├── sample-10mb.bin      # 多分片边界
└── sample-501mb.bin     # 超过 P2P 阈值（稀疏文件或脚本动态生成）
```

不需要把这些二进制文件提交到 Git。用脚本按需生成，或者用 Git LFS。

## 完成标准

### 单元测试
- [ ] 每个新增 service 函数覆盖：正常路径、边界、异常
- [ ] 测试之间独立（不依赖执行顺序、不共享可变状态）
- [ ] 单个测试文件 < 5 秒
- [ ] 无真实网络请求（R2/KV/DO 全部 Miniflare）
- [ ] 覆盖率达标

### 集成测试
- [ ] 三条核心全链路通过
- [ ] P2P 降级链路已验证
- [ ] 测试隔离（每个测试重置 Miniflare）

### E2E 测试
- [ ] 三条核心用户路径通过
- [ ] 测试隔离（每个测试新 browser context）
