<script setup lang="ts">
import ArrowReset24Regular from '@vicons/fluent/es/ArrowReset24Regular'
import Checkmark12Regular from '@vicons/fluent/es/Checkmark12Regular'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Dismiss16Filled from '@vicons/fluent/es/Dismiss16Filled'
import Edit24Regular from '@vicons/fluent/es/Edit24Regular'
import Mic24Filled from '@vicons/fluent/es/Mic24Filled'
import Next24Filled from '@vicons/fluent/es/Next24Filled'
import PeopleQueue24Filled from '@vicons/fluent/es/PeopleQueue24Filled'
import Play24Filled from '@vicons/fluent/es/Play24Filled'
import Search24Regular from '@vicons/fluent/es/Search24Regular'
import { isSameDay } from 'date-fns'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { SaveSetting, useAccount } from '@/api/account'
import type { SongRequestInfo } from '@/api/client-types'
import { QueueSortType, type ResponseSongModel, SongRequestFrom, SongRequestStatus } from '@/api/generated/model'
import { getApiSongListGet } from '@/api/generated/song-list/song-list'
import LiveActiveFocusCard from '@/apps/open-live/components/shared/LiveActiveFocusCard.vue'
import UserBadges from '@/apps/open-live/components/UserBadges.vue'
import { useLiveRequest } from '@/composables/useLiveRequest'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { copyToClipboard } from '@/shared/utils'
import { formatListForCopy, normalizeTimestampMs } from '@/shared/utils/queue'

import SongRequestItem from './SongRequestItem.vue'

const songRequest = useLiveRequest()
const accountInfo = useAccount()

const isAddingManual = ref(false)
const selectionMode = ref(false)
const selectedIds = ref<number[]>([])
const showCancelAllDialog = ref(false)
const showBatchCancelDialog = ref(false)
const refundPointOnCancelAll = ref(false)
const refundPointOnBatchCancel = ref(false)

// 编辑点播歌名 / 绑定歌单曲目弹窗
const editingItem = ref<SongRequestInfo | null>(null)
const editSongName = ref('')
const editSelectedSongKey = ref<string | null>(null)
const editSongSearch = ref('')
const mySongsCache = ref<ResponseSongModel[]>([])
const isLoadingMySongs = ref(false)
const isSavingEdit = ref(false)

const filteredBindSongs = computed(() => {
  const kw = editSongSearch.value.trim().toLowerCase()
  const list = mySongsCache.value
  if (!kw) return list.slice(0, 30)
  return list
    .filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        s.translateName?.toLowerCase().includes(kw) ||
        s.author?.some((a) => a.toLowerCase().includes(kw)),
    )
    .slice(0, 30)
})

async function openEditDialog(item: SongRequestInfo) {
  editingItem.value = item
  editSongName.value = item.songName || ''
  editSelectedSongKey.value = item.song?.key ?? null
  editSongSearch.value = ''
  if (songRequest.configCanEdit && mySongsCache.value.length === 0) {
    isLoadingMySongs.value = true
    try {
      const res = await getApiSongListGet()
      if (res.code === 200 && res.data) {
        mySongsCache.value = res.data
      }
    } finally {
      isLoadingMySongs.value = false
    }
  }
}

function selectBindSong(song: ResponseSongModel) {
  editSelectedSongKey.value = song.key
  editSongName.value = song.name
}

async function saveEditItem() {
  if (!editingItem.value || isSavingEdit.value) return
  isSavingEdit.value = true
  try {
    const ok = await songRequest.updateRequestItem(editingItem.value, {
      songName: editSongName.value,
      songListKey: editSelectedSongKey.value,
      clearSongListKey: !editSelectedSongKey.value,
    })
    if (ok) {
      editingItem.value = null
    }
  } finally {
    isSavingEdit.value = false
  }
}

async function handleAddSongManual() {
  if (isAddingManual.value || !songRequest.newSongName.trim()) return
  isAddingManual.value = true
  try {
    await songRequest.addSongManual()
  } finally {
    isAddingManual.value = false
  }
}

const todayFinishedCount = computed(() => {
  return songRequest.songs.filter(
    (s) => s.status === SongRequestStatus.Finish && isSameDay(normalizeTimestampMs(s.finishAt), Date.now()),
  ).length
})

const singingSongs = computed(() => {
  return songRequest.activeSongs.filter((s) => s.status === SongRequestStatus.Singing)
})

const waitingSongs = computed(() => {
  return songRequest.activeSongs.filter((s) => s.status === SongRequestStatus.Waiting)
})

