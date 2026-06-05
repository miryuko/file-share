import { describe, it, expect } from "vitest";
import { exports } from "cloudflare:workers";

describe("Session lifecycle integration", () => {
  it("POST /api/session/create — 给定合法文件列表，应返回 201 和 6 位分享码", async () => {
    const response = await exports.default.fetch(
      new Request("https://localhost/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [
            { filename: "test.txt", size: 1024 },
            { filename: "image.png", size: 2048, contentType: "image/png" },
          ],
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      code: string;
      files: { fileId: string; filename: string }[];
      expiresAt: number;
    };

    expect(body.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(body.files).toHaveLength(2);
    expect(body.files[0].fileId).toBe("file_0");
    expect(body.files[1].fileId).toBe("file_1");
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });

  it("GET /api/session/:code — 给定不存在的分享码，应返回 404", async () => {
    const response = await exports.default.fetch(
      new Request("https://localhost/api/session/XXXXXX"),
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string; message: string };
    expect(body.code).toBe("SESSION_NOT_FOUND");
  });

  it("完整的创建→查询流程", async () => {
    // 1. 创建
    const createRes = await exports.default.fetch(
      new Request("https://localhost/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [
            { filename: "doc.pdf", size: 5000, contentType: "application/pdf" },
          ],
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    const { code } = (await createRes.json()) as { code: string };

    // 2. 查询
    const getRes = await exports.default.fetch(
      new Request(`https://localhost/api/session/${code}`),
    );
    expect(getRes.status).toBe(200);
    const session = (await getRes.json()) as {
      code: string;
      files: { fileId: string; filename: string; size: number }[];
      remainingDownloads: number;
    };
    expect(session.code).toBe(code);
    expect(session.files).toHaveLength(1);
    expect(session.files[0].filename).toBe("doc.pdf");
    expect(session.remainingDownloads).toBe(20);
  });

  it("健康检查应返回 ok", async () => {
    const response = await exports.default.fetch(
      new Request("https://localhost/api/health"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});
