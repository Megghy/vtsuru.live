<script setup lang="ts">
import type { VideoCollectVideo } from '@/api/api-models'
import { NCard, NEllipsis, NImage, NText } from 'naive-ui'

defineProps<{
  video: VideoCollectVideo
  width?: number
}>()
</script>

<template>
  <NCard
    size="small"
    hoverable
    :style="`max-width: ${width ?? 300}px;`"
  >
    <template #cover>
      <NImage
        :src="video.cover"
        :img-props="{ referrerpolicy: 'no-referrer' }"
      />
    </template>
    <template #header>
      <a
        :href="`https://bilibili.com/video/${video.id}`"
        target="_blank"
      >
        <NText>
          <NEllipsis>{{ video.title }}</NEllipsis>
        </NText>
      </a>
    </template>
    <NText
      depth="3"
      style="white-space: pre-line"
    >
      <NEllipsis>
        {{ video.description }}
        <template #tooltip>
          <div style="white-space: pre-line; max-width: 300px">
            {{ video.description }}
          </div>
        </template>
      </NEllipsis>
    </NText>
  </NCard>
</template>
