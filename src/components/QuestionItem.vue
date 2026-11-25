<script setup lang="ts">
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { BadgeCheck, ChevronDown, ChevronUp, Heart, Pin, Tv } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { ResponseQAInfoToTarget } from '@/api/generated/model'
import QuestionThreadContext from '@/components/QuestionThreadContext.vue'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { ImagePreview } from '@/shared/ui/image-preview'
import { Separator } from '@/shared/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useQuestionBox } from '@/store/useQuestionBox'

const props = withDefaults(
  defineProps<{
    item: ResponseQAInfoToTarget
    selectable?: boolean
    selected?: boolean
  }>(),
  {
    selectable: false,
    selected: false,
  },
)

const emit = defineEmits<{ (e: 'select', id: number): void }>()

const useQA = useQuestionBox()
const showContent = ref(false)
const showFullMessage = ref(false)
const showThreadContext = ref(false)

const threadContext = computed(() => useQA.threadContext(props.item))
const isViolation = computed(() => Boolean(props.item.reviewResult && props.item.reviewResult.isApproved === false))
const isDisplaying = computed(() => useQA.displayQuestion?.id === props.item.id)
const message = computed(() => props.item.question?.message || '')
const shouldClampMessage = computed(() => message.value.length > 220 || message.value.split('\n').length > 4)

function normalizeTime(time: number): number {
  return time < 1e12 ? time * 1000 : time
}

function getScoreVariant(score?: number | null): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (score === undefined || score === null) return 'secondary'
  if (score >= 70) return 'success'
  if (score >= 40) return 'warning'
  return 'destructive'
}

function formatRelative(time: number) {
  return formatDistanceToNow(normalizeTime(time), { addSuffix: true, locale: zhCN })
}

function formatExact(time: number) {
  return format(normalizeTime(time), 'yyyy-MM-dd HH:mm:ss')
}
</script>

