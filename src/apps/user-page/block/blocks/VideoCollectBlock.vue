<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import { OpenOutline, RefreshOutline, TimerOutline, VideocamOutline } from '@vicons/ionicons5'
import { NAlert, NButton, NEmpty, NIcon, NProgress, NSpin, NTime } from 'naive-ui'
import { useNow } from '@vueuse/core'
import { computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchPublicActiveVideoCollect } from '@/apps/user-page/api'
import { getEnabledUserFunctions } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: UserInfo }>()
const values = computed<Record<string, unknown>>(() => props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps) ? props.blockProps as Record<string, unknown> : {})
const count = computed(() => Math.min(6, Math.max(1, Number(values.value.count) || 3)))
const showDescription = computed(() => values.value.showDescription !== false)
const showProgress = computed(() => values.value.showProgress !== false)
const enabled = computed(() => getEnabledUserFunctions(props.userInfo).has(FunctionTypes.VideoCollect))
const now = useNow({ interval: 30_000 })
const query = useUserPageRuntimeQuery({
  key: () => `video-collect:${props.userInfo?.id ?? 0}`,
  ttlMs: 60_000,
  loader: signal => fetchPublicActiveVideoCollect(props.userInfo!.id, { signal }),
})
const activities = computed(() => (query.data.value ?? [])
  .filter(item => !item.isFinish && item.endAt > now.value.getTime())
  .toSorted((a, b) => a.endAt - b.endAt)
  .slice(0, count.value))

function progress(videoCount: number, maxVideoCount: number) {
  return maxVideoCount > 0 ? Math.min(100, Math.round(videoCount / maxVideoCount * 100)) : 0
}

async function load(force = false) {
  if (!props.userInfo?.id || !enabled.value) {
    query.cancel()
    return
  }
  try { await query.execute(force) }
  catch (error) { console.error('用户页视频征集区块加载失败', error) }
}

onMounted(() => { void load() })
watch(() => [props.userInfo?.id, enabled.value] as const, () => { void load() })
</script>

<template>
  <BlockCard :framed="values.framed !== false" :backgrounded="values.backgrounded !== false">
    <template #header>
      <div class="collect-header">
        <span class="collect-heading"><NIcon><VideocamOutline /></NIcon>当前视频征集</span>
        <RouterLink v-if="props.userInfo?.name" v-slot="{ navigate }" :to="{ name: 'user-video-collect', params: { id: props.userInfo.name } }" custom>
          <NButton text type="primary" size="small" @click="navigate">
            全部活动<template #icon>
              <NIcon><OpenOutline /></NIcon>
            </template>
          </NButton>
        </RouterLink>
      </div>
    </template>

    <NAlert v-if="!enabled" type="info" :show-icon="false">
      视频征集未开放
    </NAlert>
    <NAlert v-else-if="query.status.value === 'error'" type="error" :show-icon="true">
      <div class="error-row">
        <span>视频征集加载失败</span><NButton size="small" secondary @click="load(true)">
          <template #icon>
            <NIcon><RefreshOutline /></NIcon>
          </template>重试
        </NButton>
      </div>
    </NAlert>
    <NSpin v-else :show="query.status.value === 'loading' || query.status.value === 'idle'" size="small">
      <NEmpty v-if="query.status.value === 'success' && !activities.length" size="small" description="暂无正在进行的征集" />
      <div v-else class="collect-list">
        <RouterLink v-for="item in activities" :key="item.id" :to="{ name: 'video-collect', params: { id: item.shortId } }" class="collect-item">
          <div class="collect-copy">
            <strong>{{ item.name }}</strong>
            <p v-if="showDescription && item.description">
              {{ item.description }}
            </p>
            <span class="deadline"><NIcon><TimerOutline /></NIcon>截止 <NTime :time="item.endAt" /></span>
          </div>
          <div v-if="showProgress" class="collect-progress">
            <span>{{ item.videoCount }} / {{ item.maxVideoCount }}</span>
            <NProgress type="line" :percentage="progress(item.videoCount, item.maxVideoCount)" :show-indicator="false" :height="6" />
          </div>
          <NIcon class="open-icon">
            <OpenOutline />
          </NIcon>
        </RouterLink>
      </div>
    </NSpin>
  </BlockCard>
</template>

<style scoped>
.collect-header, .collect-heading, .error-row, .collect-item, .deadline { display: flex; align-items: center; }
.collect-header, .error-row { justify-content: space-between; gap: 12px; width: 100%; }
.collect-heading, .deadline { gap: 7px; }
.collect-heading { font-weight: 600; }
.collect-list { container-type: inline-size; display: grid; gap: 8px; }
.collect-item { gap: 14px; min-width: 0; padding: 11px 12px; border: 1px solid var(--vtsuru-border); border-radius: 6px; color: var(--vtsuru-fg); background: var(--vtsuru-bg-muted); text-decoration: none; }
.collect-item:hover { border-color: var(--vtsuru-primary, #18a058); background: var(--vtsuru-bg-elevated); }
.collect-copy { display: grid; flex: 1; gap: 5px; min-width: 0; }
.collect-copy strong, .collect-copy p { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.collect-copy p { margin: 0; color: var(--vtsuru-fg-muted); font-size: 12px; }
.deadline { color: var(--vtsuru-fg-muted); font-size: 12px; }
.collect-progress { display: grid; flex: 0 0 120px; gap: 5px; color: var(--vtsuru-fg-muted); font-size: 11px; text-align: right; }
.open-icon { flex: none; color: var(--vtsuru-fg-muted); }
@container (max-width: 520px) { .collect-item { align-items: start; flex-wrap: wrap; } .collect-progress { flex-basis: calc(100% - 28px); order: 3; margin-left: 0; text-align: left; } }
</style>
