/**
 * Signaling Durable Object — WebRTC 信令服务
 *
 * 每个分享码对应一个 DO 实例，管理发送方和接收方的 WebSocket 连接。
 * 负责转发 SDP offer/answer 和 ICE candidates，以及 ICE 超时检测。
 *
 * 状态机：
 *   waiting → connected → transferring → completed
 *       │         │
 *       └→ expired│
 *                 └→ fallback (NAT 穿透失败)
 *
 * 触发条件：
 *   waiting → connected: 双方 peer 都已 join
 *   waiting → expired: 超时（60s）无第二个 peer
 *   connected → transferring: WebRTC Data Channel 建立（客户端通知）
 *   connected → fallback: ICE 超时（30s）→ 通知双方降级到 R2
 */

interface PeerConnection {
  ws: WebSocket;
  role: "sender" | "receiver";
}

interface SignalingMessage {
  type: string;
  payload?: Record<string, unknown>;
}

const ICE_TIMEOUT_MS = 30_000;
const ROOM_TIMEOUT_MS = 60_000;

export class SignalingDO implements DurableObject {
  private peers: PeerConnection[] = [];
  private iceTimer: ReturnType<typeof setTimeout> | null = null;
  private roomTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private state: DurableObjectState,
    private env: CloudflareBindings,
  ) {
    // 房间超时：60s 内无第二个 peer 则自动清理
    this.roomTimer = setTimeout(() => {
      this.broadcast({
        type: "error",
        payload: { message: "等待超时，对方未加入" },
      });
      this.cleanup();
    }, ROOM_TIMEOUT_MS);
  }

  async fetch(request: Request): Promise<Response> {
    // WebSocket 升级
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // 从 URL 解析角色
    const url = new URL(request.url);
    const role = (url.searchParams.get("role") || "sender") as
      | "sender"
      | "receiver";

    this.handleConnection(server, role);

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleConnection(ws: WebSocket, role: "sender" | "receiver"): void {
    ws.accept();

    // 检查是否已有同角色 peer（拒绝重复）
    const existing = this.peers.find((p) => p.role === role);
    if (existing) {
      ws.send(
        JSON.stringify({
          type: "error",
          payload: { message: "该角色已被占用" },
        }),
      );
      ws.close(4001, "角色冲突");
      return;
    }

    const peer: PeerConnection = { ws, role };
    this.peers.push(peer);

    ws.addEventListener("message", (event) => {
      try {
        const msg: SignalingMessage = JSON.parse(
          typeof event.data === "string" ? event.data : "",
        );
        this.onMessage(peer, msg);
      } catch {
        // 忽略非法消息
      }
    });

    ws.addEventListener("close", () => {
      this.peers = this.peers.filter((p) => p !== peer);
      // 通知另一方
      this.broadcast({ type: "peer-left", payload: {} }, peer);

      // 所有 peer 离开则清理
      if (this.peers.length === 0) {
        this.cleanup();
      }
    });

    ws.addEventListener("error", () => {
      this.peers = this.peers.filter((p) => p !== peer);
      if (this.peers.length === 0) {
        this.cleanup();
      }
    });

    // 检查双方是否都已加入
    if (this.peers.length === 2) {
      // 清除房间超时
      if (this.roomTimer) {
        clearTimeout(this.roomTimer);
        this.roomTimer = null;
      }

      // 通知双方 peer-joined
      for (const p of this.peers) {
        const otherRole = p.role === "sender" ? "receiver" : "sender";
        p.ws.send(
          JSON.stringify({
            type: "peer-joined",
            payload: { role: otherRole },
          }),
        );
      }

      // 启动 ICE 超时计时器
      this.iceTimer = setTimeout(() => {
        this.broadcast({
          type: "fallback",
          payload: { reason: "ICE 连接超时，切换到服务器中转模式" },
        });
        this.cleanup();
      }, ICE_TIMEOUT_MS);
    }
  }

  private onMessage(
    sender: PeerConnection,
    msg: SignalingMessage,
  ): void {
    switch (msg.type) {
      case "offer":
      case "answer":
      case "ice-candidate":
        // 转发给另一方
        this.forwardToOthers(sender, msg);
        break;

      case "connected":
        // Data Channel 已建立，清除 ICE 超时
        if (this.iceTimer) {
          clearTimeout(this.iceTimer);
          this.iceTimer = null;
        }
        break;

      case "fallback":
        // 客户端主动请求降级
        this.broadcast({
          type: "fallback",
          payload: { reason: "对方请求降级到服务器中转" },
        });
        this.cleanup();
        break;

      default:
        break;
    }
  }

  /** 转发消息给除发送者外的所有 peer */
  private forwardToOthers(sender: PeerConnection, msg: SignalingMessage): void {
    for (const peer of this.peers) {
      if (peer !== sender) {
        try {
          peer.ws.send(JSON.stringify(msg));
        } catch {
          // peer 可能已断开
        }
      }
    }
  }

  /** 广播消息给所有 peer */
  private broadcast(
    msg: SignalingMessage,
    exclude?: PeerConnection,
  ): void {
    for (const peer of this.peers) {
      if (peer !== exclude) {
        try {
          peer.ws.send(JSON.stringify(msg));
        } catch {
          // peer 可能已断开
        }
      }
    }
  }

  /** 清理所有连接和计时器 */
  private cleanup(): void {
    if (this.iceTimer) {
      clearTimeout(this.iceTimer);
      this.iceTimer = null;
    }
    if (this.roomTimer) {
      clearTimeout(this.roomTimer);
      this.roomTimer = null;
    }
    for (const peer of this.peers) {
      try {
        peer.ws.close(1000, "会话结束");
      } catch {
        // 可能已关闭
      }
    }
    this.peers = [];
  }
}
