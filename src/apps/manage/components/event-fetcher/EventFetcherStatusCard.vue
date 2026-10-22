<script setup lang="ts">
import { FlashCheckmark16Filled, Info24Filled } from '@vicons/fluent'
import { computed } from 'vue'

import { useAccount } from '@/api/account'
import { EventFetcherType } from '@/api/api-models'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Separator } from '@/shared/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const accountInfo = useAccount()
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

const status = computed<'success' | 'warning' | 'info'>(() => {
  const current = state.value
  if (current?.online === true) {
    if (!current.status || Object.keys(current.status).length === 0) {
      return 'success'
    }
    return 'warning'
  }
  return 'info'
})
</script>

<template>
  <Alert
    class="border border-border bg-card/60"
    :class="{
      'border-emerald-500/30 bg-emerald-500/5': status === 'success',
      'border-amber-500/30 bg-amber-500/5': status === 'warning',
    }"
  >
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <AlertTitle class="mb-0 text-xs font-semibold tracking-wide uppercase flex items-center gap-1.5">
          EVENT-FETCHER 状态
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="inline-flex text-muted-foreground hover:text-foreground transition-colors"
                >
                  <component
                    :is="Info24Filled"
                    class="h-3.5 w-3.5"
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
                  关于 EVENT-FETCHER &rarr;
                </a>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </AlertTitle>

        <template v-if="status !== 'info' && !accountInfo?.isServerFetcherOnline">
          <Badge
            variant="outline"
            class="text-[11px] gap-1 py-0 h-5"
          >
            <component
              :is="FlashCheckmark16Filled"
              class="h-3 w-3"
            />
            {{ eventFetcherVersionName }}
          </Badge>
          <Separator
            orientation="vertical"
            class="h-3.5"
          />
        </template>
      </div>

      <div class="flex items-center gap-2">
        <Badge
          v-if="status === 'success'"
          variant="success"
          class="text-xs"
        >
          {{ accountInfo?.isServerFetcherOnline ? '正在由本站提供监听服务' : '运行中' }} | 今日已接收
          <span class="font-bold ml-1">{{ state?.todayReceive ?? 0 }}</span> 条
        </Badge>

        <Badge
          v-else-if="status === 'warning'"
          variant="warning"
          class="text-xs"
        >
          <template v-if="state?.status"> 异常: {{ Object.values(state.status).join('; ') }} </template>
          <template v-else> 此版本已过期, 请更新 </template>
        </Badge>

        <Badge
          v-else
          variant="secondary"
          class="text-xs"
        >
          未连接
        </Badge>

        <template v-if="!state?.online">
          <Separator
            orientation="vertical"
            class="h-3.5"
          />
          <Button
            as="a"
            href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
            target="_blank"
            variant="outline"
            size="xs"
          >
            关于
          </Button>
        </template>
      </div>
    </div>
  </Alert>
</template>
