<script setup lang="ts">
import {
  CheckmarkCircle24Filled,
  FlashCheckmark16Filled,
  Info24Filled,
  PlugDisconnected24Regular,
  Warning24Filled,
} from '@vicons/fluent'
import { AlertCircle } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import { EventFetcherType } from '@/api/api-models'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const accountInfo = useAccount()
const router = useRouter()
const state = computed(() => accountInfo.value?.eventFetcherState)

const eventFetcherVersionName = computed(() => {
  const current = state.value
  if (current?.type === EventFetcherType.OBS) {
    return 'OBS/网页端'
  } else if (current?.type === EventFetcherType.Application) {
    return '控制台应用'
  } else if (current?.type === EventFetcherType.Server) {
    return '本站监听 (已删除)'
  } else if (current?.type === EventFetcherType.Tauri) {
    return 'Tauri 应用'
  } else {
    return current?.version ?? '未知'
  }
})

const status = computed<'success' | 'warning' | 'offline' | 'not-bound'>(() => {
  if (!accountInfo.value?.isBiliVerified) {
    return 'not-bound'
  }
  const current = state.value
  if (current?.online === true) {
    if (!current.status || Object.keys(current.status).length === 0) {
      return 'success'
    }
    return 'warning'
  }
  return 'offline'
})

const statusIcon = computed(() => {
  switch (status.value) {
    case 'success':
      return CheckmarkCircle24Filled
    case 'warning':
      return Warning24Filled
    case 'not-bound':
      return AlertCircle
    default:
      return PlugDisconnected24Regular
  }
})

const statusText = computed(() => {
  if (status.value === 'not-bound') {
    return '需要先绑定 Bilibili 账号'
  }
  if (status.value === 'success') {
    return accountInfo.value?.isServerFetcherOnline ? '本站托管监听服务' : '运行中'
  }
  if (status.value === 'warning') {
    return state.value?.status ? `异常: ${Object.values(state.value.status).join('; ')}` : '版本过期'
  }
  return '未连接'
})

const todayReceive = computed(() => state.value?.todayReceive ?? 0)

function goBindBili() {
  void router.push({ name: 'manage-index', query: { tab: 'info' } })
}
</script>

<template>
  <div
    class="fetcher-card"
    :class="{
      'fetcher-card--not-bound': status === 'not-bound',
      'fetcher-card--offline': status === 'offline',
    }"
  >
    <div class="fetcher-card__status">
      <component
        :is="statusIcon"
        class="fetcher-card__icon"
        :class="{
          'fetcher-card__icon--success': status === 'success',
          'fetcher-card__icon--warning': status === 'warning',
          'fetcher-card__icon--offline': status === 'offline',
          'fetcher-card__icon--not-bound': status === 'not-bound',
        }"
      />
      <div class="fetcher-card__info">
        <div class="fetcher-card__title">
          <span>Event Fetcher</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="fetcher-card__help"
                >
                  <component
                    :is="Info24Filled"
                    class="w-3.5 h-3.5"
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent class="max-w-xs text-xs leading-relaxed space-y-1.5 p-3">
                <p>持续监听直播间内的 Superchat 和上舰事件并上传到本站记录。</p>
                <p>支持按自定义范围查询并导出表格。</p>
                <a
                  href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
                  target="_blank"
                  class="text-primary underline font-medium inline-block mt-1"
                >
                  关于 Event Fetcher &rarr;
                </a>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div class="fetcher-card__status-text">
          {{ statusText }}
          <TooltipProvider v-if="status === 'success' && !accountInfo?.isServerFetcherOnline">
            <Tooltip>
              <TooltipTrigger as-child>
                <span class="fetcher-card__version">
                  <component
                    :is="FlashCheckmark16Filled"
                    class="w-3 h-3"
                  />
                  {{ eventFetcherVersionName }}
                </span>
              </TooltipTrigger>
              <TooltipContent class="text-xs">
                当前连接版本
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>

    <div
      v-if="status === 'success'"
      class="fetcher-card__stats"
    >
      <div class="fetcher-card__stat-label">今日接收</div>
      <div class="fetcher-card__stat-value">{{ todayReceive }}</div>
    </div>

    <div class="fetcher-card__actions">
      <Button
        v-if="status === 'not-bound'"
        variant="outline"
        size="xs"
        @click="goBindBili"
      >
        前往绑定
      </Button>
      <Button
        v-else-if="status === 'offline'"
        as="a"
        href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
        target="_blank"
        variant="outline"
        size="xs"
      >
        查看文档
      </Button>
    </div>
  </div>
</template>

<style scoped>
.fetcher-card {
  position: relative;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--card);
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  transition: all 0.2s ease;
}

.fetcher-card--not-bound,
.fetcher-card--offline {
  border-color: rgb(245 158 11 / 0.3);
  background: rgb(245 158 11 / 0.05);
}

.fetcher-card__status {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.fetcher-card__icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.fetcher-card__icon--success {
  color: #10b981;
}

.fetcher-card__icon--warning {
  color: #f59e0b;
}

.fetcher-card__icon--offline {
  color: var(--muted-foreground);
}

.fetcher-card__icon--not-bound {
  color: #f59e0b;
}

.fetcher-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.fetcher-card__title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--foreground);
  line-height: 1.2;
}

.fetcher-card__help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--muted-foreground);
  transition: color 0.15s ease;
}

.fetcher-card__help:hover {
  color: var(--foreground);
}

.fetcher-card__status-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--muted-foreground);
  line-height: 1.3;
}

.fetcher-card__version {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 10px;
  font-weight: 500;
  cursor: help;
  transition: all 0.15s ease;
}

.fetcher-card__version:hover {
  background: var(--accent);
}

.fetcher-card__stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  padding: 0 8px;
}

.fetcher-card__stat-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.fetcher-card__stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #10b981;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.fetcher-card__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .fetcher-card {
    flex-direction: column;
    align-items: stretch;
    padding: 10px;
    gap: 10px;
  }

  .fetcher-card__stats {
    align-items: flex-start;
    padding: 0 0 0 34px;
  }

  .fetcher-card__actions {
    padding-left: 34px;
  }
}
</style>
