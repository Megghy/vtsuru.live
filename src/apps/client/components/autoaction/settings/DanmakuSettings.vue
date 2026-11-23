<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { KeywordMatchType } from '@/apps/client/store/autoAction/types'
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Tag } from '@/shared/ui/tag'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const props = defineProps<{
  action: AutoActionItem
}>()

const tempKeyword = ref('')
const tempBlockword = ref('')

if (!props.action.triggerConfig.keywordMatchType) {
  props.action.triggerConfig.keywordMatchType = KeywordMatchType.Contains
}
if (!props.action.triggerConfig.blockwordMatchType) {
  props.action.triggerConfig.blockwordMatchType = KeywordMatchType.Contains
}

function validateRegexPattern(pattern: string): string | null {
  try {
    void new RegExp(pattern)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : '无效的正则表达式'
  }
}

const keywordRegexError = computed(() => {
  if (props.action.triggerConfig.keywordMatchType !== KeywordMatchType.Regex) return undefined
  if (tempKeyword.value.trim()) {
    const err = validateRegexPattern(tempKeyword.value.trim())
    if (err) return `输入正则语法错误：${err}`
  }
  const invalidExisting = (props.action.triggerConfig.keywords ?? []).find((kw) => validateRegexPattern(kw))
  if (invalidExisting) {
    return `已添加的正则「${invalidExisting}」语法错误：${validateRegexPattern(invalidExisting)}`
  }
  return undefined
})

const blockwordRegexError = computed(() => {
  if (props.action.triggerConfig.blockwordMatchType !== KeywordMatchType.Regex) return undefined
  if (tempBlockword.value.trim()) {
    const err = validateRegexPattern(tempBlockword.value.trim())
    if (err) return `输入正则语法错误：${err}`
  }
  const invalidExisting = (props.action.triggerConfig.blockwords ?? []).find((bw) => validateRegexPattern(bw))
  if (invalidExisting) {
    return `已添加的正则「${invalidExisting}」语法错误：${validateRegexPattern(invalidExisting)}`
  }
  return undefined
})

function addKeyword() {
  const keyword = tempKeyword.value.trim()
  if (!keyword) return

  if (props.action.triggerConfig.keywordMatchType === KeywordMatchType.Regex) {
    const err = validateRegexPattern(keyword)
    if (err) {
      toast.error(`正则表达式无效：${err}`)
      return
    }
  }

  if (!props.action.triggerConfig.keywords) {
    props.action.triggerConfig.keywords = []
  }

  if (!props.action.triggerConfig.keywords.includes(keyword)) {
    props.action.triggerConfig.keywords.push(keyword)
    tempKeyword.value = ''
  } else {
    toast.warning('此关键词已存在')
  }
}

function removeKeyword(index: number) {
  props.action.triggerConfig.keywords?.splice(index, 1)
}

function addBlockword() {
  const blockword = tempBlockword.value.trim()
  if (!blockword) return

  if (props.action.triggerConfig.blockwordMatchType === KeywordMatchType.Regex) {
    const err = validateRegexPattern(blockword)
    if (err) {
      toast.error(`正则表达式无效：${err}`)
      return
    }
  }

  if (!props.action.triggerConfig.blockwords) {
    props.action.triggerConfig.blockwords = []
  }

  if (!props.action.triggerConfig.blockwords.includes(blockword)) {
    props.action.triggerConfig.blockwords.push(blockword)
    tempBlockword.value = ''
  } else {
    toast.warning('此屏蔽词已存在')
  }
}

function removeBlockword(index: number) {
  props.action.triggerConfig.blockwords?.splice(index, 1)
}
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.DANMAKU"
    class="danmaku-trigger-settings space-y-3.5"
  >
    <!-- 触发关键词 -->
    <FormField
      label="触发关键词"
      :error="keywordRegexError"
    >
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <Input
            v-model="tempKeyword"
            :placeholder="action.triggerConfig.keywordMatchType === KeywordMatchType.Regex ? '输入正则表达式，例如 ^早.*好$' : '输入关键词后回车添加...'"
            class="flex-1"
            @keyup.enter="addKeyword"
          />
          <Button @click="addKeyword">添加</Button>
        </div>

        <SettingRow
          variant="none"
          title="匹配方式"
        >
          <ToggleGroup
            type="single"
            :model-value="action.triggerConfig.keywordMatchType"
            @update:model-value="(val) => { if (val) action.triggerConfig.keywordMatchType = val as KeywordMatchType }"
          >
            <ToggleGroupItem :value="KeywordMatchType.Full">完全</ToggleGroupItem>
            <ToggleGroupItem :value="KeywordMatchType.Contains">包含</ToggleGroupItem>
            <ToggleGroupItem :value="KeywordMatchType.Regex">正则</ToggleGroupItem>
          </ToggleGroup>
        </SettingRow>

        <div class="tag-container flex flex-wrap items-center gap-1.5 p-2 rounded-md border bg-muted/20 min-h-[36px]">
          <template v-if="action.triggerConfig.keywords && action.triggerConfig.keywords.length > 0">
            <Tag
              v-for="(keyword, index) in action.triggerConfig.keywords"
              :key="keyword"
              closable
              @close="removeKeyword(index)"
            >
              {{ keyword }}
            </Tag>
          </template>
          <span
            v-else
            class="text-xs italic text-amber-600 dark:text-amber-400"
          >
            尚未添加关键词（至少添加 1 个关键词才会触发此规则）
          </span>
        </div>
      </div>
    </FormField>

    <Separator />

    <!-- 屏蔽词 -->
    <FormField
      label="屏蔽关键词（可选）"
      description="弹幕命中任意屏蔽词时将不会触发本规则"
      :error="blockwordRegexError"
    >
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <Input
            v-model="tempBlockword"
            placeholder="输入屏蔽词后回车添加..."
            class="flex-1"
            @keyup.enter="addBlockword"
          />
          <Button
            variant="secondary"
            class="text-amber-600 dark:text-amber-400"
            @click="addBlockword"
          >
            添加
          </Button>
        </div>

        <SettingRow
          variant="none"
          title="屏蔽匹配方式"
        >
          <ToggleGroup
            type="single"
            :model-value="action.triggerConfig.blockwordMatchType"
            @update:model-value="(val) => { if (val) action.triggerConfig.blockwordMatchType = val as KeywordMatchType }"
          >
            <ToggleGroupItem :value="KeywordMatchType.Full">完全</ToggleGroupItem>
            <ToggleGroupItem :value="KeywordMatchType.Contains">包含</ToggleGroupItem>
            <ToggleGroupItem :value="KeywordMatchType.Regex">正则</ToggleGroupItem>
          </ToggleGroup>
        </SettingRow>

        <div class="tag-container flex flex-wrap items-center gap-1.5 p-2 rounded-md border bg-muted/20 min-h-[36px]">
          <template v-if="action.triggerConfig.blockwords && action.triggerConfig.blockwords.length > 0">
            <Tag
              v-for="(blockword, index) in action.triggerConfig.blockwords"
              :key="blockword"
              variant="outline"
              closable
              class="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
              @close="removeBlockword(index)"
            >
              {{ blockword }}
            </Tag>
          </template>
          <span
            v-else
            class="text-xs italic text-muted-foreground"
          >
            无屏蔽词
          </span>
        </div>
      </div>
    </FormField>
  </div>
</template>
