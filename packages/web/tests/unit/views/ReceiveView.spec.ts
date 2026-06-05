import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ReceiveView from "../../../src/views/ReceiveView.vue";
import i18n from "../../../src/i18n";

function mountWithI18n(component: Parameters<typeof mount>[0], options?: Parameters<typeof mount>[1]) {
  i18n.global.locale.value = 'zh-CN';
  return mount(component, {
    global: { plugins: [i18n] },
    ...options,
  });
}

describe("ReceiveView", () => {
  it("应渲染标题和输入区域", () => {
    const wrapper = mountWithI18n(ReceiveView);

    expect(wrapper.text()).toContain("接收");
    expect(wrapper.find('input[maxlength="6"]').exists()).toBe(true);
  });

  it("输入框应限制最大长度 6", () => {
    const wrapper = mountWithI18n(ReceiveView);
    const input = wrapper.find('input[maxlength="6"]');
    expect(input.attributes("maxlength")).toBe("6");
  });

  it("初始状态下不应显示文件列表", () => {
    const wrapper = mountWithI18n(ReceiveView);
    expect(wrapper.text()).not.toContain("剩余下载");
  });
});
