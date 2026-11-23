<script setup lang="ts">
import { Play, Sparkles } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { toast } from 'vue-sonner'

import { executeActions } from '@/apps/client/store/autoAction/actionUtils'
import type { AutoActionItem } from '@/apps/client/store/autoAction/types'
import { createDefaultRuntimeState } from '@/apps/client/store/autoAction/utils'
import { usePngtuberDriver } from '@/apps/client/store/usePngtuberDriver'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
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
  <Card>
    <CardHeader class="p-3 border-b flex-between flex-row space-y-0">
      <div class="flex items-center gap-2">
        <Sparkles class="size-4 text-primary" />
        <CardTitle class="text-xs font-semibold">PNGtuber 表情配置</CardTitle>
      </div>
      <Button
        size="xs"
        variant="secondary"
        class="gap-1"
        :disabled="testing || !action.actionConfig.pngtuberExpressionId"
        @click="test"
      >
        <Play class="size-3.5" />
        测试切换
      </Button>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <Alert
        size="sm"
        variant="info"
      >
        <AlertDescription class="m-0">
          需先启动 PNGtuber 驱动且保持频道一致。持续时间为 0 时保持表情，大于 0 时到期自动恢复默认。
        </AlertDescription>
      </Alert>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </div>

      <SettingRow
        type="number"
        variant="compact"
        title="持续时间（毫秒）"
        hint="0 表示保持表情，其他值到期后自动恢复默认"
        :min="0"
        :step="100"
        placeholder="5000"
        :model-value="action.actionConfig.pngtuberDurationMs"
        @update:model-value="action.actionConfig.pngtuberDurationMs = Number($event) || 0"
      />

      <div class="flex items-center gap-4 text-xs pt-1 border-t">
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
      </div>
    </CardContent>
  </Card>
</template>
