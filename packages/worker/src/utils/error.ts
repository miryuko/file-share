/**
 * 应用自定义错误类
 *
 * services 层抛出此错误，全局 onError 中间件统一捕获并序列化为 JSON 响应。
 * message 必须是用户可读的文案，code 供前端做分支逻辑。
 */
export class AppError extends Error {
  constructor(
    /** 机器可读错误码，前端据此做分支逻辑 */
    public code: string,
    /** HTTP 状态码 */
    public status: number,
    /** 用户可读的错误提示文案 */
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
