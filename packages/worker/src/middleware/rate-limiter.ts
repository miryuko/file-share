import type { Context, Next } from "hono";
import { AppError } from "../utils/error";

/**
 * IP 频率限制中间件（基于 KV）
 *
 * 使用 KV 的最终一致性计数器实现每分钟请求限制。
 * 键格式：rate:{IP}:{windowTimestamp}
 *
 * @param namespace - KV namespace 用于存储计数器
 * @param maxRequests - 每分钟最大请求数，-1 = 无限制，默认 10
 */
export function rateLimiter(
  namespace: KVNamespace,
  maxRequests = 10,
) {
  // 无限制时直接放行
  if (maxRequests === -1) {
    return async (_c: Context, next: Next) => {
      await next();
    };
  }
  return async (c: Context, next: Next) => {
    const clientIP = c.req.header("CF-Connecting-IP") || "unknown";
    // 按分钟窗口计算
    const windowTs = Math.floor(Date.now() / 60000);
    const key = `rate:${clientIP}:${windowTs}`;

    try {
      const current = await namespace.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= maxRequests) {
        throw new AppError(
          "RATE_LIMIT",
          429,
          "操作过于频繁，请稍后重试",
        );
      }

      // 递增计数，设置 TTL 为 2 分钟（超过窗口期自动清理）
      await namespace.put(key, String(count + 1), { expirationTtl: 120 });
    } catch (err) {
      if (err instanceof AppError) throw err;
      // KV 不可用时放行（不因限流器的故障而阻塞正常请求）
      console.warn(JSON.stringify({
        event: "rate_limiter.error",
        ip: clientIP,
        error: String(err),
      }));
    }

    await next();
  };
}
