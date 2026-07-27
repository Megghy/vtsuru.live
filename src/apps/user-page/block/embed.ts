export interface IframeRenderModel {
  src: string
  title: string
  allow: string
  sandbox: string
  referrerPolicy: 'no-referrer'
}

export interface EmbedRenderModel extends IframeRenderModel {
  provider: 'bilibili' | 'youtube'
}

export interface MusicEmbedRenderModel extends IframeRenderModel {
  provider: 'netease' | 'spotify' | 'soundcloud' | 'bandcamp'
}

const VIDEO_ID = /^[\w-]{6,64}$/
const BILIBILI_HOSTS = new Set(['bilibili.com', 'www.bilibili.com', 'm.bilibili.com'])

function parseHttpsUrl(rawUrl: string, field: string): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error(`${field} 不是合法 URL`)
  }
  if (url.protocol !== 'https:') throw new Error(`${field} 必须使用 https`)
  if (url.username || url.password) throw new Error(`${field} 不允许包含用户名或密码`)
  return url
}

function iframe(src: string, title: string, allow: string): IframeRenderModel {
  return {
    src,
    title,
    allow,
    sandbox: 'allow-scripts allow-same-origin allow-presentation',
    referrerPolicy: 'no-referrer',
  }
}

function parseBilibili(url: URL): EmbedRenderModel | null {
  if (!BILIBILI_HOSTS.has(url.hostname.toLowerCase())) return null
  const match = url.pathname.match(/^\/video\/(BV[\da-z]+|av\d+)\/?$/i)
  if (!match) throw new Error('仅支持 bilibili 视频链接（/video/BV... 或 /video/av...）')

  const id = match[1]
  const params = new URLSearchParams({ autoplay: '0' })
  if (id.startsWith('BV')) params.set('bvid', id)
  else params.set('aid', id.replace(/^av/i, ''))

  return {
    provider: 'bilibili',
    ...iframe(`https://player.bilibili.com/player.html?${params}`, 'bilibili 视频', 'fullscreen; picture-in-picture'),
  }
}

function parseYoutube(url: URL): EmbedRenderModel | null {
  const host = url.hostname.toLowerCase()
  if (!['youtube.com', 'www.youtube.com', 'youtu.be'].includes(host)) return null

  const id = host === 'youtu.be'
    ? url.pathname.slice(1)
    : url.pathname === '/watch'
      ? url.searchParams.get('v') ?? ''
      : url.pathname.match(/^\/embed\/([^/]+)\/?$/)?.[1] ?? ''
  if (!VIDEO_ID.test(id)) throw new Error('仅支持 YouTube watch/youtu.be/embed 视频链接')

  return {
    provider: 'youtube',
    ...iframe(
      `https://www.youtube-nocookie.com/embed/${id}`,
      'YouTube 视频',
      'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen',
    ),
  }
}

export function parseEmbedUrl(rawUrl: string, title?: string): EmbedRenderModel {
  const url = parseHttpsUrl(rawUrl, 'embed.url')
  const model = parseBilibili(url) ?? parseYoutube(url)
  if (!model) throw new Error(`不支持的 embed provider: ${url.hostname}`)
  return title?.trim() ? { ...model, title: title.trim() } : model
}

const FEEDBACK_PROVIDERS = [
  { host: 'docs.google.com', path: /^\/forms\/d\/e?\/[^/]+\/viewform\/?$/, query: /^(?:usp|embedded|entry\.\d+)$/ },
  { host: 'forms.office.com', path: /^\/Pages\/ResponsePage\.aspx$/i, query: /^(?:id|origin|route|lang)$/i },
  { host: 'form.jotform.com', path: /^\/\d+\/?$/, query: /^isIframeEmbed$/ },
  { host: 'airtable.com', path: /^\/embed\/[^/]+\/?$/, query: /^(?:backgroundColor|viewControls)$/ },
] as const

export function parseFeedbackEmbedUrl(rawUrl: string): IframeRenderModel {
  const url = parseHttpsUrl(rawUrl, 'feedback.url')
  const provider = FEEDBACK_PROVIDERS.find(it => it.host === url.hostname.toLowerCase() && it.path.test(url.pathname))
  if (!provider) throw new Error(`不支持的 feedback iframe provider: ${url.hostname}`)
  for (const key of url.searchParams.keys()) {
    if (!provider.query.test(key)) throw new Error(`feedback.url 不支持查询参数: ${key}`)
  }
  url.hash = ''
  return {
    ...iframe(url.toString(), '外部留言表单', ''),
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
  }
}

