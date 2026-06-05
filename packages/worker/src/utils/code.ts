/**
 * 生成 6 位分享码
 *
 * 字符集：大写字母 A-Z + 数字 2-9（排除 0/O/1/I/L 以防混淆）
 * 总空间：31^6 ≈ 8.87 亿种组合
 *
 * @returns 6 位分享码字符串
 */
export function generateCode(): string {
  // 排除易混淆字符：0/O, 1/I/L
  const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const LENGTH = 6;

  const bytes = new Uint8Array(LENGTH);
  crypto.getRandomValues(bytes);

  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }

  return code;
}

/**
 * 验证分享码格式是否合法
 *
 * @param code - 待验证的分享码
 * @returns 是否为合法的 6 位分享码
 */
export function isValidCode(code: unknown): code is string {
  if (typeof code !== "string") return false;
  if (code.length !== 6) return false;
  const VALID_CHARS = /^[A-HJ-KM-NP-Z2-9]{6}$/;
  return VALID_CHARS.test(code);
}
