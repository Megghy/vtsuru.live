<script setup lang="ts">
import { ChevronDown, ChevronUp, Disc3, X } from 'lucide-vue-next'

import type { ResponseSongModel } from '@/api/generated/model'
import SongPlayer from '@/components/SongPlayer.vue'
import { Button } from '@/shared/ui/button'

defineProps<{
  song: ResponseSongModel | undefined
  minimized: boolean
}>()

const isLrcLoading = defineModel<string | undefined>('isLrcLoading')

const emit = defineEmits<{
  close: []
  toggleMinimize: []
}>()
</script>

<template>
  <Transition name="stage-meta">
    <div
      v-if="song"
      data-site-sticky="bottom"
      class="sticky bottom-3 z-30 max-w-[var(--vtsuru-page-max-width,1180px)] mx-auto px-[clamp(12px,2vw,24px)] mt-4 pointer-events-none"
    >
      <div class="pointer-events-auto rounded-xl border border-border/80 bg-card/95 backdrop-blur-md shadow-lg overflow-hidden">
        <!-- 折叠态迷你条 -->
        <div
          v-if="minimized"
          class="flex-between gap-2 px-3 py-2 text-xs"
        >
          <div class="flex items-center gap-2 min-w-0">
            <Disc3 class="size-4 text-primary shrink-0 animate-spin" />
            <span class="font-medium text-foreground truncate">{{ song.name }}</span>
            <span
              v-if="song.author?.length"
              class="text-muted-foreground truncate hidden sm:inline"
            >
              · {{ song.author.join(' / ') }}
            </span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="展开播放器"
              @click="emit('toggleMinimize')"
            >
              <ChevronUp class="size-3.5" />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="关闭试听"
              @click="emit('close')"
            >
              <X class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- 展开态播放器（收起时用 v-show 保留音频不中断） -->
        <div v-show="!minimized">
          <div class="flex-between gap-2 px-3 py-1 border-b border-border/50 bg-muted/20 text-[11px] text-muted-foreground">
            <span class="inline-flex items-center gap-1.5">
              <Disc3 class="size-3.5 text-primary" />
              正在试听
            </span>
            <Button
              size="xs"
              variant="ghost"
              class="gap-1 h-5 px-1.5 text-[11px]"
              @click="emit('toggleMinimize')"
            >
              <ChevronDown class="size-3" />
              收起
            </Button>
          </div>
          <SongPlayer
            v-model:is-lrc-loading="isLrcLoading"
            :song="song"
            class="border-0 rounded-none"
            @close="emit('close')"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>
