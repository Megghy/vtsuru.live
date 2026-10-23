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
import { EventFetcherType } from '@/api/generated/model'
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
    class="relative rounded-[10px] border border-border bg-card p-3 sm:px-3.5 sm:py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 transition-all duration-200"
    :class="{
      'border-amber-500/30 bg-amber-500/5': status === 'not-bound' || status === 'offline',
    }"
  >
    <div class="flex-1 min-w-0 flex items-center gap-2.5">
      <component
        :is="statusIcon"
        class="size-6 shrink-0 transition-all duration-200"
        :class="{
          'text-emerald-500': status === 'success',
          'text-amber-500': status === 'warning' || status === 'not-bound',
          'text-muted-foreground': status === 'offline',
        }"
      />
      <div class="flex-1 min-w-0 flex flex-col gap-0.75">
        <div class="flex items-center gap-1.25 text-xs font-semibold text-foreground leading-tight">
          <span>Event Fetcher</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="inline-flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                >
                  <component
                    :is="Info24Filled"
                    class="size-3.5"
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
        <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground leading-snug">
          {{ statusText }}
          <TooltipProvider v-if="status === 'success' && !accountInfo?.isServerFetcherOnline">
            <Tooltip>
              <TooltipTrigger as-child>
                <span
                  class="inline-flex items-center gap-0.75 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium cursor-help hover:bg-accent transition-all"
                >
                  <component
                    :is="FlashCheckmark16Filled"
                    class="size-3"
                  />
                  {{ eventFetcherVersionName }}
                </span>
              </TooltipTrigger>
              <TooltipContent class="text-xs"> 当前连接版本 </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>

    <div
      v-if="status === 'success'"
      class="flex flex-col items-start sm:items-end gap-0.5 shrink-0 pl-8.5 sm:px-2"
    >
      <div class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">今日接收</div>
      <div class="text-lg font-bold text-emerald-500 leading-none tabular-nums">{{ todayReceive }}</div>
    </div>

    <div class="flex gap-2 shrink-0 pl-8.5 sm:pl-0">
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
