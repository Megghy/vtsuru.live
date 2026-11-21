<script setup lang="ts">
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Ban,
  CheckCircle2,
  ExternalLink,
  GripVertical,
  Pencil,
  Pin,
  PinOff,
  Play,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-vue-next'
import type { VNodeChild } from 'vue'
import { computed, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import type { SongRequestInfo } from '@/api/client-types'
import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform, SongRequestStatus } from '@/api/generated/model'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import SongOptionBadges from '@/apps/user/pages/songListTemplate/components/SongOptionBadges.vue'
import SongBatchModal, { type BatchUpdateMode } from '@/components/song-list/SongBatchModal.vue'
import SongEditModal from '@/components/song-list/SongEditModal.vue'
import {
  type SongListOptionFilter,
  type SongListSortBy,
  type SongListStatusFilter,
  useSongList,
} from '@/components/song-list/useSongList'
import SongPlayer from '@/components/SongPlayer.vue'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Table, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { showUndoToast, toast } from '@/shared/utils'
import { getPlayableAudioUrl, getSongExternalLink } from '@/shared/utils/songMedia'

const props = defineProps<{
  songs: ResponseSongModel[]
  canEdit?: boolean
  isSelf: boolean
  extraButton?: (song: ResponseSongModel) => VNodeChild[]
  liveRequestActive?: SongRequestInfo[]
}>()

const emit = defineEmits<{
  'update:songs': [songs: ResponseSongModel[]]
}>()

const state = useSongList(props, (next) => emit('update:songs', next))
const {
  songsInternal,
  playingSong,
  isLrcLoading,
  searchKeyword,
  selectedLanguageFilter,
  selectedTagFilter,
  selectedAuthorFilter,
  selectedOptionFilter,
  selectedStatusFilter,
  sortBy,
  sortOrder,
  selectedKeys,
  currentPage,
  pageSize,
  stats,
  hasActiveFilter,
  canDragReorder,
  filteredSongs,
  languageOptions,
  tagOptions,
  authorOptions,
  updateSong,
  updateSongs,
  deleteSong,
  deleteBatch,
  batchUpdate,
  batchUpdatePin,
  batchUpdateDisabled,
  selectAllFiltered,
  clearSelection,
  resetFilters,
  applyPageReorder,
  nextPage,
  prevPage,
} = state

const singingKeySet = computed(() => {
  const set = new Set<string>()
  props.liveRequestActive?.forEach((item) => {
    if (item.status === SongRequestStatus.Singing && item.song?.key) set.add(item.song.key)
  })
  return set
})
const queuedKeySet = computed(() => {
  const set = new Set<string>()
  props.liveRequestActive?.forEach((item) => {
    if (item.status !== SongRequestStatus.Singing && item.song?.key) set.add(item.song.key)
  })
  return set
})

const showListenButton = usePersistedStorage('SongList.ShowListenButton', true)
const showLinkButton = usePersistedStorage('SongList.ShowLinkButton', true)

const editModalRef = ref<InstanceType<typeof SongEditModal>>()
const batchModalRef = ref<InstanceType<typeof SongBatchModal>>()

defineExpose({ nextPage, prevPage, currentPage })

const hasAudio = computed(() => songsInternal.value.some((s) => Boolean(getPlayableAudioUrl(s))))
const hasLinks = computed(() => songsInternal.value.some((s) => Boolean(getSongExternalLink(s))))

const pagedSongs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredSongs.value.slice(start, start + pageSize.value)
})

const draggablePagedSongs = computed({
  get: () => pagedSongs.value,
  set: (reordered: ResponseSongModel[]) => {
    void applyPageReorder(reordered.map((s) => s.key))
  },
})

const allCurrentPageSelected = computed(() => {
  if (!pagedSongs.value.length) return false
  return pagedSongs.value.every((s) => selectedKeys.value.includes(s.key))
})

