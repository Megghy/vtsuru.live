<script setup lang="ts">
import { OpenOutline, RefreshOutline, TrophyOutline } from '@vicons/ionicons5'
import { computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'

import type { CheckInRankingInfo, UserInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import { fetchPublicCheckInRanking } from '@/apps/user-page/api'
import { getEnabledUserFunctions } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{
  blockProps: unknown
  userInfo?: UserInfo
}>()

const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)
const count = computed<3 | 10>(() => (values.value.count === 10 ? 10 : 3))
const showMonthly = computed(() => values.value.showMonthly !== false)
const showTotal = computed(() => values.value.showTotal === true)
const enabled = computed(() => getEnabledUserFunctions(props.userInfo).has(FunctionTypes.CheckInRanking))
const query = useUserPageRuntimeQuery<CheckInRankingInfo[]>({
  key: () => `check-in-ranking:${props.userInfo?.id ?? 0}:${count.value}`,
  ttlMs: 60_000,
  loader: (signal) => fetchPublicCheckInRanking(props.userInfo!.id, count.value, { signal }),
})

async function load(force = false) {
  if (!props.userInfo?.id || !enabled.value) {
    query.cancel()
    return
  }
  try {
    await query.execute(force)
  } catch (error) {
    console.error('用户页签到排行区块加载失败', error)
  }
}

onMounted(() => {
  void load()
})
watch(
  () => [props.userInfo?.id, count.value, enabled.value] as const,
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
      <div class="ranking-header flex items-center justify-between w-full">
        <span class="ranking-heading flex items-center gap-1.5 font-semibold text-sm">
          <component
            :is="TrophyOutline"
            class="size-4"
          />
          签到排行
        </span>
        <RouterLink
          v-if="props.userInfo?.name"
          v-slot="{ navigate }"
          :to="{ name: 'user-checkin', params: { id: props.userInfo.name } }"
          custom
        >
          <Button
            variant="ghost"
            class="text-primary font-medium p-0"
            @click="navigate"
          >
            完整排行
            <component
              :is="OpenOutline"
              class="size-3.5 ml-1"
            />
          </Button>
        </RouterLink>
      </div>
    </template>

    <Alert
      v-if="!enabled"
      class="text-xs py-2"
    >
      <AlertDescription> 签到排行未开放 </AlertDescription>
    </Alert>
    <Alert
      v-else-if="query.status.value === 'error'"
      variant="destructive"
      class="text-xs py-2"
    >
      <AlertDescription class="flex items-center justify-between w-full">
        <span>签到排行加载失败</span>
        <Button
          variant="outline"
          size="xs"
          class="gap-1"
          @click="load(true)"
        >
          <component
            :is="RefreshOutline"
            class="size-3"
          />
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
        v-if="query.status.value === 'success' && !query.data.value?.length"
        description="暂无签到记录"
        class="py-4 text-xs"
      />
      <ol
        v-else
        class="ranking-list grid gap-1.5 p-0 m-0 list-none"
      >
        <li
          v-for="(item, index) in query.data.value"
          :key="item.ouId"
          class="ranking-item flex items-center gap-2.5 p-2 rounded-lg border border-border bg-muted text-xs"
        >
          <span
            class="size-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
            :class="
              index === 0
                ? 'text-[#6b4d00] bg-[#f8d66d]'
                : index === 1
                  ? 'text-[#40464d] bg-[#d9e0e7]'
                  : index === 2
                    ? 'text-[#5e351c] bg-[#e9b58f]'
                    : 'text-muted-foreground bg-popover'
            "
          >
            {{ index + 1 }}
          </span>
          <strong class="name flex-1 min-w-0 truncate font-semibold">{{ item.name }}</strong>
          <span class="streak font-medium shrink-0">连续 {{ item.consecutiveDays }} 天</span>
          <span
            v-if="showMonthly"
            class="count text-muted-foreground shrink-0"
          >
            本月 {{ item.monthlyCheckInCount ?? 0 }} 次
          </span>
          <span
            v-if="showTotal"
            class="count text-muted-foreground shrink-0"
          >
            累计 {{ item.totalCheckInCount ?? 0 }} 次
          </span>
        </li>
      </ol>
    </div>
  </BlockCard>
</template>


