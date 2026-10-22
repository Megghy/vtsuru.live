<script setup lang="ts">
import {
  ArrowClockwise24Regular,
  Checkmark24Regular,
  Clock24Regular,
  Comment24Regular,
  Dismiss24Regular,
  Open24Regular,
  Person24Regular,
  Play24Filled,
  Video24Regular,
} from '@vicons/fluent'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, ref } from 'vue'

import type { VideoCollectVideo, VideoInfo } from '@/api/api-models'
import { VideoStatus } from '@/api/api-models'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'

const props = withDefaults(
  defineProps<{
    videoInfo: VideoInfo
    videoData: VideoCollectVideo
    loading?: boolean
    selectable?: boolean
    selected?: boolean
    viewMode?: 'list' | 'grid'
  }>(),
  {
    loading: false,
    selectable: true,
    selected: false,
    viewMode: 'list',
  },
)

const emit = defineEmits<{
  updateStatus: [status: VideoStatus, video: VideoInfo]
  toggleSelect: [bvid: string]
  preview: [bvid: string, title: string]
}>()

const coverError = ref(false)
const isExpandedSenders = ref(false)

const primarySender = computed(() => props.videoInfo.senders[0])
const otherSenders = computed(() => props.videoInfo.senders.slice(1))

const actions = computed(() => {
  if (props.videoInfo.status === VideoStatus.Pending) {
    return [
      { label: '通过', status: VideoStatus.Accepted, variant: 'brand' as const, icon: Checkmark24Regular },
      { label: '拒绝', status: VideoStatus.Rejected, variant: 'destructive' as const, icon: Dismiss24Regular },
    ]
  }
  if (props.videoInfo.status === VideoStatus.Accepted) {
    return [
      { label: '退回待审', status: VideoStatus.Pending, variant: 'outline' as const, icon: ArrowClockwise24Regular },
      { label: '拒绝', status: VideoStatus.Rejected, variant: 'destructive' as const, icon: Dismiss24Regular },
    ]
  }
  return [
    { label: '退回待审', status: VideoStatus.Pending, variant: 'outline' as const, icon: ArrowClockwise24Regular },
    { label: '通过', status: VideoStatus.Accepted, variant: 'brand' as const, icon: Checkmark24Regular },
  ]
})

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function toTimestamp(time: unknown): number {
  if (typeof time === 'number') {
    return time < 1e11 ? time * 1000 : time
  }
  if (typeof time === 'string') {
    const parsed = new Date(time).getTime()
    return isNaN(parsed) ? Date.now() : parsed
  }
  if (time instanceof Date) return time.getTime()
  return Date.now()
}

function formatRelative(time: unknown) {
  try {
    return formatDistanceToNow(toTimestamp(time), { addSuffix: true, locale: zhCN })
  } catch {
    return ''
  }
}

function openVideo() {
  window.open(`https://www.bilibili.com/video/${props.videoInfo.bvid}`, '_blank', 'noopener,noreferrer')
}

function triggerPreview() {
  emit('preview', props.videoInfo.bvid, props.videoData.title)
}
</script>

