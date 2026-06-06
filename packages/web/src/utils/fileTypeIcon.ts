/**
 * 根据文件名和 MIME 类型映射到 lucide-vue-next 图标组件名
 *
 * 图标集合来自 lucide-vue-next: File, FileImage, FileText, FileArchive,
 * FileVideo, FileAudio, FileCode, FileSpreadsheet
 */

/** 文件扩展名 → lucide 图标组件名映射 */
const EXTENSION_ICON_MAP: Record<string, string> = {
  // 图片
  jpg: "FileImage",
  jpeg: "FileImage",
  png: "FileImage",
  gif: "FileImage",
  webp: "FileImage",
  svg: "FileImage",
  bmp: "FileImage",
  ico: "FileImage",
  tiff: "FileImage",
  tif: "FileImage",
  heic: "FileImage",
  heif: "FileImage",
  // 文档
  pdf: "FileText",
  doc: "FileText",
  docx: "FileText",
  pages: "FileText",
  rtf: "FileText",
  txt: "FileText",
  md: "FileText",
  log: "FileText",
  // 压缩包
  zip: "FileArchive",
  rar: "FileArchive",
  "7z": "FileArchive",
  tar: "FileArchive",
  gz: "FileArchive",
  bz2: "FileArchive",
  xz: "FileArchive",
  tgz: "FileArchive",
  // 视频
  mp4: "FileVideo",
  avi: "FileVideo",
  mkv: "FileVideo",
  mov: "FileVideo",
  wmv: "FileVideo",
  flv: "FileVideo",
  webm: "FileVideo",
  // 音频
  mp3: "FileAudio",
  wav: "FileAudio",
  flac: "FileAudio",
  aac: "FileAudio",
  ogg: "FileAudio",
  wma: "FileAudio",
  m4a: "FileAudio",
  // 代码
  js: "FileCode",
  ts: "FileCode",
  jsx: "FileCode",
  tsx: "FileCode",
  py: "FileCode",
  rb: "FileCode",
  go: "FileCode",
  rs: "FileCode",
  java: "FileCode",
  c: "FileCode",
  cpp: "FileCode",
  h: "FileCode",
  hpp: "FileCode",
  css: "FileCode",
  scss: "FileCode",
  less: "FileCode",
  html: "FileCode",
  json: "FileCode",
  xml: "FileCode",
  yaml: "FileCode",
  yml: "FileCode",
  toml: "FileCode",
  sh: "FileCode",
  bash: "FileCode",
  sql: "FileCode",
  vue: "FileCode",
  svelte: "FileCode",
  // 电子表格
  xls: "FileSpreadsheet",
  xlsx: "FileSpreadsheet",
  csv: "FileSpreadsheet",
  numbers: "FileSpreadsheet",
  ods: "FileSpreadsheet",
  // 演示文稿
  ppt: "FileText",
  pptx: "FileText",
  key: "FileText",
  odp: "FileText",
};

/**
 * 根据文件信息返回对应的 lucide 图标组件名
 *
 * @param name 文件名（用于提取扩展名）
 * @param _type MIME 类型（保留参数以备将来使用）
 * @returns lucide-vue-next 图标组件名（如 "FileImage"、"FileArchive"）
 *          无法匹配时返回 "File"
 */
export function getFileIconComponent(name: string, _type?: string): string {
  const ext = getExtension(name);
  if (ext && ext in EXTENSION_ICON_MAP) {
    return EXTENSION_ICON_MAP[ext]!;
  }

  // 当扩展名无法匹配时，尝试通过 MIME 类型的主类型推测
  if (_type) {
    const mainType = _type.split("/")[0];
    switch (mainType) {
      case "image":
        return "FileImage";
      case "video":
        return "FileVideo";
      case "audio":
        return "FileAudio";
      case "text":
        return "FileText";
    }
  }

  return "File";
}

/**
 * 获取文件的小写扩展名（不含点号），无法获取时返回空字符串
 */
function getExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1 || lastDot === name.length - 1) return "";
  return name.slice(lastDot + 1).toLowerCase();
}
