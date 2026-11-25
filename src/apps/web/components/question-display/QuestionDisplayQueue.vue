<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Check,
  Crosshair,
  Eye,
  Heart,
  Image as ImageIcon,
  ListChecks,
  ListPlus,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  Undo2,
  X,
} from 'lucide-vue-next'
import { computed, nextTick } from 'vue'

import type { ResponseQAInfoToTarget } from '@/api/generated/model'
import { questionSenderLabel } from '@/shared/questionDisplay'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = withDefaults(
  defineProps<{
    questions: ResponseQAInfoToTarget[]
    currentId?: number
    tags: string[]
    loading: boolean
    playlistIds?: number[]
  }>(),
  {
    playlistIds: () => [],
  },
)

const emit = defineEmits<{
  refresh: []
  show: [question: ResponseQAInfoToTarget]
  clear: []
  read: [question: ResponseQAInfoToTarget, read: boolean]
  favorite: [question: ResponseQAInfoToTarget, value: boolean]
  togglePlaylist: [id: number]
  clearPlaylist: []
}>()

const search = defineModel<string>('search', { required: true })
const tag = defineModel<string | undefined>('tag', { required: true })
const onlyUnread = defineModel<boolean>('onlyUnread', { required: true })
const onlyFavorite = defineModel<boolean>('onlyFavorite', { required: true })
const onlyUnreplied = defineModel<boolean>('onlyUnreplied', { default: false })
const onlyPlaylist = defineModel<boolean>('onlyPlaylist', { default: false })

