<script setup lang="ts">
import { Info16Regular } from '@vicons/fluent'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

// 入场过滤模式选项
const enterFilterModeOptions = [
  { label: '不过滤 (欢迎所有人)', value: 'none' },
  { label: '用户黑名单 (名单内不欢迎)', value: 'blacklist' },
  { label: '用户白名单 (只欢迎名单内)', value: 'whitelist' },
  { label: '仅欢迎舰长', value: 'guard' },
  { label: '仅欢迎佩戴勋章的用户', value: 'medal' },
]
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.ENTER"
    class="enter-trigger-settings space-y-3"
  >
    <div class="space-y-1">
      <span class="text-xs text-muted-foreground">入场过滤模式</span>
      <Select v-model="action.triggerConfig.filterMode">
        <SelectTrigger class="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in enterFilterModeOptions"
            :key="opt.value"
            :value="opt.value"
            class="text-xs"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div
      v-if="action.triggerConfig.filterMode === 'medal'"
      class="flex items-center justify-between p-2.5 rounded border bg-muted/20"
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <div class="flex items-center gap-1 cursor-help">
              <span class="text-xs font-medium text-foreground">最低牌子等级</span>
              <Info16Regular class="size-3.5 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent class="text-xs"> 仅欢迎佩戴本房勋章且等级达到此值的用户，0 表示不限制等级 </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <NumberField
        :model-value="action.triggerConfig.enterMedalMinLevel"
        :min="0"
        :max="40"
        placeholder="0"
        class="w-28"
        @update:model-value="action.triggerConfig.enterMedalMinLevel = $event || 0"
      />
    </div>

    <div class="h-px bg-border my-1" />

    <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <div class="flex items-center gap-1 cursor-help">
              <span class="text-xs font-medium text-foreground">防止重复发送</span>
              <Info16Regular class="size-3.5 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent class="text-xs"> 同一用户在单次直播中多次进入仅触发一次欢迎 </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Switch v-model:checked="action.triggerConfig.preventRepeat" />
    </div>

    <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <div class="flex items-center gap-1 cursor-help">
              <span class="text-xs font-medium text-foreground">单次合并上限</span>
              <Info16Regular class="size-3.5 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent class="text-xs"> 单条欢迎弹幕中最多合并展示的用户数量 </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <NumberField
        :model-value="action.actionConfig.maxUsersPerMsg"
        :min="1"
        :max="50"
        class="w-32"
        @update:model-value="action.actionConfig.maxUsersPerMsg = $event || 1"
      />
    </div>
  </div>
</template>
