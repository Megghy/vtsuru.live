<script setup lang="ts">
import { NAlert, NButton, NFlex, NFormItem, NInput, NInputNumber, NSelect } from 'naive-ui'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { usePngtuberDriver } from '@/apps/client/store/usePngtuberDriver'

import { executeActions } from '@/apps/client/store/autoAction/actionUtils'
import type { AutoActionItem } from '@/apps/client/store/autoAction/types'
import { createDefaultRuntimeState } from '@/apps/client/store/autoAction/utils'
const props = defineProps<{ action: AutoActionItem }>()
const driver = usePngtuberDriver()
const targetChannel = computed(() => props.action.actionConfig.pngtuberChannel?.trim() || 'default')
const expressionOptions = computed(() => driver.channel === targetChannel.value
  ? driver.config.expressions.map(expression => ({ label: `${expression.name} · ${expression.id}`, value: expression.id }))
  : [])
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
        window.$message?.success('表情已切换')
      },
      onError: () => {
        testing.value = false
      },
    },
  )
}
</script>

<template>
  <NFlex vertical>
    <NAlert :show-icon="false">驱动需已启动且频道一致。持续时间为 0 时保持表情，其他值到期后恢复。</NAlert>
    <NFormItem label="频道"
      ><NInput
        v-model:value="action.actionConfig.pngtuberChannel"
        placeholder="default"
    /></NFormItem>
    <NFormItem label="表情 ID"
      ><NSelect
        v-model:value="action.actionConfig.pngtuberExpressionId"
        :options="expressionOptions"
        filterable
        tag
        placeholder="选择已加载表情或填写表情 ID"
    /></NFormItem>
    <NFormItem label="持续时间（毫秒）"
      ><NInputNumber
        v-model:value="action.actionConfig.pngtuberDurationMs"
        :min="0"
        :precision="0"
        :step="100"
        placeholder="5000"
    /></NFormItem>
    <RouterLink :to="{ name: 'client-pngtuber' }">前往启动驱动</RouterLink>
    <RouterLink :to="{ name: 'client-pngtuber-model', query: { channel: targetChannel } }">编辑目标频道表情</RouterLink>
    <NButton
      :disabled="testing || !action.actionConfig.pngtuberExpressionId?.trim()"
      :loading="testing"
      @click="test"
      >测试切换表情</NButton
    >
  </NFlex>
</template>
