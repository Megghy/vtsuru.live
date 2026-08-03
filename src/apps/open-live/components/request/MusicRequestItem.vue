<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed } from 'vue'

import type { SongsInfo } from '@/api/api-models'
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
  backgroundColor: 'var(--vtsuru-info)',
  flexShrink: 0,
}))
</script>

<template>
  <UCard
    embedded
    size="small"
    content-style="padding: 8px 12px;"
  >
    <div
      justify="space-between"
      align="center"
      :wrap="false"
    >
      <div
        align="center"
        :size="8"
        :wrap="false"
        style="min-width: 0"
      >
        <span :style="indexStyle">{{ index }}</span>
        <span
          strong
          style="font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
        >
          {{ music.name }}
        </span>
        <UBadge
          v-if="platformTag"
          size="tiny"
          :type="platformTag.type"
          :bordered="false"
        >
          {{ platformTag.label }}
        </UBadge>
        <span
          depth="3"
          style="font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
        >
          {{ music.author?.join('/') }}
        </span>
        <span
          depth="2"
          style="font-size: 12px; white-space: nowrap"
        >
          点歌人: {{ fromName }}
        </span>
      </div>

      <div
        justify="end"
        align="center"
        :size="6"
        :wrap="false"
        style="flex-shrink: 0"
      >
        <UTooltip>
          <UButton
            square
            size="small"
            color="success"
            ghost
            @click="emit('play')"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
          </UButton>
          <template #content> 播放 </template>
        </UTooltip>
        <UTooltip>
          <UButton
            square
            size="small"
            color="warning"
            ghost
            @click="emit('block')"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
          </UButton>
          <template #content> 加入黑名单 </template>
        </UTooltip>
        <UTooltip>
          <UButton
            square
            size="small"
            color="error"
            @click="emit('cancel')"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
          </UButton>
          <template #content> 取消 </template>
        </UTooltip>
      </div>
    </div>
  </UCard>
</template>
