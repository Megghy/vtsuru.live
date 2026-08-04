const FONT_HOSTS = ['https://font.webcache.cn', 'https://fonts.googleapis.com']
const FONT_LOAD_TIMEOUT = 8_000
const fontLoads = new Map<string, Promise<void>>()
let fontLoadError: Error | undefined

function getFontDefinition(family: string) {
  const [name, variation] = family.split(':')
  const weights = variation?.match(/wght@([\d;]+)/)?.[1].split(';') ?? ['400']
  return { name: name.replaceAll('+', ' '), weights }
}

async function loadFontStylesheet(family: string, hostIndex = 0): Promise<void> {
  if (hostIndex >= FONT_HOSTS.length) throw new Error(`字体 ${family} 加载失败`)

  await new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    const timeout = window.setTimeout(() => link.onerror?.(new Event('timeout')), FONT_LOAD_TIMEOUT)
    link.rel = 'stylesheet'
    link.href = `${FONT_HOSTS[hostIndex]}/css2?family=${family}&display=swap`
    link.onload = () => {
      window.clearTimeout(timeout)
      resolve()
    }
    link.onerror = () => {
      window.clearTimeout(timeout)
      link.remove()
      loadFontStylesheet(family, hostIndex + 1).then(resolve, reject)
    }
    document.head.appendChild(link)
  })
}

/** 按 family 声明加载一款 Google 字体, 幂等。family 形如 'ZCOOL+KuaiLe' 或 'Orbitron:wght@700;900' */
export async function ensureGoogleFont(family: string) {
  const existing = fontLoads.get(family)
  if (existing) return existing

  if (!document.querySelector('link[data-schedule-font-preconnect]')) {
    const link = document.createElement('link')
    link.dataset.scheduleFontPreconnect = ''
    link.rel = 'preconnect'
    link.href = 'https://fonts.gstatic.com'
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  }

  const { name, weights } = getFontDefinition(family)
  const loading = loadFontStylesheet(family)
    .then(async () => {
      await Promise.all(
        weights.map(async (weight) => document.fonts.load(`${weight} 16px "${name}"`, 'SCHEDULE 0123456789')),
      )
    })
    .then(() => undefined)
    .catch((error: unknown) => {
      fontLoadError = error instanceof Error ? error : new Error(`字体 ${family} 加载失败`)
    })
  fontLoads.set(family, loading)
  await loading
}

export async function waitForScheduleFonts() {
  await Promise.all(fontLoads.values())
  if (fontLoadError) throw fontLoadError
  await document.fonts.ready
}

export const scheduleFontStylesheetDomains = FONT_HOSTS.map((host) => new URL(host).hostname)
