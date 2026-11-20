<script setup lang="ts">
import type { VideoData } from '@/api/generated/model'
import { Card, CardContent } from '@/shared/ui/card'
import { ImagePreview } from '@/shared/ui/image-preview'

defineProps<{
  video: VideoData
  width?: number
}>()
</script>

<template>
  <Card
    class="overflow-hidden hover:shadow-md transition-shadow group flex flex-col"
    :style="`max-width: ${width ?? 300}px;`"
  >
    <div class="aspect-video w-full overflow-hidden bg-muted">
      <ImagePreview
        :src="video.cover"
        :alt="video.title"
        wrapper-class="block size-full"
      >
        <template #default="{ open }">
          <button
            type="button"
            class="block size-full cursor-zoom-in p-0 border-0 bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :aria-label="`放大查看 ${video.title}`"
            @click="open()"
          >
            <img
              :src="video.cover"
              referrerpolicy="no-referrer"
              class="size-full object-cover group-hover:scale-105 transition-transform duration-200"
              :alt="video.title"
            />
          </button>
        </template>
      </ImagePreview>
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
