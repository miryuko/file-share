import { describe, it, expect } from "vitest";
import { getFileIconComponent } from "../../../src/utils/fileTypeIcon";

describe("getFileIconComponent", () => {
  // ── 正常路径 ──

  it("给定 .jpg 文件，应返回 FileImage", () => {
    expect(getFileIconComponent("photo.jpg")).toBe("FileImage");
  });

  it("给定 .png 文件，应返回 FileImage", () => {
    expect(getFileIconComponent("screenshot.png")).toBe("FileImage");
  });

  it("给定 .pdf 文件，应返回 FileText", () => {
    expect(getFileIconComponent("document.pdf")).toBe("FileText");
  });

  it("给定 .zip 文件，应返回 FileArchive", () => {
    expect(getFileIconComponent("archive.zip")).toBe("FileArchive");
  });

  it("给定 .mp4 文件，应返回 FileVideo", () => {
    expect(getFileIconComponent("video.mp4")).toBe("FileVideo");
  });

  it("给定 .mp3 文件，应返回 FileAudio", () => {
    expect(getFileIconComponent("song.mp3")).toBe("FileAudio");
  });

  it("给定 .ts 文件，应返回 FileCode", () => {
    expect(getFileIconComponent("app.ts")).toBe("FileCode");
  });

  it("给定 .xlsx 文件，应返回 FileSpreadsheet", () => {
    expect(getFileIconComponent("data.xlsx")).toBe("FileSpreadsheet");
  });

  it("给定 .csv 文件，应返回 FileSpreadsheet", () => {
    expect(getFileIconComponent("export.csv")).toBe("FileSpreadsheet");
  });

  it("给定 .txt 文件，应返回 FileText", () => {
    expect(getFileIconComponent("readme.txt")).toBe("FileText");
  });

  it("给定 .docx 文件，应返回 FileText", () => {
    expect(getFileIconComponent("report.docx")).toBe("FileText");
  });

  // ── MIME type fallback ──

  it("给定未知扩展名但 MIME 为 image/png，应返回 FileImage", () => {
    expect(getFileIconComponent("file.unknown", "image/png")).toBe("FileImage");
  });

  it("给定未知扩展名但 MIME 为 video/mp4，应返回 FileVideo", () => {
    expect(getFileIconComponent("movie.xyz", "video/mp4")).toBe("FileVideo");
  });

  it("给定未知扩展名但 MIME 为 audio/mpeg，应返回 FileAudio", () => {
    expect(getFileIconComponent("track.abc", "audio/mpeg")).toBe("FileAudio");
  });

  it("给定未知扩展名但 MIME 为 text/plain，应返回 FileText", () => {
    expect(getFileIconComponent("notes.unk", "text/plain")).toBe("FileText");
  });

  // ── 边界情况 ──

  it("给定没有扩展名的文件，应返回 File", () => {
    expect(getFileIconComponent("Makefile")).toBe("File");
  });

  it("给定以点结尾的文件名，应返回 File", () => {
    expect(getFileIconComponent("something.")).toBe("File");
  });

  it("给定大写扩展名，应返回对应图标", () => {
    expect(getFileIconComponent("IMAGE.JPG")).toBe("FileImage");
  });

  it("给定混合大小写扩展名，应返回对应图标", () => {
    expect(getFileIconComponent("Doc.PDF")).toBe("FileText");
  });

  it("给定空字符串文件名，应返回 File", () => {
    expect(getFileIconComponent("")).toBe("File");
  });

  it("给定带多个点的文件名，应使用最后一个扩展名", () => {
    expect(getFileIconComponent("archive.tar.gz")).toBe("FileArchive");
  });

  it("给定 .webp 文件，应返回 FileImage", () => {
    expect(getFileIconComponent("image.webp")).toBe("FileImage");
  });

  it("给定 .svg 文件，应返回 FileImage", () => {
    expect(getFileIconComponent("icon.svg")).toBe("FileImage");
  });

  it("给定 .7z 文件，应返回 FileArchive", () => {
    expect(getFileIconComponent("backup.7z")).toBe("FileArchive");
  });
});
