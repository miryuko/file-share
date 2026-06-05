import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminView from "../../../src/views/AdminView.vue";

describe("AdminView", () => {
  it("应渲染标题和登录表单", () => {
    const wrapper = mount(AdminView);

    expect(wrapper.text()).toContain("管理面板");
    expect(wrapper.find(".password-input").exists()).toBe(true);
    expect(wrapper.find(".btn-login").exists()).toBe(true);
  });

  it("密码为空时登录按钮应禁用", () => {
    const wrapper = mount(AdminView);

    const btn = wrapper.find(".btn-login");
    expect(btn.attributes("disabled")).toBeDefined();
  });

  it("输入密码后登录按钮应启用", async () => {
    const wrapper = mount(AdminView);

    const input = wrapper.find(".password-input");
    await input.setValue("admin123");

    const btn = wrapper.find(".btn-login");
    expect(btn.attributes("disabled")).toBeUndefined();
  });

  it("初始状态下不应显示 dashboard", () => {
    const wrapper = mount(AdminView);

    expect(wrapper.find(".dashboard").exists()).toBe(false);
  });
});
