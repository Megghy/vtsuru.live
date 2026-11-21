<script setup lang="ts">
import { ExternalLink, ListOrdered, RefreshCw, Users } from 'lucide-vue-next'
import { useIntervalFn } from '@vueuse/core'
import { computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'

import type { ResponseQueueModel, ResponseUserInfo, SettingQueue } from '@/api/generated/model'
import { FunctionTypes, QueueStatus } from '@/api/generated/model'
import { getApiQueueGetActiveAndSettings } from '@/api/generated/queue/queue'
import { getEnabledUserFunctions } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{
  blockProps: unknown
  userInfo?: ResponseUserInfo
}>()

const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)

const title = computed(() =>
  typeof values.value.title === 'string' && values.value.title.trim() ? values.value.title.trim() : '当前排队状态',
)
const showLink = computed(() => values.value.showLink !== false)
const showWaitingCount = computed(() => values.value.showWaitingCount !== false)
const compact = computed(() => values.value.compact === true)
const enabled = computed(() => getEnabledUserFunctions(props.userInfo).has(FunctionTypes.Queue))

const query = useUserPageRuntimeQuery<{ list: ResponseQueueModel[]; setting: SettingQueue | null }>({
  key: () => `queue-status:${props.userInfo?.id ?? 0}`,
  ttlMs: 15_000,
  loader: async (signal) => {
    const res = await getApiQueueGetActiveAndSettings({ id: props.userInfo!.id }, { signal })
    if (res.code !== 200) throw new Error(res.message || '加载排队信息失败')
    return {
      list: (res.data?.queue ?? []) as ResponseQueueModel[],
      setting: (res.data?.setting ?? null) as SettingQueue | null,
    }
  },
})

const progressing = computed(() => query.data.value?.list.find((item) => item.status === QueueStatus.Progressing) ?? null)
const waitingList = computed(() => query.data.value?.list.filter((item) => item.status === QueueStatus.Waiting) ?? [])
const waitingCount = computed(() => waitingList.value.length)
const allowFromWeb = computed(() => query.data.value?.setting?.allowFromWeb === true)

async function load(force = false) {
  if (!props.userInfo?.id || !enabled.value) {
    query.cancel()
    return
  }
  try {
    await query.execute(force)
  } catch (err) {
    console.error('用户页排队状态区块加载失败', err)
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
useIntervalFn(() => {
  void load(true)
}, 20_000)
</script>

<template>
  <BlockCard
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <template #header>
      <div class="flex-between gap-2 w-full">
        <span class="flex items-center gap-1.5 font-semibold text-sm">
          <ListOrdered class="size-4 text-primary" />
          {{ title }}
        </span>
        <div class="flex items-center gap-2">
          <Badge
            v-if="enabled && query.status.value === 'success'"
            :variant="allowFromWeb ? 'default' : 'secondary'"
            size="xs"
          >
            {{ allowFromWeb ? '支持网页排队' : '直播间排队' }}
          </Badge>
          <RouterLink
            v-if="showLink && props.userInfo?.name"
            v-slot="{ navigate }"
            :to="{ name: 'user-queue', params: { id: props.userInfo.name } }"
            custom
          >
            <Button
              variant="link"
              size="xs"
              class="h-auto p-0 gap-1"
              @click="navigate"
            >
              前往排队
              <ExternalLink class="size-3.5" />
            </Button>
          </RouterLink>
        </div>
      </div>
    </template>

    <Alert v-if="!enabled">
      <AlertDescription>排队功能未开启</AlertDescription>
    </Alert>
    <Alert
      v-else-if="query.status.value === 'error'"
      variant="destructive"
    >
      <AlertDescription class="flex-between w-full">
        <span>排队状态加载失败</span>
        <Button
          variant="outline"
          size="xs"
          class="gap-1"
          @click="load(true)"
        >
          <RefreshCw class="size-3" />
          重试
        </Button>
      </AlertDescription>
    </Alert>
    <div
      v-else-if="query.status.value === 'loading' || query.status.value === 'idle'"
      class="py-5 flex justify-center"
    >
      <Spin />
    </div>
    <div
      v-else
      class="space-y-2.5"
    >
      <div
        v-if="progressing || waitingCount > 0"
        class="@container flex items-center gap-3 p-1"
      >
        <div class="size-9 rounded-full flex-center shrink-0 bg-primary/10 text-primary">
          <Users class="size-4.5" />
        </div>
        <div class="flex-1 min-w-0 grid gap-0.5">
          <span class="text-xs text-muted-foreground">
            {{ progressing ? '当前正在进行' : '当前空闲，可立即加入' }}
          </span>
          <strong class="text-sm font-semibold truncate">
            {{ progressing ? progressing.user?.name || progressing.requestBy || '处理中' : '等待下一位观众' }}
          </strong>
          <span
            v-if="!compact && progressing?.content"
            class="text-xs text-muted-foreground truncate"
          >
            {{ progressing.content }}
          </span>
        </div>
        <div
          v-if="showWaitingCount"
          class="text-center shrink-0 min-w-[54px]"
        >
          <strong class="text-lg font-bold text-primary block leading-tight tabular-nums">{{ waitingCount }}</strong>
          <span class="text-xs text-muted-foreground">人等待</span>
        </div>
      </div>
      <Empty
        v-else
        description="当前队列为空，暂无人排队"
        class="py-4 text-xs"
      />
    </div>
  </BlockCard>
</template>