<template>
  <!-- 紧凑列表行视图 (默认) -->
  <article
    v-if="viewMode === 'list'"
    class="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/60 hover:bg-muted/30 transition-all text-foreground"
    :class="{
      'border-brand ring-1 ring-brand bg-brand-soft/10': selected,
      'border-l-4 border-l-emerald-500': videoInfo.status === VideoStatus.Accepted,
      'border-l-4 border-l-destructive opacity-75': videoInfo.status === VideoStatus.Rejected,
    }"
  >
    <!-- 选择框 -->
    <div
      v-if="selectable"
      class="shrink-0 cursor-pointer"
      @click.stop="emit('toggleSelect', videoInfo.bvid)"
    >
      <Checkbox
        :checked="selected"
        @update:checked="emit('toggleSelect', videoInfo.bvid)"
      />
    </div>

    <!-- 缩略图与悬浮预览 -->
    <div
      class="relative w-28 sm:w-32 aspect-[16/9] rounded-md overflow-hidden bg-muted shrink-0 cursor-pointer group"
      role="button"
      tabindex="0"
      :aria-label="`播放预览：${videoData.title}`"
      @click="triggerPreview"
      @keydown.enter="triggerPreview"
    >
      <img
        v-if="!coverError && videoData.cover"
        :src="videoData.cover.replace('http://', 'https://')"
        :alt="videoData.title"
        class="w-full h-full object-cover transition-transform group-hover:scale-105"
        referrerpolicy="no-referrer"
        @error="coverError = true"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center text-muted-foreground"
      >
        <component
          :is="Video24Regular"
          class="h-6 w-6"
        />
      </div>

      <div
        class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <component
          :is="Play24Filled"
          class="h-7 w-7 text-white drop-shadow"
        />
      </div>

      <span
        class="absolute right-1 bottom-1 px-1 py-0.5 rounded bg-black/75 text-[10px] font-mono text-white leading-none"
      >
        {{ formatDuration(videoData.length) }}
      </span>
    </div>

    <!-- 主体元数据与推荐理由 -->
    <div class="min-w-0 flex-1 space-y-1">
      <!-- 标题行 -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          class="text-xs font-semibold text-foreground hover:text-brand transition-colors text-left truncate max-w-sm"
          :title="videoData.title"
          @click="triggerPreview"
        >
          {{ videoData.title }}
        </button>

        <button
          type="button"
          class="text-muted-foreground hover:text-foreground p-0.5 transition-colors"
          title="在哔哩哔哩新窗口打开"
          aria-label="在哔哩哔哩新窗口打开"
          @click.stop="openVideo"
        >
          <component
            :is="Open24Regular"
            class="h-3.5 w-3.5"
          />
        </button>

        <code class="px-1 py-0.5 rounded bg-muted/60 text-[10px] font-mono text-muted-foreground border border-border">
          {{ videoInfo.bvid }}
        </code>

        <span
          class="flex items-center gap-1 text-[11px] text-muted-foreground"
          :title="`UP 主: ${videoData.ownerName}`"
        >
          <component
            :is="Person24Regular"
            class="h-3 w-3"
          />
          <span class="truncate max-w-[120px]">{{ videoData.ownerName }}</span>
        </span>
      </div>

      <!-- 推荐信息行 -->
      <div class="flex items-center gap-2 text-xs flex-wrap">
        <template v-if="primarySender">
          <div
            v-if="primarySender.description"
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 border border-border text-[11px] text-muted-foreground max-w-lg truncate"
            :title="primarySender.description"
          >
            <component
              :is="Comment24Regular"
              class="h-3 w-3 text-brand shrink-0"
            />
            <span class="italic text-foreground">“{{ primarySender.description }}”</span>
            <span class="text-muted-foreground shrink-0">
              — {{ primarySender.sender || '匿名用户' }}
              <span v-if="primarySender.senderId">({{ primarySender.senderId }})</span>
              · {{ formatRelative(primarySender.sendAt) }}
            </span>
          </div>

          <div
            v-else
            class="flex items-center gap-1 text-[11px] text-muted-foreground"
          >
            <component
              :is="Person24Regular"
              class="h-3 w-3"
            />
            <span>{{ primarySender.sender || '匿名用户' }}</span>
            <span v-if="primarySender.senderId">(UID {{ primarySender.senderId }})</span>
            <span>· {{ formatRelative(primarySender.sendAt) }}</span>
          </div>

          <Badge
            v-if="otherSenders.length > 0"
            variant="outline"
            class="more-senders-pill text-[10px] cursor-pointer hover:bg-muted py-0 h-4"
            @click="isExpandedSenders = !isExpandedSenders"
          >
            共 {{ videoInfo.senders.length }} 人推荐 {{ isExpandedSenders ? '▲ 收起' : '▼ 展开' }}
          </Badge>
        </template>
        <span
          v-else
          class="text-xs text-muted-foreground"
          >无推荐人信息</span
        >
      </div>

      <!-- 折叠的其他推荐人 -->
      <div
        v-if="isExpandedSenders && otherSenders.length > 0"
        class="mt-1.5 p-2 rounded-md bg-muted/20 border border-border space-y-1 text-[11px] text-muted-foreground"
      >
        <div
          v-for="(sender, idx) in otherSenders"
          :key="idx"
          class="flex items-center gap-2 flex-wrap"
        >
          <span class="font-medium text-foreground">{{ sender.sender || '匿名用户' }}</span>
          <span v-if="sender.senderId">UID {{ sender.senderId }}</span>
          <span>{{ formatRelative(sender.sendAt) }}</span>
          <span
            v-if="sender.description"
            class="italic text-foreground"
            >“{{ sender.description }}”</span
          >
        </div>
      </div>
    </div>

    <!-- 操作按钮组 -->
    <div class="video-actions flex items-center gap-1 shrink-0">
      <Button
        v-for="action in actions"
        :key="action.status"
        size="xs"
        :variant="action.variant"
        :loading="loading"
        class="px-2"
        @click="emit('updateStatus', action.status, videoInfo)"
      >
        <component
          :is="action.icon"
          class="h-3 w-3 mr-1"
        />
        {{ action.label }}
      </Button>
    </div>
  </article>

  <!-- 网格大图卡片视图 (可选切换) -->
  <article
    v-else
    class="rounded-lg border border-border bg-card overflow-hidden hover:border-brand/40 transition-all flex flex-col text-foreground"
    :class="{
      'border-brand ring-1 ring-brand bg-brand-soft/10': selected,
      'border-t-4 border-t-emerald-500': videoInfo.status === VideoStatus.Accepted,
      'border-t-4 border-t-destructive opacity-75': videoInfo.status === VideoStatus.Rejected,
    }"
  >
    <div class="relative w-full aspect-[16/9] bg-muted group cursor-pointer">
      <div
        class="w-full h-full"
        role="button"
        tabindex="0"
        :aria-label="`播放预览：${videoData.title}`"
        @click="triggerPreview"
        @keydown.enter="triggerPreview"
      >
        <img
          v-if="!coverError && videoData.cover"
          :src="videoData.cover.replace('http://', 'https://')"
          :alt="videoData.title"
          class="w-full h-full object-cover transition-transform group-hover:scale-105"
          referrerpolicy="no-referrer"
          @error="coverError = true"
        />
        <div
          v-else
          class="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-xs gap-1"
        >
          <component
            :is="Video24Regular"
            class="h-8 w-8"
          />
          <span>封面无法加载</span>
        </div>

        <div
          class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <component
            :is="Play24Filled"
            class="h-10 w-10 text-white drop-shadow"
          />
        </div>

        <span
          class="absolute right-1.5 bottom-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono text-white flex items-center gap-1"
        >
          <component
            :is="Clock24Regular"
            class="h-2.5 w-2.5"
          />
          {{ formatDuration(videoData.length) }}
        </span>
      </div>

      <div
        v-if="selectable"
        class="absolute left-2 top-2 p-1 rounded bg-black/50 backdrop-blur-sm cursor-pointer"
        @click.stop="emit('toggleSelect', videoInfo.bvid)"
      >
        <Checkbox
          :checked="selected"
          @update:checked="emit('toggleSelect', videoInfo.bvid)"
        />
      </div>
    </div>

    <div class="p-3 flex-1 flex flex-col justify-between space-y-2">
      <div class="space-y-1.5">
        <div class="flex items-start justify-between gap-1">
          <button
            type="button"
            class="text-xs font-semibold text-foreground hover:text-brand transition-colors text-left line-clamp-2"
            :title="videoData.title"
            @click="triggerPreview"
          >
            {{ videoData.title }}
          </button>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
            title="在哔哩哔哩打开"
            @click.stop="openVideo"
          >
            <component
              :is="Open24Regular"
              class="h-3.5 w-3.5"
            />
          </button>
        </div>

        <div class="flex items-center justify-between text-[11px] text-muted-foreground">
          <span
            class="flex items-center gap-1 truncate max-w-[130px]"
            :title="`UP 主: ${videoData.ownerName}`"
          >
            <component
              :is="Person24Regular"
              class="h-3 w-3"
            />
            <span class="truncate">{{ videoData.ownerName }}</span>
          </span>
          <code class="font-mono text-[10px] bg-muted/60 px-1 py-0.5 rounded">{{ videoInfo.bvid }}</code>
        </div>

        <!-- 推荐信息 -->
        <div
          v-if="primarySender"
          class="text-xs pt-1"
        >
          <div
            v-if="primarySender.description"
            class="p-2 rounded bg-muted/30 border border-border text-[11px] text-muted-foreground space-y-1"
          >
            <p
              class="italic text-foreground line-clamp-2"
              :title="primarySender.description"
            >
              “{{ primarySender.description }}”
            </p>
            <div class="flex items-center justify-between text-[10px]">
              <span>{{ primarySender.sender || '匿名用户' }}</span>
              <span>{{ formatRelative(primarySender.sendAt) }}</span>
            </div>
          </div>
          <div
            v-else
            class="flex items-center justify-between text-[11px] text-muted-foreground"
          >
            <span>{{ primarySender.sender || '匿名用户' }}</span>
            <span>{{ formatRelative(primarySender.sendAt) }}</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="video-actions flex items-center gap-1 pt-2 border-t border-border">
        <Button
          v-for="action in actions"
          :key="action.status"
          size="xs"
          :variant="action.variant"
          :loading="loading"
          class="flex-1"
          @click="emit('updateStatus', action.status, videoInfo)"
        >
          <component
            :is="action.icon"
            class="h-3 w-3 mr-1"
          />
          {{ action.label }}
        </Button>
      </div>
    </div>
  </article>
</template>
