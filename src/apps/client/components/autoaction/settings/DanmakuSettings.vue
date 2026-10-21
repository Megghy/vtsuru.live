<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import { KeywordMatchType } from '@/apps/client/store/autoAction/types'
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

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
    <div class="settings-group space-y-2.5">
      <span class="font-semibold text-xs text-foreground block">触发关键词</span>
      <div class="flex items-center gap-2">
        <Input
          v-model="tempKeyword"
          placeholder="输入关键词..."
          class="h-8 text-xs flex-1"
          @keyup.enter="addKeyword"
        />
        <Button
          size="sm"
          class="h-8 text-xs"
          @click="addKeyword"
        >
          添加
        </Button>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-xs text-muted-foreground">匹配方式:</span>
        <div class="inline-flex rounded-md border border-input p-0.5 bg-background text-muted-foreground">
          <button
            type="button"
            class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
            :class="action.triggerConfig.keywordMatchType === KeywordMatchType.Full ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
            @click="action.triggerConfig.keywordMatchType = KeywordMatchType.Full"
          >
            完全
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
            :class="action.triggerConfig.keywordMatchType === KeywordMatchType.Contains ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
            @click="action.triggerConfig.keywordMatchType = KeywordMatchType.Contains"
          >
            包含
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
            :class="action.triggerConfig.keywordMatchType === KeywordMatchType.Regex ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
            @click="action.triggerConfig.keywordMatchType = KeywordMatchType.Regex"
          >
            正则
          </button>
        </div>
      </div>

      <div class="tag-container flex flex-wrap items-center gap-1.5 p-2 rounded-md border bg-muted/20 min-h-[36px]">
        <template v-if="action.triggerConfig.keywords && action.triggerConfig.keywords.length > 0">
          <Badge
            v-for="(keyword, index) in action.triggerConfig.keywords"
            :key="index"
            variant="secondary"
            class="text-xs h-6 px-2 gap-1.5 font-normal"
          >
            <span>{{ keyword }}</span>
            <button
              type="button"
              class="hover:text-destructive transition-colors text-muted-foreground"
              @click="removeKeyword(index)"
            >
              ✕
            </button>
          </Badge>
        </template>
        <span
          v-else
          class="text-xs italic text-muted-foreground"
        >
          未设置关键词 (将匹配所有弹幕)
        </span>
      </div>
    </div>

    <div class="h-px bg-border my-2" />

    <!-- 屏蔽词 -->
    <div class="settings-group space-y-2.5">
      <span class="font-semibold text-xs text-foreground block">屏蔽关键词</span>
      <div class="flex items-center gap-2">
        <Input
          v-model="tempBlockword"
          placeholder="输入屏蔽词..."
          class="h-8 text-xs flex-1"
          @keyup.enter="addBlockword"
        />
        <Button
          size="sm"
          variant="secondary"
          class="h-8 text-xs text-amber-600 dark:text-amber-400"
          @click="addBlockword"
        >
          添加
        </Button>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-xs text-muted-foreground">匹配方式:</span>
        <div class="inline-flex rounded-md border border-input p-0.5 bg-background text-muted-foreground">
          <button
            type="button"
            class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
            :class="action.triggerConfig.blockwordMatchType === KeywordMatchType.Full ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
            @click="action.triggerConfig.blockwordMatchType = KeywordMatchType.Full"
          >
            完全
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
            :class="action.triggerConfig.blockwordMatchType === KeywordMatchType.Contains ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
            @click="action.triggerConfig.blockwordMatchType = KeywordMatchType.Contains"
          >
            包含
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
            :class="action.triggerConfig.blockwordMatchType === KeywordMatchType.Regex ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
            @click="action.triggerConfig.blockwordMatchType = KeywordMatchType.Regex"
          >
            正则
          </button>
        </div>
      </div>

      <div class="tag-container flex flex-wrap items-center gap-1.5 p-2 rounded-md border bg-muted/20 min-h-[36px]">
        <template v-if="action.triggerConfig.blockwords && action.triggerConfig.blockwords.length > 0">
          <Badge
            v-for="(blockword, index) in action.triggerConfig.blockwords"
            :key="index"
            variant="outline"
            class="text-xs h-6 px-2 gap-1.5 font-normal border-amber-500/40 text-amber-600 bg-amber-500/10"
          >
            <span>{{ blockword }}</span>
            <button
              type="button"
              class="hover:text-destructive transition-colors text-amber-600/70"
              @click="removeBlockword(index)"
            >
              ✕
            </button>
          </Badge>
        </template>
        <span
          v-else
          class="text-xs italic text-muted-foreground"
        >
          无屏蔽词
        </span>
      </div>
    </div>
  </div>
</template>
