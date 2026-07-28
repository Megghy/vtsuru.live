<script setup lang="ts">
import { NFlex, NIcon } from 'naive-ui';
import type { Component } from 'vue'
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'
import { GlobeOutline, LinkOutline } from '@vicons/ionicons5'
import NeteaseIcon from '@/svgs/netease.svg?component'
import BilibiliIcon from '@/svgs/social/bilibili.svg?component'
import DouyinIcon from '@/svgs/social/douyin.svg?component'
import DiscordIcon from '@/svgs/social/discord.svg?component'
import GithubIcon from '@/svgs/social/github.svg?component'
import KuaishouIcon from '@/svgs/social/kuaishou.svg?component'
import QqIcon from '@/svgs/social/qq.svg?component'
import SpotifyIcon from '@/svgs/social/spotify.svg?component'
import TwitchIcon from '@/svgs/social/twitch.svg?component'
import WechatIcon from '@/svgs/social/wechat.svg?component'
import WeiboIcon from '@/svgs/social/weibo.svg?component'
import XIcon from '@/svgs/social/x.svg?component'
import XiaohongshuIcon from '@/svgs/social/xiaohongshu.svg?component'
import YoutubeIcon from '@/svgs/social/youtube.svg?component'
import ZhihuIcon from '@/svgs/social/zhihu.svg?component'
import { SOCIAL_PLATFORM_NAMES } from '../socialPlatforms'
import type { SocialPlatform } from '../socialPlatforms'

interface SocialItem {
  platform?: SocialPlatform
  url: string
  label?: string
}

