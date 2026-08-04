// Google Fonts 按需注入, 随模板懒加载; 主用官方域名, 失败时浏览器自然回退到字体栈
const FONT_HOSTS = ['https://font.webcache.cn', 'https://fonts.googleapis.com']

const loadedFonts = new Set<string>()

/** 按 family 声明加载一款 Google 字体, 幂等。family 形如 'ZCOOL+KuaiLe' 或 'Orbitron:wght@700;900' */
export function ensureGoogleFont(family: string) {
  if (loadedFonts.has(family)) return
  loadedFonts.add(family)

  const head = document.head
  const preconnect = (host: string) => {
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = host
    link.crossOrigin = 'anonymous'
    head.appendChild(link)
  }
  preconnect('https://fonts.gstatic.com')

  // 依次尝试各镜像, 首个成功返回 CSS 的生效
  const tryHost = (index: number) => {
    if (index >= FONT_HOSTS.length) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `${FONT_HOSTS[index]}/css2?family=${family}&display=swap`
    link.onerror = () => {
      link.remove()
      tryHost(index + 1)
    }
    head.appendChild(link)
  }
  tryHost(0)
}
