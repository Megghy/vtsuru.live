<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { SongsInfo } from '@/api/api-models'
import { Dismiss16Filled, MusicNote2Play20Filled, PresenceBlocked16Regular } from '@vicons/fluent'
import { NButton, NCard, NFlex, NIcon, NTag, NText, NTooltip } from 'naive-ui';
import { computed } from 'vue'
import { SongFrom } from '@/api/api-models'

const props = defineProps<{
  music: SongsInfo
  fromName: string
  index: number
}>()

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'cancel'): void
  (e: 'block'): void
}>()

const platformTag = computed(() => {
  switch (props.music.from) {
    case SongFrom.Netease:
      return { label: '网易', type: 'error' as const }
    case SongFrom.Kugou:
      return { label: '酷狗', type: 'info' as const }
    default:
      return null
  }
})

const indexStyle = computed<CSSProperties>(() => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 'bold',
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  color: '#fff',
  fontSize: '13px',
  backgroundColor: 'var(--n-info-color)',
  flexShrink: 0,
}))
</script>

<template>
  <NCard
    embedded
    size="small"
    content-style="padding: 8px 12px;"
  >
    <NFlex justify="space-between" align="center" :wrap="false">
      <NFlex align="center" :size="8" :wrap="false" style="min-width: 0;">
        <span :style="indexStyle">{{ index }}</span>
        <NText strong style="font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          {{ music.name }}
        </NText>
        <NTag v-if="platformTag" size="tiny" :type="platformTag.type" :bordered="false">
          {{ platformTag.label }}
        </NTag>
        <NText depth="3" style="font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          {{ music.author?.join('/') }}
        </NText>
        <NText depth="2" style="font-size: 12px; white-space: nowrap;">
          点歌人: {{ fromName }}
        </NText>
      </NFlex>

      <NFlex justify="end" align="center" :size="6" :wrap="false" style="flex-shrink: 0;">
        <NTooltip>
          <template #trigger>
            <NButton circle size="small" type="success" ghost @click="emit('play')">
              <template #icon>
                <NIcon :component="MusicNote2Play20Filled" />
              </template>
            </NButton>
          </template>
          播放
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton circle size="small" type="warning" ghost @click="emit('block')">
              <template #icon>
                <NIcon :component="PresenceBlocked16Regular" />
              </template>
            </NButton>
          </template>
          加入黑名单
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton circle size="small" type="error" @click="emit('cancel')">
              <template #icon>
                <NIcon :component="Dismiss16Filled" />
              </template>
            </NButton>
          </template>
          取消
        </NTooltip>
      </NFlex>
    </NFlex>
  </NCard>
</template>
