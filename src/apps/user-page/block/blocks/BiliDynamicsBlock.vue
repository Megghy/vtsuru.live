<script setup lang="ts">
import { ExternalLink, Play } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { type BiliSpaceDynamicItem, fetchBiliSpaceDynamics } from '@/api/bili-extra'
import type { ResponseUserInfo } from '@/api/generated/model'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Skeleton } from '@/shared/ui/skeleton'

import BlockCard from '../BlockCard.vue'

interface BlockConfig {
  title: string
  count: number
  showImages: boolean
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
    title: typeof o.title === 'string' && o.title.trim() ? o.title.trim() : 'B 站动态',
    count: Number.isFinite(Number(o.count)) ? Math.min(15, Math.max(1, Math.floor(Number(o.count)))) : 5,
    showImages: typeof o.showImages === 'boolean' ? o.showImages : true,
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const loading = ref(false)
const errorText = ref('')
const dynamics = ref<BiliSpaceDynamicItem[]>([])

watch(
  () => [props.userInfo?.biliId, cfg.value.count] as const,
  async ([uid, count]) => {
    if (!uid || uid <= 0) {
      dynamics.value = []
      return
    }
    loading.value = true
    errorText.value = ''
    try {
      dynamics.value = await fetchBiliSpaceDynamics(uid, count)
    } catch (err) {
      errorText.value = err instanceof Error ? err.message : '加载 B 站动态失败'
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
          :href="`https://space.bilibili.com/${userInfo.biliId}/dynamic`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0 no-underline"
        >
          <span>查看动态</span>
          <ExternalLink class="size-3" />
        </a>
      </div>

      <div
        v-if="loading"
        class="space-y-2.5"
      >
        <Skeleton
          v-for="n in 3"
          :key="n"
          class="h-16 w-full rounded-[var(--radius)]"
        />
      </div>

      <Alert
        v-else-if="errorText"
        variant="destructive"
      >
        <AlertDescription>{{ errorText }}</AlertDescription>
      </Alert>

      <div
        v-else-if="dynamics.length === 0"
        class="text-xs text-muted-foreground text-center py-6"
      >
        暂无可展示的 B 站动态
      </div>

      <div
        v-else
        class="space-y-2.5 min-w-0"
      >
        <a
          v-for="item in dynamics"
          :key="item.id"
          :href="item.jumpUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="block rounded-[var(--radius)] border border-border bg-card p-3 space-y-2 no-underline text-inherit transition-colors hover:border-primary/50"
        >
          <div class="flex-between gap-2 text-[11px] text-muted-foreground">
            <span>{{ item.pubTs ? new Date(item.pubTs * 1000).toLocaleString() : '' }}</span>
            <ExternalLink class="size-3 shrink-0" />
          </div>

          <p
            v-if="item.text"
            class="text-xs text-foreground whitespace-pre-wrap leading-relaxed line-clamp-4 m-0"
          >
            {{ item.text }}
          </p>

          <div
            v-if="cfg.showImages && item.images.length > 0"
            class="grid grid-cols-3 gap-1.5"
          >
            <img
              v-for="img in item.images.slice(0, 6)"
              :key="img"
              :src="img"
              referrerpolicy="no-referrer"
              loading="lazy"
              class="w-full aspect-square object-cover rounded-sm bg-muted border border-border"
            />
          </div>

          <div
            v-else-if="item.videoBvid"
            class="flex items-center gap-2.5 rounded-md bg-muted/50 p-2"
          >
            <img
              v-if="item.videoCover"
              :src="item.videoCover"
              referrerpolicy="no-referrer"
              loading="lazy"
              class="w-20 aspect-video object-cover rounded-sm shrink-0"
            />
            <div class="min-w-0 flex-1">
              <div class="text-xs font-medium text-foreground truncate">{{ item.videoTitle || item.videoBvid }}</div>
              <div class="inline-flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                <Play class="size-3" />
                <span>投稿视频</span>
              </div>
            </div>
          </div>
        </a>
      </div>
    </div>
  </BlockCard>
</template>
