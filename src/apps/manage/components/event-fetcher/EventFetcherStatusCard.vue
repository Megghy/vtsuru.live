<script setup lang="ts">
import { computed } from 'vue'

import { useAccount } from '@/api/account'
import { EventFetcherType } from '@/api/api-models'

const accountInfo = useAccount()
const state = accountInfo.value?.eventFetcherState

const eventFetcherVersionName = computed(() => {
  if (state?.type == EventFetcherType.OBS) {
    return 'OBS/网页端'
  } else if (state?.type == EventFetcherType.Application) {
    return '控制台应用'
  } else if (state?.type == EventFetcherType.Server) {
    return '本站监听 (已删除)'
  } else if (state?.type == EventFetcherType.Tauri) {
    return 'Tauri 应用'
  } else {
    return state?.version ?? '未知'
  }
})

const status = computed(() => {
  if (state.online == true) {
    if (state.status == undefined || state.status == null) {
      return 'warning'
    } else if (Object.keys(state.status ?? {}).length > 0) {
      return 'warning'
    } else {
      return 'success'
    }
  } else {
    return 'info'
  }
})
</script>

<template>
  <UAlert
    v-if="status"
    title="EVENT-FETCHER 状态"
    :color="status"
    variant="soft"
  >
    <template #description>
      <div class="event-fetcher-status__summary">
        <span>这是一个持续监听直播间 Superchat 和上舰事件并上传记录的程序。</span>
        <UTooltip text="事件上传后可按自定义范围查询，并导出 CSV 等表格。">
          <UIcon name="i-lucide-info" class="event-fetcher-status__info" />
        </UTooltip>
      </div>
      <div class="event-fetcher-status__body">
        <UTooltip
          v-if="status !== 'info' && !accountInfo?.isServerFetcherOnline"
          text="你所使用的版本"
        >
          <UBadge
            :icon="undefined"
            color="neutral"
            variant="subtle"
          >
            <UIcon name="i-lucide-badge-check" />
            {{ eventFetcherVersionName }}
          </UBadge>
        </UTooltip>
        <USeparator
          v-if="status !== 'info' && !accountInfo?.isServerFetcherOnline"
          orientation="vertical"
        />
        <UBadge
          :color="status"
          variant="subtle"
        >
          <template v-if="state?.online === true && (state?.status === null || state?.status === undefined)">
            此版本已过期, 请更新
            <UPopover mode="click">
              <UButton
                color="warning"
                variant="link"
                size="xs"
                label="关于"
              />
              <template #content>
                <div class="event-fetcher-status__popover">
                  Node.js 版已不再更新。如果使用 Docker，请切换至 ghcr.io/megghy/vtsurueventfetcher.net；其他环境请下载
                  https://github.com/Megghy/VtsuruEventFetcher.Net/releases/latest。
                </div>
              </template>
            </UPopover>
          </template>
          <template v-else>
            <template v-if="status === 'success'">
              {{ accountInfo?.isServerFetcherOnline ? '正在由本站提供监听服务' : '运行中' }}
              | 今日已接收
              <strong>{{ state.todayReceive }}</strong>
              条
            </template>
            <template v-else-if="status === 'warning'">
              <template v-if="state.status"> 异常: {{ Object.values(state.status).join('; ') }} </template>
            </template>
            <template v-else-if="status === 'info'"> 未连接 </template>
          </template>
        </UBadge>
        <UButton
          v-if="!state.online"
          to="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
          target="_blank"
          color="primary"
          variant="link"
          size="xs"
          label="关于 EVENT-FETCHER"
        />
      </div>
    </template>
  </UAlert>
</template>

<style scoped>
.event-fetcher-status__summary,
.event-fetcher-status__body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.event-fetcher-status__info {
  width: 16px;
  height: 16px;
  color: var(--vtsuru-fg-muted);
}

.event-fetcher-status__popover {
  max-width: 320px;
  padding: 12px;
  color: var(--vtsuru-fg);
  font-size: 13px;
  line-height: 1.55;
}
</style>
