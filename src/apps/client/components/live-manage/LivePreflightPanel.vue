<script setup lang="ts">
import { ArrowSync24Regular, CheckmarkCircle24Regular } from '@vicons/fluent'
import { computed } from 'vue'

import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'

import type { CheckTarget, PreflightCheck } from './preflight'

const props = defineProps<{
  checks: PreflightCheck[]
  refreshing: boolean
  error: string
  checkedAt?: number
}>()
defineEmits<{ refresh: []; navigate: [target: CheckTarget] }>()
const blockers = computed(() => props.checks.filter((check) => check.status === 'error').length)
const warnings = computed(() => props.checks.filter((check) => check.status === 'warning').length)
const labels = { success: '通过', error: '需处理', warning: '注意', info: '提示' } as const
const targets = { fetcher: '连接与凭据', control: '直播设置', obs: 'OBS 设置', account: '账号绑定' } as const

function getTagBadgeClass(status: 'success' | 'error' | 'warning' | 'info') {
  switch (status) {
    case 'success':
      return 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
    case 'error':
      return 'border-destructive/40 text-destructive bg-destructive/10'
    case 'warning':
      return 'border-amber-500/40 text-amber-600 bg-amber-500/10'
    case 'info':
    default:
      return 'border-sky-500/40 text-sky-600 bg-sky-500/10'
  }
}
</script>

<template>
  <Card class="p-3 border bg-card">
    <CardContent class="p-0">
      <div class="flex items-center justify-between gap-3 max-[480px]:items-start">
        <div>
          <h2 class="flex items-center gap-1.5 m-0 text-sm font-semibold text-foreground">
            <CheckmarkCircle24Regular class="size-4.5 text-primary" />
            开播前检查
          </h2>
          <p class="mt-0.5 text-xs text-muted-foreground">连接状态实时更新；登录与 OBS 配置可手动刷新。</p>
        </div>
        <Button
          variant="secondary"
          class="gap-1.5 max-[480px]:shrink-0"
          :disabled="refreshing"
          @click="$emit('refresh')"
        >
          <ArrowSync24Regular
            class="size-3.5"
            :class="{ 'animate-spin': refreshing }"
          />
          刷新检查
        </Button>
      </div>

      <div
        class="flex flex-wrap gap-x-4 gap-y-1 my-2 text-xs text-foreground [&>span]:text-muted-foreground"
        aria-live="polite"
      >
        <template v-if="refreshing">正在检查…</template>
        <template v-else-if="error">检查未完成</template>
        <template v-else>{{ blockers }} 项需处理 · {{ warnings }} 项注意</template>
        <span v-if="checkedAt && !refreshing && !error">上次检查 {{ new Date(checkedAt).toLocaleTimeString() }}</span>
      </div>

      <Alert
        v-if="error"
        class="border-destructive/20 bg-destructive/10 text-destructive py-2 px-2.5 my-2"
      >
        <AlertDescription class="text-xs m-0"> {{ error }}，请处理后重新检查。 </AlertDescription>
      </Alert>

      <ul
        class="list-none p-0 m-0 divide-y divide-border"
        :aria-busy="refreshing"
      >
        <li
          v-for="check in checks"
          :key="check.id"
          :data-check="check.id"
          class="flex items-center gap-3 py-2.5 max-[480px]:gap-2 max-[480px]:flex-wrap"
        >
          <Badge
            variant="outline"
            class="text-[10px] h-5 px-1.5 shrink-0"
            :class="getTagBadgeClass(check.status)"
          >
            {{ labels[check.status] }}
          </Badge>
          <div class="flex-1 min-w-0 break-words max-[480px]:basis-[calc(100%-60px)]">
            <strong class="text-xs font-medium text-foreground block">{{ check.title }}</strong>
            <p class="text-xs text-muted-foreground mt-0.5">{{ check.detail }}</p>
          </div>
          <Button
            v-if="check.status !== 'success'"
            size="xs"
            variant="ghost"
            class="h-6 text-[11px] shrink-0 max-[480px]:ml-auto"
            @click="$emit('navigate', check.target)"
          >
            {{ targets[check.target] }}
          </Button>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
