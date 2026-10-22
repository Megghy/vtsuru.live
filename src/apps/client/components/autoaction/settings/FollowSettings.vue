<script setup lang="ts">
import { Info16Regular } from '@vicons/fluent'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { NumberField } from '@/shared/ui/number-field'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.FOLLOW"
    class="follow-trigger-settings space-y-3"
  >
    <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <div class="flex items-center gap-1 cursor-help">
              <span class="text-xs font-medium text-foreground">防止重复发送</span>
              <Info16Regular class="size-3.5 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent class="text-xs"> 同一用户在单次直播中多次关注仅触发一次感谢 </TooltipContent>
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