function previewSong(item: SongRequestInfo) {
  if (item.song?.url) {
    songRequest.selectedSong = item.song
  }
}

const hasRefundableActive = computed(() =>
  songRequest.unfilteredActiveSongs.some((s) => s.pointCost && s.pointCost > 0 && !s.pointRefunded),
)

const hasRefundableSelected = computed(() => {
  const idSet = new Set(selectedIds.value)
  return songRequest.unfilteredActiveSongs.some(
    (s) => idSet.has(s.id) && s.pointCost && s.pointCost > 0 && !s.pointRefunded,
  )
})

function canMoveWaitingUp(index: number) {
  if (songRequest.activeFilterKeyword.trim() || index <= 0 || index >= waitingSongs.value.length) return false
  return Boolean(waitingSongs.value[index].isPinned) === Boolean(waitingSongs.value[index - 1].isPinned)
}

function canMoveWaitingDown(index: number) {
  if (songRequest.activeFilterKeyword.trim() || index < 0 || index >= waitingSongs.value.length - 1) return false
  return Boolean(waitingSongs.value[index].isPinned) === Boolean(waitingSongs.value[index + 1].isPinned)
}

const currentIsReverse = computed(() =>
  songRequest.configCanEdit ? Boolean(accountInfo.value?.settings?.songRequest?.isReverse) : songRequest.isReverse,
)

const sortType = computed({
  get: () => accountInfo.value?.settings?.songRequest?.sortType ?? QueueSortType.TimeFirst,
  set: (value) => {
    const songRequestSettings = accountInfo.value?.settings?.songRequest
    if (!songRequestSettings) return
    songRequestSettings.sortType = value
  },
})

const sortOptions = [
  { label: '时间', value: QueueSortType.TimeFirst },
  { label: '付费', value: QueueSortType.PaymentFist },
  { label: '舰长', value: QueueSortType.GuardFirst },
  { label: '粉丝牌', value: QueueSortType.FansMedalFirst },
]

