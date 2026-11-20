<script setup lang="ts">
import Timeline24Regular from '@vicons/fluent/es/Timeline24Regular'
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
import { ScrollArea } from '@/shared/ui/scroll-area'
import { useMusicRequestProvider } from '@/store/useMusicRequest'

const musicRequestStore = useMusicRequestProvider()
const showTimelineExport = ref(false)

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
      <CardContent class="p-3.5 flex-between flex-wrap gap-2">
        <span class="text-xs text-muted-foreground">
          本地记录最近 {{ musicRequestStore.history.length }} 条点歌流水 (最多保留 200 条)
        </span>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            class="gap-1"
            :disabled="musicTimelineEntries.length === 0"
            @click="showTimelineExport = true"
          >
            <Timeline24Regular class="size-4" />
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
          v-if="musicRequestStore.history.length > 0"
          class="h-[520px]"
        >
          <div
            class="hidden sm:grid grid-cols-[4.5rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_5rem] items-center gap-2 px-2.5 pb-2 text-xs text-muted-foreground border-b border-border"
          >
            <span>状态</span>
            <span>歌曲名称</span>
            <span>歌手</span>
            <span>点歌人</span>
            <span class="text-right">时间</span>
          </div>

          <div class="divide-y divide-border">
            <div
              v-for="(entry, index) in musicRequestStore.history"
              :key="`${entry.time}-${index}`"
              class="grid grid-cols-1 sm:grid-cols-[4.5rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_5rem] items-center gap-2 py-2 px-2.5 text-xs hover:bg-muted/40 rounded transition-colors"
            >
              <div>
                <Badge
                  :variant="entry.status === 'played' ? 'success' : 'destructive'"
                  size="xs"
                >
                  {{ entry.status === 'played' ? '已播' : '已取消' }}
                </Badge>
              </div>
              <span class="font-medium text-foreground truncate min-w-0">{{ entry.music.name }}</span>
              <span class="text-muted-foreground truncate min-w-0">{{ entry.music.author?.join('/') || '-' }}</span>
              <span class="text-foreground truncate min-w-0">{{ entry.from?.name || '主播' }}</span>
              <span class="font-mono tabular-nums text-muted-foreground sm:text-right">{{
                formatHistoryTime(entry.time)
              }}</span>
            </div>
          </div>
        </ScrollArea>
        <div
          v-else
          class="text-center py-12 text-xs text-muted-foreground"
        >
          暂无点歌历史记录
        </div>
      </CardContent>
    </Card>

    <SongTimelineExportDialog
      v-model:open="showTimelineExport"
      :entries="musicTimelineEntries"
      title="导出音乐点歌歌回时间轴"
    />
  </div>
</template>
