export interface EmbedRenderModel {
  provider: 'bilibili' | 'youtube'
  src: string
  allow: string
  sandbox: string
  title: string
}

function getHostname(url: URL) {
  return url.hostname.toLowerCase()
}

function parseBilibili(url: URL): EmbedRenderModel | null {
  const host = getHostname(url)
  if (!host.endsWith('bilibili.com')) return null
  const path = url.pathname
  const bvMatch = path.match(/\/video\/(BV[a-zA-Z0-9]+)/)
  const avMatch = path.match(/\/video\/(av\d+)/i)
  const bvid = bvMatch?.[1]
  const avid = avMatch?.[1]?.replace(/^av/i, '')
  if (!bvid && !avid) throw new Error('仅支持 bilibili 视频链接（/video/BV... 或 /video/av...）')

  const params = new URLSearchParams()
  params.set('autoplay', '0')
  if (bvid) params.set('bvid', bvid)
  if (avid) params.set('aid', avid)

  return {
    provider: 'bilibili',
    src: `https://player.bilibili.com/player.html?${params.toString()}`,
    title: 'bilibili',
    allow: 'fullscreen; picture-in-picture',
    sandbox: 'allow-scripts allow-same-origin allow-presentation',
  }
}

function parseYoutube(url: URL): EmbedRenderModel | null {
  const host = getHostname(url)
  const isYoutube = host === 'www.youtube.com' || host === 'youtube.com'
  const isYoutuBe = host === 'youtu.be'
  if (!isYoutube && !isYoutuBe) return null

  const videoId = (() => {
    if (isYoutuBe) return url.pathname.replace(/^\//, '')
    if (url.pathname === '/watch') return url.searchParams.get('v') || ''
    const m = url.pathname.match(/\/embed\/([^/]+)/)
    if (m) return m[1]
    return ''
  })()
  if (!videoId) throw new Error('仅支持 YouTube watch/youtu.be/embed 链接')

  return {
    provider: 'youtube',
    src: `https://www.youtube.com/embed/${videoId}`,
    title: 'YouTube',
    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen',
    sandbox: 'allow-scripts allow-same-origin allow-presentation',
  }
}

export function parseEmbedUrl(rawUrl: string, title?: string): EmbedRenderModel {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('embed.url 不是合法 URL')
  }
  if (url.protocol !== 'https:') throw new Error('embed.url 必须使用 https')

  const model = parseBilibili(url) ?? parseYoutube(url)
  if (!model) throw new Error(`不支持的 embed provider: ${url.hostname}`)
  if (title) model.title = title
  return model
}

