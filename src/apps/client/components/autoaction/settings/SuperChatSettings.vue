<script setup lang="ts">
import { Info16Regular } from '@vicons/fluent'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

// SC过滤模式选项
const scFilterModeOptions = [
  { label: '不进行额外过滤', value: 'none' },
  { label: '按价格区间过滤', value: 'price' },
]
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.SUPER_CHAT"
    class="sc-trigger-settings space-y-3"
  >
    <div class="space-y-1">
      <span class="text-xs text-muted-foreground">SC过滤模式</span>
      <Select v-model="action.triggerConfig.scFilterMode">
        <SelectTrigger class="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in scFilterModeOptions"
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
      v-if="action.triggerConfig.scFilterMode === 'price'"
      class="p-2.5 rounded border bg-muted/20 space-y-2"
    >
      <div class="flex items-center justify-between">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <div class="flex items-center gap-1 cursor-help">
                <span class="text-xs font-medium text-foreground">价格区间 (元)</span>
                <Info16Regular class="size-3.5 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent class="text-xs max-w-[280px]">
              仅当 SC 价格在区间内才触发感谢。<br />
              • 最低填 30 元可自动忽略 B 站每日赠送的 2 元免费 SC；<br />
              • 填 2 ~ 29 元可针对 2 元小额 SC 设置专属感谢话术。
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div class="flex items-center gap-2">
        <NInputNumber
          :value="action.triggerConfig.scMinPrice"
          :min="0"
          placeholder="最低 (如 30)"
          size="small"
          class="flex-1"
          @update:value="action.triggerConfig.scMinPrice = $event"
        />
        <span class="text-xs text-muted-foreground">至</span>
        <NInputNumber
          :value="action.triggerConfig.scMaxPrice"
          :min="0"
          placeholder="不限"
          size="small"
          class="flex-1"
          @update:value="action.triggerConfig.scMaxPrice = $event"
        />
      </div>
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
          <TooltipContent class="text-xs"> 同一用户在单次直播中多次发送 SC 仅触发一次感谢 </TooltipContent>
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
          <TooltipContent class="text-xs"> 单条感谢弹幕中最多合并展示的用户数量 </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <NInputNumber
        :value="action.actionConfig.maxUsersPerMsg"
        :min="1"
        :max="50"
        size="small"
        class="w-32"
        @update:value="action.actionConfig.maxUsersPerMsg = $event || 1"
      />
    </div>
  </div>
</template>
