<script setup lang="ts">
import {
  ArrowSync24Regular,
  Checkmark24Regular,
  Comment24Regular,
  Dismiss24Regular,
  Eye24Regular,
  Image24Regular,
  Location24Regular,
  LockClosed24Regular,
  Search24Regular,
} from '@vicons/fluent'
import { Heart, HeartOutline } from '@vicons/ionicons5'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, nextTick, ref } from 'vue'

import type { QAInfo } from '@/api/api-models'
import { questionSenderLabel } from '@/shared/questionDisplay'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{
  questions: QAInfo[]
  currentId?: number
  tags: string[]
  loading: boolean
}>()

const emit = defineEmits<{
  refresh: []
  show: [question: QAInfo]
  clear: []
  read: [question: QAInfo]
  favorite: [question: QAInfo, value: boolean]
}>()

const search = defineModel<string>('search', { required: true })
const tag = defineModel<string | undefined>('tag', { required: true })
const onlyUnread = defineModel<boolean>('onlyUnread', { required: true })
const onlyFavorite = defineModel<boolean>('onlyFavorite', { required: true })
const onlyUnreplied = defineModel<boolean>('onlyUnreplied', { default: false })

const tagOptions = computed(() => props.tags.map((value) => ({ label: value, value })))

function formatTimeAgo(ts: number) {
  try {
    const d = new Date(ts > 1e11 ? ts : ts * 1000)
    return formatDistanceToNow(d, { addSuffix: true, locale: zhCN })
  } catch {
    return ''
  }
}

