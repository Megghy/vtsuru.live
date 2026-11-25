<script setup lang="ts">
import { Ban, Disc3, Play, Plus, Search, SkipForward, Timer, X } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import MusicRequestItem from '@/apps/open-live/components/request/MusicRequestItem.vue'
import LiveActiveFocusCard from '@/apps/open-live/components/shared/LiveActiveFocusCard.vue'
import LiveConsoleCockpit from '@/apps/open-live/components/shared/LiveConsoleCockpit.vue'
import LiveSideCard from '@/apps/open-live/components/shared/LiveSideCard.vue'
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
import { Separator } from '@/shared/ui/separator'
import { useMessage } from '@/shared/utils'
import { useMusicRequestProvider, type WaitMusicInfo } from '@/store/useMusicRequest'

import { useActiveMusicCooldowns } from './useActiveMusicCooldowns'

const message = useMessage()
const accountInfo = useAccount()
const musicRequestStore = useMusicRequestProvider()

const waitingFilter = ref('')
const isFiltered = computed(() => waitingFilter.value.trim().length > 0)
const filteredWaiting = computed(() => {
  const kw = waitingFilter.value.trim().toLowerCase()
  return musicRequestStore.waitingMusics
    .map((info, originalIndex) => ({ info, originalIndex }))
    .filter(({ info }) => {
      if (!kw) return true
      return (
        info.music.name.toLowerCase().includes(kw) ||
        info.from?.name?.toLowerCase().includes(kw) ||
        info.music.author?.some((a) => a.toLowerCase().includes(kw))
      )
    })
})

const activeCooldowns = useActiveMusicCooldowns()

