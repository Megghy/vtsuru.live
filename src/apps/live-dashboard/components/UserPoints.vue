<script setup lang="ts">
import { Minus, Plus } from 'lucide-vue-next'
import { ref, watch } from 'vue'

import { getUserPointHistories, giveUserPoint } from '@/api/point-user'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Spin } from '@/shared/ui/spin'
import { SimpleTooltip } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'

const message = useMessage()

import type { DashboardEvent } from '../core/types'

const props = defineProps<{ event: DashboardEvent }>()

const total = ref<number>()
const loading = ref(false)
const error = ref<string>()
const count = ref(10)
const reason = ref('')
const submitting = ref(false)

let requestSeq = 0

async function load() {
  const seq = ++requestSeq
  const targetEvent = props.event
  loading.value = true
  error.value = undefined
  try {
    const histories = await getUserPointHistories(targetEvent)
    if (seq !== requestSeq) return
    total.value = histories.reduce((sum, h) => sum + h.point, 0)
  } catch (err) {
    if (seq !== requestSeq) return
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (seq === requestSeq) {
      loading.value = false
    }
  }
}

watch(
  () => props.event.ouid,
  () => void load(),
  { immediate: true },
)

async function give(sign: 1 | -1) {
  submitting.value = true
  try {
    const result = await giveUserPoint(props.event, sign * count.value, reason.value.trim() || '中控台手动调整')
    total.value = result.totalPoint
    message.success(`${sign > 0 ? '已增加' : '已扣除'} ${count.value} 积分`)
    reason.value = ''
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex-between text-xs">
      <span class="text-muted-foreground">积分</span>
      <Spin
        v-if="loading"
        class="h-3 w-3"
      />
      <SimpleTooltip
        v-else-if="error"
        :content="error"
      >
        <span class="text-destructive truncate max-w-[200px]">{{ error }}</span>
      </SimpleTooltip>
      <span
        v-else
        class="font-semibold tabular-nums text-foreground"
        >{{ Number((total ?? 0).toFixed(1)) }}</span
      >
    </div>
    <div class="flex items-center gap-1.5">
      <NumberField
        v-model="count"
        size="xs"
        :min="0.1"
        :show-buttons="false"
        class="w-16"
      />
      <Input
        size="xs"
        v-model="reason"
        class="flex-1"
        placeholder="原因（可选）"
        :maxlength="100"
      />
      <Button
        size="icon-xs"
        variant="secondary"
        class="shrink-0 text-primary"
        :disabled="!count || !!error || submitting"
        aria-label="增加积分"
        @click="give(1)"
      >
        <Plus class="size-3.5" />
      </Button>
      <Button
        size="icon-xs"
        variant="secondary"
        class="shrink-0"
        :disabled="!count || !!error || !total || submitting"
        aria-label="扣除积分"
        @click="give(-1)"
      >
        <Minus class="size-3.5" />
      </Button>
    </div>
  </div>
</template>