function scrollToCurrent() {
  if (!props.currentId) return
  void nextTick(() => {
    const el = document.querySelector<HTMLElement>(`.queue-item[data-id="${props.currentId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  })
}

defineExpose({ scrollToCurrent })
</script>

<template>
  <TooltipProvider>
    <section class="queue-panel flex flex-col h-full min-h-0 bg-card border-r border-border">
      <header class="queue-heading flex items-center justify-between p-3.5 border-b border-border/80">
        <div class="flex items-center gap-2">
          <h1 class="text-sm font-bold">提问队列</h1>
          <span class="text-xs text-muted-foreground font-mono">({{ questions.length }})</span>
        </div>
        <div class="heading-actions flex items-center gap-1">
          <Tooltip v-if="currentId">
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="size-7"
                aria-label="定位正在展示的提问"
                @click="scrollToCurrent"
              >
                <component
                  :is="Location24Regular"
                  class="size-4"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>定位正在展示的提问</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="size-7"
                :disabled="loading"
                aria-label="刷新提问队列"
                @click="emit('refresh')"
              >
                <component
                  :is="ArrowSync24Regular"
                  class="size-4"
                  :class="{ 'animate-spin': loading }"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>刷新提问队列</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div class="queue-filters p-3 space-y-2 border-b border-border/60 bg-muted/20 text-xs">
        <div class="relative">
          <component
            :is="Search24Regular"
            class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="search"
            placeholder="搜索提问内容"
            class="pl-8"
          />
        </div>

        <Select
          :model-value="tag || 'all'"
          @update:model-value="tag = $event === 'all' ? undefined : String($event)"
        >
          <SelectTrigger>
            <SelectValue placeholder="全部话题" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              value="all"
              class="text-xs"
              >全部话题</SelectItem
            >
            <SelectItem
              v-for="opt in tagOptions"
              :key="opt.value"
              :value="opt.value"
              class="text-xs"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <div class="filter-flags flex items-center gap-3 pt-1">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox v-model:checked="onlyUnread" />
            <span>未读</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox v-model:checked="onlyFavorite" />
            <span>收藏</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox v-model:checked="onlyUnreplied" />
            <span>未回复</span>
          </label>
        </div>
      </div>

      <ScrollArea class="flex-1 min-h-0">
        <div
          v-if="questions.length"
          class="queue-list p-2 space-y-2"
        >
          <article
            v-for="item in questions"
            :key="item.id"
            class="queue-item p-2.5 rounded-lg border transition text-xs flex gap-2 justify-between"
            :data-id="item.id"
            :class="[
              item.id === currentId
                ? 'is-current border-primary bg-primary/5 shadow-xs'
                : 'border-border/80 bg-background hover:border-primary/50',
              !item.isReaded ? 'font-medium' : '',
            ]"
          >
            <button
              type="button"
              class="question-main flex-1 min-w-0 text-left cursor-pointer space-y-1.5"
              @click="item.id === currentId ? emit('clear') : emit('show', item)"
            >
              <div class="question-meta flex items-center justify-between text-[11px] text-muted-foreground gap-2">
                <strong class="text-foreground truncate">{{ questionSenderLabel(item) }}</strong>
                <div class="meta-right flex items-center gap-1 shrink-0 font-mono">
                  <Tooltip v-if="!item.isPublic">
                    <TooltipTrigger as-child>
                      <component
                        :is="LockClosed24Regular"
                        class="size-3 text-muted-foreground"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ item.senderAllowsPublic === false ? '提问者选择不公开展示' : '私密提问' }}
                    </TooltipContent>
                  </Tooltip>
                  <span>{{ formatTimeAgo(item.sendAt) }}</span>
                </div>
              </div>
              <p class="question-text line-clamp-2 text-xs leading-relaxed text-foreground">
                {{ item.question.message }}
              </p>
              <div class="question-flags flex items-center gap-1.5 flex-wrap pt-0.5">
                <Badge
                  v-if="item.id === currentId"
                  variant="default"
                  class="text-[10px] h-4.5 px-1.5"
                >
                  正在展示
                </Badge>
                <Badge
                  v-else-if="!item.isReaded"
                  variant="secondary"
                  class="text-[10px] h-4.5 px-1.5 bg-amber-500/10 text-amber-500"
                >
                  未读
                </Badge>
                <Badge
                  v-if="item.answer"
                  variant="outline"
                  class="text-[10px] h-4.5 px-1.5 flex items-center gap-0.5 text-blue-500"
                >
                  <component
                    :is="Comment24Regular"
                    class="size-3"
                  />
                  已回复
                </Badge>
                <Badge
                  v-if="item.tag"
                  variant="outline"
                  class="text-[10px] h-4.5 px-1.5"
                >
                  {{ item.tag }}
                </Badge>
                <span
                  v-if="item.questionImages?.length"
                  class="img-flag inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono"
                >
                  <component
                    :is="Image24Regular"
                    class="size-3"
                  />
                  {{ item.questionImages.length }}
                </span>
              </div>
            </button>

            <div
              class="question-actions flex flex-col items-center justify-between gap-1 border-l border-border/60 pl-1.5"
            >
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-6"
                    :class="item.id === currentId ? 'text-destructive' : 'text-primary'"
                    :aria-label="item.id === currentId ? '清空当前展示' : '展示这条提问'"
                    @click="item.id === currentId ? emit('clear') : emit('show', item)"
                  >
                    <component
                      :is="item.id === currentId ? Dismiss24Regular : Eye24Regular"
                      class="size-3.5"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ item.id === currentId ? '清空当前展示' : '展示这条提问' }}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-6 text-muted-foreground hover:text-foreground"
                    :disabled="item.isReaded"
                    aria-label="标记为已读"
                    @click="emit('read', item)"
                  >
                    <component
                      :is="Checkmark24Regular"
                      class="size-3.5"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>标记为已读</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-6"
                    :class="item.isFavorite ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'"
                    :aria-label="item.isFavorite ? '取消收藏' : '收藏'"
                    @click="emit('favorite', item, !item.isFavorite)"
                  >
                    <component
                      :is="item.isFavorite ? Heart : HeartOutline"
                      class="size-3.5"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ item.isFavorite ? '取消收藏' : '收藏' }}</TooltipContent>
              </Tooltip>
            </div>
          </article>
        </div>
        <div
          v-else
          class="queue-empty py-16 text-center text-xs text-muted-foreground"
        >
          没有符合条件的提问
        </div>
      </ScrollArea>
    </section>
  </TooltipProvider>
</template>

<style scoped>
.queue-panel {
  width: 100%;
  min-width: 0;
}
</style>
