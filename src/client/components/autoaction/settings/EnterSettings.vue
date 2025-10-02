<script setup lang="ts">
import type { AutoActionItem } from '@/client/store/useAutoAction'
import { NCollapseItem, NInputNumber, NSelect, NSpace, NSwitch } from 'naive-ui'
import { TriggerType } from '@/client/store/useAutoAction'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

// 入场过滤模式选项
const enterFilterModeOptions = [
  { label: '不过滤', value: 'none' },
  { label: '用户黑名单', value: 'blacklist' },
  { label: '用户白名单', value: 'whitelist' },
  { label: '仅舰长', value: 'guard' },
  { label: '仅勋章', value: 'medal' },
]
</script>

<template>
  <NCollapseItem
    v-if="action.triggerType === TriggerType.ENTER"
    title="入场触发设置"
  >
    <NSpace vertical>
      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>入场过滤模式:</span>
        <NSelect
          v-model:value="action.triggerConfig.filterMode"
          style="width: 200px"
          :options="enterFilterModeOptions"
        />
      </NSpace>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>防止重复发送:</span>
        <NSwitch v-model:value="action.triggerConfig.preventRepeat" />
      </NSpace>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>每次处理的最大用户数:</span>
        <NInputNumber
          v-model:value="action.actionConfig.maxUsersPerMsg"
          :min="1"
          :max="20"
          style="width: 120px"
        />
      </NSpace>
    </NSpace>
  </NCollapseItem>
</template>
