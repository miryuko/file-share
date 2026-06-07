import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ReceiveView from "../../../../src/pages/receive/index.vue";
import i18n from "../../../../src/i18n";

// Mock vue-router
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: {} }),
}));

// Mock fetch globally
const mockFetch = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", mockFetch);

// Mock ResizeObserver (required by vue-input-otp, not available in jsdom)
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function mountWithI18n(component: Parameters<typeof mount>[0], options?: Parameters<typeof mount>[1]) {
  i18n.global.locale.value = 'zh-CN';
  return mount(component, {
    global: { plugins: [i18n] },
    ...options,
  });
}

describe("ReceiveView", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("应渲染标题和 OTP 输入区域", () => {
    const wrapper = mountWithI18n(ReceiveView);

    expect(wrapper.text()).toContain("接收");
    // OTP 容器应存在
    expect(wrapper.find('[data-slot="input-otp"]').exists()).toBe(true);
    // 应有 6 个 OTP slot
    expect(wrapper.findAll('[data-slot="input-otp-slot"]')).toHaveLength(6);
  });

  it("初始状态下不应显示文件列表", () => {
    const wrapper = mountWithI18n(ReceiveView);
    expect(wrapper.text()).not.toContain("剩余下载");
  });

  it("初始状态下不应显示文件/文本切换 tab", () => {
    const wrapper = mountWithI18n(ReceiveView);
    expect(wrapper.text()).not.toContain("文件");
    expect(wrapper.text()).not.toContain("文本");
  });

  it("接收按钮在输入不足 6 位时应禁用", () => {
    const wrapper = mountWithI18n(ReceiveView);

    // 初始 state：codeInput=""，按钮应禁用
    const button = wrapper.find("button");
    expect(button.attributes("disabled")).not.toBeUndefined();
  });

  it("通过 defineExpose 可设置 codeInput 值", async () => {
    const wrapper = mountWithI18n(ReceiveView);

    // defineExpose 暴露后 wrapper.vm 可访问 ref（自动 unwrap）
    const vm = wrapper.vm as unknown as { codeInput: string };
    vm.codeInput = "A3K9M2";
    await nextTick();

    // 验证 codeInput 已更新
    expect(vm.codeInput).toBe("A3K9M2");
  });
});
