<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { SettingRow } from '@/shared/ui/setting-row'
import { Tag } from '@/shared/ui/tag'

const props = defineProps<{
  action: AutoActionItem
}>()

if (!props.action.triggerConfig.filterMode) {
  props.action.triggerConfig.filterMode = 'none'
}

const giftFilterModeOptions = [
  { label: '不过滤（全部礼物）', value: 'none' },
  { label: '过滤所有免费礼物', value: 'free' },
  { label: '按最低价值过滤', value: 'value' },
  { label: '礼物黑名单（不感谢以下礼物）', value: 'blacklist' },
  { label: '礼物白名单（仅感谢以下礼物）', value: 'whitelist' },
]

const tempGiftName = ref('')

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

function removeGiftName(index: number) {
  props.action.triggerConfig.filterGiftNames?.splice(index, 1)
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
      class="filter-group space-y-2 p-3 rounded-md border bg-muted/20"
    >
      <span class="text-xs text-muted-foreground block">
        {{
          action.triggerConfig.filterMode === 'blacklist'
            ? '以下列表中的礼物将不会触发感谢'
            : '仅当礼物名称在以下列表中时才会触发感谢'
        }}
      </span>
      <div class="flex items-center gap-2">
        <Input
          v-model="tempGiftName"
          placeholder="输入礼物名称..."
          class="flex-1"
          @keyup.enter="addGiftName"
        />
        <Button @click="addGiftName">添加</Button>
      </div>

      <div class="tag-container flex flex-wrap items-center gap-1.5 p-2 rounded border bg-card min-h-[36px]">
        <template v-if="action.triggerConfig.filterGiftNames && action.triggerConfig.filterGiftNames.length > 0">
          <Tag
            v-for="(giftName, index) in action.triggerConfig.filterGiftNames"
            :key="giftName"
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
      hint="单次送礼总价值达到该金额（人民币元）时才触发"
      :min="0"
      placeholder="0"
      v-model="action.triggerConfig.minValue"
    />
  </div>
</template>
