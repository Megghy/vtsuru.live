<script setup lang="ts">
import type { VideoCollectVideo } from '@/api/api-models'
defineProps<{
  video: VideoCollectVideo
  width?: number
}>()
</script>

<template>
  <UCard
    class="simple-video-card"
    :style="`max-width: ${width ?? 300}px;`"
  >
    <img
      class="simple-video-card__cover"
      :src="video.cover"
      :alt="video.title"
      referrerpolicy="no-referrer"
    />
    <a
      class="simple-video-card__title"
      :href="`https://bilibili.com/video/${video.id}`"
      target="_blank"
      rel="noreferrer"
    >
      {{ video.title }}
    </a>
    <UTooltip :text="video.description">
      <p class="simple-video-card__description">{{ video.description }}</p>
    </UTooltip>
  </UCard>
</template>

<style scoped>
.simple-video-card {
  overflow: hidden;
}

.simple-video-card__cover {
  display: block;
  width: calc(100% + 32px);
  aspect-ratio: 16 / 9;
  margin: -16px -16px 16px;
  object-fit: cover;
}

.simple-video-card__title,
.simple-video-card__description {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
}

.simple-video-card__title {
  -webkit-line-clamp: 2;
  color: var(--vtsuru-fg);
  font-weight: 600;
  line-height: 1.45;
}

.simple-video-card__description {
  margin: 8px 0 0;
  -webkit-line-clamp: 3;
  color: var(--vtsuru-fg-muted);
  white-space: pre-line;
}
</style>
