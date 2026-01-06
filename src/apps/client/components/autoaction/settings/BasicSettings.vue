<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NInput, NSelect, NSpace, NSwitch } from 'naive-ui'
import { ActionType, Priority, TriggerType } from '@/apps/client/store/useAutoAction'

defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
  hideName: {
    type: Boolean,
    default: false,
  },
  hideEnabled: {
    type: Boolean,
    default: false,
  },
})

// 触发类型选项
const triggerTypeOptions = [
  { label: '弹幕触发', value: TriggerType.DANMAKU },
  { label: '礼物感谢', value: TriggerType.GIFT },
  { label: '上舰感谢', value: TriggerType.GUARD },
  { label: '关注感谢', value: TriggerType.FOLLOW },
  { label: '入场欢迎', value: TriggerType.ENTER },
  { label: '定时发送', value: TriggerType.SCHEDULED },
  { label: 'SC感谢', value: TriggerType.SUPER_CHAT },
]

// 操作类型选项
const actionTypeOptions = [
  { label: '发送弹幕', value: ActionType.SEND_DANMAKU },
  { label: '发送私信', value: ActionType.SEND_PRIVATE_MSG },
  { label: '执行命令', value: ActionType.EXECUTE_COMMAND },
]

// 优先级选项
const priorityOptions = [
  { label: '最高', value: Priority.HIGHEST },
  { label: '高', value: Priority.HIGH },
  { label: '普通', value: Priority.NORMAL },
  { label: '低', value: Priority.LOW },
  { label: '最低', value: Priority.LOWEST },
]
</script>

<template>
  <div class="basic-settings-container">
    <NSpace
      vertical
      class="basic-settings"
    >
      <NSpace
        v-if="!hideName"
        key="name"
        align="center"
        justify="space-between"
        style="width: 100%"
        class="setting-item"
      >
        <span>名称:</span>
        <NInput
          v-model:value="action.name"
          style="width: 300px"
        />
      </NSpace>

      <NSpace
        v-if="!hideEnabled"
        key="enabled"
        align="center"
        justify="space-between"
        style="width: 100%"
        class="setting-item"
      >
        <span>启用:</span>
        <NSwitch v-model:value="action.enabled" />
      </NSpace>

      <NSpace
        key="only-during-live"
        align="center"
        justify="space-between"
        style="width: 100%"
        class="setting-item"
      >
        <span>仅直播中启用:</span>
        <NSwitch v-model:value="action.triggerConfig.onlyDuringLive" />
      </NSpace>

      <NSpace
        key="ignore-tianxuan"
        align="center"
        justify="space-between"
        style="width: 100%"
        class="setting-item"
      >
        <span>天选时刻忽略:</span>
        <NSwitch v-model:value="action.triggerConfig.ignoreTianXuan" />
      </NSpace>

      <NSpace
        key="triggerType"
        align="center"
        justify="space-between"
        style="width: 100%"
        class="setting-item"
      >
        <span>触发类型:</span>
        <NSelect
          v-model:value="action.triggerType"
          style="width: 300px"
          :options="triggerTypeOptions"
          disabled
        />
      </NSpace>

      <NSpace
        key="actionType"
        align="center"
        justify="space-between"
        style="width: 100%"
        class="setting-item"
      >
        <span>操作类型:</span>
        <NSelect
          v-model:value="action.actionType"
          style="width: 300px"
          :options="actionTypeOptions"
        />
      </NSpace>

      <NSpace
        key="priority"
        align="center"
        justify="space-between"
        style="width: 100%"
        class="setting-item"
      >
        <span>优先级:</span>
        <NSelect
          v-model:value="action.priority"
          style="width: 300px"
          :options="priorityOptions"
        />
      </NSpace>
    </NSpace>
  </div>
</template>

<style scoped>
</style>
