/**
 * BroadcastChannel / postMessage 统一入口。
 * structured clone 不能传递 Vue Proxy；浅层 toRaw 也解不开数组/对象里的嵌套响应式。
 * 业务侧只应 post 纯 DTO，这里统一做深拷贝后再发送。
 */
export function toCloneable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function postBroadcastMessage(channel: BroadcastChannel | undefined | null, data: unknown): void {
  channel?.postMessage(toCloneable(data))
}
