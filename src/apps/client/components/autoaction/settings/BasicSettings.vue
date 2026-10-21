<script setup lang="ts">
import { Info16Regular } from '@vicons/fluent'
import { computed } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType, Priority, TriggerType } from '@/apps/client/store/useAutoAction'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

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
})

// 需要模板内容的动作类型(发送弹幕/私信/执行命令)
const requiresTemplate = computed(() =>
  [ActionType.SEND_DANMAKU, ActionType.SEND_PRIVATE_MSG, ActionType.EXECUTE_COMMAND].includes(props.action.actionType),
)

const nameInvalid = computed(() => !props.action.name?.trim())
const templateInvalid = computed(
  () => requiresTemplate.value && (typeof props.action.template !== 'string' || !props.action.template.trim()),
)

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
  { label: 'PNGtuber：切换表情', value: ActionType.PNGTUBER_EXPRESSION },
  { label: 'VTS：触发热键', value: ActionType.VTS_HOTKEY },
  { label: 'VTS：机位预设', value: ActionType.VTS_PRESET },
  { label: 'VTS：掉落道具', value: ActionType.VTS_DROP_ITEM },
  { label: 'VTS：参数注入', value: ActionType.VTS_PARAM_ADD },
  { label: 'VTS：运行宏', value: ActionType.VTS_MACRO },
  { label: 'VTS：配饰显隐', value: ActionType.VTS_ACCESSORY },
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
  <Card class="border bg-card">
    <CardHeader class="p-3 pb-2 border-b">
      <CardTitle class="text-sm font-semibold">常规设置</CardTitle>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <div
        v-if="!hideName"
        class="space-y-1"
      >
        <span class="text-xs text-muted-foreground">操作名称</span>
        <Input
          v-model="action.name"
          placeholder="例如：给礼物老板点赞"
          class="h-8 text-xs"
          :class="nameInvalid ? 'border-destructive focus-visible:ring-destructive' : ''"
        />
        <div
          v-if="nameInvalid"
          class="text-[11px] text-destructive"
        >
          操作名称不能为空
        </div>
        <div
          v-else-if="templateInvalid"
          class="text-[11px] text-amber-500"
        >
          当前动作需要设置模板内容，否则不会生效
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div
          v-if="!hideEnabled"
          class="flex items-center justify-between p-2 rounded border bg-muted/20"
        >
          <span class="text-xs text-foreground font-medium">是否启用</span>
          <Switch v-model:checked="action.enabled" />
        </div>

        <div class="flex items-center justify-between p-2 rounded border bg-muted/20">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <div class="flex items-center gap-1 cursor-help">
                  <span class="text-xs text-foreground font-medium">仅直播时</span>
                  <Info16Regular class="size-3.5 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent class="text-xs">
                关闭直播后将不会触发此操作
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Switch v-model:checked="action.triggerConfig.onlyDuringLive" />
        </div>

        <div class="flex items-center justify-between p-2 rounded border bg-muted/20">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <div class="flex items-center gap-1 cursor-help">
                  <span class="text-xs text-foreground font-medium">忽略天选</span>
                  <Info16Regular class="size-3.5 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent class="text-xs">
                开启天选时刻期间暂停触发（防止被风控）
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Switch v-model:checked="action.triggerConfig.ignoreTianXuan" />
        </div>

        <div class="space-y-1">
          <span class="text-xs text-muted-foreground">触发类型</span>
          <Select
            v-model="action.triggerType"
            disabled
          >
            <SelectTrigger class="h-8 text-xs w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in triggerTypeOptions"
                :key="opt.value"
                :value="opt.value"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-1">
          <span class="text-xs text-muted-foreground">执行动作</span>
          <Select v-model="action.actionType">
            <SelectTrigger class="h-8 text-xs w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in actionTypeOptions"
                :key="opt.value"
                :value="opt.value"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-1">
          <span class="text-xs text-muted-foreground">执行优先级</span>
          <Select v-model="action.priority">
            <SelectTrigger class="h-8 text-xs w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in priorityOptions"
                :key="opt.value"
                :value="opt.value"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
