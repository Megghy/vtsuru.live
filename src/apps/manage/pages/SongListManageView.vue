<script setup lang="ts">
import { format } from 'date-fns'
// @ts-ignore
import { saveAs } from 'file-saver'
import { GitMerge, MoreHorizontal, Sparkles } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { AddSongModel, ResponseSongModel } from '@/api/generated/model'
import { FunctionTypes, SongPlatform } from '@/api/generated/model'
import { getApiSongListGet } from '@/api/generated/song-list/song-list'
import { postApiSongListUpsertBatch } from '@/api/songRequestExtras'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import SongListAddSongModal from '@/apps/manage/components/song-list/SongListAddSongModal.vue'
import SongListBatchCompleteModal from '@/apps/manage/components/song-list/SongListBatchCompleteModal.vue'
import SongListDuplicateModal from '@/apps/manage/components/song-list/SongListDuplicateModal.vue'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import {
  buildSongListCsvTemplate,
  formatSongOptionsForCsv,
  parseSongListCsv,
  parsedRowsToSongsInfo,
} from '@/apps/manage/composables/songListCsv'
import SongList from '@/components/SongList.vue'
import { useFilePicker } from '@/composables/useFilePicker'
import { CURRENT_HOST } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { Skeleton } from '@/shared/ui/skeleton'
import { objectsToCSV, useMessage } from '@/shared/utils'

const message = useMessage()
const router = useRouter()
const accountInfo = useAccount()

const isLoading = ref(true)
const isImporting = ref(false)
const showModal = ref(false)
const showBatchCompleteModal = ref(false)
const showDuplicateModal = ref(false)
const pendingCsvSongs = ref<ResponseSongModel[] | null>(null)
const songs = ref<ResponseSongModel[]>([])
const { open: openCsvPicker } = useFilePicker({
  accept: ['.csv', 'text/csv'],
  onError: message.error,
  onSelect: ([file]) => parseAndPromptCsv(file),
})
const songListUrl = computed(() =>
  accountInfo.value?.name ? `${CURRENT_HOST}@${accountInfo.value.name}/song-list` : '',
)

async function getSongs() {
  isLoading.value = true
  try {
    const data = await getApiSongListGet({
      id: accountInfo.value?.id != null ? String(accountInfo.value.id) : undefined,
    })
    if (data.code === 200) songs.value = data.data
  } catch (err) {
    message.error(`获取歌曲失败: ${err}`)
  } finally {
    isLoading.value = false
  }
}

function onSongsAdded(addedSongs: ResponseSongModel[]) {
  songs.value = [...songs.value, ...addedSongs]
}

function downloadCsvBlob(csvContent: string, fileName: string) {
  const BOM = new Uint8Array([0xef, 0xbb, 0xbf])
  const utf8array = new TextEncoder().encode(csvContent)
  saveAs(new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }), fileName)
}

function exportData() {
  const source = songs.value
  if (!source.length) {
    message.warning('歌单暂无歌曲可导出')
    return
  }
  const from = (f: SongPlatform) => {
    switch (f) {
      case SongPlatform.Custom:
        return '手动添加'
      case SongPlatform.Netease:
        return '网易云'
      case SongPlatform.FiveSing:
        return '5sing'
      case SongPlatform.Kugou:
        return '酷狗'
      default:
        return '其他'
    }
  }
  const csvData = source.map((s) => ({
    id: s.id,
    名称: s.name,
    翻译名称: s.translateName ?? '',
    别名: s.aliases?.join(',') ?? '',
    作者: s.author?.join('/') ?? '未知',
    创建于: s.createTime ? format(s.createTime, 'yyyy-MM-dd HH:mm:ss') : '',
    更新于: s.updateTime ? format(s.updateTime, 'yyyy-MM-dd HH:mm:ss') : '',
    描述: s.description ?? '',
    来自: from(s.from),
    语言: s.language?.join(',') ?? '',
    标签: s.tags?.join(',') ?? '',
    熟练度: s.proficiency ?? '',
    升降调: s.keyShift ?? '',
    链接: s.url ?? '',
    外链: s.externalUrl ?? '',
    伴奏链接: s.instrumentalUrl ?? '',
    封面: s.cover ?? '',
    点歌门槛: formatSongOptionsForCsv(s.options),
    置顶: s.isPinned ? '是' : '否',
    暂不接歌: s.isDisabled ? '是' : '否',
    排序: s.sortOrder ?? '',
    累计被点: s.requestCount ?? 0,
    累计唱完: s.finishCount ?? 0,
  }))
  const text = objectsToCSV(csvData)
  const fileName = `歌单_${format(Date.now(), 'yyyy-MM-dd_HH-mm-ss')}_${accountInfo.value?.name || 'export'}.csv`
  downloadCsvBlob(text, fileName)
}

