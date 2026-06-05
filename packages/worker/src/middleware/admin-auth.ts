import type { Context, Next } from "hono";
import { verifyJwt } from "../utils/jwt";
import { AppError } from "../utils/error";

/**
 * 管理员认证中间件
 *
 * 从 Authorization header 提取 Bearer token，验证 JWT。
 * 验证失败返回 401。
 *
 * JWT secret 从环境变量 ADMIN_JWT_SECRET 读取。
 */
export function adminAuth(secret: string) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(
        "UNAUTHORIZED",
        401,
        "未登录，请先登录管理员账号",
      );
    }

    const token = authHeader.slice(7);
    const payload = await verifyJwt(token, secret);

    if (!payload) {
      throw new AppError(
        "TOKEN_EXPIRED",
        401,
        "登录已过期，请重新登录",
      );
    }

    await next();
  };
}
