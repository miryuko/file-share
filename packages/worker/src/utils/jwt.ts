/**
 * 简易 JWT 工具（基于 Web Crypto API）
 *
 * 用于管理员认证。签名算法：HMAC-SHA256。
 */

interface JwtPayload {
  sub: string; // subject: "admin"
  iat: number; // issued at
  exp: number; // expiration
}

const ENCODER = new TextEncoder();

/**
 * Base64URL 编码（无填充）
 */
function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Base64URL 解码
 */
function base64UrlDecode(str: string): Uint8Array {
  // 补齐填充
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 签发 JWT token
 *
 * @param payload - JWT payload（sub, iat, exp）
 * @param secret - 签名密钥
 * @returns JWT token 字符串
 */
export async function signJwt(
  payload: JwtPayload,
  secret: string,
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64UrlEncode(
    ENCODER.encode(JSON.stringify(header)),
  );
  const payloadB64 = base64UrlEncode(
    ENCODER.encode(JSON.stringify(payload)),
  );

  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret).buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    ENCODER.encode(signingInput).buffer as ArrayBuffer,
  );

  const signatureB64 = base64UrlEncode(signature);

  return `${signingInput}.${signatureB64}`;
}

/**
 * 验证 JWT token
 *
 * @param token - JWT token 字符串
 * @param secret - 签名密钥
 * @returns 解析后的 payload，验证失败返回 null
 */
export async function verifyJwt(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // 验证签名
    const signingInput = `${headerB64}.${payloadB64}`;

    const key = await crypto.subtle.importKey(
      "raw",
      ENCODER.encode(secret).buffer as ArrayBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signature = base64UrlDecode(signatureB64);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      ENCODER.encode(signingInput).buffer as ArrayBuffer,
    );

    if (!isValid) return null;

    // 解析 payload
    const payloadBytes = base64UrlDecode(payloadB64);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload: JwtPayload = JSON.parse(payloadJson);

    // 检查过期
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
