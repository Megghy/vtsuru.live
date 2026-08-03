<script setup lang="ts">
import { useSpeechService } from '@/store/useSpeechService'

import SectionField from './SectionField.vue'

const { settings } = useSpeechService()

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
      <UInputTags
        v-model="settings.blacklistUsers"
        size="small"
      />
    </SectionField>

    <SectionField
      label="屏蔽关键词"
      hint="包含这些词的弹幕不会播报"
    >
      <UInputTags
        v-model="settings.blacklistKeywords"
        size="small"
      />
    </SectionField>

    <USeparator style="margin: 4px 0" />

    <SectionField
      label="字数限制"
      hint="0 = 不限制，超出部分截断"
    >
      <UInputNumber
        v-model="settings.maxTextLength"
        :min="0"
        :max="500"
        size="small"
        placeholder="0"
        style="max-width: 140px"
      />
    </SectionField>

    <SectionField
      label="防刷屏间隔 (秒)"
      hint="同一用户在此间隔内只播报一条，0 = 不限制"
    >
      <UInputNumber
        v-model="settings.antiSpamInterval"
        :min="0"
        :max="60"
        size="small"
        placeholder="0"
        style="max-width: 140px"
      />
    </SectionField>

    <UCheckbox v-model="settings.deduplicateIdentical">
      <span style="font-size: 12px"> 去重：10 秒内完全相同的内容只播一次 </span>
    </UCheckbox>

    <USeparator style="margin: 4px 0" />

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
          <UInput
            v-model="rule.pattern"
            placeholder="匹配"
            size="small"
            style="flex: 1"
          />
          <span
            depth="3"
            style="font-size: 11px; flex-shrink: 0"
          >
            →
          </span>
          <UInput
            v-model="rule.replacement"
            placeholder="替换为"
            size="small"
            style="flex: 1"
          />
          <USwitch
            v-model="rule.isRegex"
            size="small"
          >
            <template v-if="false"> 正则 </template>
            <template v-if="false"> 文本 </template>
          </USwitch>
          <UButton
            size="tiny"
            variant="soft"
            color="error"
            @click="removeReplacement(i)"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
          </UButton>
        </div>
      </div>
      <UButton
        size="tiny"
        variant="soft"
        color="primary"
        @click="addReplacement"
      >
        <template #leading>
          <UIcon name="i-lucide-circle" />
        </template>
        添加规则
      </UButton>
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
