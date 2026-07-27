import { onScopeDispose, ref } from 'vue'

type CacheEntry = {
  value: unknown
  expiresAt: number
}

type PendingEntry = {
  controller: AbortController
  promise: Promise<unknown>
  consumers: Set<symbol>
  settled: boolean
}

export type RuntimeQueryStatus = 'idle' | 'loading' | 'success' | 'error'

const cache = new Map<string, CacheEntry>()
const pending = new Map<string, PendingEntry>()

export function clearUserPageRuntimeCache(key?: string) {
  if (key) {
    cache.delete(key)
    pending.get(key)?.controller.abort()
    pending.delete(key)
    return
  }
  cache.clear()
  for (const request of pending.values()) request.controller.abort()
  pending.clear()
}

async function consumePending<T>(entry: PendingEntry, signal: AbortSignal) {
  const consumer = Symbol('runtime-query-consumer')
  entry.consumers.add(consumer)

  return new Promise<T>((resolve, reject) => {
    const release = () => {
      signal.removeEventListener('abort', abort)
      entry.consumers.delete(consumer)
      if (!entry.settled && entry.consumers.size === 0) entry.controller.abort()
    }
    const abort = () => {
      release()
      reject(new DOMException('请求已取消', 'AbortError'))
    }

    if (signal.aborted) {
      abort()
      return
    }
    signal.addEventListener('abort', abort, { once: true })
    entry.promise.then(
      (value) => {
        release()
        resolve(value as T)
      },
      (cause) => {
        release()
        reject(cause)
      },
    )
  })
}

async function loadCached<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  ttlMs: number,
  force: boolean,
) {
  const cached = cache.get(key)
  if (!force && cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value as T)

  let entry = pending.get(key)
  if (entry?.controller.signal.aborted) {
    pending.delete(key)
    entry = undefined
  }
  if (!entry) {
    const controller = new AbortController()
    entry = {
      controller,
      consumers: new Set(),
      settled: false,
      promise: Promise.resolve(),
    }
    const current = entry
    current.promise = loader(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted && ttlMs > 0) {
          cache.set(key, { value, expiresAt: Date.now() + ttlMs })
        }
        return value
      })
      .finally(() => {
        current.settled = true
        if (pending.get(key) === current) pending.delete(key)
      })
    pending.set(key, current)
  }
  return consumePending<T>(entry, signal)
}

export function useUserPageRuntimeQuery<T>(options: {
  key: () => string
  loader: (signal: AbortSignal) => Promise<T>
  ttlMs?: number
}) {
  const data = ref<T>()
  const error = ref<Error | null>(null)
  const status = ref<RuntimeQueryStatus>('idle')
  let controller: AbortController | null = null

  async function execute(force = false) {
    controller?.abort()
    controller = new AbortController()
    const request = controller
    status.value = 'loading'
    error.value = null

    try {
      const result = await loadCached(options.key(), options.loader, request.signal, options.ttlMs ?? 30_000, force)
      if (controller !== request || request.signal.aborted) return undefined
      data.value = result
      status.value = 'success'
      return result
    } catch (cause) {
      if (request.signal.aborted) return undefined
      const queryError = cause instanceof Error ? cause : new Error(String(cause))
      if (controller === request) {
        error.value = queryError
        status.value = 'error'
      }
      throw queryError
    }
  }

  function cancel() {
    controller?.abort()
    controller = null
    if (status.value === 'loading') status.value = 'idle'
  }

  onScopeDispose(cancel)
  return { data, error, status, execute, cancel }
}
