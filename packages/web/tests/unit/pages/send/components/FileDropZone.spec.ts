import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import FileDropZone from "../../../../../src/pages/send/components/FileDropZone.vue";
import i18n from "../../../../../src/i18n";

function mountWithI18n(component: Parameters<typeof mount>[0], options?: Parameters<typeof mount>[1]) {
  return mount(component, {
    global: { plugins: [i18n] },
    ...options,
  });
}

describe("FileDropZone", () => {
  // ── 正常路径 ──
  it("给定限制文案，应显示在上传区域中", () => {
    const wrapper = mountWithI18n(FileDropZone, {
      props: { limitText: "Any file type, max 100MB per file, 500MB total" },
    });

    expect(wrapper.text()).toContain("Click to select files or drag and drop here");
    expect(wrapper.text()).toContain("100MB");
  });

  it("应渲染上传图标", () => {
    const wrapper = mountWithI18n(FileDropZone, {
      props: { limitText: "test" },
    });

    expect(wrapper.find("svg").exists()).toBe(true);
  });

  // ── 交互 ──
  it("点击区域应创建临时 file input 并触发点击", async () => {
    const wrapper = mountWithI18n(FileDropZone, {
      props: { limitText: "test" },
    });

    const mockInput = document.createElement("input");
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(mockInput);
    const clickSpy = vi.spyOn(mockInput, "click");

    const dropZone = wrapper.find(".cursor-pointer");
    await dropZone.trigger("click");

    expect(createElementSpy).toHaveBeenCalledWith("input");

    createElementSpy.mockRestore();
    clickSpy.mockRestore();
  });

  // ── 拖放交互 ──
  it("给定文件拖放，应 emit files 事件", async () => {
    const wrapper = mountWithI18n(FileDropZone, {
      props: { limitText: "test" },
    });

    const dropZone = wrapper.find(".cursor-pointer");
    const file = new File([new ArrayBuffer(100)], "test.bin");
    const dataTransfer = { files: [file] };

    await dropZone.trigger("drop", { dataTransfer });

    const emitted = wrapper.emitted("files");
    expect(emitted).toBeTruthy();
    expect(emitted![0]).toEqual([[file]]);
  });

  // ── 边界 ──
  it("给定空限制文案，应正常渲染", () => {
    const wrapper = mountWithI18n(FileDropZone, {
      props: { limitText: "" },
    });

    expect(wrapper.find(".cursor-pointer").exists()).toBe(true);
  });
});