const tagOptions = computed(() => props.tags.map((value) => ({ label: value, value })))
const playlistSet = computed(() => new Set(props.playlistIds))

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
    <section class="w-full min-w-0 flex flex-col h-full min-h-0 bg-card border-r border-border">
      <header class="queue-heading flex-between p-3 border-b border-border/80">
        <div class="flex items-center gap-2 min-w-0">
          <h1 class="text-sm font-semibold truncate">提问队列</h1>
          <span class="text-xs text-muted-foreground font-mono tabular-nums">({{ questions.length }})</span>
        </div>
        <div class="heading-actions flex items-center gap-1 shrink-0">
          <Tooltip v-if="currentId">
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="定位正在展示的提问"
                @click="scrollToCurrent"
              >
                <Crosshair class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>定位正在展示的提问</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon-xs"
                :disabled="loading"
                aria-label="刷新提问队列"
                @click="emit('refresh')"
              >
                <RefreshCw
                  class="size-3.5"
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
          <Search class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
          <SelectTrigger class="w-full">
            <SelectValue placeholder="全部话题" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部话题</SelectItem>
            <SelectItem
              v-for="opt in tagOptions"
              :key="opt.value"
              :value="opt.value"
            >
              #{{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <div class="filter-flags flex items-center gap-3 flex-wrap pt-0.5">
          <label class="flex items-center gap-1.5 cursor-pointer select-none">
            <Checkbox v-model:checked="onlyUnread" />
            <span>未读</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer select-none">
            <Checkbox v-model:checked="onlyFavorite" />
            <span>收藏</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer select-none">
            <Checkbox v-model:checked="onlyUnreplied" />
            <span>未回复</span>
          </label>
        </div>

        <!-- 本场待读队列切换 -->
        <div class="flex-between gap-1.5 pt-1 border-t border-border/50">
          <Button
            size="xs"
            :variant="onlyPlaylist ? 'default' : 'outline'"
            class="gap-1 flex-1"
            @click="onlyPlaylist = !onlyPlaylist"
          >
            <ListChecks class="size-3.5" />
            本场待读 ({{ playlistIds.length }})
          </Button>
          <Button
            v-if="playlistIds.length > 0"
            size="xs"
            variant="ghost"
            class="text-muted-foreground"
            @click="emit('clearPlaylist')"
          >
            清空
          </Button>
        </div>
      </div>

      <ScrollArea class="flex-1 min-h-0 min-w-0 [&_[data-reka-scroll-area-viewport]>div]:!block">
        <div
          v-if="questions.length"
          class="queue-list p-2 space-y-2"
        >
          <article
            v-for="item in questions"
            :key="item.id"
            class="queue-item p-2.5 rounded-lg border transition-colors text-xs flex gap-2 justify-between min-w-0"
            :data-id="item.id"
            :class="[
              item.id === currentId
                ? 'is-current border-primary bg-primary/5 shadow-xs'
                : 'border-border/80 bg-background hover:border-primary/50',
              !item.isReaded ? 'font-medium' : '',
            ]"
          >
            <div
              role="button"
              tabindex="0"
              class="question-main flex-1 min-w-0 text-left cursor-pointer space-y-1.5 focus:outline-hidden"
              @click="item.id === currentId ? emit('clear') : emit('show', item)"
              @keydown.enter="item.id === currentId ? emit('clear') : emit('show', item)"
            >
              <div class="question-meta flex-between text-[11px] text-muted-foreground gap-2">
                <strong class="text-foreground truncate">{{ questionSenderLabel(item) }}</strong>
                <div class="meta-right flex items-center gap-1 shrink-0 font-mono tabular-nums">
                  <Tooltip v-if="!item.isPublic">
                    <TooltipTrigger as-child>
                      <Lock class="size-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ item.senderAllowsPublic === false ? '提问者选择不公开展示' : '私密提问' }}
                    </TooltipContent>
                  </Tooltip>
                  <span>{{ formatTimeAgo(item.sendAt) }}</span>
                </div>
              </div>
              <p class="question-text line-clamp-2 text-xs leading-relaxed text-foreground break-words m-0">
                {{ item.question.message }}
              </p>
              <div class="question-flags flex items-center gap-1.5 flex-wrap pt-0.5">
                <Badge
                  v-if="item.id === currentId"
                  variant="default"
                  size="xs"
                >
                  正在展示
                </Badge>
                <Badge
                  v-else-if="!item.isReaded"
                  variant="secondary"
                  size="xs"
                  class="bg-amber-500/10 text-amber-500"
                >
                  未读
                </Badge>
                <Badge
                  v-if="item.answer"
                  variant="outline"
                  size="xs"
                  class="flex items-center gap-0.5 text-sky-600 dark:text-sky-400"
                >
                  <MessageSquare class="size-3" />
                  已回复
                </Badge>
                <Badge
                  v-if="item.tag"
                  variant="outline"
                  size="xs"
                >
                  #{{ item.tag }}
                </Badge>
                <span
                  v-if="item.questionImages?.length"
                  class="img-flag inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono tabular-nums"
                >
                  <ImageIcon class="size-3" />
                  {{ item.questionImages.length }}
                </span>
              </div>
            </div>

            <div
              class="question-actions flex flex-col items-center justify-between gap-0.5 border-l border-border/60 pl-1.5 shrink-0"
            >
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    :class="item.id === currentId ? 'text-destructive' : 'text-primary'"
                    :aria-label="item.id === currentId ? '清空当前展示' : '展示这条提问'"
                    @click="item.id === currentId ? emit('clear') : emit('show', item)"
                  >
                    <X
                      v-if="item.id === currentId"
                      class="size-3.5"
                    />
                    <Eye
                      v-else
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
                    size="icon-xs"
                    :class="playlistSet.has(item.id) ? 'text-brand' : 'text-muted-foreground hover:text-foreground'"
                    :aria-label="playlistSet.has(item.id) ? '移出本场待读' : '加入本场待读'"
                    @click="emit('togglePlaylist', item.id)"
                  >
                    <ListChecks
                      v-if="playlistSet.has(item.id)"
                      class="size-3.5"
                    />
                    <ListPlus
                      v-else
                      class="size-3.5"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ playlistSet.has(item.id) ? '移出本场待读' : '加入本场待读' }}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    :class="item.isReaded ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground'"
                    :aria-label="item.isReaded ? '退回未读' : '标记为已读'"
                    @click="emit('read', item, !item.isReaded)"
                  >
                    <Undo2
                      v-if="item.isReaded"
                      class="size-3.5"
                    />
                    <Check
                      v-else
                      class="size-3.5"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ item.isReaded ? '退回未读' : '标记为已读' }}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    :class="item.isFavorite ? 'text-rose-500' : 'text-muted-foreground hover:text-foreground'"
                    :aria-label="item.isFavorite ? '取消收藏' : '收藏'"
                    @click="emit('favorite', item, !item.isFavorite)"
                  >
                    <Heart
                      class="size-3.5"
                      :class="item.isFavorite ? 'fill-current' : ''"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ item.isFavorite ? '取消收藏' : '收藏' }}</TooltipContent>
              </Tooltip>
            </div>
          </article>
        </div>

        <Empty
          v-else
          :description="onlyPlaylist ? '待读队列为空，点击左侧列表的加入按钮添加' : '没有符合条件的提问'"
          class="py-16 px-4"
        />
      </ScrollArea>
    </section>
  </TooltipProvider>
</template>
