<script setup lang="ts">
import { OpenOutline, RefreshOutline, TimerOutline, VideocamOutline } from '@vicons/ionicons5'
import { useNow } from '@vueuse/core'
import { computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'

import type { UserInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import { fetchPublicActiveVideoCollect } from '@/apps/user-page/api'
import { getEnabledUserFunctions } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Progress } from '@/shared/ui/progress'
import { Spin } from '@/shared/ui/spin'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown; userInfo?: UserInfo }>()
const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)
const count = computed(() => Math.min(6, Math.max(1, Number(values.value.count) || 3)))
const showDescription = computed(() => values.value.showDescription !== false)
const showProgress = computed(() => values.value.showProgress !== false)
const enabled = computed(() => getEnabledUserFunctions(props.userInfo).has(FunctionTypes.VideoCollect))
const now = useNow({ interval: 30_000 })
const query = useUserPageRuntimeQuery({
  key: () => `video-collect:${props.userInfo?.id ?? 0}`,
  ttlMs: 60_000,
  loader: (signal) => fetchPublicActiveVideoCollect(props.userInfo!.id, { signal }),
})
const activities = computed(() =>
  (query.data.value ?? [])
    .filter((item) => !item.isFinish && item.endAt > now.value.getTime())
    .toSorted((a, b) => a.endAt - b.endAt)
    .slice(0, count.value),
)

function progress(videoCount: number, maxVideoCount: number) {
  return maxVideoCount > 0 ? Math.min(100, Math.round((videoCount / maxVideoCount) * 100)) : 0
}

function formatEndTime(time: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(time)
}

async function load(force = false) {
  if (!props.userInfo?.id || !enabled.value) {
    query.cancel()
    return
  }
  try {
    await query.execute(force)
  } catch (error) {
    console.error('用户页视频征集区块加载失败', error)
  }
}

onMounted(() => {
  void load()
})
watch(
  () => [props.userInfo?.id, enabled.value] as const,
  () => {
    void load()
  },
)
</script>

<template>
  <BlockCard
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <template #header>
      <div class="collect-header flex items-center justify-between w-full">
        <span class="collect-heading flex items-center gap-1.5 font-semibold text-sm">
          <component :is="VideocamOutline" class="size-4" />
          当前视频征集
        </span>
        <RouterLink
          v-if="props.userInfo?.name"
          v-slot="{ navigate }"
          :to="{ name: 'user-video-collect', params: { id: props.userInfo.name } }"
          custom
        >
          <Button
            variant="ghost"
            size="sm"
            class="h-7 text-xs text-primary font-medium p-0"
            @click="navigate"
          >
            全部活动
            <component :is="OpenOutline" class="size-3.5 ml-1" />
          </Button>
        </RouterLink>
      </div>
    </template>

    <Alert
      v-if="!enabled"
      class="text-xs py-2"
    >
      <AlertDescription>
        视频征集未开放
      </AlertDescription>
    </Alert>
    <Alert
      v-else-if="query.status.value === 'error'"
      variant="destructive"
      class="text-xs py-2"
    >
      <AlertDescription class="flex items-center justify-between w-full">
        <span>视频征集加载失败</span>
        <Button
          size="sm"
          variant="outline"
          class="h-6 px-2 text-xs"
          @click="load(true)"
        >
          <component :is="RefreshOutline" class="size-3 mr-1" />
          重试
        </Button>
      </AlertDescription>
    </Alert>
    <div
      v-else-if="query.status.value === 'loading' || query.status.value === 'idle'"
      class="py-6 flex justify-center"
    >
      <Spin />
    </div>
    <div v-else>
      <Empty
        v-if="query.status.value === 'success' && !activities.length"
        description="暂无正在进行的征集"
        class="py-4 text-xs"
      />
      <div
        v-else
        class="collect-list grid gap-2"
      >
        <RouterLink
          v-for="item in activities"
          :key="item.id"
          :to="{ name: 'video-collect', params: { id: item.shortId } }"
          class="collect-item flex items-center gap-3.5 p-3 rounded-lg border border-border bg-muted/40 text-foreground no-underline hover:border-primary hover:bg-card transition"
        >
          <div class="collect-copy flex-1 min-w-0 grid gap-1">
            <strong class="text-xs font-semibold truncate">{{ item.name }}</strong>
            <p
              v-if="showDescription && item.description"
              class="text-[11px] text-muted-foreground truncate m-0"
            >
              {{ item.description }}
            </p>
            <span class="deadline flex items-center gap-1 text-[11px] text-muted-foreground">
              <component :is="TimerOutline" class="size-3.5" />
              截止 {{ formatEndTime(item.endAt) }}
            </span>
          </div>
          <div
            v-if="showProgress"
            class="collect-progress flex flex-col gap-1 w-28 text-right text-[11px] text-muted-foreground shrink-0"
          >
            <span>{{ item.videoCount }} / {{ item.maxVideoCount }}</span>
            <Progress
              :model-value="progress(item.videoCount, item.maxVideoCount)"
              class="h-1.5"
            />
          </div>
          <component :is="OpenOutline" class="size-4 text-muted-foreground shrink-0" />
        </RouterLink>
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.collect-list {
  container-type: inline-size;
}
@container (max-width: 520px) {
  .collect-item {
    align-items: start;
    flex-wrap: wrap;
  }
  .collect-progress {
    flex-basis: calc(100% - 28px);
    order: 3;
    margin-left: 0;
    text-align: left;
  }
}
</style>
