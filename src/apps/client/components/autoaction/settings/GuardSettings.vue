<script setup lang="ts">
import { Info16Regular } from '@vicons/fluent'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType, TriggerType } from '@/apps/client/store/useAutoAction'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Tag } from '@/shared/ui/tag'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

// 舰长礼品码相关
const tempGiftCodeLevel = ref('3')
const tempGiftCode = ref('')

// 添加礼品码
function addGiftCode() {
  const code = tempGiftCode.value.trim()
  if (!code) return

  const levelNum = Number(tempGiftCodeLevel.value)
  if (!props.action.triggerConfig.giftCodes) {
    props.action.triggerConfig.giftCodes = []
  }

  // 查找对应等级的礼品码数组
  let levelCodes = props.action.triggerConfig.giftCodes.find((gc) => gc.level === levelNum)

  if (!levelCodes) {
    levelCodes = { level: levelNum, codes: [] }
    props.action.triggerConfig.giftCodes.push(levelCodes)
  }

  if (!levelCodes.codes.includes(code)) {
    levelCodes.codes.push(code)
    tempGiftCode.value = ''
  } else {
    toast.warning('此礼品码已存在')
  }
}

// 移除礼品码
function removeGiftCode(levelIndex: number, codeIndex: number) {
  if (
    props.action.triggerConfig.giftCodes &&
    props.action.triggerConfig.giftCodes[levelIndex] &&
    props.action.triggerConfig.giftCodes[levelIndex].codes
  ) {
    props.action.triggerConfig.giftCodes[levelIndex].codes.splice(codeIndex, 1)

    if (props.action.triggerConfig.giftCodes[levelIndex].codes.length === 0) {
      props.action.triggerConfig.giftCodes.splice(levelIndex, 1)
    }
  }
}

function getGuardLevelName(level: number): string {
  switch (level) {
    case 1:
      return '总督'
    case 2:
      return '提督'
    case 3:
      return '舰长'
    default:
      return '通用'
  }
}
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.GUARD"
    class="guard-trigger-settings space-y-3"
  >
    <SettingRow
      variant="compact"
      title="防止重复发送"
      hint="同一用户在单次直播中多次上舰仅触发一次"
    >
      <Switch v-model:checked="action.triggerConfig.preventRepeat" />
    </SettingRow>

    <div
      v-if="action.actionType === ActionType.SEND_PRIVATE_MSG"
      class="gift-codes-section space-y-3 p-3 rounded-md border bg-card"
    >
      <div class="border-b pb-2">
        <span class="font-semibold text-xs text-foreground block">私信礼品码库</span>
        <span class="text-xs text-muted-foreground mt-0.5 block">
          当操作类型为“发送私信”时，可以设置在私信中发放礼品码。
        </span>
      </div>

      <div class="flex items-center gap-2">
        <div class="w-24 shrink-0">
          <Select v-model="tempGiftCodeLevel">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">总督</SelectItem
              >
              <SelectItem value="2">提督</SelectItem
              >
              <SelectItem value="3">舰长</SelectItem
              >
              <SelectItem value="0">通用</SelectItem
              >
            </SelectContent>
          </Select>
        </div>
        <Input
          v-model="tempGiftCode"
          placeholder="输入礼品码..."
          class="flex-1"
          @keyup.enter="addGiftCode"
        />
        <Button @click="addGiftCode"> 添加 </Button>
      </div>

      <div
        v-if="action.triggerConfig.giftCodes && action.triggerConfig.giftCodes.length > 0"
        class="space-y-2 pt-1"
      >
        <div
          v-for="(levelCodes, levelIndex) in action.triggerConfig.giftCodes"
          :key="levelIndex"
          class="flex items-center gap-2 p-1.5 rounded border bg-muted/20"
        >
          <Badge variant="warning" size="xs" class="h-5" :class=" levelCodes.level === 3 ? 'border-sky-500/40 text-sky-600 bg-sky-500/10' : levelCodes.level === 0 ? '' : ' ' ">
            {{ getGuardLevelName(levelCodes.level) }}
          </Badge>

          <div class="flex flex-wrap items-center gap-1.5 flex-1">
            <Tag
              v-for="(code, codeIndex) in levelCodes.codes"
              :key="codeIndex"
              closable
              @close="removeGiftCode(levelIndex, codeIndex)"
            >
              {{ code }}
            </Tag>
          </div>
        </div>
      </div>
      <div
        v-else
        class="text-xs italic text-muted-foreground text-center py-3"
      >
        暂无库存礼品码
      </div>
    </div>
  </div>
</template>
