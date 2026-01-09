<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NCollapse, NCollapseItem, NDivider, NFlex } from 'naive-ui'
import { TriggerType } from '@/apps/client/store/useAutoAction'

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
</script>

<template>
  <NFlex class="auto-action-editor" vertical :size="12">
    <TemplateSettings :action="action" :custom-test-context="customTestContext" />

    <BasicSettings
      :action="action"
      :hide-name="hideName"
      :hide-enabled="hideEnabled"
    />

    <NCollapse>
      <NCollapseItem title="高级选项" name="advanced">
        <NFlex vertical :size="12">
          <component
            :is="TriggerSettings"
            v-if="TriggerSettings"
            :action="action"
            class="trigger-settings"
          />
          <NDivider style="margin: 0;">
            通用高级设置
          </NDivider>
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
.trigger-settings {
  width: 100%;
}
</style>
