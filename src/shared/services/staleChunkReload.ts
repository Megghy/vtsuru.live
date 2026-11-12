export const CHUNK_RELOAD_KEY = 'vtsuru:chunk-reload-at'
export const CHUNK_RELOAD_COOLDOWN_MS = 10_000

const STALE_CHUNK_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type|Unable to preload CSS/

export function shouldReloadForStaleChunk(now = Date.now(), lastRaw?: string | null) {
  const last = Number(lastRaw || 0)
  if (!Number.isFinite(last) || last <= 0) return true
  return now - last >= CHUNK_RELOAD_COOLDOWN_MS
}

export function isStaleChunkMessage(message: string) {
  return STALE_CHUNK_RE.test(message)
}

export function reloadOnStaleChunk(
  storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage,
  reload: () => void = () => location.reload(),
  now = Date.now(),
) {
  if (!shouldReloadForStaleChunk(now, storage.getItem(CHUNK_RELOAD_KEY))) return false
  storage.setItem(CHUNK_RELOAD_KEY, String(now))
  reload()
  return true
}

export function onVitePreloadError(
  event: { payload?: unknown; preventDefault?: () => void },
  storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage,
  reload: () => void = () => location.reload(),
  now = Date.now(),
) {
  const message = event.payload instanceof Error ? event.payload.message : String(event.payload ?? '')
  if (!isStaleChunkMessage(message)) return false
  // preventDefault 会让 Vite 把这次 import 当成成功并 resolve 成 undefined，调用方解构结果会抛
  // "undefined has no properties"。刷新交给 reload，失败的 import 继续 reject。
  return reloadOnStaleChunk(storage, reload, now)
}

export function installStaleChunkReload() {
  if (typeof window === 'undefined') return

  window.addEventListener('vite:preloadError', (event) => {
    onVitePreloadError(event as Event & { payload?: unknown })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = String(reason?.message ?? reason ?? '')
    if (!isStaleChunkMessage(message)) return
    reloadOnStaleChunk()
  })
}
