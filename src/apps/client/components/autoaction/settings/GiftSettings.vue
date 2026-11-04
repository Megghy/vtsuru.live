<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Tag } from '@/shared/ui/tag'

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
    <FormField
      type="select"
      label="礼物过滤模式"
      :options="giftFilterModeOptions"
      v-model="action.triggerConfig.filterMode"
    />

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
          <Tag
            v-for="(giftName, index) in action.triggerConfig.filterGiftNames"
            :key="index"
            closable
            @close="removeGiftName(index)"
          >
            {{ giftName }}
          </Tag>
        </template>
        <span
          v-else
          class="text-xs italic text-muted-foreground"
        >
          列表为空
        </span>
      </div>
    </div>

    <SettingRow
      v-if="action.triggerConfig.filterMode === 'value'"
      type="number"
      variant="compact"
      title="最低价值 (元)"
      :min="0"
      placeholder="0"
      v-model="action.triggerConfig.minValue"
    />

    <Separator class="my-1" />

    <SettingRow
      type="switch"
      variant="compact"
      title="包含数量"
      hint="在感谢语中使用 {{gift.count}} 变量显示礼物数量"
      v-model="action.triggerConfig.includeQuantity"
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

    <SettingRow
      type="number"
      variant="compact"
      title="单人礼物上限"
      hint="单个用户在同一次感谢中最多显示的礼物种类数"
      :min="1"
      :max="20"
      v-model="action.actionConfig.maxItemsPerUser"
    />
  </div>
</template>
