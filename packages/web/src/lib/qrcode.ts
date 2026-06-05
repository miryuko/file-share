/**
 * QR 码生成器 —— 基于 qrcode 库的轻量封装
 *
 * 专为分享码场景设计，生成可直接扫描的 URL 二维码（PNG data URI）。
 * 内部使用 npm qrcode 包，支持所有标准 QR 码格式，确保扫码识别率。
 */
import QRCode from "qrcode";

/**
 * 生成 QR 码 PNG data URI
 *
 * @param text - 要编码的内容（完整 URL）
 * @param size - 输出尺寸（像素），默认 200
 * @returns PNG data URI，可直接用作 img src
 */
export async function generateQRCodeDataURI(text: string, size = 200): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 2,
    width: size,
    color: {
      dark: "#000",
      light: "#fff",
    },
  });
}
