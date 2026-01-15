<script setup lang="ts">
import { NAlert } from 'naive-ui'
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'

type Provider = 'netease' | 'spotify' | 'custom'

interface BlockConfig {
  provider?: Provider
  url?: string
  height?: number
  compact?: boolean
}

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const provider = (o.provider === 'netease' || o.provider === 'spotify' || o.provider === 'custom') ? o.provider : 'netease'
  const height = Number(o.height)
  return {
    provider,
    url: typeof o.url === 'string' ? o.url : '',
    height: Number.isFinite(height) ? Math.min(900, Math.max(60, height)) : 300,
    compact: typeof o.compact === 'boolean' ? o.compact : false,
  }
})

function parseNeteaseOutchain(rawUrl: string, height: number) {
  const u = new URL(rawUrl)
  if (u.hostname.toLowerCase() === 'music.163.com' && u.pathname.startsWith('/outchain/player')) return rawUrl

  const pickIdFrom = (p: string) => {
    const url = new URL(`https://music.163.com/${p.replace(/^\//, '')}`)
    const id = url.searchParams.get('id') || ''
    return id
  }

  const hash = u.hash.replace(/^#/, '')
  const hashPath = hash.startsWith('/') ? hash : (hash.startsWith('/') ? hash : hash)
  const parseFromHash = () => {
    if (!hash) return null
    if (!hash.includes('id=')) return null
    if (hash.includes('/song')) return { type: 2, id: pickIdFrom(hashPath) }
    if (hash.includes('/playlist')) return { type: 0, id: pickIdFrom(hashPath) }
    if (hash.includes('/album')) return { type: 1, id: pickIdFrom(hashPath) }
    return null
  }

  const parseFromPath = () => {
    if (u.pathname.includes('/song')) return { type: 2, id: u.searchParams.get('id') || '' }
    if (u.pathname.includes('/playlist')) return { type: 0, id: u.searchParams.get('id') || '' }
    if (u.pathname.includes('/album')) return { type: 1, id: u.searchParams.get('id') || '' }
    return null
  }

  const parsed = parseFromHash() ?? parseFromPath()
  if (!parsed || !parsed.id) throw new Error('网易云音乐链接无法解析 id（仅支持 song/playlist/album）')

  const params = new URLSearchParams()
  params.set('type', String(parsed.type))
  params.set('id', parsed.id)
  params.set('auto', '0')
  params.set('height', String(Math.max(60, height - 20)))
  return `https://music.163.com/outchain/player?${params.toString()}`
}

function parseSpotifyEmbed(rawUrl: string) {
  const u = new URL(rawUrl)
  const host = u.hostname.toLowerCase()
  if (!host.endsWith('spotify.com')) throw new Error('Spotify 链接必须来自 spotify.com')
  if (u.pathname.startsWith('/embed/')) return rawUrl
  const m = u.pathname.match(/^\/(track|album|playlist|artist|episode|show)\/([^/?#]+)/)
  if (!m) throw new Error('Spotify 链接仅支持 track/album/playlist/... 等常见类型')
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}`
}

const iframeSrc = computed(() => {
  const raw = (cfg.value.url ?? '').trim()
  if (!raw) return ''
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return ''
  }
  if (u.protocol !== 'https:') return ''

  try {
    if (cfg.value.provider === 'netease') return parseNeteaseOutchain(raw, cfg.value.height ?? 300)
    if (cfg.value.provider === 'spotify') return parseSpotifyEmbed(raw)
    return raw
  } catch {
    return ''
  }
})

const allow = computed(() => {
  if (cfg.value.provider === 'spotify') return 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
  return 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
})
</script>

<template>
  <BlockCard class="music-player-block" :content-style="{ padding: 0 }">
    <NAlert v-if="!iframeSrc" type="info" :show-icon="false">
      未配置可用的链接
    </NAlert>

    <iframe
      v-else
      :src="iframeSrc"
      :height="cfg.height"
      class="player-frame"
      :allow="allow"
      loading="lazy"
      referrerpolicy="no-referrer"
    />
  </BlockCard>
</template>

<style scoped>
.music-player-block {
  width: 100%;
}

.player-frame {
  width: 100%;
  border: 0;
  display: block;
}
</style>
