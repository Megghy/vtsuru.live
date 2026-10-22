<script setup lang="ts">
import { Info16Regular } from '@vicons/fluent'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

// 礼物过滤模式选项
const giftFilterModeOptions = [
  { label: '不过滤', value: 'none' },
  { label: '礼物黑名单 (不感谢这些礼物)', value: 'blacklist' },
  { label: '礼物白名单 (只感谢这些礼物)', value: 'whitelist' },
  { label: '按最低价值过滤', value: 'value' },
  { label: '过滤所有免费礼物', value: 'free' },
]

// 礼物名称相关
const tempGiftName = ref('')

// 添加礼物名称到过滤列表
function addGiftName() {
  const name = tempGiftName.value.trim()
  if (!name) return

  if (!props.action.triggerConfig.filterGiftNames) {
    props.action.triggerConfig.filterGiftNames = []
  }

  if (!props.action.triggerConfig.filterGiftNames.includes(name)) {
    props.action.triggerConfig.filterGiftNames.push(name)
    tempGiftName.value = ''
  } else {
    toast.warning('此礼物名称已存在')
  }
}

// 移除礼物名称
function removeGiftName(index: number) {
  if (props.action.triggerConfig.filterGiftNames) {
    props.action.triggerConfig.filterGiftNames.splice(index, 1)
  }
}
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.GIFT"
    class="gift-trigger-settings space-y-3"
  >
    <div class="space-y-1">
      <span class="text-xs text-muted-foreground">礼物过滤模式</span>
      <Select v-model="action.triggerConfig.filterMode">
        <SelectTrigger class="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in giftFilterModeOptions"
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
      v-if="action.triggerConfig.filterMode === 'blacklist' || action.triggerConfig.filterMode === 'whitelist'"
      class="filter-group space-y-2 p-3 rounded-md border bg-card"
    >
      <span class="text-xs text-muted-foreground block">
        {{
          action.triggerConfig.filterMode === 'blacklist'
            ? '以下列表中的礼物将不会触发感谢'
            : '仅当礼物在以下列表中时才会触发感谢'
        }}
      </span>
      <div class="flex items-center gap-2">
        <Input
          v-model="tempGiftName"
          placeholder="输入礼物名称..."
          class="flex-1"
          @keyup.enter="addGiftName"
        />
        <Button @click="addGiftName"> 添加 </Button>
      </div>

      <div class="tag-container flex flex-wrap items-center gap-1.5 p-2 rounded border bg-muted/20 min-h-[36px]">
        <template v-if="action.triggerConfig.filterGiftNames && action.triggerConfig.filterGiftNames.length > 0">
          <Badge
            v-for="(giftName, index) in action.triggerConfig.filterGiftNames"
            :key="index"
            variant="secondary"
            class="text-xs h-6 px-2 gap-1.5 font-normal"
          >
            <span>{{ giftName }}</span>
            <button
              type="button"
              class="hover:text-destructive transition-colors text-muted-foreground"
              @click="removeGiftName(index)"
            >
              ✕
            </button>
          </Badge>
        </template>
        <span
          v-else
          class="text-xs italic text-muted-foreground"
        >
          列表为空
        </span>
      </div>
    </div>

    <div
      v-if="action.triggerConfig.filterMode === 'value'"
      class="flex items-center justify-between p-2.5 rounded border bg-muted/20"
    >
      <span class="text-xs font-medium text-foreground">最低价值 (元)</span>
      <NumberField
        :model-value="action.triggerConfig.minValue"
        :min="0"
        placeholder="0"
        class="w-32"
        @update:model-value="action.triggerConfig.minValue = $event || 0"
      />
    </div>

    <div class="h-px bg-border my-1" />

    <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <div class="flex items-center gap-1 cursor-help">
              <span class="text-xs font-medium text-foreground">包含数量</span>
              <Info16Regular class="size-3.5 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent class="text-xs"> 在感谢语中使用 {{ '\{\{gift.count\}\}' }} 变量显示礼物数量 </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Switch v-model:checked="action.triggerConfig.includeQuantity" />
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

    <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <div class="flex items-center gap-1 cursor-help">
              <span class="text-xs font-medium text-foreground">单人礼物上限</span>
              <Info16Regular class="size-3.5 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent class="text-xs"> 单个用户在同一次感谢中最多显示的礼物种类数 </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <NumberField
        :model-value="action.actionConfig.maxItemsPerUser"
        :min="1"
        :max="20"
        class="w-32"
        @update:model-value="action.actionConfig.maxItemsPerUser = $event || 1"
      />
    </div>
  </div>
</template>
