<script setup lang="ts">
import { ExternalLink, Play } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { type BiliSpaceVideoItem, fetchBiliSpaceVideos } from '@/api/bili-extra'
import type { ResponseUserInfo } from '@/api/generated/model'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Skeleton } from '@/shared/ui/skeleton'

import BlockCard from '../BlockCard.vue'

interface BlockConfig {
  title: string
  keyword: string
  seasonId: number
  count: number
  columns: number
  framed: boolean
  backgrounded: boolean
}

const props = defineProps<{
  blockProps: unknown
  userInfo?: ResponseUserInfo
}>()

const cfg = computed<BlockConfig>(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as Record<string, any>)
      : {}
  return {
    title: typeof o.title === 'string' && o.title.trim() ? o.title.trim() : '最新视频',
    keyword: typeof o.keyword === 'string' ? o.keyword.trim() : '',
    seasonId: Number.isFinite(Number(o.seasonId)) ? Math.max(0, Math.floor(Number(o.seasonId))) : 0,
    count: Number.isFinite(Number(o.count)) ? Math.min(24, Math.max(1, Math.floor(Number(o.count)))) : 6,
    columns: Number.isFinite(Number(o.columns)) ? Math.min(4, Math.max(1, Math.floor(Number(o.columns)))) : 3,
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const loading = ref(false)
const errorText = ref('')
const videos = ref<BiliSpaceVideoItem[]>([])

const gridClass = computed(() => {
  switch (cfg.value.columns) {
    case 1:
      return 'grid-cols-1'
    case 2:
      return 'grid-cols-1 sm:grid-cols-2'
    case 4:
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
    default:
      return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
  }
})

function formatPlay(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return String(n || 0)
}

watch(
  () => [props.userInfo?.biliId, cfg.value.count, cfg.value.keyword, cfg.value.seasonId] as const,
  async ([uid, count, keyword, seasonId]) => {
    if (!uid || uid <= 0) {
      videos.value = []
      return
    }
    loading.value = true
    errorText.value = ''
    try {
      videos.value = await fetchBiliSpaceVideos(uid, {
        page: 1,
        pageSize: count,
        keyword: keyword || undefined,
        seasonId: seasonId || undefined,
      })
    } catch (err) {
      errorText.value = err instanceof Error ? err.message : '加载 B 站投稿失败'
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <BlockCard
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
  >
    <div class="space-y-3 min-w-0">
      <div class="flex-between gap-2">
        <h3 class="text-sm font-semibold text-foreground truncate">{{ cfg.title }}</h3>
        <a
          v-if="userInfo?.biliId"
          :href="`https://space.bilibili.com/${userInfo.biliId}/video`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0 no-underline"
        >
          <span>更多</span>
          <ExternalLink class="size-3" />
        </a>
      </div>

      <div
        v-if="loading"
        class="grid gap-3"
        :class="gridClass"
      >
        <div
          v-for="n in Math.min(cfg.count, 6)"
          :key="n"
          class="space-y-1.5"
        >
          <Skeleton class="aspect-video w-full rounded-[var(--radius)]" />
          <Skeleton class="h-3.5 w-4/5" />
        </div>
      </div>

      <Alert
        v-else-if="errorText"
        variant="destructive"
      >
        <AlertDescription>{{ errorText }}</AlertDescription>
      </Alert>

      <div
        v-else-if="videos.length === 0"
        class="text-xs text-muted-foreground text-center py-6"
      >
        暂无同步到的 B 站视频投稿
      </div>

      <div
        v-else
        class="grid gap-3 min-w-0"
        :class="gridClass"
      >
        <a
          v-for="video in videos"
          :key="video.bvid"
          :href="`https://www.bilibili.com/video/${video.bvid}`"
          target="_blank"
          rel="noopener noreferrer"
          class="group block min-w-0 rounded-[var(--radius)] border border-border bg-card overflow-hidden no-underline text-inherit transition-colors hover:border-primary/50"
        >
          <div class="relative aspect-video bg-muted overflow-hidden">
            <img
              v-if="video.pic"
              :src="video.pic"
              :alt="video.title"
              referrerpolicy="no-referrer"
              loading="lazy"
              class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
            <span
              v-if="video.duration"
              class="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white tabular-nums"
            >
              {{ video.duration }}
            </span>
          </div>
          <div class="p-2.5 space-y-1">
            <div class="text-xs font-medium text-foreground line-clamp-2 leading-snug">
              {{ video.title }}
            </div>
            <div class="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
              <span class="inline-flex items-center gap-0.5">
                <Play class="size-3" />
                {{ formatPlay(video.play) }}
              </span>
              <span v-if="video.pubdate">
                {{ new Date(video.pubdate * 1000).toLocaleDateString() }}
              </span>
            </div>
          </div>
        </a>
      </div>
    </div>
  </BlockCard>
</template>
