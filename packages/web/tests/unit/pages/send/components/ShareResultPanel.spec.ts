import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ShareResultPanel from "../../../../../src/pages/send/components/ShareResultPanel.vue";
import i18n from "../../../../../src/i18n";

function mountWithI18n(component: Parameters<typeof mount>[0], options?: Parameters<typeof mount>[1]) {
  return mount(component, {
    global: { plugins: [i18n] },
    ...options,
  });
}

describe("ShareResultPanel", () => {
  // ── 正常路径：文件类型 ──
  it("给定文件类型，应显示分享码和文件相关标签", () => {
    const wrapper = mountWithI18n(ShareResultPanel, {
      props: {
        code: "A3K9M2",
        qrCodeURI: "",
        type: "file" as const,
      },
    });

    expect(wrapper.text()).toContain("A3K9M2");
    expect(wrapper.text()).toContain("Share Code");
  });

  it("给定文本类型，应显示文本相关标签", () => {
    const wrapper = mountWithI18n(ShareResultPanel, {
      props: {
        code: "X7Y2P4",
        qrCodeURI: "",
        type: "text" as const,
      },
    });

    expect(wrapper.text()).toContain("X7Y2P4");
    expect(wrapper.text()).toContain("Text Share Code");
  });

  // ── QR 码 ──
  it("给定 qrCodeURI，应渲染图片", () => {
    const wrapper = mountWithI18n(ShareResultPanel, {
      props: {
        code: "A3K9M2",
        qrCodeURI: "data:image/png;base64,test",
        type: "file" as const,
      },
    });

    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe("data:image/png;base64,test");
  });

  it("给定空 qrCodeURI，不应渲染图片", () => {
    const wrapper = mountWithI18n(ShareResultPanel, {
      props: {
        code: "A3K9M2",
        qrCodeURI: "",
        type: "file" as const,
      },
    });

    expect(wrapper.find("img").exists()).toBe(false);
  });

  // ── 文件列表 ──
  it("给定文件类型和 uploads，应显示文件结果", () => {
    const wrapper = mountWithI18n(ShareResultPanel, {
      props: {
        code: "A3K9M2",
        qrCodeURI: "",
        type: "file" as const,
        uploads: [
          {
            fileId: "f1",
            filename: "photo.jpg",
            file: new File([], "photo.jpg"),
            status: "completed" as const,
            progress: 100,
            loadedBytes: 2048,
            totalBytes: 2048,
            speed: 0,
            eta: 0,
            uploadMethod: "direct" as const,
          },
        ],
      },
    });

    expect(wrapper.text()).toContain("photo.jpg");
    expect(wrapper.text()).toContain("2 KB");
  });

  // ── 重置事件 ──
  it("点击重置按钮应 emit reset 事件", async () => {
    const wrapper = mountWithI18n(ShareResultPanel, {
      props: {
        code: "A3K9M2",
        qrCodeURI: "",
        type: "file" as const,
      },
    });

    const buttons = wrapper.findAll("button");
    const resetBtn = buttons.find((b) => b.text().includes("Send New File"));
    expect(resetBtn).toBeTruthy();
    await resetBtn!.trigger("click");
    expect(wrapper.emitted("reset")).toBeTruthy();
  });

  // ── 边界 ──
  it("给定空 uploads，不应显示文件列表项", () => {
    const wrapper = mountWithI18n(ShareResultPanel, {
      props: {
        code: "A3K9M2",
        qrCodeURI: "",
        type: "file" as const,
        uploads: [],
      },
    });

    expect(wrapper.text()).not.toContain("photo.jpg");
  });
});
