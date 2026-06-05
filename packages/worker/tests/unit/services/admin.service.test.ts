import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminLogin, getAdminConfig, updateAdminConfig, listActiveSessions } from "../../../src/services/admin.service";
import { AppError } from "../../../src/utils/error";
import { hashPassword } from "../../../src/utils/password";

const TEST_SECRET = "test-admin-jwt-secret";

function createMockKV(store: Map<string, string>): KVNamespace {
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => {
      const keys: { name: string }[] = [];
      store.forEach((_, k) => {
        if (k.startsWith("code:")) keys.push({ name: k });
      });
      return { keys, list_complete: true, cursor: "" };
    }),
  } as unknown as KVNamespace;
}

describe("adminLogin", () => {
  let store: Map<string, string>;
  let mockKV: KVNamespace;

  beforeEach(() => {
    store = new Map();
    mockKV = createMockKV(store);
  });

  it("首次使用默认密码应成功登录并返回 token", async () => {
    // 无 admin:password 键 = 首次使用
    const result = await adminLogin("admin123", { FILE_KV: mockKV }, TEST_SECRET);

    expect(result.token).toBeTruthy();
    expect(result.token.split(".")).toHaveLength(3);
    // 密码应被哈希存储
    const stored = store.get("admin:password");
    expect(stored).toMatch(/^pbkdf2:/);
  });

  it("首次使用错误密码应抛出错误", async () => {
    await expect(
      adminLogin("wrong", { FILE_KV: mockKV }, TEST_SECRET),
    ).rejects.toThrow(AppError);
  });

  it("首次使用错误密码应记录失败尝试", async () => {
    try {
      await adminLogin("wrong", { FILE_KV: mockKV }, TEST_SECRET);
    } catch { /* expected */ }

    const lockData = store.get("admin:login_lock");
    expect(lockData).toBeTruthy();
    expect(JSON.parse(lockData!).attempts).toBe(1);
  });

  it("哈希存储后正确密码应能验证", async () => {
    // 先初始化
    const hashed = await hashPassword("mypassword");
    store.set("admin:password", hashed);

    const result = await adminLogin("mypassword", { FILE_KV: mockKV }, TEST_SECRET);
    expect(result.token).toBeTruthy();
  });

  it("哈希存储后错误密码应失败", async () => {
    const hashed = await hashPassword("correct");
    store.set("admin:password", hashed);

    await expect(
      adminLogin("wrong", { FILE_KV: mockKV }, TEST_SECRET),
    ).rejects.toThrow(AppError);
  });
});

describe("getAdminConfig", () => {
  let store: Map<string, string>;
  let mockKV: KVNamespace;

  beforeEach(() => {
    store = new Map();
    mockKV = createMockKV(store);
  });

  it("无配置时返回默认值", async () => {
    const config = await getAdminConfig({ FILE_KV: mockKV });
    expect(config.maxFileSize).toBe(100 * 1024 * 1024);
    expect(config.ttlSeconds).toBe(3600);
  });

  it("有自定义配置时返回合并后的值", async () => {
    store.set("admin:config", JSON.stringify({ maxFiles: 50 }));
    const config = await getAdminConfig({ FILE_KV: mockKV });
    expect(config.maxFiles).toBe(50);
    expect(config.maxFileSize).toBe(100 * 1024 * 1024); // 默认值保留
  });

  it("配置 JSON 损坏时返回默认值", async () => {
    store.set("admin:config", "not valid json");
    const config = await getAdminConfig({ FILE_KV: mockKV });
    expect(config.maxFileSize).toBeDefined();
  });
});

describe("updateAdminConfig", () => {
  let store: Map<string, string>;
  let mockKV: KVNamespace;

  beforeEach(() => {
    store = new Map();
    mockKV = createMockKV(store);
  });

  it("应更新并返回新配置", async () => {
    const updated = await updateAdminConfig({ maxFiles: 30 }, { FILE_KV: mockKV });
    expect(updated.maxFiles).toBe(30);
    expect(store.get("admin:config")).toContain("30");
  });
});

describe("listActiveSessions", () => {
  let store: Map<string, string>;
  let mockKV: KVNamespace;

  beforeEach(() => {
    store = new Map();
    mockKV = createMockKV(store);
  });

  it("应列出非 expired 状态的 session", async () => {
    store.set(
      "code:A3K9M2",
      JSON.stringify({
        code: "A3K9M2",
        files: [],
        status: "ready",
        totalSize: 0,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        maxDownloads: 20,
        downloadCount: 0,
        creatorIP: "1.2.3.4",
      }),
    );
    store.set(
      "code:B7NX5P",
      JSON.stringify({
        code: "B7NX5P",
        files: [],
        status: "expired",
        totalSize: 0,
        createdAt: Date.now() - 7200000,
        expiresAt: Date.now() - 1000,
        maxDownloads: 20,
        downloadCount: 20,
        creatorIP: "5.6.7.8",
      }),
    );

    const result = await listActiveSessions({ FILE_KV: mockKV });

    expect(result.total).toBe(1);
    expect(result.sessions[0].code).toBe("A3K9M2");
  });

  it("无活跃 session 时返回空列表", async () => {
    const result = await listActiveSessions({ FILE_KV: mockKV });
    expect(result.sessions).toEqual([]);
    expect(result.total).toBe(0);
  });
});
