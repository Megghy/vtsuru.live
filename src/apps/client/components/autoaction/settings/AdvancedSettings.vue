<script setup lang="ts">
import { computed } from 'vue'

import { createDefaultAutoAction, validateLogicalExpression } from '@/apps/client/store/autoAction/utils'
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Badge } from '@/shared/ui/badge'
import { FormField } from '@/shared/ui/form-field'
import { SettingRow } from '@/shared/ui/setting-row'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
  hideUserFilter: {
    type: Boolean,
    default: false,
  },
})

const showUserFilter = computed(() => !props.hideUserFilter && props.action.triggerType !== TriggerType.SCHEDULED)
const defaultAction = computed(() => createDefaultAutoAction(props.action.triggerType))

function isModified(path: string, value: any) {
  const pathParts = path.split('.')
  let defaultValue: any = defaultAction.value
  let currentValue: any = props.action

  for (const part of pathParts) {
    defaultValue =
      defaultValue && typeof defaultValue === 'object' ? defaultValue[part as keyof typeof defaultValue] : undefined
    currentValue =
      currentValue && typeof currentValue === 'object' ? currentValue[part as keyof typeof currentValue] : undefined
  }

  if (value !== undefined) return value !== defaultValue
  return currentValue !== defaultValue
}

const userFilterModified = computed(() => {
  if (!showUserFilter.value) return false
  return (
    isModified('triggerConfig.userFilterEnabled', props.action.triggerConfig.userFilterEnabled) ||
    isModified('triggerConfig.requireMedal', props.action.triggerConfig.requireMedal) ||
    isModified('triggerConfig.requireCaptain', props.action.triggerConfig.requireCaptain)
  )
})

const cooldownModified = computed(() => {
  return (
    isModified('ignoreCooldown', props.action.ignoreCooldown) ||
    isModified('actionConfig.delaySeconds', props.action.actionConfig.delaySeconds) ||
    isModified('actionConfig.cooldownSeconds', props.action.actionConfig.cooldownSeconds)
  )
})

const logicalExpressionModified = computed(() => isModified('logicalExpression', props.action.logicalExpression))

const expressionSyntaxError = computed(() => {
  const err = validateLogicalExpression(props.action.logicalExpression)
  return err ? `语法错误：${err}` : undefined
})
</script>

<template>
  <div class="advanced-settings">
    <Accordion
      type="single"
      collapsible
      class="w-full space-y-2"
    >
      <AccordionItem
        v-if="showUserFilter"
        value="user-filter"
        class="border rounded-md px-3 bg-card"
      >
        <AccordionTrigger class="py-2.5 hover:no-underline">
          <div class="flex items-center gap-2">
            <span
              class="text-xs font-semibold"
              :class="userFilterModified ? 'text-amber-500' : 'text-foreground'"
            >
              用户过滤条件
            </span>
            <Badge
              v-if="userFilterModified"
              variant="warning"
              size="xs"
            >
              已修改
            </Badge>
          </div>
        </AccordionTrigger>

        <AccordionContent class="pt-2 pb-3 space-y-3">
          <SettingRow
            type="switch"
            variant="compact"
            title="启用通用用户筛选"
            v-model="action.triggerConfig.userFilterEnabled"
          />

          <div
            v-if="action.triggerConfig.userFilterEnabled"
            class="space-y-2 pl-2 border-l-2 border-primary/30"
          >
            <SettingRow
              type="switch"
              variant="compact"
              title="要求佩戴粉丝勋章"
              v-model="action.triggerConfig.requireMedal"
            />
            <SettingRow
              type="switch"
              variant="compact"
              title="要求大航海身份"
              v-model="action.triggerConfig.requireCaptain"
            />
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem
        value="cooldown"
        class="border rounded-md px-3 bg-card"
      >
        <AccordionTrigger class="py-2.5 hover:no-underline">
          <div class="flex items-center gap-2">
            <span
              class="text-xs font-semibold"
              :class="cooldownModified ? 'text-amber-500' : 'text-foreground'"
            >
              频率与延迟控制
            </span>
            <Badge
              v-if="cooldownModified"
              variant="warning"
              size="xs"
            >
              已修改
            </Badge>
          </div>
        </AccordionTrigger>

        <AccordionContent class="pt-2 pb-3 space-y-3">
          <SettingRow
            type="switch"
            variant="compact"
            title="忽略单条规则冷却"
            hint="开启后跳过下方设定的单条规则冷却时间；全局每分钟弹幕防吞限流仍会生效"
            v-model="action.ignoreCooldown"
          />

          <SettingRow
            type="number"
            variant="compact"
            title="延迟执行 (秒)"
            hint="命中条件后延迟指定秒数再触发动作"
            :min="0"
            :max="600"
            v-model="action.actionConfig.delaySeconds"
          />

          <SettingRow
            type="number"
            variant="compact"
            title="规则冷却时间 (秒)"
            hint="两次触发之间的最小间隔（忽略单条冷却开启时不生效）"
            :min="0"
            :max="3600"
            :disabled="action.ignoreCooldown"
            v-model="action.actionConfig.cooldownSeconds"
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem
        value="logical-expression"
        class="border rounded-md px-3 bg-card"
      >
        <AccordionTrigger class="py-2.5 hover:no-underline">
          <div class="flex items-center gap-2">
            <span
              class="text-xs font-semibold"
              :class="expressionSyntaxError ? 'text-destructive' : logicalExpressionModified ? 'text-amber-500' : 'text-foreground'"
            >
              逻辑判断表达式
            </span>
            <Badge
              v-if="expressionSyntaxError"
              variant="destructive"
              size="xs"
            >
              语法错误
            </Badge>
            <Badge
              v-else-if="logicalExpressionModified"
              variant="warning"
              size="xs"
            >
              已配置
            </Badge>
          </div>
        </AccordionTrigger>

        <AccordionContent class="pt-2 pb-3 space-y-2">
          <FormField
            v-model="action.logicalExpression"
            type="textarea"
            placeholder="例如：user.guardLevel > 0 || gift.price >= 10"
            control-class="font-mono resize-none min-h-[64px]"
            :error="expressionSyntaxError"
            description="使用同步 JavaScript 表达式，仅返回真值时执行。可直接访问 user、gift、sc、guard、danmaku、pointOrder、event 以及 inDanmaku()、giftValue()、hasMedal()、isCaptain() 等辅助变量。"
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
</template>
