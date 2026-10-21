<script setup lang="ts">
import { ArrowSync24Regular, CheckmarkCircle24Regular } from '@vicons/fluent'
import { computed } from 'vue'

import type { CheckTarget, PreflightCheck } from './preflight'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'

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
  <Card class="preflight-panel p-3 border bg-card">
    <CardContent class="p-0">
      <div class="preflight-heading">
        <div>
          <h2>
            <CheckmarkCircle24Regular class="size-4.5 text-primary" />
            开播前检查
          </h2>
          <p>连接状态实时更新；登录与 OBS 配置可手动刷新。</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          class="h-8 text-xs gap-1.5"
          :disabled="refreshing"
          @click="$emit('refresh')"
        >
          <ArrowSync24Regular class="size-3.5" :class="{ 'animate-spin': refreshing }" />
          刷新检查
        </Button>
      </div>

      <div
        class="preflight-summary"
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
        <AlertDescription class="text-xs m-0">
          {{ error }}，请处理后重新检查。
        </AlertDescription>
      </Alert>

      <ul
        class="preflight-list"
        :aria-busy="refreshing"
      >
        <li
          v-for="check in checks"
          :key="check.id"
          :data-check="check.id"
        >
          <Badge
            variant="outline"
            class="text-[10px] h-5 px-1.5 shrink-0"
            :class="getTagBadgeClass(check.status)"
          >
            {{ labels[check.status] }}
          </Badge>
          <div class="preflight-copy">
            <strong>{{ check.title }}</strong>
            <p>{{ check.detail }}</p>
          </div>
          <Button
            v-if="check.status !== 'success'"
            size="xs"
            variant="ghost"
            class="h-6 text-[11px] shrink-0"
            @click="$emit('navigate', check.target)"
          >
            {{ targets[check.target] }}
          </Button>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>

<style scoped>
.preflight-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
h2 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--foreground);
}
p {
  margin: 3px 0 0;
  color: var(--muted-foreground);
  font-size: 12px;
}
.preflight-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 12px 0 6px;
  font-size: 12px;
  color: var(--foreground);
}
.preflight-summary span {
  color: var(--muted-foreground);
}
.preflight-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.preflight-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.preflight-list li:last-child {
  border: 0;
  padding-bottom: 0;
}
.preflight-copy {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.preflight-copy strong {
  font-size: 13px;
  font-weight: 500;
  color: var(--foreground);
}
@media (max-width: 480px) {
  .preflight-heading {
    align-items: flex-start;
  }
  .preflight-heading > :last-child {
    flex-shrink: 0;
  }
  .preflight-list li {
    gap: 8px;
    flex-wrap: wrap;
  }
  .preflight-copy {
    flex-basis: calc(100% - 60px);
  }
  .preflight-list li > :last-child:not(.preflight-copy) {
    margin-left: auto;
  }
}
</style>
