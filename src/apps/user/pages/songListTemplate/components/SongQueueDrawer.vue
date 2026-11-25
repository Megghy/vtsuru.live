<script setup lang="ts">
import { ArrowUpCircle, ChevronRight, ListMusic, Mic, RefreshCw, Undo2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { SongRequestInfo } from '@/api/client-types'
import { SongRequestFrom, SongRequestStatus } from '@/api/generated/model'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet'

const props = withDefaults(
  defineProps<{
    songsActive: SongRequestInfo[]
    allowPointPriority?: boolean
    priorityPointCost?: number
    queueMaxSize?: number
    isOfflineBlocked?: boolean
    currentUserUid?: number
    prioritizingId?: number | null
    cancellingId?: number | null
    refreshing?: boolean
  }>(),
  {
    allowPointPriority: false,
    priorityPointCost: 0,
    queueMaxSize: 0,
    isOfflineBlocked: false,
    currentUserUid: undefined,
    prioritizingId: null,
    cancellingId: null,
    refreshing: false,
  },
)

const emit = defineEmits<{
  refresh: []
  priority: [item: SongRequestInfo]
  cancel: [item: SongRequestInfo]
}>()

const open = ref(false)

const singingItems = computed(() => props.songsActive.filter((item) => item.status === SongRequestStatus.Singing))
const waitingItems = computed(() => props.songsActive.filter((item) => item.status === SongRequestStatus.Waiting))
const isQueueFull = computed(() => props.queueMaxSize > 0 && props.songsActive.length >= props.queueMaxSize)

const myWaitingIndex = computed(() => {
  if (!props.currentUserUid) return -1
  return waitingItems.value.findIndex((item) => item.user?.uid === props.currentUserUid)
})

function isMine(item: SongRequestInfo) {
  return Boolean(props.currentUserUid && item.user?.uid === props.currentUserUid)
}
</script>

<template>
  <div>
    <!-- 全模板通用紧凑队列状态条 -->
    <div
      data-site-surface="bar"
      class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-card/85 px-3 py-2 text-xs"
    >
      <div class="flex flex-wrap items-center gap-2 min-w-0">
        <span class="inline-flex items-center gap-1.5 font-medium text-foreground shrink-0">
          <ListMusic class="size-3.5 text-primary" />
          当前队列
        </span>

        <template v-if="singingItems.length > 0">
          <Badge
            variant="warning"
            size="xs"
            class="gap-1"
          >
            <Mic class="size-2.5" />
            演唱中
          </Badge>
          <span class="font-medium text-foreground truncate max-w-[200px] sm:max-w-[280px]">
            《{{ singingItems[0].songName }}》
          </span>
        </template>
        <span
          v-else-if="waitingItems.length === 0"
          class="text-muted-foreground"
        >
          当前暂无排队曲目
        </span>

        <Badge
          v-if="waitingItems.length > 0 || queueMaxSize > 0"
          :variant="isQueueFull ? 'destructive' : 'secondary'"
          size="xs"
          class="tabular-nums"
        >
          {{ queueMaxSize > 0 ? `队列 ${songsActive.length}/${queueMaxSize}${isQueueFull ? ' (已满)' : ''}` : `待唱 ${waitingItems.length} 首` }}
        </Badge>

        <Badge
          v-if="isOfflineBlocked"
          variant="outline"
          size="xs"
          class="text-muted-foreground"
        >
          未开播暂不接歌
        </Badge>

        <Badge
          v-if="myWaitingIndex >= 0"
          variant="brand"
          size="xs"
          class="tabular-nums"
        >
          我的排队第 {{ myWaitingIndex + 1 }} 位
        </Badge>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon-xs"
          :disabled="refreshing"
          aria-label="刷新队列"
          @click="emit('refresh')"
        >
          <RefreshCw
            class="size-3.5"
            :class="{ 'animate-spin': refreshing }"
          />
        </Button>
        <Button
          variant="outline"
          size="xs"
          class="gap-1"
          @click="open = true"
        >
          查看队列
          <ChevronRight class="size-3" />
        </Button>
      </div>
    </div>

    <!-- 右侧队列抽屉 -->
    <Sheet v-model:open="open">
      <SheetContent
        side="right"
        class="flex flex-col p-4 sm:max-w-md gap-3"
      >
        <SheetHeader class="space-y-1 pr-6">
          <div class="flex items-center justify-between gap-2">
            <SheetTitle class="text-sm flex items-center gap-1.5">
              <ListMusic class="size-4 text-primary" />
              当前点歌队列
            </SheetTitle>
            <Button
              variant="ghost"
              size="xs"
              class="gap-1"
              :disabled="refreshing"
              @click="emit('refresh')"
            >
              <RefreshCw
                class="size-3"
                :class="{ 'animate-spin': refreshing }"
              />
              刷新
            </Button>
          </div>
          <SheetDescription class="text-xs">
            共 {{ singingItems.length }} 首演唱中，{{ waitingItems.length }} 首排队等待
          </SheetDescription>
        </SheetHeader>

        <ScrollArea class="flex-1 min-w-0 -mx-1 px-1 [&_[data-reka-scroll-area-viewport]>div]:!block">
          <div class="space-y-4 pb-2">
            <!-- 正在演唱 -->
            <section
              v-if="singingItems.length > 0"
              class="space-y-2"
            >
              <h3 class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mic class="size-3.5 text-amber-500" />
                正在演唱
              </h3>
              <div
                v-for="item in singingItems"
                :key="item.id"
                class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold text-foreground truncate">{{ item.songName }}</span>
                  <Badge
                    variant="warning"
                    size="xs"
                  >
                    演唱中
                  </Badge>
                </div>
                <div class="text-[11px] text-muted-foreground truncate">
                  点歌人：{{ item.user?.name || item.requestBy || '匿名观众' }}
                </div>
              </div>
            </section>

            <!-- 等待列表 -->
            <section class="space-y-2">
              <h3 class="text-xs font-semibold text-foreground">
                等待列表 ({{ waitingItems.length }})
              </h3>

              <Empty
                v-if="waitingItems.length === 0"
                description="暂无排队曲目"
                class="py-8"
              />

              <div
                v-else
                class="space-y-1.5"
              >
                <div
                  v-for="(item, index) in waitingItems"
                  :key="item.id"
                  class="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card/80 px-3 py-2 min-w-0"
                  :class="{ 'border-primary/40 bg-primary/5': isMine(item) }"
                >
                  <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    <span class="w-5 text-center text-xs font-mono tabular-nums text-muted-foreground shrink-0">
                      {{ index + 1 }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5 min-w-0">
                        <span class="text-xs font-medium text-foreground truncate">{{ item.songName }}</span>
                        <Badge
                          v-if="item.from === SongRequestFrom.SC"
                          variant="warning"
                          size="xs"
                        >
                          SC{{ item.price ? ` ¥${item.price}` : '' }}
                        </Badge>
                        <Badge
                          v-if="item.isPinned || item.priorityLevel > 0"
                          variant="secondary"
                          size="xs"
                        >
                          插队
                        </Badge>
                        <Badge
                          v-if="isMine(item)"
                          variant="brand"
                          size="xs"
                        >
                          我
                        </Badge>
                      </div>
                      <div class="text-[11px] text-muted-foreground truncate">
                        {{ item.user?.name || item.requestBy || '匿名观众' }}
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="isMine(item)"
                    class="flex items-center gap-1 shrink-0"
                  >
                    <Button
                      v-if="allowPointPriority"
                      size="xs"
                      variant="outline"
                      class="gap-1"
                      :loading="prioritizingId === item.id"
                      :disabled="cancellingId === item.id"
                      @click="emit('priority', item)"
                    >
                      <ArrowUpCircle class="size-3" />
                      插队 ({{ priorityPointCost }})
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                      :loading="cancellingId === item.id"
                      :disabled="prioritizingId === item.id"
                      @click="emit('cancel', item)"
                    >
                      <Undo2 class="size-3" />
                      撤回
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  </div>
</template>
