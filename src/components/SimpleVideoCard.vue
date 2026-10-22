<script setup lang="ts">
import type { VideoCollectVideo } from '@/api/api-models'
import { Card, CardContent } from '@/shared/ui/card'

defineProps<{
  video: VideoCollectVideo
  width?: number
}>()
</script>

<template>
  <Card
    class="overflow-hidden hover:shadow-md transition-shadow group flex flex-col"
    :style="`max-width: ${width ?? 300}px;`"
  >
    <div class="aspect-video w-full overflow-hidden bg-muted">
      <img
        :src="video.cover"
        referrerpolicy="no-referrer"
        class="size-full object-cover group-hover:scale-105 transition-transform duration-200"
        alt=""
      />
    </div>

    <CardContent class="p-3 space-y-1.5 flex-1 min-w-0">
      <a
        :href="`https://bilibili.com/video/${video.id}`"
        target="_blank"
        rel="noopener noreferrer"
        class="font-medium text-xs text-foreground hover:text-primary transition line-clamp-2 block leading-snug"
        :title="video.title"
      >
        {{ video.title }}
      </a>
      <p
        v-if="video.description"
        class="text-muted-foreground text-[11px] line-clamp-2 leading-relaxed m-0"
        :title="video.description"
      >
        {{ video.description }}
      </p>
    </CardContent>
  </Card>
</template>
