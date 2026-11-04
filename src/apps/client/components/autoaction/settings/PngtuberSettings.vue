<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { toast } from 'vue-sonner'

import { executeActions } from '@/apps/client/store/autoAction/actionUtils'
import type { AutoActionItem } from '@/apps/client/store/autoAction/types'
import { createDefaultRuntimeState } from '@/apps/client/store/autoAction/utils'
import { usePngtuberDriver } from '@/apps/client/store/usePngtuberDriver'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { SettingRow } from '@/shared/ui/setting-row'

const props = defineProps<{ action: AutoActionItem }>()
const driver = usePngtuberDriver()
const targetChannel = computed(() => props.action.actionConfig.pngtuberChannel?.trim() || 'default')
const expressionOptions = computed(() =>
  driver.channel === targetChannel.value
    ? driver.config.expressions.map((expression) => ({
        label: `${expression.name} · ${expression.id}`,
        value: expression.id,
      }))
    : [],
)
const testing = ref(false)

function test() {
  testing.value = true
  executeActions(
    [props.action],
    null,
    props.action.triggerType,
    1,
    createDefaultRuntimeState(),
    {},
    {
      isTest: true,
      onSuccess: () => {
        testing.value = false
        toast.success('表情已切换')
      },
      onError: () => {
        testing.value = false
      },
    },
  )
}
</script>

<template>
  <div class="space-y-3">
    <Alert size="sm" variant="info">
      <AlertDescription class="m-0">
        驱动需已启动且频道一致。持续时间为 0 时保持表情，其他值到期后恢复。
      </AlertDescription>
    </Alert>

    <FormField
      label="频道"
      placeholder="default"
      v-model="action.actionConfig.pngtuberChannel"
    />

    <FormField
      v-if="expressionOptions.length > 0"
      type="select"
      label="表情 ID"
      placeholder="选择已加载表情"
      :options="expressionOptions"
      v-model="action.actionConfig.pngtuberExpressionId"
    />
    <FormField
      v-else
      label="表情 ID"
      placeholder="填写表情 ID"
      v-model="action.actionConfig.pngtuberExpressionId"
    />

    <SettingRow
      type="number"
      title="持续时间（毫秒）"
      hint="持续时间为 0 时保持表情，其他值到期后恢复默认"
      :min="0"
      :step="100"
      placeholder="5000"
      :model-value="action.actionConfig.pngtuberDurationMs"
      @change="(val) => (action.actionConfig.pngtuberDurationMs = Number(val) || 0)"
    />

    <div class="flex items-center gap-4 text-xs pt-1">
      <RouterLink
        :to="{ name: 'client-pngtuber' }"
        class="text-primary hover:underline"
      >
        前往启动驱动 →
      </RouterLink>
      <RouterLink
        :to="{ name: 'client-pngtuber-model', query: { channel: targetChannel } }"
        class="text-primary hover:underline"
      >
        前往模型配置 →
      </RouterLink>
      <Button
        size="xs"
        variant="outline"
        class="ml-auto"
        :loading="testing"
        :disabled="testing || !action.actionConfig.pngtuberExpressionId"
        @click="test"
      >
        测试触发
      </Button>
    </div>
  </div>
</template>
