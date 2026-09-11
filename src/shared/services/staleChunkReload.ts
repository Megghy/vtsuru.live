export const CHUNK_RELOAD_KEY = 'vtsuru:chunk-reload-at'
export const CHUNK_RELOAD_COOLDOWN_MS = 10_000

const STALE_CHUNK_RE = /Failed to fetch dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type|Unable to preload CSS/

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

export function installStaleChunkReload() {
  if (typeof window === 'undefined') return

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    reloadOnStaleChunk()
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = String(reason?.message ?? reason ?? '')
    if (!isStaleChunkMessage(message)) return
    reloadOnStaleChunk()
  })
}
