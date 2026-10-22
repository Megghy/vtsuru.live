<script setup lang="ts">
import { ChevronDown12Regular, ChevronUp12Regular, Tv20Regular } from '@vicons/fluent'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, ref } from 'vue'

import type { QAInfo } from '@/api/api-models'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Separator } from '@/shared/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useQuestionBox } from '@/store/useQuestionBox'

const props = defineProps<{
  item: QAInfo
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{ (e: 'select', id: number): void }>()
const useQA = useQuestionBox()

const isViolation = computed(() => props.item.reviewResult?.isApproved === false)
const isDisplaying = computed(() => useQA.displayQuestion?.id === props.item.id)
const showContent = ref(!isViolation.value)
const showFullMessage = ref(false)
const message = computed(() => props.item.question?.message ?? '')
const shouldClampMessage = computed(() => message.value.length > 240)

function getScoreColor(score: number | undefined): string {
  if (score === undefined) return 'grey'
  const clamped = Math.max(0, Math.min(100, score))
  const hue = 120 * (clamped / 100)
  return `hsl(${hue}, 50%, 45%)`
}

function formatRelative(time: number) {
  return formatDistanceToNow(time, { addSuffix: true, locale: zhCN })
}
</script>

<template>
  <Card
    v-if="item"
    class="question-item transition-all text-xs border border-border/80"
    :class="{
      'is-unread': !item.isReaded,
      'is-displaying ring-1 ring-primary border-primary': isDisplaying,
    }"
  >
    <TooltipProvider>
      <CardHeader
        class="p-3 pb-2 border-b border-border/60 flex flex-row items-center justify-between space-y-0 gap-2 flex-wrap"
      >
        <div class="flex items-center gap-1.5 flex-wrap">
          <Checkbox
            v-if="selectable"
            :checked="selected"
            class="mr-1"
            @click.stop
            @update:checked="emit('select', item.id)"
          />

          <Badge
            v-if="isDisplaying"
            variant="default"
            class="text-[10px] h-4.5 px-1.5 font-normal bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 displaying-tag"
          >
            <component
              :is="Tv20Regular"
              class="size-3"
            />
            OBS 展示中
          </Badge>

          <Badge
            v-if="!item.isReaded"
            variant="default"
            class="text-[10px] h-4.5 px-1.5 font-normal bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
          >
            未读
          </Badge>

          <span
            v-if="!item.isReaded || isDisplaying"
            class="text-border"
          >
            |
          </span>

          <strong
            class="font-semibold text-xs"
            :class="item.isAnonymous ? 'text-muted-foreground' : 'text-foreground'"
          >
            {{ item.isAnonymous ? item.anonymousName || '匿名用户' : item.sender?.name || '观众' }}
          </strong>

          <Badge
            v-if="item.isSenderRegisted"
            variant="secondary"
            class="text-[10px] h-4 px-1 font-normal text-sky-600 dark:text-sky-400 bg-sky-500/10"
          >
            已注册
          </Badge>

          <Badge
            v-if="item.isPublic"
            variant="secondary"
            class="text-[10px] h-4 px-1 font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
          >
            公开
          </Badge>
          <Badge
            v-if="item.senderAllowsPublic === false"
            variant="secondary"
            class="text-[10px] h-4 px-1 font-normal text-amber-600 dark:text-amber-400 bg-amber-500/10"
          >
            提问者不公开
          </Badge>

          <Tooltip v-if="item.tag">
            <TooltipTrigger as-child>
              <Badge
                variant="outline"
                class="text-[10px] h-4 px-1 font-normal"
              >
                {{ item.tag }}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>标签/话题</TooltipContent>
          </Tooltip>

          <span class="text-border">|</span>

          <Tooltip>
            <TooltipTrigger as-child>
              <span class="text-muted-foreground text-[11px] cursor-default">
                {{ formatRelative(item.sendAt) }}
              </span>
            </TooltipTrigger>
            <TooltipContent>{{ format(item.sendAt, 'yyyy-MM-dd HH:mm:ss') }}</TooltipContent>
          </Tooltip>

          <template v-if="item.reviewResult && item.reviewResult.violationType?.length">
            <span class="text-border">|</span>
            <div class="flex items-center gap-1 flex-wrap">
              <Badge
                v-for="v in item.reviewResult.violationType"
                :key="v"
                variant="destructive"
                class="text-[10px] h-4 px-1 font-normal"
              >
                {{ useQA.getViolationString(v) }}
              </Badge>
            </div>
          </template>

          <template v-if="item.reviewResult && item.reviewResult.saftyScore !== undefined">
            <span class="text-border">|</span>
            <Tooltip>
              <TooltipTrigger as-child>
                <span
                  class="text-[10px] px-1.5 py-0.2 rounded font-medium text-white cursor-default"
                  :style="{ backgroundColor: getScoreColor(item.reviewResult.saftyScore) }"
                >
                  得分: {{ item.reviewResult.saftyScore }}
                </span>
              </TooltipTrigger>
              <TooltipContent>审查得分, 满分100, 越高越安全</TooltipContent>
            </Tooltip>
          </template>
        </div>

        <slot
          name="header-extra"
          :item="item"
        />
      </CardHeader>

      <CardContent class="p-3 space-y-2 text-xs">
        <div
          v-if="item.questionImages && item.questionImages.length > 0"
          class="flex items-center gap-2 flex-wrap"
        >
          <img
            v-for="(img, index) in item.questionImages"
            :key="index"
            :src="img.path"
            class="h-20 rounded border border-border/60 object-cover"
            alt=""
          />
        </div>

        <div
          class="question-item__message text-foreground leading-relaxed whitespace-pre-wrap break-words"
          :class="{ 'line-clamp-4': shouldClampMessage && !showFullMessage }"
          :style="{
            filter: isViolation && !showContent ? 'blur(3.7px)' : '',
            cursor: isViolation && !showContent ? 'pointer' : '',
          }"
          @click="isViolation ? (showContent = !showContent) : null"
        >
          {{ message }}
        </div>

        <button
          v-if="shouldClampMessage"
          type="button"
          class="text-primary hover:underline text-[11px] inline-flex items-center gap-1 font-medium"
          @click="showFullMessage = !showFullMessage"
        >
          <component
            :is="showFullMessage ? ChevronUp12Regular : ChevronDown12Regular"
            class="size-3"
          />
          {{ showFullMessage ? '收起内容' : '展开全部' }}
        </button>

        <template v-if="item.answer">
          <Separator class="my-2" />
          <div class="question-item__answer-box p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
            <span class="font-medium text-[11px] text-muted-foreground block">我的回复：</span>
            <p class="m-0 text-xs text-foreground leading-relaxed">{{ item.answer.message }}</p>
          </div>
        </template>
      </CardContent>

      <CardFooter
        v-if="$slots.footer"
        class="p-3 pt-0 border-t border-border/40 mt-1 pt-2"
      >
        <slot
          name="footer"
          :item="item"
        />
      </CardFooter>
    </TooltipProvider>
  </Card>
</template>

<style scoped>
.displaying-tag {
  animation: pulse-soft 2s infinite ease-in-out;
}
@keyframes pulse-soft {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.75;
  }
}
</style>
