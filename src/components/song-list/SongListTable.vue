<script setup lang="ts">
import { ArrowDown24Filled, ArrowUp24Filled, Delete24Filled, NotepadEdit20Filled, Play24Filled } from '@vicons/fluent'
import type { VNodeChild } from 'vue'
import { computed, ref } from 'vue'

import type { SongRequestInfo } from '@/api/client-types'
import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform, SongRequestStatus } from '@/api/generated/model'
import SongBatchModal from '@/components/song-list/SongBatchModal.vue'
import SongEditModal from '@/components/song-list/SongEditModal.vue'
import { useSongList } from '@/components/song-list/useSongList'
import SongPlayer from '@/components/SongPlayer.vue'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { GetPlayButton } from '@/shared/utils'

const props = defineProps<{
  songs: ResponseSongModel[]
  canEdit?: boolean
  isSelf: boolean
  extraButton?: (song: ResponseSongModel) => VNodeChild[]
  liveRequestActive?: SongRequestInfo[]
}>()

const state = useSongList(props)
const {
  songsInternal,
  isLoading,
  playingSong,
  isLrcLoading,
  searchKeyword,
  selectedLanguageFilter,
  selectedTagFilter,
  selectedAuthorFilter,
  selectedKeys,
  currentPage,
  pageSize,
  filteredSongs,
  languageOptions,
  tagOptions,
  authorOptions,
  updateSong,
  updateSongs,
  deleteSong,
  deleteBatch,
  batchUpdate,
  moveSong,
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

const volume = usePersistedStorage('Settings.AplayerVolume', 0.8)
const showListenButton = usePersistedStorage('SongList.ShowListenButton', true)
const showLinkButton = usePersistedStorage('SongList.ShowLinkButton', true)

const editModalRef = ref<InstanceType<typeof SongEditModal>>()
const batchModalRef = ref<InstanceType<typeof SongBatchModal>>()

defineExpose({ nextPage, prevPage, currentPage })

const hasAudio = computed(() => songsInternal.value.some((s) => s.url && /\.(?:mp3|flac|ogg|wav|m4a)$/i.test(s.url)))
const hasLinks = computed(() =>
  songsInternal.value.some(
    (s) => s.url || [SongPlatform.Netease, SongPlatform.FiveSing, SongPlatform.Kugou].includes(s.from),
  ),
)

function getSCColor(price: number): string {
  if (price < 50) return '#2a60b2'
  if (price < 100) return '#427d9e'
  if (price < 500) return '#c99801'
  if (price < 1000) return '#e09443'
  if (price < 2000) return '#e54d4d'
  return '#ab1a32'
}

function getGuardColor(level: number): string {
  return level === 1 ? 'rgb(122, 4, 35)' : level === 2 ? 'rgb(157, 155, 255)' : 'rgb(104, 136, 241)'
}

function hasSongOptions(options?: ResponseSongModel['options']): boolean {
  if (!options) return false
  return !!(
    options.needJianzhang ||
    options.needTidu ||
    options.needZongdu ||
    options.scMinPrice ||
    options.fanMedalMinLevel
  )
}

const totalPages = computed(() => Math.max(1, Math.ceil(filteredSongs.value.length / pageSize.value)))
const pagedSongs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredSongs.value.slice(start, start + pageSize.value)
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

async function handleEditSave(song: ResponseSongModel) {
  const ok = await updateSong(song)
  if (ok) editModalRef.value?.close()
  else if (editModalRef.value) editModalRef.value.loading = false
}

async function handleBatchField(
  endpoint: string,
  field: keyof ResponseSongModel,
  value: string[],
  mode: 'replace' | 'append',
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
  await batchUpdate(endpoint, field, value, label)
}

async function handleBatchAuthor(value: string[], mode: 'replace' | 'append') {
  await handleBatchField('update-batch-author', 'author', value, mode, '作者')
}
async function handleBatchTag(value: string[], mode: 'replace' | 'append') {
  await handleBatchField('update-batch-tag', 'tags', value, mode, '标签')
}
async function handleBatchLanguage(value: string[], mode: 'replace' | 'append') {
  await handleBatchField('update-batch-language', 'language', value, mode, '语言')
}
async function handleBatchOption(value: any) {
  await batchUpdate('update-batch-option', 'options', value ?? null, '点歌要求')
}
async function handleBatchDelete() {
  const ok = await deleteBatch()
  if (ok) batchModalRef.value?.close()
}
</script>

<template>
  <TooltipProvider>
    <Card class="border border-border/80 mb-2.5">
      <CardContent class="p-3 flex flex-wrap items-center gap-2 text-xs">
        <Input
          v-model="searchKeyword"
          placeholder="搜索曲名/译名"
          class="min-w-[150px] flex-1"
        />

        <Select
          :model-value="selectedAuthorFilter || 'all'"
          @update:model-value="selectedAuthorFilter = $event === 'all' ? null : String($event)"
        >
          <SelectTrigger class="min-w-[140px] flex-1">
            <SelectValue placeholder="筛选歌手" />
          </SelectTrigger>
          <SelectContent class="max-h-56">
            <SelectItem
              value="all"
              class="text-xs"
              >全部歌手</SelectItem
            >
            <SelectItem
              v-for="a in authorOptions"
              :key="a.value"
              :value="a.value"
              class="text-xs"
            >
              {{ a.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <div class="flex items-center gap-3 ml-auto">
          <template v-if="hasAudio">
            <label class="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground select-none">
              <Switch v-model:checked="showListenButton" />
              <span>试听</span>
            </label>
          </template>
          <template v-if="hasLinks">
            <label class="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground select-none">
              <Switch v-model:checked="showLinkButton" />
              <span>链接</span>
            </label>
          </template>
        </div>
      </CardContent>
    </Card>

    <div class="flex items-center justify-between mb-2 text-xs">
      <span class="text-muted-foreground">共 {{ filteredSongs.length }} / {{ songsInternal.length }} 首</span>
      <Button
        v-if="isSelf"
        variant="outline"
        size="xs"
        class="border-primary text-primary"
        :disabled="selectedKeys.length === 0"
        @click="batchModalRef?.open()"
      >
        批量操作 ({{ selectedKeys.length }})
      </Button>
    </div>

    <!-- 播放器区域 -->
    <div
      v-if="playingSong"
      class="mb-3"
    >
      <SongPlayer
        v-model:is-lrc-loading="isLrcLoading"
        :song="playingSong"
        @close="playingSong = undefined"
      />
    </div>

    <!-- 歌曲表格 -->
    <div class="border border-border/80 rounded-lg overflow-hidden bg-card">
      <Table class="table-fixed">
        <TableHeader>
          <TableRow class="hover:bg-transparent border-b border-border/80 bg-muted/40">
            <TableHead
              v-if="isSelf"
              class="w-10 px-3"
            >
              <Checkbox
                :checked="allCurrentPageSelected"
                @update:checked="toggleSelectAll"
              />
            </TableHead>
            <TableHead class="min-w-[200px]">曲名</TableHead>
            <TableHead class="w-44">作者</TableHead>
            <TableHead class="w-24">语言</TableHead>
            <TableHead class="w-36">点歌要求</TableHead>
            <TableHead class="w-36">标签</TableHead>
            <TableHead class="w-32 text-right pr-4">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow
            v-for="row in pagedSongs"
            :key="row.key"
            class="border-b border-border/60 hover:bg-muted/40 transition-colors even:bg-muted/[0.14]"
          >
            <TableCell
              v-if="isSelf"
              class="px-3"
            >
              <Checkbox
                :checked="selectedKeys.includes(row.key)"
                @update:checked="toggleSelectRow(row.key, $event)"
              />
            </TableCell>

            <!-- 曲名 -->
            <TableCell>
              <div class="flex items-center gap-1.5 flex-wrap">
                <Badge
                  v-if="singingKeySet.has(row.key)"
                  variant="default"
                  class="text-[10px] h-4.5 px-1 font-normal bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                >
                  演唱中
                </Badge>
                <Badge
                  v-else-if="queuedKeySet.has(row.key)"
                  variant="default"
                  class="text-[10px] h-4.5 px-1 font-normal bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                >
                  排队中
                </Badge>

                <div class="flex flex-col">
                  <span
                    class="font-medium text-xs text-foreground"
                    :class="{ 'text-[#c36767]': row.options?.scMinPrice }"
                  >
                    {{ row.name }}
                  </span>
                  <span
                    v-if="row.translateName"
                    class="text-[11px] text-muted-foreground"
                  >
                    {{ row.translateName }}
                  </span>
                </div>
              </div>
            </TableCell>

            <!-- 作者 -->
            <TableCell>
              <div
                v-if="row.author?.length"
                class="flex items-center gap-1 flex-wrap"
              >
                <button
                  v-for="a in row.author"
                  :key="a"
                  type="button"
                  class="px-1.5 py-0.5 rounded text-[10px] bg-muted/60 hover:bg-primary/10 hover:text-primary transition"
                  @click="selectedAuthorFilter = selectedAuthorFilter === a ? null : a"
                >
                  {{ a }}
                </button>
              </div>
              <span
                v-else
                class="text-[11px] text-muted-foreground/35 select-none"
                >-</span
              >
            </TableCell>

            <!-- 语言 -->
            <TableCell>
              <div
                v-if="row.language?.length"
                class="flex items-center gap-1 flex-wrap"
              >
                <span
                  v-for="l in row.language"
                  :key="l"
                  class="text-[11px] text-muted-foreground"
                >
                  {{ l }}
                </span>
              </div>
              <span
                v-else
                class="text-[11px] text-muted-foreground/35 select-none"
                >-</span
              >
            </TableCell>

            <!-- 要求 -->
            <TableCell>
              <div
                v-if="hasSongOptions(row.options)"
                class="flex items-center gap-1 flex-wrap"
              >
                <Badge
                  v-if="row.options!.needJianzhang"
                  class="text-[10px] h-4 px-1 font-normal text-white"
                  :style="{ backgroundColor: getGuardColor(3) }"
                >
                  舰长
                </Badge>
                <Badge
                  v-if="row.options!.needTidu"
                  class="text-[10px] h-4 px-1 font-normal text-white"
                  :style="{ backgroundColor: getGuardColor(2) }"
                >
                  提督
                </Badge>
                <Badge
                  v-if="row.options!.needZongdu"
                  class="text-[10px] h-4 px-1 font-normal text-white"
                  :style="{ backgroundColor: getGuardColor(1) }"
                >
                  总督
                </Badge>
                <Badge
                  v-if="row.options!.scMinPrice"
                  class="text-[10px] h-4 px-1 font-normal text-white"
                  :style="{ backgroundColor: getSCColor(row.options!.scMinPrice) }"
                >
                  SC ≥ {{ row.options!.scMinPrice }}
                </Badge>
                <Badge
                  v-if="row.options!.fanMedalMinLevel"
                  variant="secondary"
                  class="text-[10px] h-4 px-1 font-normal text-sky-600 bg-sky-500/10"
                >
                  牌 ≥ {{ row.options!.fanMedalMinLevel }}
                </Badge>
              </div>
              <span
                v-else
                class="text-[11px] text-muted-foreground/35 select-none"
                >-</span
              >
            </TableCell>

            <!-- 标签 -->
            <TableCell>
              <div
                v-if="row.tags?.length"
                class="flex items-center gap-1 flex-wrap"
              >
                <Badge
                  v-for="t in row.tags"
                  :key="t"
                  variant="secondary"
                  class="text-[10px] h-4 px-1 font-normal"
                >
                  {{ t }}
                </Badge>
              </div>
              <span
                v-else
                class="text-[11px] text-muted-foreground/35 select-none"
                >-</span
              >
            </TableCell>

            <!-- 操作 -->
            <TableCell class="text-right pr-4">
              <div class="flex items-center justify-end gap-1">
                <template v-if="showListenButton && /\.(?:mp3|flac|ogg|wav|m4a)$/i.test(row.url ?? '')">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        size="icon"
                        variant="ghost"
                        class="size-7 rounded-full text-primary hover:bg-primary/10"
                        :disabled="isLrcLoading === row.key"
                        @click="playingSong = row"
                      >
                        <component
                          :is="Play24Filled"
                          class="size-3.5"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>试听</TooltipContent>
                  </Tooltip>
                </template>

                <template v-if="isSelf">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        size="icon"
                        variant="ghost"
                        class="size-7 rounded-full text-muted-foreground hover:text-foreground"
                        @click="moveSong(row.key, -1)"
                      >
                        <component
                          :is="ArrowUp24Filled"
                          class="size-3.5"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>上移</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        size="icon"
                        variant="ghost"
                        class="size-7 rounded-full text-muted-foreground hover:text-foreground"
                        @click="moveSong(row.key, 1)"
                      >
                        <component
                          :is="ArrowDown24Filled"
                          class="size-3.5"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>下移</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        size="icon"
                        variant="ghost"
                        class="size-7 rounded-full text-muted-foreground hover:text-foreground"
                        @click="editModalRef?.open(row)"
                      >
                        <component
                          :is="NotepadEdit20Filled"
                          class="size-3.5"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>修改</TooltipContent>
                  </Tooltip>

                  <Popconfirm
                    :title="`确认删除《${row.name}》？`"
                    positive-text="删除"
                    negative-text="取消"
                    @positive-click="deleteSong(row)"
                  >
                    <template #trigger>
                      <Button
                        size="icon"
                        variant="ghost"
                        class="size-7 rounded-full text-destructive hover:bg-destructive/10"
                      >
                        <component
                          :is="Delete24Filled"
                          class="size-3.5"
                        />
                      </Button>
                    </template>
                    确认删除《{{ row.name }}》？
                  </Popconfirm>
                </template>
              </div>
            </TableCell>
          </TableRow>

          <TableEmpty
            v-if="!pagedSongs.length"
            :colspan="isSelf ? 7 : 6"
            description="暂无歌曲"
          />
        </TableBody>
      </Table>
    </div>

    <!-- 紧凑分页导航 -->
    <div
      v-if="totalPages > 1"
      class="flex items-center justify-between gap-2 mt-3 text-xs"
    >
      <span class="text-muted-foreground text-[11px]"> 第 {{ currentPage }} / {{ totalPages }} 页 </span>
      <div class="flex items-center gap-1.5">
        <Button
          variant="outline"
          :disabled="currentPage <= 1"
          @click="prevPage"
        >
          上一页
        </Button>
        <Button
          variant="outline"
          :disabled="currentPage >= totalPages"
          @click="nextPage"
        >
          下一页
        </Button>
      </div>
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
    />
  </TooltipProvider>
</template>
