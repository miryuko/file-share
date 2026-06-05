/**
 * WebRTC P2P 文件传输 composable
 *
 * 流程：
 * 1. 连接 WebSocket 信令服务器
 * 2. 创建 RTCPeerConnection
 * 3. 通过信令交换 SDP 和 ICE candidates
 * 4. 建立 Data Channel → 传输文件
 * 5. ICE 超时 → 自动降级通知
 */

import { ref, type Ref } from "vue";

/** WebSocket 信令消息 */
interface SignalingMessage {
  type: string;
  payload?: Record<string, unknown>;
}

/** P2P 连接状态 */
export type P2PStatus =
  | "idle"
  | "connecting"
  | "signaling"
  | "connected"
  | "transferring"
  | "fallback"
  | "error";

/** STUN 服务器配置 */
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useWebRTC(): {
  status: Ref<P2PStatus>;
  connect: (code: string, role: "sender" | "receiver") => Promise<void>;
  sendFile: (file: File) => Promise<void>;
  onFileReceived: (callback: (file: { name: string; data: ArrayBuffer; size: number }) => void) => void;
  onFallback: (callback: () => void) => void;
  disconnect: () => void;
} {
  const status = ref<P2PStatus>("idle");
  let ws: WebSocket | null = null;
  let pc: RTCPeerConnection | null = null;
  let dataChannel: RTCDataChannel | null = null;
  let iceTimeout: ReturnType<typeof setTimeout> | null = null;
  let fallbackCallback: (() => void) | null = null;
  let fileReceivedCallback: ((file: { name: string; data: ArrayBuffer; size: number }) => void) | null = null;
  let receivedChunks: ArrayBuffer[] = [];
  let receivedFileName = "";
  let receivedFileSize = 0;

  const ICE_TIMEOUT_MS = 25_000; // 稍短于 DO 的 30s

  async function connect(
    code: string,
    role: "sender" | "receiver",
  ): Promise<void> {
    status.value = "connecting";

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${location.host}/ws/signaling/${code}?role=${role}`;

    return new Promise((resolve, reject) => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          status.value = "signaling";

          // 创建 RTCPeerConnection
          pc = new RTCPeerConnection(ICE_SERVERS);

          pc.onicecandidate = (event) => {
            if (event.candidate && ws?.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "ice-candidate",
                  payload: {
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                  },
                }),
              );
            }
          };

          pc.onconnectionstatechange = () => {
            if (pc?.connectionState === "connected") {
              if (iceTimeout) clearTimeout(iceTimeout);
              status.value = "connected";
            }
          };

          if (role === "sender") {
            createDataChannelAndOffer(pc, ws!);
          } else {
            // Receiver: listen for data channel
            pc.ondatachannel = (event) => {
              setupDataChannel(event.channel);
            };
          }

          // ICE 超时检测
          iceTimeout = setTimeout(() => {
            if (status.value !== "connected") {
              status.value = "fallback";
              fallbackCallback?.();
              if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "fallback", payload: {} }));
              }
              disconnect();
            }
          }, ICE_TIMEOUT_MS);

          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const msg: SignalingMessage = JSON.parse(event.data);
            handleSignalingMessage(msg, role, pc!, ws!);
          } catch {
            // 忽略非法消息
          }
        };

        ws.onerror = () => {
          // WebSocket 失败 → 直接降级
          status.value = "fallback";
          fallbackCallback?.();
          reject(new Error("WebSocket connection failed"));
        };

        ws.onclose = () => {
          if (status.value !== "fallback" && status.value !== "connected") {
            status.value = "fallback";
            fallbackCallback?.();
          }
        };
      } catch (err) {
        // RTCPeerConnection 不可用 → 降级
        status.value = "fallback";
        fallbackCallback?.();
        reject(err);
      }
    });
  }

  async function createDataChannelAndOffer(
    peerConnection: RTCPeerConnection,
    websocket: WebSocket,
  ): Promise<void> {
    dataChannel = peerConnection.createDataChannel("file-transfer", {
      ordered: true,
    });
    setupDataChannel(dataChannel);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    websocket.send(
      JSON.stringify({
        type: "offer",
        payload: { sdp: offer.sdp },
      }),
    );
  }

  function setupDataChannel(channel: RTCDataChannel): void {
    dataChannel = channel;

    channel.onopen = () => {
      status.value = "connected";
      if (iceTimeout) clearTimeout(iceTimeout);
    };

    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        // 元数据消息（文件名、大小、是否为最后一块）
        try {
          const meta = JSON.parse(event.data);
          if (meta.type === "file-meta") {
            receivedFileName = meta.name;
            receivedFileSize = meta.size;
            receivedChunks = [];
          } else if (meta.type === "file-end") {
            // 合并所有分片
            const totalLength = receivedChunks.reduce(
              (sum, c) => sum + c.byteLength,
              0,
            );
            const combined = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of receivedChunks) {
              combined.set(new Uint8Array(chunk), offset);
              offset += chunk.byteLength;
            }
            fileReceivedCallback?.({
              name: receivedFileName,
              data: combined.buffer,
              size: receivedFileSize,
            });
            status.value = "transferring";
          }
        } catch { /* ignore */ }
      } else if (event.data instanceof ArrayBuffer) {
        receivedChunks.push(event.data);
      }
    };
  }

  function handleSignalingMessage(
    msg: SignalingMessage,
    role: "sender" | "receiver",
    peerConnection: RTCPeerConnection,
    websocket: WebSocket,
  ): void {
    switch (msg.type) {
      case "peer-joined":
        // 对方已加入，发送方开始创建 offer
        break;

      case "offer":
        if (role === "receiver" && msg.payload?.sdp) {
          handleOffer(peerConnection, websocket, msg.payload.sdp as string);
        }
        break;

      case "answer":
        if (role === "sender" && msg.payload?.sdp) {
          peerConnection.setRemoteDescription(
            new RTCSessionDescription({
              type: "answer",
              sdp: msg.payload.sdp as string,
            }),
          );
        }
        break;

      case "ice-candidate":
        if (msg.payload?.candidate) {
          peerConnection.addIceCandidate(
            new RTCIceCandidate({
              candidate: msg.payload.candidate as string,
              sdpMid: msg.payload.sdpMid as string | undefined,
              sdpMLineIndex: msg.payload.sdpMLineIndex as number | undefined,
            }),
          );
        }
        break;

      case "fallback":
        status.value = "fallback";
        fallbackCallback?.();
        disconnect();
        break;

      case "peer-left":
        if (status.value !== "connected") {
          status.value = "fallback";
          fallbackCallback?.();
          disconnect();
        }
        break;

      case "error":
        console.warn("Signaling error:", msg.payload?.message);
        break;
    }
  }

  async function handleOffer(
    peerConnection: RTCPeerConnection,
    websocket: WebSocket,
    sdp: string,
  ): Promise<void> {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription({ type: "offer", sdp }),
    );

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    websocket.send(
      JSON.stringify({
        type: "answer",
        payload: { sdp: answer.sdp },
      }),
    );
  }

  async function sendFile(file: File): Promise<void> {
    if (!dataChannel || dataChannel.readyState !== "open") {
      throw new Error("Data Channel 未就绪");
    }

    status.value = "transferring";

    const CHUNK_SIZE = 16 * 1024; // 16KB per chunk
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 发送文件元数据
    dataChannel.send(
      JSON.stringify({
        type: "file-meta",
        name: file.name,
        size: file.size,
        totalChunks,
      }),
    );

    // 分块发送
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const buffer = await chunk.arrayBuffer();
      dataChannel.send(buffer);
    }

    // 发送结束信号
    dataChannel.send(JSON.stringify({ type: "file-end" }));
  }

  function onFileReceived(
    callback: (file: { name: string; data: ArrayBuffer; size: number }) => void,
  ): void {
    fileReceivedCallback = callback;
  }

  function onFallback(callback: () => void): void {
    fallbackCallback = callback;
  }

  function disconnect(): void {
    if (iceTimeout) clearTimeout(iceTimeout);
    if (dataChannel) {
      dataChannel.close();
      dataChannel = null;
    }
    if (pc) {
      pc.close();
      pc = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    if (status.value !== "fallback") {
      status.value = "idle";
    }
  }

  return {
    status,
    connect,
    sendFile,
    onFileReceived,
    onFallback,
    disconnect,
  };
}
