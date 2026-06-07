import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import FileListPreview from "../../../src/components/FileListPreview.vue";
import i18n from "../../../src/i18n";
import type { SelectedFileInfo } from "../../../src/composables/useFileUploadManager";

function mountWithI18n(component: Parameters<typeof mount>[0], options?: Parameters<typeof mount>[1]) {
  return mount(component, {
    global: { plugins: [i18n] },
    ...options,
  });
}

function makeFileInfo(name: string, size: number): SelectedFileInfo {
  return {
    file: new File([], name),
    id: `id-${name}`,
    size,
    name,
    type: "application/octet-stream",
    extension: "bin",
    hash: `hash-${name}`,
    isValid: true,
  };
}

describe("FileListPreview", () => {
  // ── 正常路径 ──
  it("给定文件列表，应显示文件名", () => {
    const files = [makeFileInfo("test.bin", 1024), makeFileInfo("doc.pdf", 2048)];
    const wrapper = mountWithI18n(FileListPreview, {
      props: { files, canAddMore: true },
    });

    expect(wrapper.text()).toContain("test.bin");
    expect(wrapper.text()).toContain("doc.pdf");
  });

  it("给定 canAddMore，应显示添加按钮", () => {
    const wrapper = mountWithI18n(FileListPreview, {
      props: { files: [makeFileInfo("a.bin", 100)], canAddMore: true },
    });

    expect(wrapper.text()).toContain("Add more files");
  });

  it("给定 canAddMore 为 false，不应显示添加按钮", () => {
    const wrapper = mountWithI18n(FileListPreview, {
      props: { files: [makeFileInfo("a.bin", 100)], canAddMore: false },
    });

    expect(wrapper.text()).not.toContain("Add more files");
  });

  // ── 进度条 ──
  it("给定 maxFiles 限制，应显示文件数量进度", () => {
    const files = [makeFileInfo("a.bin", 100), makeFileInfo("b.bin", 200)];
    const wrapper = mountWithI18n(FileListPreview, {
      props: { files, maxFiles: 10 },
    });

    expect(wrapper.text()).toContain("2 / 10");
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(true);
  });

  it("给定 maxTotalSize 限制，应显示总大小进度", () => {
    const files = [makeFileInfo("a.bin", 50 * 1024 * 1024)];
    const wrapper = mountWithI18n(FileListPreview, {
      props: { files, maxTotalSize: 100 * 1024 * 1024 },
    });

    expect(wrapper.text()).toContain("50 MB / 100 MB");
  });

  it("给定无限制（-1），不应显示进度条", () => {
    const files = [makeFileInfo("a.bin", 100)];
    const wrapper = mountWithI18n(FileListPreview, {
      props: { files, maxFiles: -1, maxTotalSize: -1 },
    });

    const progressbars = wrapper.findAll('[role="progressbar"]');
    expect(progressbars).toHaveLength(0);
  });

  // ── 边界 ──
  it("给定空文件列表，应显示 0 个文件", () => {
    const wrapper = mountWithI18n(FileListPreview, {
      props: { files: [], canAddMore: true },
    });

    expect(wrapper.text()).toContain("0 files");
  });

  // ── 事件 ──
  it("点击移除按钮应 emit remove 事件", async () => {
    const files = [makeFileInfo("a.bin", 100)];
    const wrapper = mountWithI18n(FileListPreview, {
      props: { files, canAddMore: true },
    });

    // aria-label is i18n key 'send.removeFile' → 'Remove file' in en
    const removeBtn = wrapper.find('button[aria-label="Remove file"]');
    expect(removeBtn.exists()).toBe(true);
    await removeBtn.trigger("click");

    expect(wrapper.emitted("remove")).toBeTruthy();
    expect(wrapper.emitted("remove")![0]).toEqual([0]);
  });

  it("点击添加按钮应 emit addMore 事件", async () => {
    const wrapper = mountWithI18n(FileListPreview, {
      props: { files: [makeFileInfo("a.bin", 100)], canAddMore: true },
    });

    const buttons = wrapper.findAll("button");
    const addMoreBtn = buttons.find((b) => b.text().includes("Add more files"));
    expect(addMoreBtn).toBeTruthy();
    await addMoreBtn!.trigger("click");
    expect(wrapper.emitted("addMore")).toBeTruthy();
  });
});
