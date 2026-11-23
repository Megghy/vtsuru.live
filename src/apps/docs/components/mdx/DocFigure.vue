<script setup lang="ts">
import { Maximize2 } from 'lucide-vue-next'

import { ImagePreview } from '@/shared/ui/image-preview'

defineProps<{
  src?: string
  alt?: string
  title?: string
  caption?: string
  badge?: string
}>()
</script>

<template>
  <figure class="my-5 overflow-hidden rounded-lg border border-border bg-card">
    <div
      v-if="title || badge"
      class="flex-between gap-2 border-b border-border bg-muted/40 px-3.5 py-2"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="flex items-center gap-1"
          aria-hidden="true"
        >
          <span class="size-2 rounded-full bg-border" />
          <span class="size-2 rounded-full bg-border" />
          <span class="size-2 rounded-full bg-border" />
        </span>
        <span
          v-if="title"
          class="truncate text-xs font-medium text-foreground"
        >
          {{ title }}
        </span>
      </div>
      <span
        v-if="badge"
        class="shrink-0 rounded-sm bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand"
      >
        {{ badge }}
      </span>
    </div>

    <div class="bg-inset/50 p-3 sm:p-4">
      <ImagePreview
        v-if="src"
        :src="src"
        :alt="alt || title || '文档配图'"
        wrapper-class="w-full justify-center"
      >
        <template #default="{ open }">
          <button
            type="button"
            class="group relative block w-full overflow-hidden rounded-md border border-border bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="open"
          >
            <img
              :src="src"
              :alt="alt || title || '文档配图'"
              loading="lazy"
              decoding="async"
              data-no-preview
              class="m-0! w-full max-h-[460px] object-contain border-0! rounded-none!"
            />
            <span
              class="pointer-events-none absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-md border border-border bg-background/88 px-2 py-1 text-[11px] font-medium text-foreground opacity-0 shadow-xs backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100"
            >
              <Maximize2 class="size-3" />
              查看大图
            </span>
          </button>
        </template>
      </ImagePreview>

      <div
        v-else
        class="w-full"
      >
        <slot />
      </div>
    </div>

    <figcaption
      v-if="caption"
      class="border-t border-border/70 bg-card px-3.5 py-2 text-center text-xs text-muted-foreground"
    >
      {{ caption }}
    </figcaption>
  </figure>
</template>
