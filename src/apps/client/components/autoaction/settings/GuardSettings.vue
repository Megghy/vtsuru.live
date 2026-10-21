<script setup lang="ts">
import { Info16Regular } from '@vicons/fluent'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType, TriggerType } from '@/apps/client/store/useAutoAction'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
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
    <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <div class="flex items-center gap-1 cursor-help">
              <span class="text-xs font-medium text-foreground">防止重复发送</span>
              <Info16Regular class="size-3.5 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            同一用户在单次直播中多次上舰仅触发一次
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Switch v-model:checked="action.triggerConfig.preventRepeat" />
    </div>

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
            <SelectTrigger class="h-8 text-xs w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1" class="text-xs">总督</SelectItem>
              <SelectItem value="2" class="text-xs">提督</SelectItem>
              <SelectItem value="3" class="text-xs">舰长</SelectItem>
              <SelectItem value="0" class="text-xs">通用</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          v-model="tempGiftCode"
          placeholder="输入礼品码..."
          class="h-8 text-xs flex-1"
          @keyup.enter="addGiftCode"
        />
        <Button
          size="sm"
          class="h-8 text-xs"
          @click="addGiftCode"
        >
          添加
        </Button>
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
          <Badge
            variant="outline"
            class="text-[10px] h-5 px-1.5 shrink-0"
            :class="levelCodes.level === 3 ? 'border-sky-500/40 text-sky-600 bg-sky-500/10' : levelCodes.level === 0 ? '' : 'border-amber-500/40 text-amber-600 bg-amber-500/10'"
          >
            {{ getGuardLevelName(levelCodes.level) }}
          </Badge>

          <div class="flex flex-wrap items-center gap-1.5 flex-1">
            <Badge
              v-for="(code, codeIndex) in levelCodes.codes"
              :key="codeIndex"
              variant="secondary"
              class="text-xs h-6 px-2 gap-1.5 font-normal"
            >
              <span>{{ code }}</span>
              <button
                type="button"
                class="hover:text-destructive transition-colors text-muted-foreground"
                @click="removeGiftCode(levelIndex, codeIndex)"
              >
                ✕
              </button>
            </Badge>
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
