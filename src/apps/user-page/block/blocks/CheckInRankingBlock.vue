<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import { NAlert, NButton, NEmpty, NIcon, NSpin } from 'naive-ui'
import { computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { OpenOutline, RefreshOutline, TrophyOutline } from '@vicons/ionicons5'
import { fetchPublicCheckInRanking } from '@/apps/user-page/api'
import { getEnabledUserFunctions } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{
  blockProps: unknown
  userInfo?: UserInfo
}>()

const values = computed<Record<string, unknown>>(() => props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
  ? props.blockProps as Record<string, unknown>
  : {})
const count = computed<3 | 10>(() => values.value.count === 10 ? 10 : 3)
const showMonthly = computed(() => values.value.showMonthly !== false)
const showTotal = computed(() => values.value.showTotal === true)
const enabled = computed(() => getEnabledUserFunctions(props.userInfo).has(FunctionTypes.CheckInRanking))
const query = useUserPageRuntimeQuery({
  key: () => `check-in-ranking:${props.userInfo?.id ?? 0}:${count.value}`,
  ttlMs: 60_000,
  loader: signal => fetchPublicCheckInRanking(props.userInfo!.id, count.value, { signal }),
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

onMounted(() => { void load() })
watch(() => [props.userInfo?.id, count.value, enabled.value] as const, () => { void load() })
</script>

<template>
  <BlockCard :framed="values.framed !== false" :backgrounded="values.backgrounded !== false">
    <template #header>
      <div class="ranking-header">
        <span class="ranking-heading">
          <NIcon><TrophyOutline /></NIcon>
          签到排行
        </span>
        <RouterLink v-if="props.userInfo?.name" v-slot="{ navigate }" :to="{ name: 'user-checkin', params: { id: props.userInfo.name } }" custom>
          <NButton text type="primary" size="small" @click="navigate">
            完整排行
            <template #icon>
              <NIcon><OpenOutline /></NIcon>
            </template>
          </NButton>
        </RouterLink>
      </div>
    </template>

    <NAlert v-if="!enabled" type="info" :show-icon="false">
      签到排行未开放
    </NAlert>
    <NAlert v-else-if="query.status.value === 'error'" type="error" :show-icon="true">
      <div class="error-row">
        <span>签到排行加载失败</span>
        <NButton size="small" secondary @click="load(true)">
          <template #icon>
            <NIcon><RefreshOutline /></NIcon>
          </template>
          重试
        </NButton>
      </div>
    </NAlert>
    <NSpin v-else :show="query.status.value === 'loading' || query.status.value === 'idle'" size="small">
      <NEmpty v-if="query.status.value === 'success' && !query.data.value?.length" size="small" description="暂无签到记录" />
      <ol v-else class="ranking-list">
        <li v-for="(item, index) in query.data.value" :key="item.ouId" class="ranking-item">
          <span class="rank" :class="`rank--${index + 1}`">{{ index + 1 }}</span>
          <strong class="name">{{ item.name }}</strong>
          <span class="streak">连续 {{ item.consecutiveDays }} 天</span>
          <span v-if="showMonthly" class="count">本月 {{ item.monthlyCheckInCount ?? 0 }} 次</span>
          <span v-if="showTotal" class="count">累计 {{ item.totalCheckInCount ?? 0 }} 次</span>
        </li>
      </ol>
    </NSpin>
  </BlockCard>
</template>

<style scoped>
.ranking-header, .ranking-heading, .error-row, .ranking-item { display: flex; align-items: center; }
.ranking-header, .error-row { justify-content: space-between; gap: 12px; width: 100%; }
.ranking-heading { gap: 7px; font-weight: 600; }
.ranking-list { container-type: inline-size; display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.ranking-item { gap: 9px; min-width: 0; min-height: 42px; padding: 7px 10px; border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-border); border-radius: var(--vtsuru-page-radius); background: var(--vtsuru-bg-muted); }
.rank { display: grid; place-items: center; flex: none; width: 25px; height: 25px; border-radius: 50%; color: var(--vtsuru-fg-muted); background: var(--vtsuru-bg-elevated); font-size: 12px; font-weight: 700; }
.rank--1 { color: #6b4d00; background: #f8d66d; }
.rank--2 { color: #40464d; background: #d9e0e7; }
.rank--3 { color: #5e351c; background: #e9b58f; }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.streak { flex: none; font-size: 13px; font-weight: 600; }
.count { flex: none; color: var(--vtsuru-fg-muted); font-size: 12px; }

@container (max-width: 520px) {
  .ranking-item { flex-wrap: wrap; }
  .name { flex-basis: calc(100% - 44px); }
  .streak { margin-left: 34px; }
}
</style>
