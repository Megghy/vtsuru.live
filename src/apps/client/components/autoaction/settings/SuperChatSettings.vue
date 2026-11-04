<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'

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
    <FormField
      type="select"
      label="SC过滤模式"
      :options="scFilterModeOptions"
      v-model="action.triggerConfig.scFilterMode"
    />

    <div
      v-if="action.triggerConfig.scFilterMode === 'price'"
      class="p-2.5 rounded border bg-muted/20 space-y-2"
    >
      <FormField
        label="价格区间 (元)"
        hint="仅当 SC 价格在区间内才触发感谢。最低填 30 元可自动忽略 B 站每日赠送的 2 元免费 SC；填 2 ~ 29 元可针对 2 元小额 SC 设置专属感谢话术。"
      >
        <div class="flex items-center gap-2">
          <NumberField
            :model-value="action.triggerConfig.scMinPrice"
            :min="0"
            placeholder="最低 (如 30)"
            class="flex-1"
            @update:model-value="action.triggerConfig.scMinPrice = $event"
          />
          <span class="text-xs text-muted-foreground">至</span>
          <NumberField
            :model-value="action.triggerConfig.scMaxPrice"
            :min="0"
            placeholder="不限"
            class="flex-1"
            @update:model-value="action.triggerConfig.scMaxPrice = $event"
          />
        </div>
      </FormField>
    </div>

    <Separator class="my-1" />

    <SettingRow
      type="switch"
      variant="compact"
      title="防止重复发送"
      hint="同一用户在单次直播中多次发送 SC 仅触发一次感谢"
      v-model="action.triggerConfig.preventRepeat"
    />

    <SettingRow
      type="number"
      variant="compact"
      title="单次合并上限"
      hint="单条感谢弹幕中最多合并展示的用户数量"
      :min="1"
      :max="50"
      v-model="action.actionConfig.maxUsersPerMsg"
    />
  </div>
</template>
