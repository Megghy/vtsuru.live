/**
 * OBS 组件专属字体动态加载器
 * 基于国内高速镜像 https://font.webcache.cn/
 */
const loadedFonts = new Set<string>()

/**
 * 动态加载 Google Fonts（经 font.webcache.cn 国内高速镜像）
 * @param fontFamilies 字体家族名称列表，如 ['Orbitron:wght@700;900', 'Share+Tech+Mono']
 */
export function loadObsStoreFonts(fontFamilies: string[]): void {
  if (typeof document === 'undefined') return

  const pending = fontFamilies.filter((f) => !loadedFonts.has(f))
  if (pending.length === 0) return

  pending.forEach((f) => loadedFonts.add(f))

  const query = pending.map((f) => `family=${f.replace(/ /g, '+')}`).join('&')
  const href = `https://font.webcache.cn/google/css2?${query}&display=swap`

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.dataset.vtsuruObsFont = 'true'
  document.head.appendChild(link)
}

/**
 * 预定义各时钟/挂件主题推荐的字体配置
 */
export const OBS_CLOCK_FONTS = [
  'Orbitron:wght@700;900',
  'Share+Tech+Mono',
  'Bebas+Neue',
  'Oswald:wght@600;700',
  'Inter:wght@700;800;900',
  'Rajdhani:wght@600;700',
  'Plus+Jakarta+Sans:wght@700;800',
  'Space+Grotesk:wght@700',
  'Gaegu:wght@700',
  'Great+Vibes',
  'Playfair+Display:ital,wght@0,600;0,800;1,400',
  'Quicksand:wght@600;700',
  'Press+Start+2P',
  'Silkscreen:wght@400;700',
  'VT323',
  'Chakra+Petch:ital,wght@1,700',
]
