<script setup lang="ts">
import { Clock, ListPlus, Search, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import SongTimelineExportDialog from '@/components/song/SongTimelineExportDialog.vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useMusicRequestProvider } from '@/store/useMusicRequest'

const musicRequestStore = useMusicRequestProvider()
const showTimelineExport = ref(false)
const keyword = ref('')
const statusFilter = ref<'all' | 'played' | 'cancelled'>('all')

const filteredHistory = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return musicRequestStore.history.filter((entry) => {
    if (statusFilter.value !== 'all' && entry.status !== statusFilter.value) {
      return false
    }
    if (!kw) return true
    return (
      entry.music.name.toLowerCase().includes(kw) ||
      entry.from?.name?.toLowerCase().includes(kw) ||
      entry.music.author?.some((a) => a.toLowerCase().includes(kw))
    )
  })
})

const musicTimelineEntries = computed(() =>
  musicRequestStore.history
    .filter((entry) => entry.status === 'played')
    .map((entry) => ({
      title: entry.music.name,
      artist: entry.music.author?.join('/'),
      requester: entry.from?.name,
      timeMs: entry.time,
    })),
)

function formatHistoryTime(timestamp: number) {
  const d = new Date(timestamp)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="space-y-3">
    <Card>
      <CardContent class="p-3.5 flex-between flex-wrap gap-2.5">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-muted-foreground tabular-nums">
            共 {{ musicRequestStore.history.length }} 条本地流水 (最多保留 200 条)
          </span>
          <ToggleGroup
            v-model="statusFilter"
            type="single"
            size="xs"
          >
            <ToggleGroupItem value="all">全部</ToggleGroupItem>
            <ToggleGroupItem value="played">已播</ToggleGroupItem>
            <ToggleGroupItem value="cancelled">已取消</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <div class="relative w-48 max-w-full">
            <Search
              class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
            />
            <Input
              v-model="keyword"
              placeholder="搜索歌名、歌手或点歌人"
              class="pl-8 pr-7"
            />
            <Button
              v-if="keyword"
              size="none"
              variant="ghost"
              class="absolute right-1.5 top-1/2 -translate-y-1/2 size-5 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="清空搜索"
              @click="keyword = ''"
            >
              <X class="size-3" />
            </Button>
          </div>

          <Button
            variant="outline"
            :disabled="musicTimelineEntries.length === 0"
            @click="showTimelineExport = true"
          >
            <Clock class="size-3.5 mr-1" />
            导出时间轴
          </Button>

          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button
                variant="ghost"
                class="text-destructive hover:bg-destructive/10"
                :disabled="musicRequestStore.history.length === 0"
              >
                清空历史
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent class="sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>清空点歌历史？</AlertDialogTitle>
                <AlertDialogDescription>此操作将抹去本地点歌历史流水。</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  @click="musicRequestStore.clearHistory"
                >
                  确认清空
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-3">
        <ScrollArea
          v-if="filteredHistory.length > 0"
          class="h-[520px] [&_[data-reka-scroll-area-viewport]>div]:!block"
        >
          <div
            class="hidden sm:grid grid-cols-[4rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_4.75rem_2.25rem] items-center gap-2 px-2.5 pb-2 text-xs text-muted-foreground border-b border-border"
          >
            <span>状态</span>
            <span>歌曲名称</span>
            <span>歌手</span>
            <span>点歌人</span>
            <span class="text-right">时间</span>
            <span class="text-right">操作</span>
          </div>

          <TooltipProvider :delay-duration="250">
            <div class="divide-y divide-border">
              <div
                v-for="(entry, index) in filteredHistory"
                :key="`${entry.time}-${index}`"
                class="flex items-center justify-between gap-2 sm:grid sm:grid-cols-[4rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_4.75rem_2.25rem] sm:gap-2 py-2 px-2.5 text-xs hover:bg-muted/40 rounded transition-colors"
              >
                <div class="hidden sm:block">
                  <Badge
                    :variant="entry.status === 'played' ? 'success' : 'destructive'"
                    size="xs"
                  >
                    {{ entry.status === 'played' ? '已播' : '已取消' }}
                  </Badge>
                </div>

                <!-- 窄屏双行结构 / 桌面多列结构 -->
                <div class="min-w-0 flex-1 sm:contents">
                  <div class="flex items-center gap-1.5 min-w-0 sm:block">
                    <Badge
                      :variant="entry.status === 'played' ? 'success' : 'destructive'"
                      size="xs"
                      class="sm:hidden shrink-0"
                    >
                      {{ entry.status === 'played' ? '已播' : '已取消' }}
                    </Badge>
                    <span class="font-medium text-foreground truncate block min-w-0">{{ entry.music.name }}</span>
                  </div>
                  <div class="text-[11px] sm:text-xs text-muted-foreground truncate min-w-0">
                    <span>{{ entry.music.author?.join('/') || '-' }}</span>
                    <span class="sm:hidden"> · {{ entry.from?.name || '主播' }} · {{ formatHistoryTime(entry.time) }}</span>
                  </div>
                </div>

                <span class="hidden sm:block text-foreground truncate min-w-0">{{ entry.from?.name || '主播' }}</span>
                <span class="hidden sm:block font-mono tabular-nums text-muted-foreground text-right">
                  {{ formatHistoryTime(entry.time) }}
                </span>

                <div class="flex justify-end shrink-0">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label="重新加入待播"
                        @click="musicRequestStore.requeueFromHistory(entry)"
                      >
                        <ListPlus class="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>重新加入待播队列</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </TooltipProvider>
        </ScrollArea>

        <Empty
          v-else
          :description="keyword || statusFilter !== 'all' ? '没有符合筛选条件的历史记录' : '暂无点歌历史记录'"
          class="py-10"
        />
      </CardContent>
    </Card>

    <SongTimelineExportDialog
      v-model:open="showTimelineExport"
      :entries="musicTimelineEntries"
      title="导出点歌机歌回时间轴"
    />
  </div>
</template>
