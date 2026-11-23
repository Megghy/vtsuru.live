<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import type { GuardLevel } from '@/api/generated/model'
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType, TriggerType } from '@/apps/client/store/useAutoAction'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Tag } from '@/shared/ui/tag'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const props = defineProps<{
  action: AutoActionItem
}>()

const tempGiftCodeLevel = ref('3')
const tempGiftCode = ref('')

const selectedGuardLevels = computed({
  get: () => (props.action.triggerConfig.guardLevels ?? []).map(String),
  set: (vals: string[]) => {
    props.action.triggerConfig.guardLevels = vals.map((v) => Number(v) as GuardLevel)
  },
})

function addGiftCode() {
  const code = tempGiftCode.value.trim()
  if (!code) return

  const levelNum = Number(tempGiftCodeLevel.value)
  if (!props.action.triggerConfig.giftCodes) {
    props.action.triggerConfig.giftCodes = []
  }

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

function removeGiftCode(levelIndex: number, codeIndex: number) {
  const group = props.action.triggerConfig.giftCodes?.[levelIndex]
  if (!group?.codes) return
  group.codes.splice(codeIndex, 1)
  if (group.codes.length === 0) {
    props.action.triggerConfig.giftCodes?.splice(levelIndex, 1)
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

function getGuardBadgeClass(level: number): string {
  if (level === 3) return 'border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10'
  if (level === 2) return 'border-violet-500/40 text-violet-600 dark:text-violet-400 bg-violet-500/10'
  if (level === 1) return 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10'
  return ''
}
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.GUARD"
    class="guard-trigger-settings space-y-3"
  >
    <FormField
      label="适用大航海等级"
      description="不选则默认对所有大航海等级（总督/提督/舰长）生效"
    >
      <ToggleGroup
        v-model="selectedGuardLevels"
        type="multiple"
        class="justify-start"
      >
        <ToggleGroupItem value="3">舰长</ToggleGroupItem>
        <ToggleGroupItem value="2">提督</ToggleGroupItem>
        <ToggleGroupItem value="1">总督</ToggleGroupItem>
      </ToggleGroup>
    </FormField>

    <SettingRow
      variant="compact"
      title="防止重复发送"
      hint="同一用户在本次会话中多次上舰仅触发一次（按规则独立记录）"
    >
      <Switch v-model:checked="action.triggerConfig.preventRepeat" />
    </SettingRow>

    <div
      v-if="action.actionType === ActionType.SEND_PRIVATE_MSG"
      class="gift-codes-section space-y-3 p-3 rounded-md border bg-muted/20"
    >
      <div class="border-b pb-2">
        <span class="font-semibold text-xs text-foreground block">私信礼品码库</span>
        <span class="text-[11px] text-muted-foreground mt-0.5 block">
          在私信模板中使用 <code v-pre class="px-1 rounded bg-muted">{{guard.giftCode}}</code> 即可自动按开通等级抽取礼品码发放。
        </span>
      </div>

      <SettingRow
        variant="compact"
        title="发送成功后自动消耗礼品码"
        hint="开启后，私信成功发出的礼品码会立即从库存中移除，防止重复发给其他观众"
      >
        <Switch v-model:checked="action.triggerConfig.consumeGiftCode" />
      </SettingRow>

      <div class="flex items-center gap-2">
        <div class="w-24 shrink-0">
          <Select v-model="tempGiftCodeLevel">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">舰长</SelectItem>
              <SelectItem value="2">提督</SelectItem>
              <SelectItem value="1">总督</SelectItem>
              <SelectItem value="0">通用</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          v-model="tempGiftCode"
          placeholder="输入礼品码后回车添加..."
          class="flex-1"
          @keyup.enter="addGiftCode"
        />
        <Button @click="addGiftCode">添加</Button>
      </div>

      <div
        v-if="action.triggerConfig.giftCodes && action.triggerConfig.giftCodes.length > 0"
        class="space-y-2 pt-1"
      >
        <div
          v-for="(levelCodes, levelIndex) in action.triggerConfig.giftCodes"
          :key="levelCodes.level"
          class="flex items-center gap-2 p-2 rounded border bg-card"
        >
          <Badge
            variant="outline"
            size="xs"
            :class="getGuardBadgeClass(levelCodes.level)"
          >
            {{ getGuardLevelName(levelCodes.level) }}
          </Badge>

          <div class="flex flex-wrap items-center gap-1.5 flex-1">
            <Tag
              v-for="(code, codeIndex) in levelCodes.codes"
              :key="code"
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
        class="text-xs italic text-muted-foreground text-center py-2.5"
      >
        暂无库存礼品码
      </div>
    </div>
  </div>
</template>