async function updateSettings(): Promise<boolean> {
  if (accountInfo.value?.id) {
    songRequest.isLoading = true
    try {
      await SaveSetting('SongRequest', accountInfo.value.settings.songRequest)
      toast.success('排序规则已保存')
      return true
    } catch (err) {
      toast.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`)
      return false
    } finally {
      songRequest.isLoading = false
    }
  } else {
    toast.success('排序已切换')
    return true
  }
}

async function handleSortTypeChange(val: unknown) {
  const settings = accountInfo.value?.settings?.songRequest
  if (!val || !settings || songRequest.isLoading) return
  const nextType = Number(val) as QueueSortType
  const prevType = settings.sortType
  if (prevType === nextType) return
  settings.sortType = nextType
  const ok = await updateSettings()
  if (!ok) {
    settings.sortType = prevType
  }
}

async function handleReverseChange(value: boolean) {
  if (songRequest.configCanEdit) {
    const settings = accountInfo.value?.settings?.songRequest
    if (!settings || songRequest.isLoading) return
    const prevReverse = settings.isReverse
    settings.isReverse = value
    const ok = await updateSettings()
    if (!ok) {
      settings.isReverse = prevReverse
    }
  } else {
    songRequest.isReverse = value
    toast.success('排序已切换')
  }
}

watch(
  () => songRequest.unfilteredActiveSongs.map((s) => s.id),
  (ids) => {
    if (selectedIds.value.length === 0) return
    const valid = new Set(ids)
    selectedIds.value = selectedIds.value.filter((id) => valid.has(id))
  },
)

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  selectedIds.value = []
}

function toggleSelect(id: number, checked: boolean) {
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id]
  } else {
    selectedIds.value = selectedIds.value.filter((item) => item !== id)
  }
}

function selectAllWaiting() {
  selectedIds.value = waitingSongs.value.map((s) => s.id)
}

async function handleBatchFinish() {
  const targetIds = selectedIds.value.filter((id) => songRequest.unfilteredActiveSongs.some((s) => s.id === id))
  if (targetIds.length === 0) return
  const ok = await songRequest.batchUpdateStatus(targetIds, SongRequestStatus.Finish)
  if (ok) {
    selectedIds.value = []
    selectionMode.value = false
  }
}

function openBatchCancelDialog() {
  if (selectedIds.value.length === 0) return
  refundPointOnBatchCancel.value = hasRefundableSelected.value
  showBatchCancelDialog.value = true
}

async function confirmBatchCancel() {
  const targetIds = [...selectedIds.value]
  const ok = await songRequest.batchUpdateStatus(
    targetIds,
    SongRequestStatus.Cancel,
    hasRefundableSelected.value && refundPointOnBatchCancel.value,
  )
  showBatchCancelDialog.value = false
  if (ok) {
    selectedIds.value = []
    selectionMode.value = false
  }
}

function openCancelAllDialog() {
  refundPointOnCancelAll.value = hasRefundableActive.value
  showCancelAllDialog.value = true
}

async function confirmCancelAll() {
  await songRequest.deactiveAllSongs(hasRefundableActive.value && refundPointOnCancelAll.value)
  showCancelAllDialog.value = false
  selectedIds.value = []
  selectionMode.value = false
}

async function copyWaitingQueue() {
  const list = songRequest.activeSongs
  if (list.length === 0) {
    toast.info('当前待唱列表为空')
    return
  }
  const text = formatListForCopy(
    list,
    (item) => item.songName || '未知歌曲',
    (item) => (item.user?.name ? item.user.name : '主播添加'),
  )
  await copyToClipboard(text, `已复制 ${list.length} 首待唱曲目清单`)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <Card>
      <CardContent class="p-3 space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <!-- 左侧统计指示 -->
          <div class="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              class="gap-1 border-sky-500/40 text-sky-600 bg-sky-500/10"
            >
              <PeopleQueue24Filled class="size-3.5" />
              待唱: {{ waitingSongs.length }}
            </Badge>
            <Badge
              variant="success"
              class="gap-1"
            >
              <Checkmark12Regular class="size-3.5" />
              今日已唱: {{ todayFinishedCount }}
            </Badge>
            <span class="text-xs text-muted-foreground"
              >当前队列 {{ songRequest.unfilteredActiveSongs.length }} 首</span
            >
            <Badge
              v-if="songRequest.hasCustomOrder"
              variant="secondary"
              size="xs"
            >
              已手动调序
            </Badge>
          </div>

          <!-- 右侧快捷操作 -->
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1.5 w-[210px]">
              <Input
                v-model="songRequest.newSongName"
                placeholder="手动输入歌名加入队列"
                class="flex-1"
                @keyup.enter="handleAddSongManual()"
              />
              <Button
                class="shrink-0"
                :loading="isAddingManual"
                :disabled="isAddingManual || !songRequest.newSongName.trim()"
                @click="handleAddSongManual()"
              >
                添加
              </Button>
            </div>

            <Button
              variant="outline"
              :disabled="songRequest.activeSongs.length === 0"
              @click="copyWaitingQueue"
            >
              <Copy24Regular class="size-3.5 mr-1" />
              复制歌单
            </Button>

            <Button
              :variant="selectionMode ? 'default' : 'outline'"
              :disabled="!selectionMode && songRequest.unfilteredActiveSongs.length === 0"
              @click="toggleSelectionMode"
            >
              {{ selectionMode ? '退出批量' : '批量管理' }}
            </Button>

            <Button
              variant="outline"
              class="border-destructive/40 text-destructive hover:bg-destructive/10"
              :disabled="songRequest.unfilteredActiveSongs.length === 0"
              @click="openCancelAllDialog"
            >
              全部取消
            </Button>
          </div>
        </div>

        <!-- 第二行：搜索 + 排序策略 -->
        <div class="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/60">
          <div class="relative w-[220px] max-w-full">
            <Search24Regular
              class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <Input
              v-model="songRequest.activeFilterKeyword"
              placeholder="搜索当前歌名或点播观众..."
              class="pl-7 pr-7"
            />
            <button
              v-if="songRequest.activeFilterKeyword"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="清空搜索"
              @click="songRequest.activeFilterKeyword = ''"
            >
              <Dismiss16Filled class="size-3" />
            </button>
          </div>

          <div class="flex items-center gap-2.5 flex-wrap">
            <ToggleGroup
              type="single"
              size="xs"
              :model-value="String(sortType)"
              :disabled="!songRequest.configCanEdit || songRequest.isLoading"
              @update:model-value="handleSortTypeChange"
            >
              <ToggleGroupItem
                v-for="opt in sortOptions"
                :key="opt.value"
                :value="String(opt.value)"
              >
                {{ opt.label }}
              </ToggleGroupItem>
            </ToggleGroup>

            <label class="flex items-center gap-1.5 cursor-pointer text-xs select-none">
              <Checkbox
                :checked="currentIsReverse"
                :disabled="songRequest.isLoading"
                @update:checked="handleReverseChange"
              />
              <span>倒序</span>
            </label>

            <Button
              v-if="songRequest.hasCustomOrder"
              size="xs"
              variant="outline"
              :disabled="songRequest.isLoading"
              @click="songRequest.resetOrder()"
            >
              <ArrowReset24Regular class="size-3.5 mr-1" />
              恢复规则排序
            </Button>
          </div>
        </div>

        <!-- 批量操作条 -->
        <div
          v-if="selectionMode"
          class="flex-between gap-2 flex-wrap rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs"
        >
          <div class="flex items-center gap-2">
            <span class="font-medium text-foreground">已选择 {{ selectedIds.length }} 项</span>
            <Button
              size="xs"
              variant="ghost"
              @click="selectAllWaiting"
            >
              全选待唱 ({{ waitingSongs.length }})
            </Button>
            <Button
              v-if="selectedIds.length > 0"
              size="xs"
              variant="ghost"
              @click="selectedIds = []"
            >
              清空选择
            </Button>
          </div>

          <div class="flex items-center gap-2">
            <Button
              size="xs"
              class="bg-emerald-600 hover:bg-emerald-700 text-white"
              :disabled="selectedIds.length === 0 || songRequest.isLoading"
              @click="handleBatchFinish"
            >
              批量标记已完成
            </Button>
            <Button
              size="xs"
              variant="outline"
              class="border-destructive/40 text-destructive hover:bg-destructive/10"
              :disabled="selectedIds.length === 0 || songRequest.isLoading"
              @click="openBatchCancelDialog"
            >
              批量取消
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 正在演唱焦点卡 -->
    <LiveActiveFocusCard
      v-for="item in singingSongs"
      :key="`singing-${item.id}`"
      badge-label="正在演唱"
      :badge-icon="Mic24Filled"
      :title="item.songName"
    >
      <template #meta>
        <Badge
          v-if="item.from === SongRequestFrom.Manual"
          variant="secondary"
          size="xs"
        >
          手动添加
        </Badge>
        <Badge
          v-else
          variant="outline"
          size="xs"
          class="border-sky-500/40 text-sky-600 bg-sky-500/10"
        >
          {{ item.user?.name || '未知用户' }}
        </Badge>
        <UserBadges
          v-if="item.from === SongRequestFrom.Danmaku || item.from === SongRequestFrom.SC"
          :user="item.user"
          size="tiny"
        />
        <Badge
          v-if="item.pointCost && item.pointCost > 0"
          variant="secondary"
          size="xs"
        >
          {{ item.pointCost }} 积分
        </Badge>
      </template>

      <template #actions>
        <Button
          size="xs"
          variant="ghost"
          :disabled="songRequest.isLoading || songRequest.isSongOperating(item.id)"
          @click="openEditDialog(item)"
        >
          <Edit24Regular class="size-3.5 mr-1" />
          编辑
        </Button>
        <Button
          v-if="item.song?.url"
          size="xs"
          variant="outline"
          :disabled="songRequest.isLrcLoading === item.song?.key"
          @click="previewSong(item)"
        >
          <Play24Filled class="size-3.5 mr-1" />
          试听
        </Button>
        <Button
          size="xs"
          variant="outline"
          :disabled="songRequest.isLoading || songRequest.isSongOperating(item.id)"
          @click="songRequest.updateSongStatus(item, SongRequestStatus.Waiting)"
        >
          暂停退回
        </Button>
        <Button
          v-if="waitingSongs.length > 0"
          size="xs"
          :disabled="songRequest.isLoading || songRequest.isSongOperating(item.id)"
          @click="songRequest.finishAndStartNext()"
        >
          <Next24Filled class="size-3.5 mr-1" />
          完成并唱下一首
        </Button>
        <Button
          size="xs"
          class="bg-emerald-600 hover:bg-emerald-700 text-white"
          :disabled="songRequest.isLoading || songRequest.isSongOperating(item.id)"
          @click="songRequest.updateSongStatus(item, SongRequestStatus.Finish)"
        >
          <Checkmark12Regular class="size-3.5 mr-1" />
          标记完成
        </Button>
      </template>
    </LiveActiveFocusCard>

    <div
      v-if="waitingSongs.length > 0"
      class="flex flex-col gap-2"
    >
      <SongRequestItem
        v-for="(item, index) in waitingSongs"
        :key="item.id"
        :song="item"
        :index="index + 1"
        :is-loading="songRequest.isLoading"
        :is-lrc-loading="songRequest.isLrcLoading"
        :can-move-up="canMoveWaitingUp(index)"
        :can-move-down="canMoveWaitingDown(index)"
        :selection-mode="selectionMode"
        :selected="selectedIds.includes(item.id)"
        @toggle-select="(checked) => toggleSelect(item.id, checked)"
        @edit="openEditDialog"
      />
    </div>
    <div
      v-else-if="singingSongs.length > 0"
      class="text-center py-6 text-xs text-muted-foreground border rounded-md bg-card"
    >
      当前暂无更多等待点播，演唱完成后可继续点歌
    </div>
    <Empty
      v-else
      :description="songRequest.activeFilterKeyword ? '没有匹配当前搜索词的待唱曲目' : '暂无点播歌曲'"
      class="py-12 border rounded-md bg-card"
    >
      <Button
        v-if="songRequest.activeFilterKeyword"
        variant="outline"
        @click="songRequest.activeFilterKeyword = ''"
      >
        清除筛选条件
      </Button>
    </Empty>

    <!-- 全部取消确认弹窗 -->
    <AlertDialog v-model:open="showCancelAllDialog">
      <AlertDialogContent class="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>取消全部当前点播？</AlertDialogTitle>
          <AlertDialogDescription class="text-xs">
            将把当前队列中的 {{ songRequest.unfilteredActiveSongs.length }} 首曲目统一设为「已取消」。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label
          v-if="hasRefundableActive"
          class="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-xs cursor-pointer select-none"
        >
          <Checkbox v-model:checked="refundPointOnCancelAll" />
          <span>同时退回队列中尚未退款的已消耗积分</span>
        </label>

        <AlertDialogFooter>
          <AlertDialogCancel>保留</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmCancelAll"
          >
            确认取消全部
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- 批量取消确认弹窗 -->
    <AlertDialog v-model:open="showBatchCancelDialog">
      <AlertDialogContent class="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>批量取消选中的点播？</AlertDialogTitle>
          <AlertDialogDescription class="text-xs">
            确定将选中的 {{ selectedIds.length }} 条点播记录标记为「已取消」吗？
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label
          v-if="hasRefundableSelected"
          class="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-xs cursor-pointer select-none"
        >
          <Checkbox v-model:checked="refundPointOnBatchCancel" />
          <span>同时退回选中记录中已消费的积分</span>
        </label>

        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmBatchCancel"
          >
            确认取消 ({{ selectedIds.length }})
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- 编辑点播歌名 / 绑定歌单弹窗 -->
    <Dialog
      :open="Boolean(editingItem)"
      @update:open="(val) => { if (!val) editingItem = null }"
    >
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑点播曲目</DialogTitle>
          <DialogDescription>修正观众打错的歌名，或关联到你的歌单曲目以支持试听与统计。</DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-1">
          <FormField label="显示歌名">
            <Input
              v-model="editSongName"
              placeholder="输入修正后的歌曲名称"
              @keyup.enter="saveEditItem"
            />
          </FormField>

          <FormField
            v-if="songRequest.configCanEdit"
            label="绑定我的歌单曲目（可选）"
          >
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <Input
                  v-model="editSongSearch"
                  placeholder="搜索我的歌单曲目或原唱..."
                  class="flex-1"
                />
                <Button
                  v-if="editSelectedSongKey"
                  variant="outline"
                  size="xs"
                  @click="editSelectedSongKey = null"
                >
                  取消绑定
                </Button>
              </div>
              <ScrollArea class="h-44 rounded-md border border-border/70 p-1.5">
                <div
                  v-if="isLoadingMySongs"
                  class="py-6 text-center text-xs text-muted-foreground"
                >
                  正在加载我的歌单...
                </div>
                <div
                  v-else-if="filteredBindSongs.length === 0"
                  class="py-6 text-center text-xs text-muted-foreground"
                >
                  没有匹配的歌单曲目
                </div>
                <div
                  v-else
                  class="space-y-1"
                >
                  <button
                    v-for="song in filteredBindSongs"
                    :key="song.key"
                    type="button"
                    class="w-full flex-between gap-2 px-2.5 py-1.5 rounded text-left text-xs transition-colors"
                    :class="
                      editSelectedSongKey === song.key
                        ? 'bg-primary/15 text-primary font-medium'
                        : 'hover:bg-muted/70 text-foreground'
                    "
                    @click="selectBindSong(song)"
                  >
                    <span class="truncate">{{ song.name }}</span>
                    <span class="text-[11px] text-muted-foreground truncate max-w-[140px]">
                      {{ song.author?.join(' / ') || '未知原唱' }}
                    </span>
                  </button>
                </div>
              </ScrollArea>
            </div>
          </FormField>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="editingItem = null"
          >
            取消
          </Button>
          <Button
            :loading="isSavingEdit"
            :disabled="!editSongName.trim()"
            @click="saveEditItem"
          >
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
