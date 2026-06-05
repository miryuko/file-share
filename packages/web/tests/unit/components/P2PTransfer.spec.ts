import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import P2PTransfer from "../../../src/components/P2PTransfer.vue";

describe("P2PTransfer", () => {
  it("初始渲染时不应显示状态（isActive 默认 false）", () => {
    const wrapper = mount(P2PTransfer, {
      props: {
        code: "A3K9M2",
        role: "sender",
      },
    });

    // 组件默认 isActive 为 false，不应渲染 .p2p-status
    expect(wrapper.find(".p2p-status").exists()).toBe(false);
  });

  it("给定 sender 角色，应接受 props", () => {
    const wrapper = mount(P2PTransfer, {
      props: {
        code: "A3K9M2",
        role: "sender",
      },
    });

    expect(wrapper.props("code")).toBe("A3K9M2");
    expect(wrapper.props("role")).toBe("sender");
  });

  it("给定 receiver 角色，应接受 props", () => {
    const wrapper = mount(P2PTransfer, {
      props: {
        code: "B7NX5P",
        role: "receiver",
      },
    });

    expect(wrapper.props("role")).toBe("receiver");
  });
});
