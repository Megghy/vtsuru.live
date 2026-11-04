<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import { KeywordMatchType } from '@/apps/client/store/autoAction/types'
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { Tag } from '@/shared/ui/tag'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

// 弹幕关键词相关
const tempKeyword = ref('')
const tempBlockword = ref('')

// 初始化匹配类型配置
if (!props.action.triggerConfig.keywordMatchType) {
  props.action.triggerConfig.keywordMatchType = KeywordMatchType.Contains
}

if (!props.action.triggerConfig.blockwordMatchType) {
  props.action.triggerConfig.blockwordMatchType = KeywordMatchType.Contains
}

// 添加关键词
function addKeyword() {
  const keyword = tempKeyword.value.trim()
  if (!keyword) return

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

// 移除关键词
function removeKeyword(index: number) {
  if (props.action.triggerConfig.keywords) {
    props.action.triggerConfig.keywords.splice(index, 1)
  }
}

// 添加屏蔽词
function addBlockword() {
  const blockword = tempBlockword.value.trim()
  if (!blockword) return

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

// 移除屏蔽词
function removeBlockword(index: number) {
  if (props.action.triggerConfig.blockwords) {
    props.action.triggerConfig.blockwords.splice(index, 1)
  }
}
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.DANMAKU"
    class="danmaku-trigger-settings space-y-4"
  >
    <!-- 触发关键词 -->
    <FormField
      label="触发关键词"
      class="settings-group space-y-2"
    >
      <div class="flex items-center gap-2">
        <Input
          v-model="tempKeyword"
          placeholder="输入关键词..."
          class="flex-1"
          @keyup.enter="addKeyword"
        />
        <Button @click="addKeyword"> 添加 </Button>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-xs text-muted-foreground">匹配方式:</span>
        <ToggleGroup
          type="single"
          :model-value="action.triggerConfig.keywordMatchType"
          @update:model-value="(val) => { if (val) action.triggerConfig.keywordMatchType = val as any }"
        >
          <ToggleGroupItem :value="KeywordMatchType.Full">完全</ToggleGroupItem>
          <ToggleGroupItem :value="KeywordMatchType.Contains">包含</ToggleGroupItem>
          <ToggleGroupItem :value="KeywordMatchType.Regex">正则</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div class="tag-container flex flex-wrap items-center gap-1.5 p-2 rounded-md border bg-muted/20 min-h-[36px]">
        <template v-if="action.triggerConfig.keywords && action.triggerConfig.keywords.length > 0">
          <Tag
            v-for="(keyword, index) in action.triggerConfig.keywords"
            :key="index"
            closable
            @close="removeKeyword(index)"
          >
            {{ keyword }}
          </Tag>
        </template>
        <span
          v-else
          class="text-xs italic text-muted-foreground"
        >
          未设置关键词 (将匹配所有弹幕)
        </span>
      </div>
    </FormField>

    <Separator class="my-2" />

    <!-- 屏蔽词 -->
    <FormField
      label="屏蔽关键词"
      class="settings-group space-y-2"
    >
      <div class="flex items-center gap-2">
        <Input
          v-model="tempBlockword"
          placeholder="输入屏蔽词..."
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

      <div class="flex items-center gap-3">
        <span class="text-xs text-muted-foreground">匹配方式:</span>
        <ToggleGroup
          type="single"
          :model-value="action.triggerConfig.blockwordMatchType"
          @update:model-value="(val) => { if (val) action.triggerConfig.blockwordMatchType = val as any }"
        >
          <ToggleGroupItem :value="KeywordMatchType.Full">完全</ToggleGroupItem>
          <ToggleGroupItem :value="KeywordMatchType.Contains">包含</ToggleGroupItem>
          <ToggleGroupItem :value="KeywordMatchType.Regex">正则</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div class="tag-container flex flex-wrap items-center gap-1.5 p-2 rounded-md border bg-muted/20 min-h-[36px]">
        <template v-if="action.triggerConfig.blockwords && action.triggerConfig.blockwords.length > 0">
          <Tag
            v-for="(blockword, index) in action.triggerConfig.blockwords"
            :key="index"
            variant="outline"
            closable
            class="border-amber-500/40 text-amber-600 bg-amber-500/10"
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
    </FormField>
  </div>
</template>
