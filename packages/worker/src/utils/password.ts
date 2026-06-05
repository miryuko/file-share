/**
 * 管理员密码哈希工具（基于 Web Crypto API）
 *
 * 使用 PBKDF2 派生密钥，SHA-256 哈希。
 * Workers 环境不支持 bcrypt，使用 Web Crypto API 的原生密码学操作。
 */

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/** 生成 16 字节随机盐 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/** 盐字节 → hex 字符串 */
function saltToHex(salt: Uint8Array): string {
  return Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** hex → 盐字节 */
function hexToSalt(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * 使用 PBKDF2 哈希密码
 *
 * 格式：`pbkdf2:<salt_hex>:<hash_hex>`
 *
 * @param password - 明文密码
 * @returns 哈希字符串
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );

  const hashHex = saltToHex(new Uint8Array(hash));
  return `pbkdf2:${saltToHex(salt)}:${hashHex}`;
}

/**
 * 验证密码
 *
 * @param password - 明文密码
 * @param storedHash - 存储的哈希字符串
 * @returns 是否匹配
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  // 兼容旧版明文密码
  if (!storedHash.startsWith("pbkdf2:")) {
    return password === storedHash;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 3) return false;

  const [, saltHex, hashHex] = parts;
  const salt = hexToSalt(saltHex);

  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );

  const computedHex = saltToHex(new Uint8Array(hash));
  return computedHex === hashHex;
}