interface BlockConfig {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'round' | 'square'
  showLabel?: boolean
  items?: SocialItem[]
  framed?: boolean
  backgrounded?: boolean
}

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return {
    size: (o.size === 'sm' || o.size === 'md' || o.size === 'lg') ? o.size : 'md',
    variant: (o.variant === 'round' || o.variant === 'square') ? o.variant : 'round',
    showLabel: typeof o.showLabel === 'boolean' ? o.showLabel : false,
    items: Array.isArray(o.items) ? o.items : [],
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

function isDomain(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`)
}

function inferPlatform(url: string): SocialPlatform {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (isDomain(host, 'bilibili.com')) return 'bilibili'
    if (isDomain(host, 'weibo.com') || isDomain(host, 'weibo.cn')) return 'weibo'
    if (isDomain(host, 'xiaohongshu.com') || isDomain(host, 'xhslink.com')) return 'xiaohongshu'
    if (isDomain(host, 'douyin.com') || isDomain(host, 'iesdouyin.com')) return 'douyin'
    if (isDomain(host, 'kuaishou.com')) return 'kuaishou'
    if (isDomain(host, 'weixin.qq.com')) return 'wechat'
    if (isDomain(host, 'zhihu.com')) return 'zhihu'
    if (isDomain(host, 'youtube.com') || host === 'youtu.be') return 'youtube'
    if (host === 'x.com' || isDomain(host, 'twitter.com')) return 'x'
    if (isDomain(host, 'discord.com') || host === 'discord.gg') return 'discord'
    if (isDomain(host, 'twitch.tv')) return 'twitch'
    if (isDomain(host, 'github.com')) return 'github'
    if (isDomain(host, 'qm.qq.com')) return 'qqgroup'
    if (isDomain(host, 'spotify.com')) return 'spotify'
    if (isDomain(host, 'music.163.com')) return 'netease'
    return 'website'
  } catch {
    return 'other'
  }
}

function normalize(items: SocialItem[]) {
  return items
    .filter(it => it && typeof it.url === 'string' && it.url.trim().length)
    .map((it) => {
      const url = it.url.trim()
      const platform = (it.platform && String(it.platform).length) ? it.platform : inferPlatform(url)
      const label = (typeof it.label === 'string' && it.label.trim().length) ? it.label.trim() : ''
      return { platform, url, label }
    })
}

const items = computed(() => normalize(cfg.value.items ?? []))

function getAccessibleName(item: { platform: SocialPlatform, label: string }) {
  return `${item.label || SOCIAL_PLATFORM_NAMES[item.platform]}（新窗口打开）`
}

function getStyle(platform: SocialPlatform) {
  const presets: Record<SocialPlatform, { bg: string, fg: string }> = {
    bilibili: { bg: '#fb7299', fg: '#ffffff' },
    weibo: { bg: '#e6162d', fg: '#ffffff' },
    xiaohongshu: { bg: '#ff2442', fg: '#ffffff' },
    douyin: { bg: '#111111', fg: '#ffffff' },
    kuaishou: { bg: '#ff5000', fg: '#ffffff' },
    wechat: { bg: '#07c160', fg: '#ffffff' },
    zhihu: { bg: '#0084ff', fg: '#ffffff' },
    youtube: { bg: '#ff0000', fg: '#ffffff' },
    x: { bg: '#111111', fg: '#ffffff' },
    discord: { bg: '#5865f2', fg: '#ffffff' },
    twitch: { bg: '#9146ff', fg: '#ffffff' },
    qqgroup: { bg: '#12B7F5', fg: '#ffffff' },
    github: { bg: '#24292f', fg: '#ffffff' },
    website: { bg: 'rgba(0, 0, 0, 0.55)', fg: '#ffffff' },
    netease: { bg: '#d33a31', fg: '#ffffff' },
    spotify: { bg: '#1db954', fg: '#ffffff' },
    other: { bg: 'rgba(0, 0, 0, 0.55)', fg: '#ffffff' },
  }
  return presets[platform]
}

const platformIcons = {
  bilibili: BilibiliIcon,
  weibo: WeiboIcon,
  xiaohongshu: XiaohongshuIcon,
  douyin: DouyinIcon,
  kuaishou: KuaishouIcon,
  wechat: WechatIcon,
  zhihu: ZhihuIcon,
  youtube: YoutubeIcon,
  x: XIcon,
  discord: DiscordIcon,
  twitch: TwitchIcon,
  qqgroup: QqIcon,
  github: GithubIcon,
  website: GlobeOutline,
  netease: NeteaseIcon,
  spotify: SpotifyIcon,
  other: LinkOutline,
} satisfies Record<SocialPlatform, Component>

const sizePx = computed(() => {
  if (cfg.value.size === 'sm') return 36
  if (cfg.value.size === 'lg') return 52
  return 44
})

const iconSize = computed(() => {
  if (cfg.value.size === 'sm') return 18
  if (cfg.value.size === 'lg') return 24
  return 20
})
</script>

<template>
  <BlockCard :framed="cfg.framed" :backgrounded="cfg.backgrounded">
    <NFlex
      justify="center"
      wrap
      style="gap: 10px"
    >
      <a
        v-for="(it, idx) in items"
        :key="idx"
        class="social"
        :href="it.url"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="getAccessibleName(it)"
        :title="getAccessibleName(it)"
        :style="{
          '--social-bg': getStyle(it.platform).bg,
          '--social-fg': getStyle(it.platform).fg,
          '--social-size': `${sizePx}px`,
          '--social-radius': cfg.variant === 'round' ? '999px' : '12px',
        }"
      >
        <NIcon :size="iconSize" class="social-icon" aria-hidden="true">
          <component :is="platformIcons[it.platform]" />
        </NIcon>
        <span v-if="cfg.showLabel" class="social-label">
          {{ it.label || SOCIAL_PLATFORM_NAMES[it.platform] }}
        </span>
      </a>
    </NFlex>
  </BlockCard>
</template>

<style scoped>
.social {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: var(--social-size);
  padding: 0 16px;
  min-width: var(--social-size);
  border-radius: var(--social-radius);
  background: var(--social-bg);
  color: var(--social-fg);
  text-decoration: none;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: filter 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.social:hover {
  filter: brightness(1.08);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.social:active {
  filter: brightness(0.95);
  transform: translateY(0);
}
.social :deep(svg) {
  display: block;
  fill: currentColor;
}
.social-label {
  color: var(--social-fg);
  font-weight: 600;
}

.social:focus-visible {
  outline: 2px solid var(--vtsuru-page-primary, var(--vtsuru-brand));
  outline-offset: 3px;
}

</style>
