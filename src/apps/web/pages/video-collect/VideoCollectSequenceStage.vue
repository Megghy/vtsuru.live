<script setup lang="ts">
import { ArrowLeft, ArrowRight, Play, PlayCircle, RotateCcw } from 'lucide-vue-next'

import type { ReponseVideoCollectVideo } from '@/api/generated/model'
import { Button } from '@/shared/ui/button'
import { formatVideoDuration, normalizeBiliCoverUrl } from '@/shared/utils/videoCollect'

import VideoCollectResultCard from './VideoCollectResultCard.vue'

defineProps<{
  acceptedVideos: ReponseVideoCollectVideo[]
  sequenceVideo?: ReponseVideoCollectVideo
  sequenceIndex: number
  watchedIds: string[]
  watchedCount: number
  watchedDuration: number
  canPushObs: boolean
}>()

const emit = defineEmits<{
  prev: []
  skip: []
  openCurrent: []
  playCurrent: []
  pushToObs: [item: ReponseVideoCollectVideo]
  toggleWatched: [bvid: string]
  setIndex: [idx: number]
  restart: []
}>()
</script>

<template>
  <div
    v-if="sequenceVideo"
    class="sequence-stage max-w-2xl mx-auto space-y-4"
  >
    <div class="sequence-header flex-between flex-wrap gap-2 text-xs text-muted-foreground">
      <div class="sequence-nav-info flex items-center gap-1.5 font-mono tabular-nums">
        <PlayCircle class="size-3.5 text-primary" />
        <span>当前视频</span>
        <strong class="text-foreground">{{ sequenceIndex + 1 }} / {{ acceptedVideos.length }}</strong>
      </div>
      <span class="sequence-tip text-[11px] hidden sm:inline">左右方向键切换 / 空格键打开播放</span>
    </div>

    <VideoCollectResultCard
      :key="`seq-${sequenceVideo.info.bvid}`"
      :item="sequenceVideo"
      :index="sequenceIndex"
      presentation="plain"
      :featured="true"
      :revealed="true"
      :watched="watchedIds.includes(sequenceVideo.info.bvid ?? '')"
      :can-push-obs="canPushObs"
      @select="emit('openCurrent')"
      @play="emit('playCurrent')"
      @push-to-obs="emit('pushToObs', sequenceVideo)"
      @toggle-watched="sequenceVideo.info.bvid && emit('toggleWatched', sequenceVideo.info.bvid)"
    />

    <div class="sequence-controls flex-center flex-wrap gap-2">
      <Button
        variant="outline"
        :disabled="sequenceIndex === 0"
        class="gap-1.5"
        @click="emit('prev')"
      >
        <ArrowLeft class="size-3.5" />
        上一个
      </Button>
      <Button
        variant="secondary"
        @click="emit('skip')"
      >
        跳过
      </Button>
      <Button
        variant="outline"
        class="gap-1.5"
        @click="emit('playCurrent')"
      >
        <Play class="size-3.5" />
        站内播放
      </Button>
      <Button
        class="gap-1.5"
        @click="emit('openCurrent')"
      >
        在 B 站打开并继续
        <ArrowRight class="size-3.5" />
      </Button>
    </div>

    <!-- 底部胶片播放列表 -->
    <div class="sequence-filmstrip space-y-2 pt-4 border-t border-border/60">
      <div class="filmstrip-label text-xs font-semibold text-muted-foreground">播放列表</div>
      <div class="filmstrip-track flex gap-2 overflow-x-auto scrollbar-thin pb-2">
        <Button
          v-for="(item, idx) in acceptedVideos"
          :key="`strip-${item.info.bvid}`"
          variant="outline"
          size="none"
          class="filmstrip-item flex items-center gap-2 p-1.5 pr-2.5 rounded-lg border border-border/80 bg-card hover:border-primary/50 text-left shrink-0 transition-colors font-normal"
          :class="{
            'border-primary bg-primary/5': idx === sequenceIndex,
            'opacity-60': watchedIds.includes(item.info.bvid ?? ''),
          }"
          @click="emit('setIndex', idx)"
        >
          <span class="strip-index font-mono tabular-nums text-[11px] text-muted-foreground w-4 text-center">
            {{ idx + 1 }}
          </span>
          <img
            :src="normalizeBiliCoverUrl(item.video.cover)"
            :alt="item.video.title"
            referrerpolicy="no-referrer"
            class="strip-thumb size-8 rounded object-cover bg-muted shrink-0"
          />
          <div class="strip-details flex flex-col text-xs max-w-32 min-w-0">
            <span class="strip-title truncate font-medium">{{ item.video.title }}</span>
            <span class="strip-duration font-mono tabular-nums text-[10px] text-muted-foreground">
              {{ formatVideoDuration(item.video.length) }}
            </span>
          </div>
        </Button>
      </div>
    </div>
  </div>

  <div
    v-else
    class="text-center py-16 space-y-3"
  >
    <h3 class="text-lg font-bold">本轮征集视频已全部浏览完毕</h3>
    <p class="text-xs text-muted-foreground">
      已累计观看 {{ watchedCount }} 个视频，总观看时长 {{ formatVideoDuration(watchedDuration) }}
    </p>
    <Button
      class="mt-2 gap-1.5 mx-auto"
      @click="emit('restart')"
    >
      <RotateCcw class="size-3.5" />
      从头再看一轮
    </Button>
  </div>
</template>
