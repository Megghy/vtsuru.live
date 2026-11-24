<script setup lang="ts">
import { computed } from 'vue'

import { NOTIFICATION_ACTION_TYPES, OBS_ACTION_TYPES, VTS_ACTION_TYPES } from '@/apps/client/store/autoAction/types'
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType, TriggerType } from '@/apps/client/store/useAutoAction'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

import type { Placeholder } from './placeholders'
import AdvancedSettings from './settings/AdvancedSettings.vue'
import AudioSettings from './settings/AudioSettings.vue'
import BasicSettings from './settings/BasicSettings.vue'
import DanmakuSettings from './settings/DanmakuSettings.vue'
import EnterSettings from './settings/EnterSettings.vue'
import FollowSettings from './settings/FollowSettings.vue'
import GiftSettings from './settings/GiftSettings.vue'
import GuardSettings from './settings/GuardSettings.vue'
import NotificationActionSettings from './settings/NotificationActionSettings.vue'
import ObsSettings from './settings/ObsSettings.vue'
import PngtuberSettings from './settings/PngtuberSettings.vue'
import PointRedeemSettings from './settings/PointRedeemSettings.vue'
import ScheduledSettings from './settings/ScheduledSettings.vue'
import SuperChatSettings from './settings/SuperChatSettings.vue'
import TemplateSettings from './settings/TemplateSettings.vue'
import VtsSettings from './settings/VtsSettings.vue'

const props = withDefaults(
  defineProps<{
    action: AutoActionItem
    hideName?: boolean
    hideEnabled?: boolean
    hideUserFilter?: boolean
    hideTriggerSettings?: boolean
    customTestContext?: Record<string, any>
    extraPlaceholders?: Placeholder[]
  }>(),
  {
    hideName: false,
    hideEnabled: false,
    hideUserFilter: false,
    hideTriggerSettings: false,
    customTestContext: undefined,
    extraPlaceholders: undefined,
  },
)

const showTemplate = computed(() =>
  [
    ActionType.SEND_DANMAKU,
    ActionType.SEND_PRIVATE_MSG,
    ActionType.SEND_NOTIFICATION,
    ActionType.OBS_NOTIFY,
    ActionType.SPEAK_TTS,
    ActionType.SEND_WEBHOOK,
  ].includes(props.action.actionType),
)

const showVtsSettings = computed(() => VTS_ACTION_TYPES.has(props.action.actionType))
const showObsSettings = computed(() => OBS_ACTION_TYPES.has(props.action.actionType))
const showNotificationSettings = computed(() => NOTIFICATION_ACTION_TYPES.has(props.action.actionType))
const showAudioSettings = computed(() => props.action.actionType === ActionType.PLAY_AUDIO)
const showPngtuberSettings = computed(() => props.action.actionType === ActionType.PNGTUBER_EXPRESSION)

const TriggerSettings = computed(() => {
  if (props.hideTriggerSettings) return null
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
    case TriggerType.POINT_REDEEM:
      return PointRedeemSettings
    default:
      return null
  }
})

const advancedSummary = computed(() => {
  const summaries: string[] = []
  const { triggerConfig, ignoreCooldown, actionConfig, logicalExpression } = props.action

  if (!props.hideUserFilter && triggerConfig.userFilterEnabled) summaries.push('用户筛选')
  if (!ignoreCooldown && (actionConfig.cooldownSeconds ?? 0) > 0) summaries.push(`冷却 ${actionConfig.cooldownSeconds}s`)
  if (ignoreCooldown) summaries.push('忽略单条冷却')
  if ((actionConfig.delaySeconds ?? 0) > 0) summaries.push(`延迟 ${actionConfig.delaySeconds}s`)
  if (logicalExpression?.trim()) summaries.push('逻辑表达式')

  return summaries.length > 0 ? `(${summaries.join(' · ')})` : ''
})
</script>

<template>
  <div class="auto-action-editor flex flex-col gap-3.5">
    <!-- 1. 基础设置 -->
    <BasicSettings
      :action="action"
      :hide-name="hideName"
      :hide-enabled="hideEnabled"
    />

    <!-- 2. 触发条件（直接展开呈现，不再深埋在折叠面板里） -->
    <Card v-if="TriggerSettings">
      <CardHeader class="p-3 border-b">
        <CardTitle class="text-xs font-semibold">触发条件配置</CardTitle>
      </CardHeader>
      <CardContent class="p-3">
        <component
          :is="TriggerSettings"
          :action="action"
          class="w-full"
        />
      </CardContent>
    </Card>

    <!-- 3. 执行内容 (通知 / 模板 / 音效 / PNGtuber / VTS / OBS) -->
    <div
      v-if="showNotificationSettings || showTemplate || showVtsSettings || showObsSettings || showPngtuberSettings || showAudioSettings"
      class="content-settings-section space-y-3.5"
    >
      <NotificationActionSettings
        v-if="showNotificationSettings"
        :action="action"
      />
      <TemplateSettings
        v-if="showTemplate"
        :action="action"
        :custom-test-context="customTestContext"
        :extra-placeholders="extraPlaceholders"
      />
      <AudioSettings
        v-if="showAudioSettings"
        :action="action"
      />
      <PngtuberSettings
        v-if="showPngtuberSettings"
        :action="action"
      />
      <VtsSettings
        v-if="showVtsSettings"
        :action="action"
      />
      <ObsSettings
        v-if="showObsSettings"
        :action="action"
      />
    </div>

    <!-- 4. 通用高级设置 (折叠面板) -->
    <Accordion
      type="single"
      collapsible
      class="w-full border rounded-lg px-3 bg-card"
    >
      <AccordionItem
        value="advanced"
        class="border-none"
      >
        <AccordionTrigger class="py-3 text-xs font-semibold hover:no-underline">
          <div class="flex items-center gap-2">
            <span>通用高级设置</span>
            <span
              v-if="advancedSummary"
              class="text-[11px] text-muted-foreground font-normal"
            >
              {{ advancedSummary }}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent class="pt-1 pb-3">
          <AdvancedSettings
            :action="action"
            :hide-user-filter="hideUserFilter"
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
</template>
