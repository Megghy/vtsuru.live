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

const props = defineProps<{
  action: AutoActionItem
}>()

if (!props.action.triggerConfig.filterMode) {
  props.action.triggerConfig.filterMode = 'none'
}

const enterFilterModeOptions = [
  { label: '不过滤（欢迎所有人）', value: 'none' },
  { label: '仅欢迎大航海（舰长/提督/总督）', value: 'guard' },
  { label: '仅欢迎佩戴勋章的用户', value: 'medal' },
  { label: '用户黑名单（名单内不欢迎）', value: 'blacklist' },
  { label: '用户白名单（仅欢迎名单内）', value: 'whitelist' },
]

const tempUsername = ref('')

function addUsername() {
  const name = tempUsername.value.trim()
  if (!name) return

  if (!props.action.triggerConfig.filterGiftNames) {
    props.action.triggerConfig.filterGiftNames = []
  }

  if (!props.action.triggerConfig.filterGiftNames.includes(name)) {
    props.action.triggerConfig.filterGiftNames.push(name)
    tempUsername.value = ''
  } else {
    toast.warning('该用户名已在名单中')
  }
}

function removeUsername(index: number) {
  props.action.triggerConfig.filterGiftNames?.splice(index, 1)
}
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.ENTER"
    class="enter-trigger-settings space-y-3"
  >
    <FormField
      type="select"
      label="入场过滤模式"
      :options="enterFilterModeOptions"
      v-model="action.triggerConfig.filterMode"
    />

    <div
      v-if="action.triggerConfig.filterMode === 'blacklist' || action.triggerConfig.filterMode === 'whitelist'"
      class="space-y-2 p-3 rounded-md border bg-muted/20"
    >
      <span class="text-xs text-muted-foreground block">
        {{
          action.triggerConfig.filterMode === 'blacklist'
            ? '以下用户名进入直播间时不会触发欢迎（按完整昵称匹配）'
            : '仅当进入用户的昵称在以下列表中时才触发欢迎'
        }}
      </span>
      <div class="flex items-center gap-2">
        <Input
          v-model="tempUsername"
          placeholder="输入 B 站用户昵称..."
          class="flex-1"
          @keyup.enter="addUsername"
        />
        <Button @click="addUsername">添加</Button>
      </div>

      <div class="flex flex-wrap items-center gap-1.5 p-2 rounded border bg-card min-h-[36px]">
        <template v-if="action.triggerConfig.filterGiftNames && action.triggerConfig.filterGiftNames.length > 0">
          <Tag
            v-for="(uname, index) in action.triggerConfig.filterGiftNames"
            :key="uname"
            closable
            @close="removeUsername(index)"
          >
            {{ uname }}
          </Tag>
        </template>
        <span
          v-else
          class="text-xs italic text-muted-foreground"
        >
          {{ action.triggerConfig.filterMode === 'whitelist' ? '名单为空（当前不会欢迎任何人）' : '名单为空' }}
        </span>
      </div>
    </div>

    <SettingRow
      v-if="action.triggerConfig.filterMode === 'medal'"
      type="number"
      variant="compact"
      title="最低牌子等级"
      hint="仅欢迎佩戴粉丝勋章且等级达到此值的用户，0 表示不限制等级"
      :min="0"
      :max="40"
      v-model="action.triggerConfig.enterMedalMinLevel"
    />

    <Separator class="my-1" />

    <SettingRow
      type="switch"
      variant="compact"
      title="防止重复发送"
      hint="同一用户在本次会话中多次进入仅触发一次（按规则独立记录）"
      v-model="action.triggerConfig.preventRepeat"
    />
  </div>
</template>
