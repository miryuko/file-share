/**
 * 定时清理过期会话和孤儿 R2 文件
 *
 * 由 Cron Trigger 每 5 分钟触发一次。
 *
 * 清理策略：
 * 1. 扫描 KV 中 code: 前缀的所有键
 * 2. 检查每个 session 的 expiresAt
 * 3. 删除已过期 session 对应的 R2 文件
 * 4. 删除过期的 KV 键
 */

interface CleanupStats {
  scanned: number;
  expired: number;
  r2FilesDeleted: number;
  errors: number;
}

/**
 * 执行清理任务
 *
 * @param env - Worker 环境绑定
 * @returns 清理统计
 */
export async function runCleanup(env: {
  FILE_KV: KVNamespace;
  FILE_BUCKET: R2Bucket;
}): Promise<CleanupStats> {
  const stats: CleanupStats = {
    scanned: 0,
    expired: 0,
    r2FilesDeleted: 0,
    errors: 0,
  };

  const now = Date.now();

  try {
    // 列出所有活跃 session
    const list = await env.FILE_KV.list({ prefix: "code:" });

    for (const key of list.keys) {
      stats.scanned++;

      try {
        const raw = await env.FILE_KV.get(key.name);
        if (!raw) continue;

        const session = JSON.parse(raw);

        // 检查是否过期
        if (session.expiresAt && now > session.expiresAt) {
          // 删除 R2 文件
          if (session.files) {
            for (const file of session.files) {
              try {
                await env.FILE_BUCKET.delete(
                  `files/${session.code}/${file.fileId}`,
                );
                stats.r2FilesDeleted++;
              } catch (err) {
                stats.errors++;
                console.error(JSON.stringify({
                  event: "cleanup.r2.delete.failed",
                  code: session.code,
                  fileId: file.fileId,
                  error: String(err),
                }));
              }
            }
          }

          // 删除 KV 键
          await env.FILE_KV.delete(key.name);
          stats.expired++;
        }
      } catch (err) {
        stats.errors++;
        console.error(JSON.stringify({
          event: "cleanup.session.failed",
          key: key.name,
          error: String(err),
        }));
      }
    }
  } catch (err) {
    console.error(JSON.stringify({
      event: "cleanup.list.failed",
      error: String(err),
    }));
    stats.errors++;
  }

  console.log(JSON.stringify({
    event: "cleanup.completed",
    ...stats,
  }));

  return stats;
}