function parseNetease(url: URL, height: number): MusicEmbedRenderModel {
  if (url.hostname.toLowerCase() !== 'music.163.com') throw new Error('网易云音乐链接域名不受支持')
  const isOutchain = url.pathname === '/outchain/player'
  const route = `${url.hash.replace(/^#\/?/, '/') || url.pathname}`
  const routeUrl = new URL(route, 'https://music.163.com')
  const type = isOutchain
    ? Number(url.searchParams.get('type'))
    : routeUrl.pathname.includes('/song') ? 2 : routeUrl.pathname.includes('/playlist') ? 0 : routeUrl.pathname.includes('/album') ? 1 : -1
  const id = isOutchain ? url.searchParams.get('id') : routeUrl.searchParams.get('id') ?? url.searchParams.get('id')
  if (![0, 1, 2].includes(type)) throw new Error('仅支持网易云歌曲、歌单或专辑链接')
  if (!/^\d+$/.test(id ?? '')) throw new Error('仅支持网易云歌曲、歌单或专辑链接')
  const params = new URLSearchParams({ type: String(type), id, auto: '0', height: String(Math.max(60, height - 20)) })
  return { provider: 'netease', ...iframe(`https://music.163.com/outchain/player?${params}`, '网易云音乐播放器', 'autoplay') }
}

function parseSpotify(url: URL): MusicEmbedRenderModel {
  if (url.hostname.toLowerCase() !== 'open.spotify.com') throw new Error('Spotify 链接域名不受支持')
  const match = url.pathname.match(/^\/(?:embed\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)\/?$/)
  if (!match) throw new Error('Spotify 链接类型不受支持')
  return {
    provider: 'spotify',
    ...iframe(`https://open.spotify.com/embed/${match[1]}/${match[2]}`, 'Spotify 播放器', 'autoplay; encrypted-media; fullscreen; picture-in-picture'),
  }
}

function parseCustomMusic(url: URL): MusicEmbedRenderModel {
  const host = url.hostname.toLowerCase()
  if (host === 'w.soundcloud.com' && url.pathname === '/player/') {
    const allowedQuery = /^(?:url|color|auto_play|hide_related|show_comments|show_user|show_reposts|show_teaser|visual|buying|sharing|download|start_track_id)$/
    for (const key of url.searchParams.keys()) {
      if (!allowedQuery.test(key)) throw new Error(`SoundCloud 播放器不支持查询参数: ${key}`)
    }
    const target = url.searchParams.get('url')
    if (!target) throw new Error('SoundCloud 播放器缺少 url 参数')
    const targetUrl = parseHttpsUrl(target, 'soundcloud.url')
    if (!['soundcloud.com', 'api.soundcloud.com'].includes(targetUrl.hostname.toLowerCase())) {
      throw new Error('SoundCloud 播放内容域名不受支持')
    }
    return { provider: 'soundcloud', ...iframe(url.toString(), 'SoundCloud 播放器', 'autoplay') }
  }
  if ((host === 'bandcamp.com' || host.endsWith('.bandcamp.com')) && url.pathname.startsWith('/EmbeddedPlayer/')) {
    if ([...url.searchParams].length) throw new Error('Bandcamp 播放器不支持查询参数')
    return { provider: 'bandcamp', ...iframe(url.toString(), 'Bandcamp 播放器', 'autoplay') }
  }
  throw new Error(`不支持的自定义音乐 provider: ${url.hostname}`)
}

export function parseMusicEmbedUrl(provider: 'netease' | 'spotify' | 'custom', rawUrl: string, height = 300): MusicEmbedRenderModel {
  const url = parseHttpsUrl(rawUrl, 'musicPlayer.url')
  url.hash = provider === 'netease' ? url.hash : ''
  if (provider === 'netease') return parseNetease(url, height)
  if (provider === 'spotify') return parseSpotify(url)
  return parseCustomMusic(url)
}
