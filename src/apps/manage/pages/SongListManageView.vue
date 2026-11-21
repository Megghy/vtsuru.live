<script setup lang="ts">
import { format } from 'date-fns'
// @ts-ignore
import { saveAs } from 'file-saver'
import { MoreHorizontal } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { ResponseSongModel } from '@/api/generated/model'
import { FunctionTypes, SongPlatform } from '@/api/generated/model'
import { getApiSongListGet } from '@/api/generated/song-list/song-list'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import SongListAddSongModal from '@/apps/manage/components/song-list/SongListAddSongModal.vue'
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { Skeleton } from '@/shared/ui/skeleton'
import { objectsToCSV, useMessage } from '@/shared/utils'

const message = useMessage()
const router = useRouter()
const accountInfo = useAccount()

const isLoading = ref(true)
const isImporting = ref(false)
const showModal = ref(false)
const songs = ref<ResponseSongModel[]>([])
const { open: openCsvPicker } = useFilePicker({
  accept: ['.csv', 'text/csv'],
  onError: message.error,
  onSelect: ([file]) => importCsvFile(file),
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
    作者: s.author?.join('/') ?? '未知',
    创建于: s.createTime ? format(s.createTime, 'yyyy-MM-dd HH:mm:ss') : '',
    更新于: s.updateTime ? format(s.updateTime, 'yyyy-MM-dd HH:mm:ss') : '',
    描述: s.description ?? '',
    来自: from(s.from),
    语言: s.language?.join(',') ?? '',
    标签: s.tags?.join(',') ?? '',
    链接: s.url ?? '',
    外链: s.externalUrl ?? '',
    封面: s.cover ?? '',
    点歌门槛: formatSongOptionsForCsv(s.options),
    置顶: s.isPinned ? '是' : '否',
    暂不接歌: s.isDisabled ? '是' : '否',
    排序: s.sortOrder ?? '',
    累计被点: s.requestCount ?? 0,
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

async function importCsvFile(file: File) {
  isImporting.value = true
  try {
    const text = await file.text()
    const rows = parseSongListCsv(text)
    if (!rows.length) {
      message.warning('CSV 中没有可导入的歌曲')
      return
    }
    const payload = parsedRowsToSongsInfo(rows)
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
    message.success(`已导入 ${added.length} 首歌曲`)
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  } finally {
    isImporting.value = false
  }
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
              <DropdownMenuItem @click="handleMoreAction('template')"> 修改展示模板 </DropdownMenuItem>
              <DropdownMenuItem @click="handleMoreAction('export')"> 导出为 CSV </DropdownMenuItem>
              <DropdownMenuItem @click="handleMoreAction('import')"> 从 CSV 导入 </DropdownMenuItem>
              <DropdownMenuItem @click="handleMoreAction('download-template')"> 下载 CSV 导入模板 </DropdownMenuItem>
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
