<script setup lang="ts">
import { ArrowSync24Regular, CheckmarkCircle24Regular } from '@vicons/fluent'
import { NAlert, NButton, NCard, NIcon, NTag } from 'naive-ui'
import { computed } from 'vue'

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
</script>

<template>
  <NCard
    size="small"
    class="preflight-panel"
  >
    <div class="preflight-heading">
      <div>
        <h2><NIcon :component="CheckmarkCircle24Regular" />开播前检查</h2>
        <p>连接状态实时更新；登录与 OBS 配置可手动刷新。</p>
      </div>
      <NButton
        size="small"
        :loading="refreshing"
        :disabled="refreshing"
        @click="$emit('refresh')"
      >
        <template #icon><NIcon :component="ArrowSync24Regular" /></template>
        刷新检查
      </NButton>
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
    <NAlert
      v-if="error"
      type="error"
      :bordered="false"
      >{{ error }}，请处理后重新检查。</NAlert
    >
    <ul
      class="preflight-list"
      :aria-busy="refreshing"
    >
      <li
        v-for="check in checks"
        :key="check.id"
        :data-check="check.id"
      >
        <NTag
          size="small"
          :bordered="false"
          :type="check.status"
          >{{ labels[check.status] }}</NTag
        >
        <div class="preflight-copy">
          <strong>{{ check.title }}</strong>
          <p>{{ check.detail }}</p>
        </div>
        <NButton
          v-if="check.status !== 'success'"
          size="tiny"
          quaternary
          @click="$emit('navigate', check.target)"
        >
          {{ targets[check.target] }}
        </NButton>
      </li>
    </ul>
  </NCard>
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
  font-size: 16px;
  font-weight: 600;
}
p {
  margin: 3px 0 0;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.preflight-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 14px 0 4px;
  font-size: 12px;
  color: var(--vtsuru-fg);
}
.preflight-summary span {
  color: var(--vtsuru-fg-muted);
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
  border-bottom: 1px solid var(--vtsuru-border);
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