function toggleSelectAll(checked: boolean) {
  if (checked) {
    const keysToAdd = pagedSongs.value.map((s) => s.key).filter((k) => !selectedKeys.value.includes(k))
    selectedKeys.value = [...selectedKeys.value, ...keysToAdd]
  } else {
    const pageKeys = new Set(pagedSongs.value.map((s) => s.key))
    selectedKeys.value = selectedKeys.value.filter((k) => !pageKeys.has(k))
  }
}

function toggleSelectRow(key: string, checked: boolean) {
  if (checked) {
    if (!selectedKeys.value.includes(key)) selectedKeys.value = [...selectedKeys.value, key]
  } else {
    selectedKeys.value = selectedKeys.value.filter((k) => k !== key)
  }
}

function toggleStatusPill(target: SongListStatusFilter) {
  selectedOptionFilter.value = 'all'
  selectedStatusFilter.value = selectedStatusFilter.value === target ? 'all' : target
}

function toggleOptionPill() {
  selectedStatusFilter.value = 'all'
  selectedOptionFilter.value = selectedOptionFilter.value === 'any' ? 'all' : 'any'
}

function platformLabel(from: SongPlatform): string | undefined {
  switch (from) {
    case SongPlatform.Netease:
      return '网易云'
    case SongPlatform.FiveSing:
      return '5sing'
    case SongPlatform.Kugou:
      return '酷狗'
    default:
      return undefined
  }
}

function formatLastRequested(ts?: number | null): string {
  if (!ts) return '暂无点播记录'
  return `最近点播: ${new Date(ts).toLocaleString('zh-CN')}`
}

async function handleEditSave(song: ResponseSongModel) {
  const ok = await updateSong(song)
  if (ok) editModalRef.value?.close()
  else if (editModalRef.value) editModalRef.value.loading = false
}

async function handleDeleteSong(song: ResponseSongModel) {
  const backup = JSON.parse(JSON.stringify(song)) as ResponseSongModel
  const ok = await deleteSong(song)
  if (!ok) return

  showUndoToast(`已删除《${backup.name}》`, async () => {
    const res = await addSongsToSongList([backup], backup.from)
    if (res.code !== 200 || !res.data?.length) {
      throw new Error(res.message || '恢复失败')
    }
    const restored = res.data as unknown as ResponseSongModel[]
    const next = [...songsInternal.value, ...restored]
    songsInternal.value = next
    emit('update:songs', next)
    toast.success(`已恢复《${backup.name}》`)
  })
}

async function handleBatchField(
  endpoint: string,
  field: 'author' | 'tags' | 'language',
  value: string[],
  mode: BatchUpdateMode,
  label: string,
) {
  if (mode === 'append') {
    const ids = new Set(selectedKeys.value)
    const updates = songsInternal.value
      .filter((s) => ids.has(s.key))
      .map((song) => ({ ...song, [field]: [...new Set([...((song[field] as string[]) || []), ...value])] }))
    await updateSongs(updates, label)
    return
  }
  if (mode === 'remove') {
    const ids = new Set(selectedKeys.value)
    const removeSet = new Set(value)
    const updates = songsInternal.value
      .filter((s) => ids.has(s.key))
      .map((song) => ({
        ...song,
        [field]: ((song[field] as string[]) || []).filter((item) => !removeSet.has(item)),
      }))
    await updateSongs(updates, label)
    return
  }
  await batchUpdate(endpoint, field, value, label)
}

async function handleBatchAuthor(value: string[], mode: BatchUpdateMode) {
  await handleBatchField('update-batch-author', 'author', value, mode, '作者')
}
async function handleBatchTag(value: string[], mode: BatchUpdateMode) {
  await handleBatchField('update-batch-tag', 'tags', value, mode, '标签')
}
async function handleBatchLanguage(value: string[], mode: BatchUpdateMode) {
  await handleBatchField('update-batch-language', 'language', value, mode, '语言')
}
async function handleBatchOption(value: ResponseSongModel['options'] | undefined) {
  await batchUpdate('update-batch-option', 'options', value ?? null, '点歌要求')
}
async function handleBatchDelete() {
  const ok = await deleteBatch()
  if (ok) batchModalRef.value?.close()
}
</script>