<template>
  <Card
    v-if="item"
    class="question-item transition-colors text-xs"
    :class="{
      'is-unread border-l-2 border-l-brand': !item.isReaded,
      'is-displaying ring-1 ring-primary border-primary': isDisplaying,
    }"
  >
    <TooltipProvider>
      <CardHeader
        class="p-3 border-b border-border/60 flex flex-row items-center justify-between space-y-0 gap-2 flex-wrap"
      >
        <div class="flex items-center gap-1.5 flex-wrap min-w-0">
          <Checkbox
            v-if="selectable"
            :checked="selected"
            class="mr-1"
            @click.stop
            @update:checked="emit('select', item.id)"
          />

          <Badge
            v-if="isDisplaying"
            variant="success"
            size="xs"
            class="flex items-center gap-1 displaying-tag"
          >
            <Tv class="size-3" />
            OBS 展示中
          </Badge>

          <Badge
            v-if="item.isPinned"
            variant="secondary"
            size="xs"
            class="flex items-center gap-1 text-brand bg-brand-soft"
          >
            <Pin class="size-3" />
            置顶
          </Badge>

          <Badge
            v-if="!item.isReaded"
            variant="warning"
            size="xs"
          >
            未读
          </Badge>

          <span
            v-if="!item.isReaded || isDisplaying || item.isPinned"
            class="text-border"
          >
            |
          </span>

          <strong
            class="font-semibold text-xs truncate max-w-[180px]"
            :class="item.isAnonymous ? 'text-muted-foreground' : 'text-foreground'"
          >
            {{ item.isAnonymous ? item.anonymousName || '匿名用户' : item.sender?.name || '观众' }}
          </strong>

          <Badge
            v-if="item.isSenderRegisted"
            variant="secondary"
            size="xs"
            class="text-sky-600 dark:text-sky-400 bg-sky-500/10"
          >
            已注册
          </Badge>

          <Tooltip v-if="item.isSenderBiliAuthed">
            <TooltipTrigger as-child>
              <Badge
                variant="secondary"
                size="xs"
                class="flex items-center gap-0.5 text-pink-600 dark:text-pink-400 bg-pink-500/10"
              >
                <BadgeCheck class="size-3" />
                {{ item.senderBiliAuthInfo?.name || 'B站认证' }}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>已完成 B 站身份认证</TooltipContent>
          </Tooltip>

          <Badge
            v-if="item.threadRootId"
            variant="secondary"
            size="xs"
            class="text-violet-600 dark:text-violet-400 bg-violet-500/10"
          >
            追问
          </Badge>

          <Badge
            v-if="item.isPublic"
            variant="secondary"
            size="xs"
            class="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
          >
            公开
          </Badge>
          <Badge
            v-if="item.senderAllowsPublic === false"
            variant="secondary"
            size="xs"
            class="text-amber-600 dark:text-amber-400 bg-amber-500/10"
          >
            提问者不公开
          </Badge>

          <Tooltip v-if="item.tag">
            <TooltipTrigger as-child>
              <Badge
                variant="outline"
                size="xs"
              >
                #{{ item.tag }}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>标签/话题</TooltipContent>
          </Tooltip>

          <span
            v-if="(item.likeCount ?? 0) > 0"
            class="inline-flex items-center gap-0.5 text-[11px] text-rose-500 tabular-nums"
          >
            <Heart class="size-3 fill-current" />
            {{ item.likeCount }}
          </span>

          <span class="text-border">|</span>

          <Tooltip>
            <TooltipTrigger as-child>
              <span class="text-muted-foreground text-[11px] cursor-default tabular-nums">
                {{ formatRelative(item.sendAt) }}
              </span>
            </TooltipTrigger>
            <TooltipContent>{{ formatExact(item.sendAt) }}</TooltipContent>
          </Tooltip>

          <template v-if="item.reviewResult && item.reviewResult.violationType?.length">
            <span class="text-border">|</span>
            <div class="flex items-center gap-1 flex-wrap">
              <Badge
                v-for="v in item.reviewResult.violationType"
                :key="v"
                variant="destructive"
                size="xs"
              >
                {{ useQA.getViolationString(v) }}
              </Badge>
            </div>
          </template>

          <template v-if="item.reviewResult && item.reviewResult.saftyScore !== undefined && item.reviewResult.saftyScore !== null">
            <span class="text-border">|</span>
            <Tooltip>
              <TooltipTrigger as-child>
                <Badge
                  :variant="getScoreVariant(item.reviewResult.saftyScore)"
                  size="xs"
                  class="tabular-nums cursor-default"
                >
                  安全分 {{ item.reviewResult.saftyScore }}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>审查得分，满分 100，越高越安全</TooltipContent>
            </Tooltip>
          </template>
        </div>

        <slot
          name="header-extra"
          :item="item"
        />
      </CardHeader>

      <CardContent class="p-3 space-y-2 text-xs">
        <template v-if="threadContext.length">
          <Button
            variant="link"
            size="xs"
            class="h-auto p-0 text-[11px] gap-1 text-muted-foreground"
            @click="showThreadContext = !showThreadContext"
          >
            <ChevronUp
              v-if="showThreadContext"
              class="size-3"
            />
            <ChevronDown
              v-else
              class="size-3"
            />
            {{ showThreadContext ? '收起上文' : `查看上文 (${threadContext.length})` }}
          </Button>
          <QuestionThreadContext
            v-if="showThreadContext"
            :items="threadContext"
            answer-label="我的回复"
          />
        </template>

        <div
          v-if="item.questionImages && item.questionImages.length > 0"
          class="flex items-center gap-2 flex-wrap"
        >
          <ImagePreview
            v-for="(img, index) in item.questionImages"
            :key="img.id || index"
            :src="img.path || ''"
            :alt="img.name || '提问附图'"
            :gallery="item.questionImages"
            :index="index"
            class="h-20 w-24"
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

        <Button
          v-if="shouldClampMessage"
          variant="link"
          size="xs"
          class="h-auto p-0 text-[11px] gap-1"
          @click="showFullMessage = !showFullMessage"
        >
          <ChevronUp
            v-if="showFullMessage"
            class="size-3"
          />
          <ChevronDown
            v-else
            class="size-3"
          />
          {{ showFullMessage ? '收起内容' : '展开全部' }}
        </Button>

        <template v-if="item.answer">
          <Separator class="my-2" />
          <div class="question-item__answer-box p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1.5">
            <div class="flex-between text-[11px] text-muted-foreground">
              <span class="font-medium">我的回复</span>
              <span
                v-if="item.isEdited"
                class="text-muted-foreground/80"
              >
                已编辑
              </span>
            </div>
            <p class="m-0 text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words">
              {{ item.answer.message }}
            </p>
            <div
              v-if="item.answerImages && item.answerImages.length > 0"
              class="flex items-center gap-2 flex-wrap pt-1"
            >
              <ImagePreview
                v-for="(img, index) in item.answerImages"
                :key="img.id || index"
                :src="img.path || ''"
                :alt="img.name || '回复附图'"
                :gallery="item.answerImages"
                :index="index"
                class="h-16 w-20"
              />
            </div>
          </div>
        </template>
      </CardContent>

      <CardFooter
        v-if="$slots.footer"
        class="p-3 border-t border-border/40 pt-2"
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
