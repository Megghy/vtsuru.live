<script setup lang="ts">
import { ArrowRight, CheckCircle2, History, Play, Shuffle, Sparkles } from 'lucide-vue-next'

import type { ReponseVideoCollectVideo } from '@/api/generated/model'
import { Button } from '@/shared/ui/button'
import { SimpleTooltip } from '@/shared/ui/tooltip'
import { normalizeBiliCoverUrl } from '@/shared/utils/videoCollect'

import VideoCollectResultCard from './VideoCollectResultCard.vue'

defineProps<{
  acceptedVideos: ReponseVideoCollectVideo[]
  drawnIds: string[]
  drawnHistory: ReponseVideoCollectVideo[]
  drawnVideo?: ReponseVideoCollectVideo
  drawDisplayVideo?: ReponseVideoCollectVideo
  isDrawing: boolean
  watchedIds: string[]
  canPushObs: boolean
}>()

const emit = defineEmits<{
  draw: []
  selectVideo: [item: ReponseVideoCollectVideo]
  playVideo: [item: ReponseVideoCollectVideo]
  pushToObs: [item: ReponseVideoCollectVideo]
  toggleWatched: [bvid: string]
  selectHistory: [item: ReponseVideoCollectVideo]
}>()
</script>

<template>
  <div class="draw-stage max-w-xl mx-auto space-y-4">
    <div class="draw-stage-header flex-between flex-wrap gap-2 text-xs text-muted-foreground">
      <div class="draw-round-info flex items-center gap-1.5 font-mono tabular-nums">
        <Shuffle class="size-3.5" />
        <span>本轮已抽取</span>
        <strong class="text-foreground">{{ drawnIds.length }} / {{ acceptedVideos.length }}</strong>
      </div>
      <span class="draw-shortcut-tip text-[11px] hidden sm:inline">按空格键快捷抽取</span>
    </div>

    <div
      class="draw-display-box transition-opacity"
      :class="{ 'opacity-80 scale-[0.99]': isDrawing }"
    >
      <VideoCollectResultCard
        v-if="drawDisplayVideo"
        :key="`draw-${drawDisplayVideo.info.bvid}`"
        :item="drawDisplayVideo"
        :index="acceptedVideos.indexOf(drawDisplayVideo)"
        presentation="plain"
        :featured="true"
        :revealed="true"
        :watched="watchedIds.includes(drawDisplayVideo.info.bvid ?? '')"
        :can-push-obs="canPushObs && Boolean(drawnVideo)"
        @select="drawnVideo && emit('selectVideo', drawnVideo)"
        @play="drawnVideo && emit('playVideo', drawnVideo)"
        @push-to-obs="drawnVideo && emit('pushToObs', drawnVideo)"
        @toggle-watched="drawnVideo?.info.bvid && emit('toggleWatched', drawnVideo.info.bvid)"
      />
      <Button
        v-else
        variant="outline"
        class="draw-trigger-placeholder w-full aspect-video rounded-xl border-2 border-dashed border-border/80 hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition flex-col-center gap-2 text-muted-foreground hover:text-foreground h-auto p-4"
        @click="emit('draw')"
      >
        <div class="placeholder-icon size-12 rounded-full bg-primary/10 text-primary flex-center">
          <Sparkles class="size-6" />
        </div>
        <strong class="text-sm">点击开始随机抽取</strong>
        <span class="text-xs text-muted-foreground">或按键盘空格键</span>
      </Button>
    </div>

    <div class="draw-actions-row flex-center flex-wrap gap-2.5 pt-1">
      <Button
        v-if="drawnVideo"
        variant="outline"
        class="gap-1.5"
        @click="emit('playVideo', drawnVideo)"
      >
        <Play class="size-3.5" />
        站内播放
      </Button>
      <Button
        v-if="drawnVideo"
        variant="outline"
        class="gap-1.5"
        @click="emit('selectVideo', drawnVideo)"
      >
        在 B 站打开
        <ArrowRight class="size-3.5" />
      </Button>
      <Button
        size="lg"
        :disabled="isDrawing"
        class="main-draw-btn gap-1.5 px-7"
        @click="emit('draw')"
      >
        <Sparkles class="size-4" />
        {{ drawnVideo ? '继续抽取下一个' : '开始抽取' }}
      </Button>
    </div>

    <!-- 历史抽取记录流 -->
    <div
      v-if="drawnHistory.length > 0"
      class="drawn-history-stream space-y-2 pt-4 border-t border-border/60"
    >
      <div class="history-title flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
        <History class="size-3.5" />
        <span>抽取历史 ({{ drawnHistory.length }})</span>
      </div>
      <div class="history-scroll-track flex gap-2.5 overflow-x-auto scrollbar-thin pb-2">
        <div
          v-for="histItem in drawnHistory"
          :key="`hist-${histItem.info.bvid}`"
          class="history-item-pill flex items-center gap-2 p-1.5 pr-2 rounded-lg border border-border/80 bg-card hover:border-primary/50 cursor-pointer shrink-0 transition-colors"
          :class="{ 'border-primary bg-primary/5': drawnVideo?.info.bvid === histItem.info.bvid }"
          @click="emit('selectHistory', histItem)"
        >
          <img
            :src="normalizeBiliCoverUrl(histItem.video.cover)"
            :alt="histItem.video.title"
            referrerpolicy="no-referrer"
            class="hist-thumb size-9 rounded object-cover bg-muted shrink-0"
          />
          <div class="hist-info flex flex-col text-xs max-w-36 min-w-0">
            <span class="hist-name font-medium truncate">{{ histItem.video.title }}</span>
            <span class="hist-sender text-[11px] text-muted-foreground truncate">
              {{ histItem.info.senders[0]?.sender || histItem.video.ownerName }}
            </span>
          </div>
          <SimpleTooltip
            :content="watchedIds.includes(histItem.info.bvid ?? '') ? '标为未看' : '标为已看'"
          >
            <Button
              size="icon-xs"
              variant="ghost"
              class="shrink-0"
              :aria-label="watchedIds.includes(histItem.info.bvid ?? '') ? '标为未看' : '标为已看'"
              @click.stop="histItem.info.bvid && emit('toggleWatched', histItem.info.bvid)"
            >
              <CheckCircle2
                class="size-3.5"
                :class="
                  watchedIds.includes(histItem.info.bvid ?? '')
                    ? 'text-primary'
                    : 'text-muted-foreground opacity-50'
                "
              />
            </Button>
          </SimpleTooltip>
        </div>
      </div>
    </div>
  </div>
</template>
