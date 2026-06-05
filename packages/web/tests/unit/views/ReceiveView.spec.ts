import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ReceiveView from "../../../src/views/ReceiveView.vue";

describe("ReceiveView", () => {
  it("应渲染标题和输入区域", () => {
    const wrapper = mount(ReceiveView);

    expect(wrapper.text()).toContain("接收文件");
    expect(wrapper.find("input.code-input").exists()).toBe(true);
    expect(wrapper.text()).toContain("接收");
  });

  it("输入框应限制最大长度 6", () => {
    const wrapper = mount(ReceiveView);
    const input = wrapper.find("input.code-input");
    expect(input.attributes("maxlength")).toBe("6");
  });

  it("初始状态下不应显示文件列表", () => {
    const wrapper = mount(ReceiveView);
    expect(wrapper.text()).not.toContain("剩余下载");
  });
});
