import type { Context, Next } from "hono";

/**
 * 请求日志中间件
 *
 * 记录每个请求的方法、路径、状态码和耗时。
 */
export function logger() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    console.log(JSON.stringify({
      event: "request",
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: duration,
    }));
  };
}
