<script setup lang="ts">
import { Add16Regular, Subtract16Regular } from '@vicons/fluent'
import { NButton, NIcon, NInput, NInputNumber, NSpin } from 'naive-ui'
import { ref, watch } from 'vue'

import { getUserPointHistories, giveUserPoint } from '@/api/point-user'

import type { DashboardEvent } from '../core/types'

const props = defineProps<{ event: DashboardEvent }>()

const total = ref<number>()
const loading = ref(false)
const error = ref<string>()
const count = ref(10)
const reason = ref('')
const submitting = ref(false)

async function load() {
  loading.value = true
  error.value = undefined
  try {
    const histories = await getUserPointHistories(props.event)
    total.value = histories.reduce((sum, h) => sum + h.point, 0)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

watch(() => props.event.ouid, () => void load(), { immediate: true })

async function give(sign: 1 | -1) {
  submitting.value = true
  try {
    const result = await giveUserPoint(props.event, sign * count.value, reason.value.trim() || '中控台手动调整')
    total.value = result.totalPoint
    window.$message.success(`${sign > 0 ? '已增加' : '已扣除'} ${count.value} 积分`)
    reason.value = ''
  } catch (err) {
    window.$message.error(err instanceof Error ? err.message : String(err))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="user-points">
    <div class="user-points__head">
      <span class="user-points__label">积分</span>
      <NSpin
        v-if="loading"
        :size="12"
      />
      <span
        v-else-if="error"
        class="user-points__error"
        :title="error"
      >{{ error }}</span>
      <span
        v-else
        class="user-points__value"
      >{{ Number((total ?? 0).toFixed(1)) }}</span>
    </div>
    <div class="user-points__form">
      <NInputNumber
        v-model:value="count"
        size="tiny"
        :min="0.1"
        :precision="1"
        :show-button="false"
        style="width: 64px"
      />
      <NInput
        v-model:value="reason"
        size="tiny"
        placeholder="原因（可选）"
        :maxlength="100"
      />
      <NButton
        size="tiny"
        secondary
        type="primary"
        :disabled="!count || !!error"
        :loading="submitting"
        aria-label="增加积分"
        @click="give(1)"
      >
        <template #icon>
          <NIcon :component="Add16Regular" />
        </template>
      </NButton>
      <NButton
        size="tiny"
        secondary
        :disabled="!count || !!error || !total"
        :loading="submitting"
        aria-label="扣除积分"
        @click="give(-1)"
      >
        <template #icon>
          <NIcon :component="Subtract16Regular" />
        </template>
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.user-points {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
}

.user-points__head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.user-points__label {
  color: var(--vtsuru-fg-muted);
}

.user-points__value {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.user-points__error {
  color: var(--vtsuru-error);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-points__form {
  display: flex;
  gap: 4px;
  align-items: center;
}
</style>
