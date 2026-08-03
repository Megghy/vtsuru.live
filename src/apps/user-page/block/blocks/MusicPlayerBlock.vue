<script setup lang="ts">
import { computed } from 'vue'

import BlockCard from '../BlockCard.vue'
import { parseMusicEmbedUrl } from '../embed'
import { getBlockPropertyNumberRange, isBlockPropertyAvailable } from '../propertyCapabilities'

type Provider = 'netease' | 'spotify' | 'custom'

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

const cfg = computed(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as Record<string, unknown>)
      : {}
  const height = Number(o.height)
  const heightRange = getBlockPropertyNumberRange('musicPlayer', o, 'height')!
  return {
    provider: (o.provider === 'spotify' || o.provider === 'custom' ? o.provider : 'netease') as Provider,
    url: typeof o.url === 'string' ? o.url : '',
    height:
      isBlockPropertyAvailable('musicPlayer', o, 'height') && Number.isFinite(height)
        ? Math.min(heightRange.max, Math.max(heightRange.min, height))
        : 300,
    compact: typeof o.compact === 'boolean' ? o.compact : false,
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const frameHeight = computed(() => {
  if (!cfg.value.compact) return cfg.value.height
  if (cfg.value.provider === 'netease') return 86
  if (cfg.value.provider === 'spotify') return 152
  return Math.min(cfg.value.height, 180)
})

const embed = computed(() => {
  if (!cfg.value.url.trim()) return null
  try {
    return parseMusicEmbedUrl(cfg.value.provider, cfg.value.url.trim(), frameHeight.value)
  } catch {
    return null
  }
})
</script>

<template>
  <BlockCard
    class="music-player"
    :class="{ compact: cfg.compact }"
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
    :content-style="{ padding: 0 }"
  >
    <UAlert
      v-if="!embed"
      color="info"
      ><template #description> 未配置可用的音乐链接 </template></UAlert
    >
    <iframe
      v-else
      :src="embed.src"
      :height="frameHeight"
      :title="embed.title"
      :allow="embed.allow"
      :sandbox="embed.sandbox"
      :referrerpolicy="embed.referrerPolicy"
      class="player-frame"
      loading="lazy"
    />
  </BlockCard>
</template>

<style scoped>
.music-player {
  width: 100%;
}
.music-player.compact {
  max-width: 720px;
}
.player-frame {
  display: block;
  width: 100%;
  border: 0;
}
</style>
