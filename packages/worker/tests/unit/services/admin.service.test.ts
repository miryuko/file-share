import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminLogin, changePassword, getAdminConfig, getSiteConfig, isDefaultPassword, updateAdminConfig, listActiveSessions } from "../../../src/services/admin.service";
import { DEFAULT_ADMIN_CONFIG } from "../../../src/models/session";
import { AppError } from "../../../src/utils/error";
import { hashPassword } from "../../../src/utils/password";

const TEST_SECRET = "test-admin-jwt-secret";
const TEST_DEFAULT_PASSWORD = "123456";

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

  it("首次使用默认密码应成功登录并返回 token，标记需要改密", async () => {
    // 无 admin:password 键 = 首次使用
    const result = await adminLogin(
      TEST_DEFAULT_PASSWORD,
      { FILE_KV: mockKV },
      TEST_SECRET,
      TEST_DEFAULT_PASSWORD,
    );

    expect(result.token).toBeTruthy();
    expect(result.token.split(".")).toHaveLength(3);
    expect(result.needsPasswordChange).toBe(true);
    // 密码应被哈希存储
    const stored = store.get("admin:password");
    expect(stored).toMatch(/^pbkdf2:/);
  });

  it("首次使用错误密码应抛出错误", async () => {
    await expect(
      adminLogin("wrong", { FILE_KV: mockKV }, TEST_SECRET, TEST_DEFAULT_PASSWORD),
    ).rejects.toThrow(AppError);
  });

  it("首次使用错误密码应记录失败尝试", async () => {
    try {
      await adminLogin("wrong", { FILE_KV: mockKV }, TEST_SECRET, TEST_DEFAULT_PASSWORD);
    } catch { /* expected */ }

    const lockData = store.get("admin:login_lock");
    expect(lockData).toBeTruthy();
    expect(JSON.parse(lockData!).attempts).toBe(1);
  });

  it("哈希存储后正确密码应能验证", async () => {
    // 先初始化
    const hashed = await hashPassword("mypassword");
    store.set("admin:password", hashed);

    const result = await adminLogin(
      "mypassword",
      { FILE_KV: mockKV },
      TEST_SECRET,
      TEST_DEFAULT_PASSWORD,
    );
    expect(result.token).toBeTruthy();
    expect(result.needsPasswordChange).toBe(false);
  });

  it("哈希存储后错误密码应失败", async () => {
    const hashed = await hashPassword("correct");
    store.set("admin:password", hashed);

    await expect(
      adminLogin("wrong", { FILE_KV: mockKV }, TEST_SECRET, TEST_DEFAULT_PASSWORD),
    ).rejects.toThrow(AppError);
  });

  it("使用默认密码登录已初始化的账户时应返回 needsPasswordChange", async () => {
    const hashed = await hashPassword(TEST_DEFAULT_PASSWORD);
    store.set("admin:password", hashed);

    const result = await adminLogin(
      TEST_DEFAULT_PASSWORD,
      { FILE_KV: mockKV },
      TEST_SECRET,
      TEST_DEFAULT_PASSWORD,
    );
    expect(result.token).toBeTruthy();
    expect(result.needsPasswordChange).toBe(true);
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

describe("changePassword", () => {
  let store: Map<string, string>;
  let mockKV: KVNamespace;

  beforeEach(() => {
    store = new Map();
    mockKV = createMockKV(store);
  });

  it("修改密码成功后应哈希存储新密码", async () => {
    // 先设置一个初始密码
    const { hashPassword } = await import("../../../src/utils/password");
    const initialHash = await hashPassword("oldpassword");
    store.set("admin:password", initialHash);

    const result = await changePassword("oldpassword", "newpassword", {
      FILE_KV: mockKV,
    });

    expect(result.success).toBe(true);
    const newHash = store.get("admin:password");
    expect(newHash).toMatch(/^pbkdf2:/);
    expect(newHash).not.toBe(initialHash);
  });

  it("当前密码错误时应抛出错误", async () => {
    const { hashPassword } = await import("../../../src/utils/password");
    store.set("admin:password", await hashPassword("correct"));

    await expect(
      changePassword("wrong", "newpassword", { FILE_KV: mockKV }),
    ).rejects.toThrow(AppError);
  });

  it("新密码与当前密码相同时应抛出错误", async () => {
    const { hashPassword } = await import("../../../src/utils/password");
    store.set("admin:password", await hashPassword("samepass"));

    await expect(
      changePassword("samepass", "samepass", { FILE_KV: mockKV }),
    ).rejects.toThrow(AppError);
  });

  it("新密码为空时应抛出错误", async () => {
    await expect(
      changePassword("current", "", { FILE_KV: mockKV }),
    ).rejects.toThrow(AppError);
  });
});

describe("isDefaultPassword", () => {
  let store: Map<string, string>;
  let mockKV: KVNamespace;

  beforeEach(() => {
    store = new Map();
    mockKV = createMockKV(store);
  });

  it("未设置密码时返回 true", async () => {
    const result = await isDefaultPassword({ FILE_KV: mockKV }, TEST_DEFAULT_PASSWORD);
    expect(result).toBe(true);
  });

  it("密码为默认密码 123456 时返回 true", async () => {
    const { hashPassword } = await import("../../../src/utils/password");
    store.set("admin:password", await hashPassword(TEST_DEFAULT_PASSWORD));

    const result = await isDefaultPassword({ FILE_KV: mockKV }, TEST_DEFAULT_PASSWORD);
    expect(result).toBe(true);
  });

  it("密码为自定义密码时返回 false", async () => {
    const { hashPassword } = await import("../../../src/utils/password");
    store.set("admin:password", await hashPassword("custompw"));

    const result = await isDefaultPassword({ FILE_KV: mockKV }, TEST_DEFAULT_PASSWORD);
    expect(result).toBe(false);
  });

  it("自定义默认密码时正确识别", async () => {
    const { hashPassword } = await import("../../../src/utils/password");
    store.set("admin:password", await hashPassword("mydefault123"));

    const result = await isDefaultPassword({ FILE_KV: mockKV }, "mydefault123");
    expect(result).toBe(true);
  });
});

describe("getSiteConfig", () => {
  let store: Map<string, string>;
  let mockKV: KVNamespace;

  beforeEach(() => {
    store = new Map();
    mockKV = createMockKV(store);
  });

  it("无配置时返回默认值", async () => {
    const config = await getSiteConfig({ FILE_KV: mockKV });
    expect(config.siteTitle).toBe("File Share");
    expect(config.siteDescription).toBe("");
    expect(config.footerNotice).toBe("");
  });

  it("有自定义配置时返回对应值", async () => {
    store.set(
      "admin:config",
      JSON.stringify({
        siteTitle: "My Share",
        siteDescription: "A great sharing site",
        footerNotice: "© 2024 My Share",
      }),
    );

    const config = await getSiteConfig({ FILE_KV: mockKV });
    expect(config.siteTitle).toBe("My Share");
    expect(config.siteDescription).toBe("A great sharing site");
    expect(config.footerNotice).toBe("© 2024 My Share");
  });

  it("仅返回公开字段，不泄露敏感配置", async () => {
    store.set(
      "admin:config",
      JSON.stringify({
        maxFileSize: 1024,
        siteTitle: "Secure Share",
      }),
    );

    const config = await getSiteConfig({ FILE_KV: mockKV });
    expect(config.siteTitle).toBe("Secure Share");
    // 确保不包含管理员专属字段
    expect((config as Record<string, unknown>).maxFileSize).toBeUndefined();
  });
});

describe("DEFAULT_ADMIN_CONFIG 新增字段", () => {
  it("应包含 maxTextSize 默认值", () => {
    expect(DEFAULT_ADMIN_CONFIG.maxTextSize).toBe(1 * 1024 * 1024);
  });

  it("应包含 siteTitle 默认值", () => {
    expect(DEFAULT_ADMIN_CONFIG.siteTitle).toBe("File Share");
  });

  it("应包含 siteDescription 和 footerNotice 默认值", () => {
    expect(DEFAULT_ADMIN_CONFIG.siteDescription).toBe("");
    expect(DEFAULT_ADMIN_CONFIG.footerNotice).toBe("");
  });
});
