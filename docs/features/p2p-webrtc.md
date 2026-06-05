# P2P WebRTC 直传 (Phase 3)

## 为什么做

文件通过服务器中转（R2）有双重成本：上传带宽 + 存储 + 下载带宽。同一局域网的两台设备也要绕一圈服务器。P2P 直传零服务器带宽、零延迟。

不做的后果：所有文件都走 R2，大文件传输慢且占用存储和带宽。

## 场景

### 场景 1：P2P 直传成功
- 角色：发送方 + 接收方
- 前置条件：双方在线，NAT 可穿透
- 操作：发送方上传文件 → 生成分享码 → 双方建立 WebRTC 连接 → 文件通过 Data Channel 直传
- 期望：文件直接 P2P 传输，不经过服务器

### 场景 2：NAT 穿透失败 → 自动降级
- 前置条件：一方在严格 NAT 后（如企业网络）
- 操作：ICE 连接 30s 超时 → 自动回退到 R2 上传/下载
- 期望：用户无感知降级，传输仍能完成

### 异常场景
- ICE 超时（30s）→ 自动降级 R2，通知双方 "切换到服务器中转模式"
- DO 不可达 → 直接降级到 R2 模式（无 P2P 尝试）
- WebSocket 断开 → 尝试重连 3 次，仍失败则降级
- 一方离线 → DO 等待 60s 后通知另一方降级

## 功能边界

包含：WebSocket 信令、WebRTC Data Channel 文件传输、ICE 超时自动降级
不包含：多接收方 P2P、TURN 服务器（使用免费 STUN）、断点续传（P2P 场景下）

## 架构对齐

- 存储：DO 管理信令状态（内存），R2 作为 fallback 存储
- 新增 DO：`SignalingDO` — 管理一对一的 WebRTC 信令
- API：`/ws/signaling/:code` — WebSocket 端点
- 所属 Phase：Phase 3

## WebSocket 消息协议

### C→S（客户端→服务器）

| type | payload | 说明 |
|------|---------|------|
| `join` | `{ role: "sender" \| "receiver" }` | 加入信令房间 |
| `offer` | `{ sdp: string }` | SDP offer |
| `answer` | `{ sdp: string }` | SDP answer |
| `ice-candidate` | `{ candidate: string, sdpMid?: string, sdpMLineIndex?: number }` | ICE candidate |
| `fallback` | `{}` | 客户端请求降级 |

### S→C（服务器→客户端）

| type | payload | 说明 |
|------|---------|------|
| `peer-joined` | `{ role: string }` | 对方已加入 |
| `offer` | `{ sdp: string }` | 转发 offer |
| `answer` | `{ sdp: string }` | 转发 answer |
| `ice-candidate` | `{ candidate, sdpMid, sdpMLineIndex }` | 转发 ICE candidate |
| `fallback` | `{ reason: string }` | 通知降级到 R2 |
| `peer-left` | `{}` | 对方断开 |
| `error` | `{ message: string }` | 错误信息 |

## 处理流程

```
发送方：创建 Session → 连接 WebSocket → join(sender)
接收方：输入 code → 连接 WebSocket → join(receiver)
  │
  ├─ DO 检测双方 join → 通知 peer-joined 给双方
  │
  ├─ 发送方创建 offer → 通过 DO 转发给接收方
  ├─ 接收方创建 answer → 通过 DO 转发给发送方
  ├─ 双方交换 ICE candidates（通过 DO 转发）
  │
  ├─ ICE 连接建立（<30s）
  │   └─ Data Channel 打开 → 文件直传 → 完成
  │
  └─ ICE 超时（30s）
      └─ DO 通知双方 fallback → 降级 R2 上传/下载

降级逻辑：
  GET /api/session/:code
    │
    ├─ 尝试连接 /ws/signaling/:code
    │   ├─ DO 不可达 → 直接走 R2
    │   └─ 连接成功 → 等待 ICE
    │       ├─ ICE 成功 → P2P
    │       └─ ICE 失败 → R2
    └─
```

## 降级

| 风险 | 处理 |
|------|------|
| ICE 超时 | 30s 后 DO 通知双方 fallback → 使用已有 R2 流程 |
| DO 不可达 | fetch /ws 失败 → 直接使用 R2 |
| WebSocket 断开 | 重连 3 次 → 仍失败则降级 |
| 一方不支持 WebRTC | 检测 RTCPeerConnection 不可用 → 降级 |
