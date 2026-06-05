import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SendView from "../../../src/views/SendView.vue";

describe("SendView", () => {
  it("应渲染标题和上传区域", () => {
    const wrapper = mount(SendView);

    expect(wrapper.text()).toContain("File Share");
    expect(wrapper.text()).toContain("安全、匿名、即时的文件传输");
    expect(wrapper.text()).toContain("点击选择文件或拖拽到此处");
  });

  it("应包含隐藏的文件输入", () => {
    const wrapper = mount(SendView);
    const input = wrapper.find('input[type="file"]');
    expect(input.exists()).toBe(true);
    expect(input.attributes("multiple")).toBeDefined();
  });

  it("初始状态下不应显示分享码", () => {
    const wrapper = mount(SendView);
    expect(wrapper.text()).not.toContain("分享码");
  });
});
