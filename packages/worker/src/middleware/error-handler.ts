import { AppError } from "../utils/error";
import type { ErrorResponse } from "../models/api";

/**
 * 全局错误处理中间件
 *
 * AppError → 返回结构化 JSON 错误
 * 未预期错误 → 记录完整现场，对用户返回模糊化提示
 */
export function errorHandler(err: Error, c: { req: { url: string; method: string }; json: (body: ErrorResponse, status: number) => Response }): Response {
  if (err instanceof AppError) {
    return c.json(
      { code: err.code, message: err.message },
      err.status,
    );
  }

  // 未预期的错误：记录完整现场，对用户模糊化
  console.error(JSON.stringify({
    event: "unhandled",
    error: err.message,
    stack: err.stack,
    url: c.req.url,
    method: c.req.method,
  }));

  return c.json(
    { code: "INTERNAL", message: "服务异常，请稍后重试" },
    500,
  );
}
