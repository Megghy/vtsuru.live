import { createDanmakuSocket } from './socket'
import type { DanmakuAuth, DanmakuSocket } from './socket'

const CONNECT_TIMEOUT_MS = 30_000

export type DanmakuStartResult = { success: boolean; message: string }

type LiveEvent = Event & { data?: unknown }

export function rawEventText(data: unknown) {
  return typeof data === 'string' ? data : JSON.stringify(data)
}

export function waitUntilLive(socket: DanmakuSocket, signal: AbortSignal, timeoutMs = CONNECT_TIMEOUT_MS) {
  if (signal.aborted) {
    return Promise.resolve<DanmakuStartResult>({ success: false, message: '弹幕客户端启动已取消' })
  }

  return new Promise<DanmakuStartResult>((resolve) => {
    let settled = false
    const finish = (result: DanmakuStartResult) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }
    const onLive = () => finish({ success: true, message: '' })
    const onClose = () => finish({ success: false, message: '连接在握手完成前关闭' })
    const onError = () => finish({ success: false, message: 'WebSocket 连接发生错误' })
    const onAbort = () => finish({ success: false, message: '弹幕客户端启动已取消' })
    const timeoutId = setTimeout(() => finish({ success: false, message: '连接超时' }), timeoutMs)
    const cleanup = () => {
      clearTimeout(timeoutId)
      socket.removeEventListener('live', onLive)
      socket.removeEventListener('close', onClose)
      socket.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
    }

    socket.addEventListener('live', onLive)
    socket.addEventListener('close', onClose)
    socket.addEventListener('error', onError)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export function connectDanmaku(auth: DanmakuAuth) {
  const socket = createDanmakuSocket(auth)
  const listeners = new Set<(raw: string) => void>()
  const onMessage = (event: Event) => {
    const text = rawEventText((event as LiveEvent).data)
    for (const listener of listeners) listener(text)
  }
  socket.addEventListener('msg', onMessage)

  return {
    socket,
    onRaw(listener: (raw: string) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async start(signal: AbortSignal = new AbortController().signal) {
      const result = await waitUntilLive(socket, signal)
      if (!result.success) socket.close()
      return result
    },
    stop() {
      socket.close()
    },
  }
}
