<script setup lang="ts">
import { computed } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType, TriggerType } from '@/apps/client/store/useAutoAction'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Card, CardContent } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'

import AdvancedSettings from './settings/AdvancedSettings.vue'
import BasicSettings from './settings/BasicSettings.vue'
import DanmakuSettings from './settings/DanmakuSettings.vue'
import EnterSettings from './settings/EnterSettings.vue'
import FollowSettings from './settings/FollowSettings.vue'
import GiftSettings from './settings/GiftSettings.vue'
import GuardSettings from './settings/GuardSettings.vue'
import PngtuberSettings from './settings/PngtuberSettings.vue'
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
  hideUserFilter: {
    type: Boolean,
    default: false,
  },
})

const showTemplate = computed(() => {
  return [ActionType.SEND_DANMAKU, ActionType.SEND_PRIVATE_MSG, ActionType.EXECUTE_COMMAND].includes(
    props.action.actionType,
  )
})

const showVtsSettings = computed(() => {
  return [
    ActionType.VTS_HOTKEY,
    ActionType.VTS_PRESET,
    ActionType.VTS_DROP_ITEM,
    ActionType.VTS_PARAM_ADD,
    ActionType.VTS_MACRO,
    ActionType.VTS_ACCESSORY,
  ].includes(props.action.actionType)
})

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

function getAdvancedSummary() {
  const summaries: string[] = []
  const { triggerConfig, ignoreCooldown, actionConfig, logicalExpression, executeCommand } = props.action

  if (!props.hideUserFilter && triggerConfig.userFilterEnabled) summaries.push('用户过滤')
  if (!ignoreCooldown && (actionConfig.cooldownSeconds > 0 || actionConfig.delaySeconds > 0))
    summaries.push('冷却/延迟')
  if (logicalExpression) summaries.push('逻辑条件')
  if (executeCommand) summaries.push('自定义JS')

  if (summaries.length === 0) return ''
  return `(${summaries.join(', ')})`
}
</script>

<template>
  <div class="auto-action-editor flex flex-col gap-4">
    <!-- 1. 基础设置 -->
    <BasicSettings
      :action="action"
      :hide-name="hideName"
      :hide-enabled="hideEnabled"
    />

    <!-- 2. 内容配置 (模板或VTS) -->
    <Card
      v-if="showTemplate || showVtsSettings || action.actionType === ActionType.PNGTUBER_EXPRESSION"
      class="content-settings-card border-none bg-muted/40"
    >
      <CardContent class="p-0">
        <TemplateSettings
          v-if="showTemplate"
          :action="action"
          :custom-test-context="customTestContext"
        />
        <PngtuberSettings
          v-if="action.actionType === ActionType.PNGTUBER_EXPRESSION"
          :action="action"
        />
        <VtsSettings
          v-if="showVtsSettings"
          :action="action"
        />
      </CardContent>
    </Card>

    <!-- 3. 高级设置 (触发器特定 & 通用高级) -->
    <Accordion
      type="single"
      collapsible
      class="w-full border rounded-lg px-3 bg-card"
    >
      <AccordionItem
        value="advanced"
        class="border-none"
      >
        <AccordionTrigger class="py-3 text-sm font-medium hover:no-underline">
          <div class="flex items-center gap-2">
            <span>高级规则与触发条件</span>
            <span class="text-xs text-muted-foreground font-normal">
              {{ getAdvancedSummary() }}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent class="pt-2 pb-4">
          <div class="flex flex-col gap-4">
            <!-- 触发器特定设置 -->
            <component
              :is="TriggerSettings"
              v-if="TriggerSettings"
              :action="action"
              class="trigger-settings"
            />

            <div
              v-if="TriggerSettings"
              class="relative my-2 text-center"
            >
              <Separator />
              <span class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                通用高级设置
              </span>
            </div>

            <!-- 通用高级设置 -->
            <AdvancedSettings
              :action="action"
              :hide-user-filter="hideUserFilter"
              class="advanced-settings"
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
</template>

<style scoped>
.auto-action-editor {
  width: 100%;
}

.trigger-settings {
  width: 100%;
}
</style>
