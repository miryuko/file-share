import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", mockFetch);

// 每次测试前重新导入模块，确保模块级状态隔离
beforeEach(async () => {
  vi.resetModules();
  mockFetch.mockReset();
});

describe("useSiteConfig", () => {
  it("初始时应返回默认配置", async () => {
    const { useSiteConfig } = await import("../../../src/composables/useSiteConfig");
    const { config, loaded } = useSiteConfig();

    expect(config.value.siteTitle).toBe("File Share");
    expect(config.value.maxFileSize).toBe(100 * 1024 * 1024);
    expect(config.value.maxTotalSize).toBe(500 * 1024 * 1024);
    expect(config.value.maxFiles).toBe(20);
    expect(config.value.maxTextSize).toBe(100000);
    expect(loaded.value).toBe(false);
  });

  it("加载成功后应更新配置", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        siteTitle: "Custom Title",
        siteDescription: "Custom Desc",
        footerNotice: "Custom Footer",
        maxFileSize: 200 * 1024 * 1024,
        maxTotalSize: 1024 * 1024 * 1024,
        maxFiles: 30,
        maxTextSize: 2 * 1024 * 1024,
      }),
    } as unknown as Response);

    const { useSiteConfig } = await import("../../../src/composables/useSiteConfig");
    const { config, loaded, load } = useSiteConfig();
    await load();

    expect(config.value.siteTitle).toBe("Custom Title");
    expect(config.value.maxFileSize).toBe(200 * 1024 * 1024);
    expect(loaded.value).toBe(true);
  });

  it("加载失败后应保持默认值并标记为已加载", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { useSiteConfig } = await import("../../../src/composables/useSiteConfig");
    const { config, loaded, load } = useSiteConfig();
    await load();

    // 应保持默认值
    expect(config.value.siteTitle).toBe("File Share");
    expect(config.value.maxFileSize).toBe(100 * 1024 * 1024);
    // 应标记为已加载以防止无限重试
    expect(loaded.value).toBe(true);
    // 应打印警告
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("远程配置缺少字段时应使用默认值兜底", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        siteTitle: "",
        maxFileSize: 0,
        maxTotalSize: -1,
      }),
    } as unknown as Response);

    const { useSiteConfig } = await import("../../../src/composables/useSiteConfig");
    const { config, load } = useSiteConfig();
    await load();

    // 空字符串应回退到默认值
    expect(config.value.siteTitle).toBe("File Share");
    // 无效限制值应使用默认值
    expect(config.value.maxFileSize).toBe(100 * 1024 * 1024);
    expect(config.value.maxTotalSize).toBe(500 * 1024 * 1024);
    // 缺失字段应使用默认值
    expect(config.value.maxFiles).toBe(20);
    expect(config.value.maxTextSize).toBe(100000);
  });

  it("重复调用 load 不应重复请求", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        siteTitle: "Title",
        siteDescription: "",
        footerNotice: "",
        maxFileSize: 100 * 1024 * 1024,
        maxTotalSize: 500 * 1024 * 1024,
        maxFiles: 20,
        maxTextSize: 1 * 1024 * 1024,
      }),
    } as unknown as Response);

    const { useSiteConfig } = await import("../../../src/composables/useSiteConfig");
    const { load } = useSiteConfig();
    await load();
    await load();
    await load();

    // 只应发起一次请求
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
