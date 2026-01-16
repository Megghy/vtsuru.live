<script setup lang="ts">
import { NFlex, NIcon, NText } from 'naive-ui'
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'
import {
  GlobeOutline,
  LogoDiscord,
  LogoGithub,
  LogoTwitch,
  LogoTwitter,
  LogoYoutube,
} from '@vicons/ionicons5'
import bilibili from '@/svgs/bilibili.svg'

type Platform =
  | 'bilibili'
  | 'youtube'
  | 'x'
  | 'discord'
  | 'twitch'
  | 'qqgroup'
  | 'github'
  | 'website'
  | 'netease'
  | 'spotify'
  | 'other'

interface SocialItem {
  platform?: Platform
  url: string
  label?: string
}

interface BlockConfig {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'round' | 'square'
  showLabel?: boolean
  items?: SocialItem[]
  framed?: boolean
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
  }
})

function inferPlatform(url: string): Platform {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host.endsWith('bilibili.com')) return 'bilibili'
    if (host.endsWith('youtube.com') || host === 'youtu.be') return 'youtube'
    if (host === 'x.com' || host.endsWith('twitter.com')) return 'x'
    if (host.endsWith('discord.com') || host === 'discord.gg') return 'discord'
    if (host.endsWith('twitch.tv')) return 'twitch'
    if (host.endsWith('github.com')) return 'github'
    if (host.endsWith('qm.qq.com')) return 'qqgroup'
    if (host.endsWith('spotify.com')) return 'spotify'
    if (host.endsWith('music.163.com')) return 'netease'
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

function getStyle(platform: Platform) {
  const presets: Record<Platform, { bg: string, fg: string }> = {
    bilibili: { bg: '#fb7299', fg: '#ffffff' },
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

function getIcon(platform: Platform) {
  if (platform === 'bilibili') return bilibili
  if (platform === 'youtube') return LogoYoutube
  if (platform === 'x') return LogoTwitter
  if (platform === 'discord') return LogoDiscord
  if (platform === 'twitch') return LogoTwitch
  if (platform === 'github') return LogoGithub
  return GlobeOutline
}

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
  <BlockCard :framed="cfg.framed">
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
        :style="{
          '--social-bg': getStyle(it.platform).bg,
          '--social-fg': getStyle(it.platform).fg,
          '--social-size': `${sizePx}px`,
          '--social-radius': cfg.variant === 'round' ? '999px' : '12px',
        }"
      >
        <NIcon :size="iconSize">
          <component :is="getIcon(it.platform)" />
        </NIcon>
        <NText v-if="cfg.showLabel" class="social-label">
          {{ it.label || it.platform }}
        </NText>
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
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
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
}
.social-label {
  color: var(--social-fg);
  font-weight: 600;
}
</style>