<template>
  <TooltipProvider>
    <div class="space-y-2.5">
      <!-- 曲库概览快捷筛选条 -->
      <div class="flex flex-wrap items-center gap-1.5 text-xs">
        <Button
          size="xs"
          :variant="selectedStatusFilter === 'all' && selectedOptionFilter === 'all' ? 'default' : 'outline'"
          class="tabular-nums"
          @click="((selectedStatusFilter = 'all'), (selectedOptionFilter = 'all'))"
        >
          全部 {{ stats.total }}
        </Button>
        <Button
          size="xs"
          :variant="selectedStatusFilter === 'pinned' ? 'default' : 'outline'"
          class="tabular-nums"
          @click="toggleStatusPill('pinned')"
        >
          置顶 {{ stats.pinned }}
        </Button>
        <Button
          size="xs"
          :variant="selectedStatusFilter === 'disabled' ? 'default' : 'outline'"
          class="tabular-nums"
          @click="toggleStatusPill('disabled')"
        >
          暂不接歌 {{ stats.disabled }}
        </Button>
        <Button
          size="xs"
          :variant="selectedOptionFilter === 'any' ? 'default' : 'outline'"
          class="tabular-nums"
          @click="toggleOptionPill"
        >
          有门槛 {{ stats.withOptions }}
        </Button>
        <Button
          size="xs"
          :variant="selectedStatusFilter === 'incomplete' ? 'default' : 'outline'"
          class="tabular-nums"
          @click="toggleStatusPill('incomplete')"
        >
          待完善 {{ stats.incomplete }}
        </Button>
      </div>

      <!-- 搜索与筛选工具栏 -->
      <Card>
        <CardContent class="p-3 flex flex-wrap items-center gap-2 text-xs">
          <div class="relative min-w-[180px] flex-1">
            <Search class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="searchKeyword"
              placeholder="搜索曲名 / 译名 / 歌手 / 标签 / 备注"
              class="pl-8 w-full"
            />
          </div>

          <Select
            :model-value="selectedAuthorFilter || 'all'"
            @update:model-value="selectedAuthorFilter = $event === 'all' ? null : String($event)"
          >
            <SelectTrigger class="min-w-[120px] w-[140px]">
              <SelectValue placeholder="筛选歌手" />
            </SelectTrigger>
            <SelectContent class="max-h-56">
              <SelectItem value="all">全部歌手</SelectItem>
              <SelectItem
                v-for="a in authorOptions"
                :key="a.value"
                :value="a.value"
              >
                {{ a.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            :model-value="selectedLanguageFilter[0] || 'all'"
            @update:model-value="selectedLanguageFilter = $event === 'all' ? [] : [String($event)]"
          >
            <SelectTrigger class="min-w-[104px] w-[116px]">
              <SelectValue placeholder="筛选语言" />
            </SelectTrigger>
            <SelectContent class="max-h-56">
              <SelectItem value="all">全部语言</SelectItem>
              <SelectItem
                v-for="l in languageOptions"
                :key="l.value"
                :value="l.value"
              >
                {{ l.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            v-if="tagOptions.length > 0"
            :model-value="selectedTagFilter[0] || 'all'"
            @update:model-value="selectedTagFilter = $event === 'all' ? [] : [String($event)]"
          >
            <SelectTrigger class="min-w-[104px] w-[124px]">
              <SelectValue placeholder="筛选标签" />
            </SelectTrigger>
            <SelectContent class="max-h-56">
              <SelectItem value="all">全部标签</SelectItem>
              <SelectItem
                v-for="t in tagOptions"
                :key="t.value"
                :value="t.value"
              >
                {{ t.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            :model-value="selectedOptionFilter"
            @update:model-value="selectedOptionFilter = $event as SongListOptionFilter"
          >
            <SelectTrigger class="min-w-[104px] w-[120px]">
              <SelectValue placeholder="门槛条件" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部门槛</SelectItem>
              <SelectItem value="free">无限制</SelectItem>
              <SelectItem value="any">有门槛</SelectItem>
              <SelectItem value="guard">大航海</SelectItem>
              <SelectItem value="sc">SC 要求</SelectItem>
              <SelectItem value="medal">粉丝牌</SelectItem>
            </SelectContent>
          </Select>

          <div class="flex items-center gap-1">
            <Select
              :model-value="sortBy"
              @update:model-value="sortBy = $event as SongListSortBy"
            >
              <SelectTrigger class="min-w-[104px] w-[116px]">
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">默认排序</SelectItem>
                <SelectItem value="name">按歌名</SelectItem>
                <SelectItem value="author">按歌手</SelectItem>
                <SelectItem value="popular">按被点次数</SelectItem>
                <SelectItem value="newest">按添加时间</SelectItem>
                <SelectItem value="updated">按更新时间</SelectItem>
              </SelectContent>
            </Select>
            <Button
              v-if="sortBy !== 'default'"
              variant="ghost"
              size="icon-sm"
              :title="sortOrder === 'asc' ? '升序' : '降序'"
              @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
            >
              <component
                :is="sortOrder === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow"
                class="size-3.5"
              />
            </Button>
          </div>

          <Button
            v-if="hasActiveFilter || sortBy !== 'default'"
            variant="ghost"
            size="xs"
            class="gap-1"
            @click="resetFilters"
          >
            <RotateCcw class="size-3" />
            重置
          </Button>

          <div class="flex items-center gap-3 ml-auto">
            <div
              v-if="hasAudio"
              class="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Switch
                id="songlist-show-listen"
                v-model:checked="showListenButton"
              />
              <label
                for="songlist-show-listen"
                class="cursor-pointer select-none"
              >
                试听
              </label>
            </div>
            <div
              v-if="hasLinks"
              class="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Switch
                id="songlist-show-link"
                v-model:checked="showLinkButton"
              />
              <label
                for="songlist-show-link"
                class="cursor-pointer select-none"
              >
                外链
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 内联批量操作条 -->
      <div
        v-if="isSelf && selectedKeys.length > 0"
        class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-xs"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-medium text-foreground tabular-nums">已选 {{ selectedKeys.length }} 首</span>
          <Button
            v-if="selectedKeys.length < filteredSongs.length"
            variant="outline"
            size="xs"
            @click="selectAllFiltered"
          >
            全选筛选结果 ({{ filteredSongs.length }})
          </Button>
          <Button
            variant="ghost"
            size="xs"
            @click="clearSelection"
          >
            取消选择
          </Button>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            @click="batchUpdatePin(true)"
          >
            置顶
          </Button>
          <Button
            variant="outline"
            size="xs"
            @click="batchUpdatePin(false)"
          >
            取消置顶
          </Button>
          <Button
            variant="outline"
            size="xs"
            @click="batchUpdateDisabled(true)"
          >
            暂不接歌
          </Button>
          <Button
            variant="outline"
            size="xs"
            @click="batchUpdateDisabled(false)"
          >
            恢复可点
          </Button>
          <Button
            variant="secondary"
            size="xs"
            @click="batchModalRef?.open()"
          >
            批量编辑
          </Button>
          <Popconfirm
            :title="`确认删除选中的 ${selectedKeys.length} 首歌曲？`"
            positive-text="删除"
            negative-text="取消"
            @positive-click="handleBatchDelete"
          >
            <template #trigger>
              <Button
                variant="destructive"
                size="xs"
              >
                批量删除
              </Button>
            </template>
            删除后不可撤销，确认删除？
          </Popconfirm>
        </div>
      </div>

      <div class="flex-between text-xs text-muted-foreground">
        <span class="tabular-nums">显示 {{ filteredSongs.length }} / {{ songsInternal.length }} 首</span>
        <span v-if="isSelf && !canDragReorder">筛选或排序模式下已暂停拖拽排序</span>
      </div>

      <!-- 播放器区域 -->
      <SongPlayer
        v-if="playingSong"
        v-model:is-lrc-loading="isLrcLoading"
        :song="playingSong"
        @close="playingSong = undefined"
      />

      <!-- 歌曲表格 -->
      <div class="border border-border/80 rounded-lg overflow-x-auto bg-card">
        <Table class="min-w-[820px]">
          <TableHeader>
            <TableRow class="hover:bg-transparent border-b border-border/80 bg-muted/40">
              <TableHead
                v-if="isSelf"
                class="w-14 px-2"
              >
                <div class="flex items-center gap-1.5">
                  <Checkbox
                    :checked="allCurrentPageSelected"
                    @update:checked="toggleSelectAll"
                  />
                </div>
              </TableHead>
              <TableHead class="min-w-[230px]">曲名</TableHead>
              <TableHead class="w-40">作者</TableHead>
              <TableHead class="w-24">语言</TableHead>
              <TableHead class="w-36">点歌要求</TableHead>
              <TableHead class="w-36">标签</TableHead>
              <TableHead class="w-20 text-right">热度</TableHead>
              <TableHead class="w-40 text-right pr-3">操作</TableHead>
            </TableRow>
          </TableHeader>

          <VueDraggable
            v-model="draggablePagedSongs"
            tag="tbody"
            handle=".song-drag-handle"
            draggable=".song-drag-row"
            :animation="150"
            :force-fallback="true"
            :fallback-on-body="true"
            :fallback-tolerance="4"
            ghost-class="opacity-40"
            fallback-class="opacity-95"
            :disabled="!canDragReorder"
            class="[&_tr:last-child]:border-0"
          >
            <TableRow
              v-for="row in draggablePagedSongs"
              :key="row.key"
              class="song-drag-row border-b border-border/60 hover:bg-muted/40 transition-colors even:bg-muted/[0.14]"
              :class="{ 'opacity-65': row.isDisabled }"
            >
              <TableCell
                v-if="isSelf"
                class="px-2"
              >
                <div class="flex items-center gap-1.5">
                  <span
                    class="song-drag-handle inline-flex-center w-5 h-7 -ml-1 rounded select-none touch-none transition-colors"
                    :class="
                      canDragReorder
                        ? 'cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted'
                        : 'cursor-not-allowed text-muted-foreground/30'
                    "
                    :title="canDragReorder ? '按住拖拽调整云端排序' : '仅在无筛选且默认排序下支持拖拽调序'"
                  >
                    <GripVertical class="size-3.5 pointer-events-none" />
                  </span>
                  <Checkbox
                    :checked="selectedKeys.includes(row.key)"
                    @update:checked="toggleSelectRow(row.key, $event)"
                  />
                </div>
              </TableCell>

              <!-- 曲名 -->
              <TableCell>
                <div class="flex items-center gap-2.5 min-w-0">
                  <img
                    v-if="row.cover"
                    :src="row.cover"
                    :alt="row.name"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    class="size-8 rounded object-cover border border-border/60 shrink-0"
                  />

                  <div class="flex flex-col min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <Pin
                        v-if="row.isPinned"
                        class="size-3 text-primary shrink-0"
                        aria-label="置顶"
                      />
                      <span class="font-medium text-xs text-foreground truncate max-w-[220px]">
                        {{ row.name }}
                      </span>
                      <Badge
                        v-if="row.isDisabled"
                        variant="secondary"
                        size="xs"
                      >
                        暂不接歌
                      </Badge>
                      <Badge
                        v-if="singingKeySet.has(row.key)"
                        variant="warning"
                        size="xs"
                      >
                        演唱中
                      </Badge>
                      <Badge
                        v-else-if="queuedKeySet.has(row.key)"
                        variant="success"
                        size="xs"
                      >
                        排队中
                      </Badge>
                      <Badge
                        v-if="platformLabel(row.from)"
                        variant="outline"
                        size="xs"
                      >
                        {{ platformLabel(row.from) }}
                      </Badge>
                    </div>

                    <div
                      v-if="row.translateName || row.description"
                      class="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0"
                    >
                      <span
                        v-if="row.translateName"
                        class="truncate max-w-[140px]"
                        :title="row.translateName"
                      >
                        {{ row.translateName }}
                      </span>
                      <span
                        v-if="row.translateName && row.description"
                        class="opacity-50"
                      >
                        ·
                      </span>
                      <Tooltip v-if="row.description">
                        <TooltipTrigger as-child>
                          <span class="truncate max-w-[180px] cursor-help">
                            {{ row.description }}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent class="max-w-xs">{{ row.description }}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </TableCell>

              <!-- 作者 -->
              <TableCell>
                <div
                  v-if="row.author?.length"
                  class="flex items-center gap-1 flex-wrap"
                >
                  <Button
                    v-for="a in row.author"
                    :key="a"
                    variant="ghost"
                    size="xs"
                    class="px-1.5 py-0.5 rounded text-[11px] font-normal"
                    :class="selectedAuthorFilter === a ? 'bg-primary/10 text-primary' : 'bg-muted/60'"
                    @click="selectedAuthorFilter = selectedAuthorFilter === a ? null : a"
                  >
                    {{ a }}
                  </Button>
                </div>
                <span
                  v-else
                  class="text-[11px] text-muted-foreground/35 select-none"
                >
                  -
                </span>
              </TableCell>

              <!-- 语言 -->
              <TableCell>
                <div
                  v-if="row.language?.length"
                  class="flex items-center gap-1 flex-wrap"
                >
                  <button
                    v-for="l in row.language"
                    :key="l"
                    type="button"
                    class="text-[11px] cursor-pointer transition-colors"
                    :class="
                      selectedLanguageFilter.includes(l)
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                    @click="selectedLanguageFilter = selectedLanguageFilter[0] === l ? [] : [l]"
                  >
                    {{ l }}
                  </button>
                </div>
                <span
                  v-else
                  class="text-[11px] text-muted-foreground/35 select-none"
                >
                  -
                </span>
              </TableCell>

              <!-- 要求 -->
              <TableCell>
                <SongOptionBadges
                  :options="row.options"
                  variant="guard"
                  size="tiny"
                />
                <span
                  v-if="
                    !row.options?.needJianzhang &&
                    !row.options?.needTidu &&
                    !row.options?.needZongdu &&
                    !(row.options?.scMinPrice ?? 0) &&
                    !(row.options?.fanMedalMinLevel ?? 0)
                  "
                  class="text-[11px] text-muted-foreground/35 select-none"
                >
                  -
                </span>
              </TableCell>

              <!-- 标签 -->
              <TableCell>
                <div
                  v-if="row.tags?.length"
                  class="flex items-center gap-1 flex-wrap"
                >
                  <button
                    v-for="t in row.tags"
                    :key="t"
                    type="button"
                    class="cursor-pointer"
                    @click="selectedTagFilter = selectedTagFilter[0] === t ? [] : [t]"
                  >
                    <Badge
                      :variant="selectedTagFilter.includes(t) ? 'default' : 'secondary'"
                      size="xs"
                    >
                      {{ t }}
                    </Badge>
                  </button>
                </div>
                <span
                  v-else
                  class="text-[11px] text-muted-foreground/35 select-none"
                >
                  -
                </span>
              </TableCell>

              <!-- 热度 -->
              <TableCell class="text-right tabular-nums text-[11px]">
                <Tooltip v-if="(row.requestCount ?? 0) > 0">
                  <TooltipTrigger as-child>
                    <span class="font-medium text-foreground cursor-default">{{ row.requestCount }} 次</span>
                  </TooltipTrigger>
                  <TooltipContent>{{ formatLastRequested(row.lastRequestedAt) }}</TooltipContent>
                </Tooltip>
                <span
                  v-else
                  class="text-muted-foreground/35 select-none"
                >
                  -
                </span>
              </TableCell>

              <!-- 操作 -->
              <TableCell class="text-right pr-3">
                <div class="flex items-center justify-end gap-0.5">
                  <Tooltip v-if="showListenButton && getPlayableAudioUrl(row)">
                    <TooltipTrigger as-child>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        class="text-primary hover:bg-primary/10"
                        :disabled="isLrcLoading === row.key"
                        aria-label="试听"
                        @click="playingSong = row"
                      >
                        <Play class="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>试听</TooltipContent>
                  </Tooltip>

                  <Tooltip v-if="showLinkButton && getSongExternalLink(row)">
                    <TooltipTrigger as-child>
                      <a
                        :href="getSongExternalLink(row)!.url"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          class="text-muted-foreground"
                          :aria-label="getSongExternalLink(row)!.label"
                        >
                          <ExternalLink class="size-3.5" />
                        </Button>
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>{{ getSongExternalLink(row)!.label }}</TooltipContent>
                  </Tooltip>

                  <template v-if="isSelf">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          :class="row.isPinned ? 'text-primary' : 'text-muted-foreground'"
                          :aria-label="row.isPinned ? '取消置顶' : '置顶'"
                          @click="batchUpdatePin(!row.isPinned, [row.key])"
                        >
                          <component
                            :is="row.isPinned ? PinOff : Pin"
                            class="size-3.5"
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{{ row.isPinned ? '取消置顶' : '置顶招牌' }}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          :class="row.isDisabled ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'"
                          :aria-label="row.isDisabled ? '恢复可点' : '暂不接歌'"
                          @click="batchUpdateDisabled(!row.isDisabled, [row.key])"
                        >
                          <component
                            :is="row.isDisabled ? CheckCircle2 : Ban"
                            class="size-3.5"
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{{ row.isDisabled ? '恢复可点歌' : '设为暂不接歌' }}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          class="text-muted-foreground"
                          aria-label="修改"
                          @click="editModalRef?.open(row)"
                        >
                          <Pencil class="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>修改</TooltipContent>
                    </Tooltip>

                    <Popconfirm
                      :title="`确认删除《${row.name}》？`"
                      positive-text="删除"
                      negative-text="取消"
                      @positive-click="handleDeleteSong(row)"
                    >
                      <template #trigger>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          class="text-destructive hover:bg-destructive/10"
                          aria-label="删除"
                        >
                          <Trash2 class="size-3.5" />
                        </Button>
                      </template>
                      确认删除《{{ row.name }}》？
                    </Popconfirm>
                  </template>
                </div>
              </TableCell>
            </TableRow>
          </VueDraggable>

          <tbody v-if="!pagedSongs.length">
            <TableEmpty
              :colspan="isSelf ? 8 : 7"
              description="暂无符合条件的歌曲"
            />
          </tbody>
        </Table>
      </div>

      <div
        v-if="filteredSongs.length > 0"
        class="pt-1"
      >
        <Pagination
          v-model:page="currentPage"
          v-model:page-size="pageSize"
          :total="filteredSongs.length"
          :page-sizes="[15, 25, 50, 100]"
          show-size-picker
        />
      </div>

      <SongEditModal
        ref="editModalRef"
        :language-options="languageOptions"
        :tag-options="tagOptions"
        :author-options="authorOptions"
        @save="handleEditSave"
      />
      <SongBatchModal
        ref="batchModalRef"
        :selected-count="selectedKeys.length"
        :language-options="languageOptions"
        :tag-options="tagOptions"
        :author-options="authorOptions"
        @delete="handleBatchDelete"
        @update-author="handleBatchAuthor"
        @update-tag="handleBatchTag"
        @update-language="handleBatchLanguage"
        @update-option="handleBatchOption"
        @update-pin="batchUpdatePin($event)"
        @update-disabled="batchUpdateDisabled($event)"
      />
    </div>
  </TooltipProvider>
</template>
