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
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

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
    <Alert class="py-2 px-2.5 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
      <AlertDescription class="text-xs m-0">
        驱动需已启动且频道一致。持续时间为 0 时保持表情，其他值到期后恢复。
      </AlertDescription>
    </Alert>

    <div class="space-y-1">
      <span class="text-xs text-muted-foreground">频道</span>
      <Input
        v-model="action.actionConfig.pngtuberChannel"
        placeholder="default"
        class="h-8 text-xs"
      />
    </div>

    <div class="space-y-1">
      <span class="text-xs text-muted-foreground">表情 ID</span>
      <div v-if="expressionOptions.length > 0">
        <Select v-model="action.actionConfig.pngtuberExpressionId">
          <SelectTrigger class="h-8 text-xs w-full">
            <SelectValue placeholder="选择已加载表情或填写表情 ID" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in expressionOptions"
              :key="opt.value"
              :value="opt.value"
              class="text-xs"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div v-else>
        <Input
          v-model="action.actionConfig.pngtuberExpressionId"
          placeholder="填写表情 ID"
          class="h-8 text-xs"
        />
      </div>
    </div>

    <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
      <span class="text-xs font-medium text-foreground">持续时间（毫秒）</span>
      <NInputNumber
        :value="action.actionConfig.pngtuberDurationMs"
        :min="0"
        :step="100"
        placeholder="5000"
        size="small"
        class="w-32"
        @update:value="action.actionConfig.pngtuberDurationMs = $event"
      />
    </div>

    <div class="flex items-center gap-4 text-xs pt-1">
      <RouterLink :to="{ name: 'client-pngtuber' }" class="text-primary hover:underline">
        前往启动驱动 →
      </RouterLink>
      <RouterLink :to="{ name: 'client-pngtuber-model', query: { channel: targetChannel } }" class="text-primary hover:underline">
        编辑目标频道表情 →
      </RouterLink>
    </div>

    <Button
      class="h-8 text-xs w-full"
      :disabled="testing || !action.actionConfig.pngtuberExpressionId?.trim()"
      @click="test"
    >
      {{ testing ? '切换中...' : '测试切换表情' }}
    </Button>
  </div>
</template>
