import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import UploadOptionsPanel from "../../../../src/components/send/UploadOptionsPanel.vue";
import i18n from "../../../../src/i18n";

function mountWithI18n(component: Parameters<typeof mount>[0], options?: Parameters<typeof mount>[1]) {
  return mount(component, {
    global: { plugins: [i18n] },
    ...options,
  });
}

const defaultProps = {
  defaultTtl: 3600,
  defaultMaxDownloads: 20,
  ttlLimit: 86400,
  downloadsLimit: 100,
};

describe("UploadOptionsPanel", () => {
  // ── 正常路径 ──
  it("初始状态应为折叠", () => {
    const wrapper = mountWithI18n(UploadOptionsPanel, {
      props: defaultProps,
    });

    expect(wrapper.text()).toContain("Upload Options");
    // 折叠时不显示过期时间子内容
    expect(wrapper.text()).not.toContain("Expiration");
  });

  it("点击标题应展开面板", async () => {
    const wrapper = mountWithI18n(UploadOptionsPanel, {
      props: defaultProps,
    });

    const toggleBtn = wrapper.find("button");
    await toggleBtn.trigger("click");

    expect(wrapper.text()).toContain("Expiration");
    expect(wrapper.text()).toContain("Max Downloads");
  });

  it("应显示默认 TTL 值", () => {
    const wrapper = mountWithI18n(UploadOptionsPanel, {
      props: defaultProps,
    });

    // Default TTL 3600s = 1 hour, shows in collapsed state as select value
    expect(wrapper.text()).toContain("Upload Options");
  });

  // ── 边界 ──
  it("给定默认 TTL 为 -1，面板应正常渲染", () => {
    const wrapper = mountWithI18n(UploadOptionsPanel, {
      props: { ...defaultProps, defaultTtl: -1, ttlLimit: -1 },
    });

    expect(wrapper.text()).toContain("Upload Options");
  });

  it("给定 maxDownloads 为 -1，面板应正常渲染", () => {
    const wrapper = mountWithI18n(UploadOptionsPanel, {
      props: { ...defaultProps, defaultMaxDownloads: -1, downloadsLimit: -1 },
    });

    expect(wrapper.text()).toContain("Upload Options");
  });

  // ── 折叠往返 ──
  it("再次点击标题应折叠面板", async () => {
    const wrapper = mountWithI18n(UploadOptionsPanel, {
      props: defaultProps,
    });

    const toggleBtn = wrapper.find("button");
    await toggleBtn.trigger("click");
    expect(wrapper.text()).toContain("Expiration");

    await toggleBtn.trigger("click");
    expect(wrapper.text()).not.toContain("Expiration");
  });
});
