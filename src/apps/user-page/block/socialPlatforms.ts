const SOCIAL_PLATFORM_ENTRIES = [
  ['bilibili', '哔哩哔哩'],
  ['weibo', '微博'],
  ['xiaohongshu', '小红书'],
  ['douyin', '抖音'],
  ['kuaishou', '快手'],
  ['wechat', '微信'],
  ['zhihu', '知乎'],
  ['youtube', 'YouTube'],
  ['x', 'X'],
  ['discord', 'Discord'],
  ['twitch', 'Twitch'],
  ['qqgroup', 'QQ 群'],
  ['github', 'GitHub'],
  ['website', '网站'],
  ['netease', '网易云音乐'],
  ['spotify', 'Spotify'],
  ['other', '其他链接'],
] as const

export type SocialPlatform = (typeof SOCIAL_PLATFORM_ENTRIES)[number][0]

export const SOCIAL_PLATFORM_OPTIONS = SOCIAL_PLATFORM_ENTRIES.map(([value, label]) => ({ label, value }))
export const SOCIAL_PLATFORM_IDS: readonly SocialPlatform[] = SOCIAL_PLATFORM_ENTRIES.map(([value]) => value)

export const SOCIAL_PLATFORM_NAMES = Object.fromEntries(SOCIAL_PLATFORM_ENTRIES) as Record<SocialPlatform, string>