// 拖拽排序状态
const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onRowDragStart(index: number, event: DragEvent) {
  if (isFiltered.value) return
  dragFromIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onRowDragOver(index: number, event: DragEvent) {
  if (isFiltered.value || dragFromIndex.value === null) return
  event.preventDefault()
  dragOverIndex.value = index
}

function onRowDrop(index: number, event: DragEvent) {
  event.preventDefault()
  if (!isFiltered.value && dragFromIndex.value !== null && dragFromIndex.value !== index) {
    musicRequestStore.reorderWaiting(dragFromIndex.value, index)
  }
  dragFromIndex.value = null
  dragOverIndex.value = null
}

function onRowDragEnd() {
  dragFromIndex.value = null
  dragOverIndex.value = null
}

// 快捷搜歌切播（多候选）
const quickSearchKeyword = ref('')
const quickPlatform = ref<'netease' | 'kugou'>(musicRequestStore.settings.platform || 'netease')
const quickCandidates = ref<ResponseSongModel[]>([])
const hasSearchedQuick = ref(false)

watch(
  () => musicRequestStore.settings.platform,
  (val) => {
    if (val) quickPlatform.value = val
  },
)

async function handleQuickSearch() {
  const kw = quickSearchKeyword.value.trim()
  if (!kw) {
    message.warning('请输入要搜索的歌名或歌手')
    return
  }
  quickCandidates.value = []
  hasSearchedQuick.value = true
  const list = await musicRequestStore.searchOnlineCandidates(kw, quickPlatform.value, 8)
  if (list.length === 0) {
    message.warning(`在${quickPlatform.value === 'netease' ? '网易云' : '酷狗'}未搜到可播曲目「${kw}」`)
    return
  }
  quickCandidates.value = list
}

function clearQuickSearch() {
  quickSearchKeyword.value = ''
  quickCandidates.value = []
  hasSearchedQuick.value = false
}

function enqueueQuickSong(song: ResponseSongModel, playNow: boolean) {
  const info: WaitMusicInfo = {
    from: {
      name: accountInfo.value?.name || '主播',
      uid: accountInfo.value?.biliId ?? 0,
      oid: '',
      guard_level: 0,
      fans_medal_level: 0,
      fans_medal_name: '',
      fans_medal_wearing_status: false,
      face: '',
    },
    music: song,
  }
  if (playNow) {
    musicRequestStore.playWaitingItemNow(info)
  } else {
    musicRequestStore.addWaitingMusic(info, { queueOnly: true })
  }
}
</script>

<template>
  <LiveConsoleCockpit>
    <template #main>
      <LiveActiveFocusCard
        v-if="musicRequestStore.currentOriginMusic && musicRequestStore.isPlayingOrderMusic"
        badge-label="正在播放点歌"
        :badge-icon="Disc3"
        :title="musicRequestStore.currentOriginMusic.music.name"
        :subtitle="musicRequestStore.currentOriginMusic.music.author?.join('/')"
      >
        <template #meta>
          <Badge
            variant="brand"
            size="xs"
          >
            点歌人: {{ musicRequestStore.currentOriginMusic.from?.name || '观众' }}
          </Badge>
        </template>

        <template #actions>
          <div class="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="ghost"
              class="text-destructive hover:bg-destructive/10"
              @click="musicRequestStore.blockCurrentSongAndSkip()"
            >
              <Ban class="size-3.5 mr-1" />
              拉黑并切歌
            </Button>
            <Button
              size="xs"
              variant="outline"
              @click="musicRequestStore.nextMusic()"
            >
              <SkipForward class="size-3.5 mr-1" />
              切下一首
            </Button>
          </div>
        </template>
      </LiveActiveFocusCard>

      <Card>
        <CardContent class="p-3.5 space-y-3">
          <div class="flex-between gap-2.5 flex-wrap">
            <div class="flex items-center gap-2 flex-wrap">
              <Badge variant="brand">待播歌曲: {{ musicRequestStore.waitingMusics.length }} 首</Badge>
              <Badge
                v-if="!musicRequestStore.settings.enabled"
                variant="secondary"
              >
                弹幕接单已暂停
              </Badge>
              <Badge
                v-if="activeCooldowns.length > 0"
                variant="warning"
              >
                冷却中观众: {{ activeCooldowns.length }} 人
              </Badge>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <Button
                v-if="!musicRequestStore.isPlaying && musicRequestStore.originMusics.length > 0"
                size="xs"
                variant="outline"
                @click="musicRequestStore.startPlayback()"
              >
                <Play class="size-3.5 mr-1" />
                开始播放曲库
              </Button>

              <div class="relative w-52 max-w-full">
                <Search
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                />
                <Input
                  v-model="waitingFilter"
                  placeholder="搜索待播歌名或点歌人"
                  class="pl-8 pr-7"
                />
                <Button
                  v-if="waitingFilter"
                  size="none"
                  variant="ghost"
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 size-5 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label="清空搜索"
                  @click="waitingFilter = ''"
                >
                  <X class="size-3" />
                </Button>
              </div>

              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button
                    variant="ghost"
                    class="text-destructive hover:bg-destructive/10"
                    :disabled="musicRequestStore.waitingMusics.length === 0"
                  >
                    清空待播
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent class="sm:max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>清空全部待播点歌？</AlertDialogTitle>
                    <AlertDialogDescription>
                      将清空当前队列中的 {{ musicRequestStore.waitingMusics.length }} 首待播点歌（清空后可通过底部提示撤销）。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      @click="musicRequestStore.clearWaitingWithUndo()"
                    >
                      确认清空
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <Separator />

          <div
            v-if="filteredWaiting.length > 0"
            class="space-y-2"
          >
            <div
              v-for="{ info, originalIndex } in filteredWaiting"
              :key="info.requestId || `${info.music.id}-${info.from?.name || ''}-${originalIndex}`"
              :draggable="!isFiltered"
              @dragstart="onRowDragStart(originalIndex, $event)"
              @dragover="onRowDragOver(originalIndex, $event)"
              @drop="onRowDrop(originalIndex, $event)"
              @dragend="onRowDragEnd"
            >
              <MusicRequestItem
                :music="info.music"
                :from-name="info.from?.name || ''"
                :index="originalIndex + 1"
                :is-pinned="Boolean(info.isPinned)"
                :can-block-user="Boolean(info.from?.uid || info.from?.oid)"
                :can-move-up="!isFiltered && musicRequestStore.canMoveWaiting(originalIndex, 'up')"
                :can-move-down="!isFiltered && musicRequestStore.canMoveWaiting(originalIndex, 'down')"
                :draggable="!isFiltered"
                :is-dragging="dragFromIndex === originalIndex"
                :is-drag-over="dragOverIndex === originalIndex && dragFromIndex !== originalIndex"
                @play="musicRequestStore.playWaitingItemNow(info)"
                @cancel="musicRequestStore.cancelWaiting(info)"
                @block-song="musicRequestStore.blockSongKeyword(info)"
                @block-user="musicRequestStore.blockUser(info)"
                @pin="musicRequestStore.pinWaiting(originalIndex)"
                @move-up="musicRequestStore.moveWaiting(originalIndex, 'up')"
                @move-down="musicRequestStore.moveWaiting(originalIndex, 'down')"
              />
            </div>
          </div>

          <Empty
            v-else
            :description="waitingFilter ? '没有匹配的待播歌曲' : '当前暂无观众点歌，等待弹幕发送中...'"
            class="py-10"
          >
            <template
              v-if="!waitingFilter && !musicRequestStore.isPlaying && musicRequestStore.originMusics.length > 0"
              #extra
            >
              <Button
                variant="outline"
                @click="musicRequestStore.startPlayback()"
              >
                <Play class="size-3.5 mr-1" />
                播放闲置曲库 ({{ musicRequestStore.originMusics.length }} 首)
              </Button>
            </template>
          </Empty>
        </CardContent>
      </Card>
    </template>

    <template #aside>
      <LiveSideCard title="在线搜歌快捷切播">
        <template #header-action>
          <Button
            size="xs"
            variant="outline"
            @click="quickPlatform = quickPlatform === 'netease' ? 'kugou' : 'netease'"
          >
            {{ quickPlatform === 'netease' ? '网易云' : '酷狗' }}
          </Button>
        </template>

        <div class="space-y-2.5">
          <div class="flex items-center gap-2">
            <Input
              v-model="quickSearchKeyword"
              placeholder="输入歌名或歌手..."
              class="flex-1 min-w-0"
              @keyup.enter="handleQuickSearch"
            />
            <Button
              :loading="musicRequestStore.isSearchingSong"
              @click="handleQuickSearch"
            >
              <Search class="size-3.5 mr-1" />
              搜歌
            </Button>
          </div>

          <div
            v-if="quickCandidates.length > 0"
            class="space-y-1.5"
          >
            <div class="flex-between text-[11px] text-muted-foreground">
              <span>找到 {{ quickCandidates.length }} 首可播候选</span>
              <Button
                size="none"
                variant="ghost"
                class="h-5 px-1.5 text-[11px]"
                @click="clearQuickSearch"
              >
                收起
              </Button>
            </div>

            <ScrollArea class="max-h-72 [&_[data-reka-scroll-area-viewport]>div]:!block">
              <div class="space-y-1.5 pr-1">
                <div
                  v-for="(song, idx) in quickCandidates"
                  :key="song.key || `${song.from}-${song.id}-${idx}`"
                  class="rounded-md border border-border bg-muted/20 hover:bg-muted/40 p-2 space-y-1.5 transition-colors text-xs"
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <Badge
                      :variant="song.from === SongPlatform.Netease ? 'destructive' : 'outline'"
                      size="xs"
                      class="shrink-0"
                    >
                      {{ song.from === SongPlatform.Netease ? '网易云' : '酷狗' }}
                    </Badge>
                    <span
                      class="font-medium text-foreground truncate"
                      :title="song.name"
                    >
                      {{ song.name }}
                    </span>
                  </div>
                  <div class="flex-between gap-2">
                    <span class="text-[11px] text-muted-foreground truncate">
                      {{ song.author?.join('/') || '未知歌手' }}
                    </span>
                    <div class="flex items-center gap-1 shrink-0">
                      <Button
                        size="xs"
                        variant="outline"
                        @click="enqueueQuickSong(song, false)"
                      >
                        <Plus class="size-3 mr-0.5" />
                        待播
                      </Button>
                      <Button
                        size="xs"
                        @click="enqueueQuickSong(song, true)"
                      >
                        <Play class="size-3 mr-0.5" />
                        切播
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
          <p
            v-else-if="hasSearchedQuick && !musicRequestStore.isSearchingSong"
            class="text-[11px] text-muted-foreground text-center py-2 mb-0"
          >
            未找到可播放结果，可切换平台重试
          </p>
        </div>
      </LiveSideCard>

      <LiveSideCard
        title="点歌冷却监控"
        :icon="Timer"
        icon-class="text-amber-500"
        :badge="activeCooldowns.length > 0 ? activeCooldowns.length : null"
        badge-variant="warning"
      >
        <template
          v-if="activeCooldowns.length > 0"
          #header-action
        >
          <Button
            size="xs"
            variant="ghost"
            class="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            @click="musicRequestStore.clearAllCooldowns()"
          >
            解除全部
          </Button>
        </template>

        <div
          v-if="activeCooldowns.length > 0"
          class="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto scrollbar-thin"
        >
          <Badge
            v-for="cd in activeCooldowns"
            :key="cd.userKey"
            variant="warning"
            class="gap-1 pr-1"
          >
            <span class="tabular-nums">{{ cd.name }} (剩 {{ cd.remain }}s)</span>
            <Button
              size="none"
              variant="ghost"
              class="size-4 rounded-full hover:bg-foreground/10"
              aria-label="解除该观众冷却"
              @click="musicRequestStore.clearCooldown(cd.userKey)"
            >
              <X class="size-2.5" />
            </Button>
          </Badge>
        </div>
        <Empty
          v-else
          size="small"
          description="当前暂无观众处于点歌冷却期"
          class="py-3"
        />
      </LiveSideCard>
    </template>
  </LiveConsoleCockpit>
</template>
