<script setup lang="ts">
import { Add20Filled, Delete20Filled, Dismiss20Filled } from '@vicons/fluent'
import { ref } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Separator } from '@/shared/ui/separator'
import { Switch } from '@/shared/ui/switch'
import { useSpeechService } from '@/store/useSpeechService'

import SectionField from './SectionField.vue'

const { settings } = useSpeechService()

const newBlacklistUser = ref('')
const newBlacklistKeyword = ref('')

function addUser() {
  const val = newBlacklistUser.value.trim()
  if (val && !settings.value.blacklistUsers.includes(val)) {
    settings.value.blacklistUsers.push(val)
    newBlacklistUser.value = ''
  }
}

function removeUser(idx: number) {
  settings.value.blacklistUsers.splice(idx, 1)
}

function addKeyword() {
  const val = newBlacklistKeyword.value.trim()
  if (val && !settings.value.blacklistKeywords.includes(val)) {
    settings.value.blacklistKeywords.push(val)
    newBlacklistKeyword.value = ''
  }
}

function removeKeyword(idx: number) {
  settings.value.blacklistKeywords.splice(idx, 1)
}

function addReplacement() {
  settings.value.textReplacements.push({ pattern: '', replacement: '', isRegex: false })
}

function removeReplacement(index: number) {
  settings.value.textReplacements.splice(index, 1)
}
</script>

<template>
  <div class="panel">
    <SectionField
      label="屏蔽用户"
      hint="这些用户的弹幕/礼物不会播报"
    >
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap gap-1.5 min-h-7 items-center">
          <Badge
            v-for="(u, idx) in settings.blacklistUsers"
            :key="idx"
            variant="secondary"
            class="gap-1 text-xs py-0.5"
          >
            {{ u }}
            <button
              type="button"
              class="hover:text-destructive cursor-pointer"
              @click="removeUser(idx)"
            >
              <Dismiss20Filled class="size-3" />
            </button>
          </Badge>
          <span
            v-if="settings.blacklistUsers.length === 0"
            class="text-xs text-muted-foreground"
            >无</span
          >
        </div>
        <div class="flex gap-2">
          <Input
            size="xs"
            v-model="newBlacklistUser"
            placeholder="输入用户名并回车"
            @keyup.enter="addUser"
          />
          <Button
            class="px-2 shrink-0"
            @click="addUser"
          >
            添加
          </Button>
        </div>
      </div>
    </SectionField>

    <SectionField
      label="屏蔽关键词"
      hint="包含这些词的弹幕不会播报"
    >
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap gap-1.5 min-h-7 items-center">
          <Badge
            v-for="(kw, idx) in settings.blacklistKeywords"
            :key="idx"
            variant="secondary"
            class="gap-1 text-xs py-0.5"
          >
            {{ kw }}
            <button
              type="button"
              class="hover:text-destructive cursor-pointer"
              @click="removeKeyword(idx)"
            >
              <Dismiss20Filled class="size-3" />
            </button>
          </Badge>
          <span
            v-if="settings.blacklistKeywords.length === 0"
            class="text-xs text-muted-foreground"
            >无</span
          >
        </div>
        <div class="flex gap-2">
          <Input
            size="xs"
            v-model="newBlacklistKeyword"
            placeholder="输入关键词并回车"
            @keyup.enter="addKeyword"
          />
          <Button
            class="px-2 shrink-0"
            @click="addKeyword"
          >
            添加
          </Button>
        </div>
      </div>
    </SectionField>

    <Separator class="my-1" />

    <SectionField
      label="字数限制"
      hint="0 = 不限制，超出部分截断"
    >
      <div class="max-w-[140px]">
        <NInputNumber
          v-model:value="settings.maxTextLength"
          :min="0"
          :max="500"
          size="small"
          placeholder="0"
        />
      </div>
    </SectionField>

    <SectionField
      label="防刷屏间隔 (秒)"
      hint="同一用户在此间隔内只播报一条，0 = 不限制"
    >
      <div class="max-w-[140px]">
        <NInputNumber
          v-model:value="settings.antiSpamInterval"
          :min="0"
          :max="60"
          size="small"
          placeholder="0"
        />
      </div>
    </SectionField>

    <label class="flex items-center gap-2 cursor-pointer text-xs">
      <Checkbox
        :checked="settings.deduplicateIdentical"
        @update:checked="settings.deduplicateIdentical = $event"
      />
      <span>去重：10 秒内完全相同的内容只播一次</span>
    </label>

    <Separator class="my-1" />

    <SectionField
      label="文本替换规则"
      hint="按顺序执行，可用正则"
    >
      <div class="replacements">
        <div
          v-for="(rule, i) in settings.textReplacements"
          :key="i"
          class="rule-row"
        >
          <Input
            size="xs"
            v-model="rule.pattern"
            placeholder="匹配"
            class="flex-1"
          />
          <span class="text-xs text-muted-foreground shrink-0">→</span>
          <Input
            size="xs"
            v-model="rule.replacement"
            placeholder="替换为"
            class="flex-1"
          />
          <div class="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground">
            <span>{{ rule.isRegex ? '正则' : '文本' }}</span>
            <Switch
              :checked="rule.isRegex"
              @update:checked="rule.isRegex = $event"
            />
          </div>
          <Button
            size="xs"
            variant="ghost"
            class="w-7 p-0 text-destructive hover:bg-destructive/10 shrink-0"
            @click="removeReplacement(i)"
          >
            <Delete20Filled class="size-3.5" />
          </Button>
        </div>
      </div>
      <Button
        variant="outline"
        class="gap-1 w-fit"
        @click="addReplacement"
      >
        <Add20Filled class="size-3.5" />
        添加规则
      </Button>
    </SectionField>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.replacements {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rule-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
