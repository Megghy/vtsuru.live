<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NCard, NForm, NFormItem, NGi, NGrid, NInput, NSelect, NSwitch, NTooltip, NIcon } from 'naive-ui';
import { ActionType, Priority, TriggerType } from '@/apps/client/store/useAutoAction'
import { Info16Regular } from '@vicons/fluent'

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
  { label: 'VTS：触发热键', value: ActionType.VTS_HOTKEY },
  { label: 'VTS：机位预设', value: ActionType.VTS_PRESET },
  { label: 'VTS：掉落道具', value: ActionType.VTS_DROP_ITEM },
  { label: 'VTS：参数注入(add)', value: ActionType.VTS_PARAM_ADD },
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
  <NCard
    title="常规设置"
    size="small"
    bordered
    embedded
    class="basic-settings-card"
  >
    <NForm
      label-placement="left"
      label-width="100"
      size="small"
      :show-feedback="false"
    >
      <NGrid
        cols="1 m:2"
        responsive="screen"
        :x-gap="24"
        :y-gap="12"
      >
        <NGi v-if="!hideName" span="1 m:2">
          <NFormItem label="操作名称">
            <NInput
              v-model:value="action.name"
              placeholder="例如：给礼物老板点赞"
              clearable
            />
          </NFormItem>
        </NGi>

        <NGi v-if="!hideEnabled">
          <NFormItem label="是否启用">
            <NSwitch v-model:value="action.enabled" size="small" />
          </NFormItem>
        </NGi>

        <NGi>
          <NFormItem>
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span>仅直播时 <NIcon :component="Info16Regular" style="vertical-align: -2px" /></span>
                </template>
                关闭直播后将不会触发此操作
              </NTooltip>
            </template>
            <NSwitch v-model:value="action.triggerConfig.onlyDuringLive" size="small" />
          </NFormItem>
        </NGi>

        <NGi>
          <NFormItem>
            <template #label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span>忽略天选 <NIcon :component="Info16Regular" style="vertical-align: -2px" /></span>
                </template>
                开启天选时刻期间暂停触发（防止被风控）
              </NTooltip>
            </template>
            <NSwitch v-model:value="action.triggerConfig.ignoreTianXuan" size="small" />
          </NFormItem>
        </NGi>

        <NGi>
          <NFormItem label="触发类型">
            <NSelect
              v-model:value="action.triggerType"
              :options="triggerTypeOptions"
              disabled
            />
          </NFormItem>
        </NGi>

        <NGi>
          <NFormItem label="执行动作">
            <NSelect
              v-model:value="action.actionType"
              :options="actionTypeOptions"
            />
          </NFormItem>
        </NGi>

        <NGi>
          <NFormItem label="执行优先级">
            <NSelect
              v-model:value="action.priority"
              :options="priorityOptions"
            />
          </NFormItem>
        </NGi>
      </NGrid>
    </NForm>
  </NCard>
</template>

<style scoped>
.basic-settings-card {
  border-radius: var(--n-border-radius);
}

:deep(.n-form-item-label) {
  font-weight: 500;
}
</style>
