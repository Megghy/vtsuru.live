<script setup lang="ts">
import { computed } from 'vue'

import { createDefaultAutoAction } from '@/apps/client/store/autoAction/utils'
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

// 根据触发类型判断是否显示用户过滤选项
const showUserFilter = computed(() => {
  return !props.hideUserFilter && ![TriggerType.SCHEDULED].includes(props.action.triggerType)
})

// 获取默认配置作为比较基准
const defaultAction = computed(() => createDefaultAutoAction(props.action.triggerType))

// 检查设置项是否被修改
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

  if (value !== undefined) {
    return value !== defaultValue
  }

  return currentValue !== defaultValue
}

// 检查用户过滤区域是否有修改
const userFilterModified = computed(() => {
  if (!showUserFilter.value) return false
  return (
    isModified('triggerConfig.userFilterEnabled', props.action.triggerConfig.userFilterEnabled) ||
    isModified('triggerConfig.requireMedal', props.action.triggerConfig.requireMedal) ||
    isModified('triggerConfig.requireCaptain', props.action.triggerConfig.requireCaptain)
  )
})

// 检查冷却控制区域是否有修改
const cooldownModified = computed(() => {
  return (
    isModified('ignoreCooldown', props.action.ignoreCooldown) ||
    isModified('actionConfig.delaySeconds', props.action.actionConfig.delaySeconds) ||
    isModified('actionConfig.cooldownSeconds', props.action.actionConfig.cooldownSeconds)
  )
})

// 检查逻辑表达式是否有修改
const logicalExpressionModified = computed(() => {
  return isModified('logicalExpression', props.action.logicalExpression)
})

// 检查自定义JS是否有修改
const customJsModified = computed(() => {
  return isModified('executeCommand', props.action.executeCommand)
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
            <Badge v-if="userFilterModified" variant="warning" size="xs">
              已修改
            </Badge>
          </div>
        </AccordionTrigger>

        <AccordionContent class="pt-2 pb-3 space-y-3">
          <SettingRow
            type="switch"
            variant="compact"
            title="启用过滤"
            v-model="action.triggerConfig.userFilterEnabled"
          />

          <div
            v-if="action.triggerConfig.userFilterEnabled"
            class="space-y-2 pl-2 border-l-2 border-primary/30"
          >
            <SettingRow
              type="switch"
              variant="compact"
              title="要求本房勋章"
              v-model="action.triggerConfig.requireMedal"
            />
            <SettingRow
              type="switch"
              variant="compact"
              title="要求任意舰长"
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
            <Badge v-if="cooldownModified" variant="warning" size="xs">
              已修改
            </Badge>
          </div>
        </AccordionTrigger>

        <AccordionContent class="pt-2 pb-3 space-y-3">
          <SettingRow
            type="switch"
            variant="compact"
            title="忽略全局冷却"
            hint="开启后此操作不受全局发送频率限制的影响"
            v-model="action.ignoreCooldown"
          />

          <SettingRow
            type="number"
            variant="compact"
            title="延迟执行 (秒)"
            :min="0"
            :max="600"
            v-model="action.actionConfig.delaySeconds"
          />

          <SettingRow
            type="number"
            variant="compact"
            title="冷却时间 (秒)"
            :min="0"
            :max="3600"
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
              :class="logicalExpressionModified ? 'text-amber-500' : 'text-foreground'"
            >
              逻辑判断表达式
            </span>
            <Badge v-if="logicalExpressionModified" variant="warning" size="xs">
              已配置
            </Badge>
          </div>
        </AccordionTrigger>

        <AccordionContent class="pt-2 pb-3 space-y-2">
          <FormField
            type="textarea"
            placeholder="输入表达式..."
            control-class="font-mono resize-none min-h-[64px]"
            description="使用 JavaScript 语法，仅在返回值为真时执行。例如：user.guardLevel > 0 || gift.price >= 10"
            v-model="action.logicalExpression"
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem
        value="custom-js"
        class="border rounded-md px-3 bg-card"
      >
        <AccordionTrigger class="py-2.5 hover:no-underline">
          <div class="flex items-center gap-2">
            <span
              class="text-xs font-semibold"
              :class="customJsModified ? 'text-amber-500' : 'text-foreground'"
            >
              自定义脚本 (JS)
            </span>
            <Badge v-if="customJsModified" variant="warning" size="xs">
              已编写
            </Badge>
          </div>
        </AccordionTrigger>

        <AccordionContent class="pt-2 pb-3 space-y-2">
          <FormField
            type="textarea"
            placeholder="输入要执行的JS代码..."
            control-class="font-mono resize-none min-h-[96px]"
            description="在操作执行前运行。可访问 context, event, biliFunc 等变量。"
            v-model="action.executeCommand"
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
</template>
