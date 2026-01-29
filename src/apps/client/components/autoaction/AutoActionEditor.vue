<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NCard, NCollapse, NCollapseItem, NDivider, NFlex, NText } from 'naive-ui';
import { ActionType, TriggerType } from '@/apps/client/store/useAutoAction'
import { computed } from 'vue'

import AdvancedSettings from './settings/AdvancedSettings.vue'
// 引入拆分的子组件
import BasicSettings from './settings/BasicSettings.vue'
import DanmakuSettings from './settings/DanmakuSettings.vue'
import EnterSettings from './settings/EnterSettings.vue'
import FollowSettings from './settings/FollowSettings.vue'
import GiftSettings from './settings/GiftSettings.vue'
import GuardSettings from './settings/GuardSettings.vue'
import ScheduledSettings from './settings/ScheduledSettings.vue'
import SuperChatSettings from './settings/SuperChatSettings.vue'
import TemplateSettings from './settings/TemplateSettings.vue'
import VtsSettings from './settings/VtsSettings.vue'

const props = defineProps({
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
  customTestContext: {
    type: Object,
    default: undefined,
  },
})

const showTemplate = computed(() => {
  return [
    ActionType.SEND_DANMAKU,
    ActionType.SEND_PRIVATE_MSG,
    ActionType.EXECUTE_COMMAND,
  ].includes(props.action.actionType)
})

const showVtsSettings = computed(() => {
  return [
    ActionType.VTS_HOTKEY,
    ActionType.VTS_PRESET,
    ActionType.VTS_DROP_ITEM,
    ActionType.VTS_PARAM_ADD,
  ].includes(props.action.actionType)
})

// 根据触发类型获取对应的设置组件
function getTriggerSettings() {
  switch (props.action.triggerType) {
    case TriggerType.DANMAKU:
      return DanmakuSettings
    case TriggerType.GIFT:
      return GiftSettings
    case TriggerType.GUARD:
      return GuardSettings
    case TriggerType.FOLLOW:
      return FollowSettings
    case TriggerType.ENTER:
      return EnterSettings
    case TriggerType.SCHEDULED:
      return ScheduledSettings
    case TriggerType.SUPER_CHAT:
      return SuperChatSettings
    default:
      return null
  }
}

const TriggerSettings = getTriggerSettings()

// 获取高级设置的简要状态
function getAdvancedSummary() {
  const summaries: string[] = []
  const { triggerConfig, ignoreCooldown, actionConfig, logicalExpression, executeCommand } = props.action

  if (triggerConfig.userFilterEnabled) summaries.push('用户过滤')
  if (!ignoreCooldown && (actionConfig.cooldownSeconds > 0 || actionConfig.delaySeconds > 0)) summaries.push('冷却/延迟')
  if (logicalExpression) summaries.push('逻辑条件')
  if (executeCommand) summaries.push('自定义JS')

  if (summaries.length === 0) return ''
  return `(${summaries.join(', ')})`
}
</script>

<template>
  <NFlex class="auto-action-editor" vertical :size="16">
    <!-- 1. 基础设置 -->
    <BasicSettings
      :action="action"
      :hide-name="hideName"
      :hide-enabled="hideEnabled"
    />

    <!-- 2. 内容配置 (模板或VTS) -->
    <NCard
      v-if="showTemplate || showVtsSettings"
      size="small"
      embedded
      :bordered="false"
      class="content-settings-card"
    >
      <TemplateSettings v-if="showTemplate" :action="action" :custom-test-context="customTestContext" />
      <VtsSettings v-if="showVtsSettings" :action="action" />
    </NCard>

    <!-- 3. 高级设置 (触发器特定 & 通用高级) -->
    <NCollapse>
      <NCollapseItem title="高级规则与触发条件" name="advanced">
        <template #header-extra>
          <NText depth="3" style="font-size: 12px">
            {{ getAdvancedSummary() }}
          </NText>
        </template>
        <NFlex vertical :size="16" style="padding-top: 8px">
          <!-- 触发器特定设置 -->
          <component
            :is="TriggerSettings"
            v-if="TriggerSettings"
            :action="action"
            class="trigger-settings"
          />

          <NDivider v-if="TriggerSettings" style="margin: 0;">
            通用高级设置
          </NDivider>

          <!-- 通用高级设置 -->
          <AdvancedSettings
            :action="action"
            class="advanced-settings"
          />
        </NFlex>
      </NCollapseItem>
    </NCollapse>
  </NFlex>
</template>

<style scoped>
.auto-action-editor {
  width: 100%;
}

.content-settings-card {
  background-color: var(--n-color-modal); 
}

.trigger-settings {
  width: 100%;
}
</style>
