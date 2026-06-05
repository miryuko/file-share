import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminView from "../../../src/views/AdminView.vue";

describe("AdminView", () => {
  it("应渲染标题和登录表单", () => {
    const wrapper = mount(AdminView);

    expect(wrapper.text()).toContain("管理面板");
    // shadcn Input 渲染为 <input>
    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    // shadcn Button 渲染为 <button>
    expect(wrapper.find("button").exists()).toBe(true);
  });

  it("密码为空时登录按钮应禁用", () => {
    const wrapper = mount(AdminView);

    const btn = wrapper.find("button");
    expect(btn.attributes("disabled")).toBeDefined();
  });

  it("输入密码后登录按钮应启用", async () => {
    const wrapper = mount(AdminView);

    const input = wrapper.find('input[type="password"]');
    await input.setValue("admin123");

    const btn = wrapper.find("button");
    expect(btn.attributes("disabled")).toBeUndefined();
  });

  it("初始状态下不应显示 dashboard", () => {
    const wrapper = mount(AdminView);

    expect(wrapper.text()).not.toContain("退出登录");
  });
});