function downloadTemplate() {
  downloadCsvBlob(buildSongListCsvTemplate(), '歌单导入模板.csv')
}

function handleMoreAction(key: string) {
  switch (key) {
    case 'batch-complete':
      showBatchCompleteModal.value = true
      break
    case 'duplicates':
      showDuplicateModal.value = true
      break
    case 'template':
      router.push({ name: 'manage-index', query: { tab: 'template', template: 'songlist' } })
      break
    case 'export':
      exportData()
      break
    case 'import':
      openCsvPicker()
      break
    case 'download-template':
      downloadTemplate()
      break
    case 'live-request':
      router.push({ name: 'manage-liveRequest' })
      break
    case 'song-list':
      router.push({ name: 'user-songList', params: { id: accountInfo.value?.name } })
      break
  }
}

async function parseAndPromptCsv(file: File) {
  try {
    const text = await file.text()
    const rows = parseSongListCsv(text)
    if (!rows.length) {
      message.warning('CSV 中没有可导入的歌曲')
      return
    }
    pendingCsvSongs.value = parsedRowsToSongsInfo(rows)
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

function toAddSongPayload(s: ResponseSongModel): AddSongModel {
  return {
    name: s.name,
    id: s.from === SongPlatform.Custom ? -1 : s.id,
    from: s.from,
    author: s.author ?? [],
    url: s.url ?? undefined,
    externalUrl: s.externalUrl ?? undefined,
    description: s.description ?? undefined,
    cover: s.cover ?? undefined,
    tags: s.tags ?? [],
    language: s.language ?? [],
    translateName: s.translateName ?? undefined,
    options: s.options,
    sortOrder: s.sortOrder ?? undefined,
    isPinned: s.isPinned ?? undefined,
    isDisabled: s.isDisabled ?? undefined,
    aliases: s.aliases ?? [],
    proficiency: s.proficiency ?? undefined,
    keyShift: s.keyShift ?? undefined,
    instrumentalUrl: s.instrumentalUrl ?? undefined,
  }
}

async function confirmImportCsv(updateExisting: boolean) {
  const payload = pendingCsvSongs.value
  if (!payload?.length) return
  isImporting.value = true
  try {
    if (updateExisting) {
      const resp = await postApiSongListUpsertBatch(payload.map(toAddSongPayload), { updateExisting: true })
      if (resp.code !== 200) throw new Error(resp.message || '导入失败')
      const { added, updated, skipped } = resp.data
      const updatedMap = new Map(updated.map((s) => [s.key, s]))
      songs.value = [
        ...songs.value.map((s) => {
          const u = updatedMap.get(s.key)
          return u ? { ...u, requestCount: s.requestCount ?? u.requestCount, finishCount: s.finishCount ?? u.finishCount } : s
        }),
        ...added,
      ]
      message.success(`导入完成：新增 ${added.length} 首，覆盖更新 ${updated.length} 首${skipped > 0 ? `，跳过 ${skipped} 首` : ''}`)
    } else {
      const groups = new Map<SongPlatform, ResponseSongModel[]>()
      for (const song of payload) {
        const list = groups.get(song.from) ?? []
        list.push(song)
        groups.set(song.from, list)
      }
      const added: ResponseSongModel[] = []
      for (const [from, list] of groups) {
        const resp = await addSongsToSongList(list, from)
        if (resp.code !== 200) throw new Error(resp.message || '导入失败')
        if (resp.data?.length) added.push(...(resp.data as unknown as ResponseSongModel[]))
      }
      songs.value = [...songs.value, ...added]
      message.success(`已新增导入 ${added.length} 首歌曲`)
    }
    pendingCsvSongs.value = null
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    isImporting.value = false
  }
}

function onSongsBatchCompleted(updatedList: ResponseSongModel[]) {
  const map = new Map(updatedList.map((s) => [s.key, s]))
  songs.value = songs.value.map((s) => {
    const next = map.get(s.key)
    return next
      ? {
          ...next,
          requestCount: s.requestCount ?? next.requestCount,
          finishCount: s.finishCount ?? next.finishCount,
          lastRequestedAt: s.lastRequestedAt ?? next.lastRequestedAt,
        }
      : s
  })
}

function onDuplicatesMerged(payload: { primary: ResponseSongModel; removedKeys: string[] }) {
  const removedSet = new Set(payload.removedKeys)
  songs.value = songs.value
    .filter((s) => !removedSet.has(s.key))
    .map((s) => (s.key === payload.primary.key ? payload.primary : s))
}

onMounted(getSongs)
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="歌单管理"
      subtitle="管理你的演唱/翻唱曲目库，支持置顶、暂不接歌、批量编辑、CSV/文本导入及网易云同步"
      :function-type="FunctionTypes.SongList"
      :links="[{ label: '展示页链接', value: songListUrl }]"
    >
      <template #action>
        <div class="flex items-center gap-2">
          <Button
            variant="default"
            @click="showModal = true"
          >
            添加歌曲
          </Button>

          <Button
            variant="outline"
            :loading="isLoading || isImporting"
            @click="getSongs"
          >
            刷新
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                :loading="isImporting"
              >
                <MoreHorizontal class="size-3.5 mr-1" />
                更多
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="handleMoreAction('batch-complete')">
                <Sparkles class="size-3.5 mr-1.5" />
                批量补全曲目信息
              </DropdownMenuItem>
              <DropdownMenuItem @click="handleMoreAction('duplicates')">
                <GitMerge class="size-3.5 mr-1.5" />
                曲库查重与合并
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="handleMoreAction('template')"> 修改展示模板 </DropdownMenuItem>
              <DropdownMenuItem @click="handleMoreAction('export')"> 导出为 CSV </DropdownMenuItem>
              <DropdownMenuItem @click="handleMoreAction('import')"> 从 CSV 导入 / 回导更新 </DropdownMenuItem>
              <DropdownMenuItem @click="handleMoreAction('download-template')"> 下载 CSV 导入模板 </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="handleMoreAction('live-request')"> 前往点播管理页 </DropdownMenuItem>
              <DropdownMenuItem @click="handleMoreAction('song-list')"> 前往歌单展示页 </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </template>
    </ManagePageHeader>

    <SongListAddSongModal
      v-model:show="showModal"
      :songs="songs"
      @added="onSongsAdded"
    />

    <SongListBatchCompleteModal
      v-model:open="showBatchCompleteModal"
      :songs="songs"
      @updated="onSongsBatchCompleted"
    />

    <SongListDuplicateModal
      v-model:open="showDuplicateModal"
      :songs="songs"
      @merged="onDuplicatesMerged"
    />

    <!-- CSV 导入模式选择弹窗 -->
    <Dialog
      :open="Boolean(pendingCsvSongs)"
      @update:open="(val) => { if (!val) pendingCsvSongs = null }"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>选择 CSV 导入方式</DialogTitle>
          <DialogDescription>
            已解析 {{ pendingCsvSongs?.length ?? 0 }} 首曲目，请选择遇到歌单中已有同名/同 ID 曲目时的处理方式。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            :disabled="isImporting"
            @click="confirmImportCsv(false)"
          >
            仅新增（跳过已有）
          </Button>
          <Button
            variant="default"
            :loading="isImporting"
            @click="confirmImportCsv(true)"
          >
            覆盖更新已有曲目并新增
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div
      v-if="isLoading"
      class="space-y-2.5"
    >
      <div class="flex gap-2">
        <Skeleton class="h-7 w-20" />
        <Skeleton class="h-7 w-20" />
        <Skeleton class="h-7 w-20" />
      </div>
      <Skeleton class="h-14 w-full rounded-lg" />
      <div class="border border-border/80 rounded-lg p-3 space-y-2.5 bg-card">
        <Skeleton
          v-for="i in 6"
          :key="i"
          class="h-10 w-full"
        />
      </div>
    </div>
    <SongList
      v-else
      v-model:songs="songs"
      is-self
    />
  </div>
</template>
