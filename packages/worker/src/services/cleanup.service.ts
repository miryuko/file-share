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
  textEntriesDeleted: number;
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
    textEntriesDeleted: 0,
    errors: 0,
  };

  const now = Date.now();

  // 1. 清理过期的文件 session
  try {
    const fileList = await env.FILE_KV.list({ prefix: "code:" });

    for (const key of fileList.keys) {
      stats.scanned++;

      try {
        const raw = await env.FILE_KV.get(key.name);
        if (!raw) continue;

        const session = JSON.parse(raw);

        if (session.expiresAt && now > session.expiresAt) {
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
      event: "cleanup.file_list.failed",
      error: String(err),
    }));
    stats.errors++;
  }

  // 2. 清理过期的文本条目
  try {
    const textList = await env.FILE_KV.list({ prefix: "text:" });

    for (const key of textList.keys) {
      stats.scanned++;

      try {
        const raw = await env.FILE_KV.get(key.name);
        if (!raw) continue;

        const entry = JSON.parse(raw);

        if (entry.expiresAt && now > entry.expiresAt) {
          await env.FILE_KV.delete(key.name);
          stats.textEntriesDeleted++;
        }
      } catch (err) {
        stats.errors++;
        console.error(JSON.stringify({
          event: "cleanup.text.failed",
          key: key.name,
          error: String(err),
        }));
      }
    }
  } catch (err) {
    console.error(JSON.stringify({
      event: "cleanup.text_list.failed",
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
