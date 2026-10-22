<script setup lang="ts">
import { MoreHorizontal24Filled } from '@vicons/fluent'
import { format } from 'date-fns'
// @ts-ignore
import { saveAs } from 'file-saver'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { SongsInfo } from '@/api/api-models'
import { FunctionTypes, SongFrom } from '@/api/api-models'
import { getApiSongListGet } from '@/api/generated/song-list/song-list'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import SongListAddSongModal from '@/apps/manage/components/song-list/SongListAddSongModal.vue'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { parseSongListCsv, parsedRowsToSongsInfo } from '@/apps/manage/composables/songListCsv'
import SongList from '@/components/SongList.vue'
import { CURRENT_HOST } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { useMessage } from '@/shared/utils'
import { objectsToCSV } from '@/shared/utils'

const message = useMessage()
const router = useRouter()
const accountInfo = useAccount()

const isLoading = ref(true)
const isImporting = ref(false)
const showModal = ref(false)
const songs = ref<SongsInfo[]>([])
const csvInputRef = ref<HTMLInputElement | null>(null)
const songListUrl = computed(() =>
  accountInfo.value?.name ? `${CURRENT_HOST}@${accountInfo.value.name}/song-list` : '',
)

async function getSongs() {
  isLoading.value = true
  try {
    const data = (await getApiSongListGet({
      id: accountInfo.value?.id != null ? String(accountInfo.value.id) : undefined,
    })) as unknown as {
      code: number
      data: any
    }
    if (data.code === 200) songs.value = data.data
  } catch (err) {
    message.error(`获取歌曲失败: ${err}`)
  } finally {
    isLoading.value = false
  }
}

function onSongsAdded(addedSongs: SongsInfo[]) {
  songs.value.push(...addedSongs)
}

function exportData() {
  const source = songs.value
  const from = (f: SongFrom) => {
    switch (f) {
      case SongFrom.Custom:
        return '手动添加'
      case SongFrom.Netease:
        return '网易云'
      case SongFrom.FiveSing:
        return '5sing'
      default:
        return '其他'
    }
  }
  const csvData = source.map((s) => ({
    id: s.id,
    名称: s.name,
    翻译名称: s.translateName,
    作者: s.author?.join('/') ?? '未知',
    创建于: format(s.createTime, 'yyyy-MM-dd HH:mm:ss'),
    更新于: format(s.updateTime, 'yyyy-MM-dd HH:mm:ss'),
    描述: s.description,
    来自: from(s.from),
    语言: s.language.join(','),
    标签: s.tags?.join(',') ?? '',
    链接: s.url,
  }))
  const text = objectsToCSV(csvData)
  const BOM = new Uint8Array([0xef, 0xbb, 0xbf])
  const utf8array = new TextEncoder().encode(text)
  const fileName = `歌单_${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.name}_.csv`
  saveAs(new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }), fileName)
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
      csvInputRef.value?.click()
      break
    case 'live-request':
      router.push({ name: 'manage-liveRequest' })
      break
    case 'song-list':
      router.push({ name: 'user-songList', params: { id: accountInfo.value?.name } })
      break
  }
}

async function onCsvFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  isImporting.value = true
  try {
    const text = await file.text()
    const rows = parseSongListCsv(text)
    if (!rows.length) {
      message.warning('CSV 中没有可导入的歌曲')
      return
    }
    const payload = parsedRowsToSongsInfo(rows)
    const groups = new Map<SongFrom, SongsInfo[]>()
    for (const song of payload) {
      const list = groups.get(song.from) ?? []
      list.push(song)
      groups.set(song.from, list)
    }
    const added: SongsInfo[] = []
    for (const [from, list] of groups) {
      const resp = await addSongsToSongList(list, from)
      if (resp.code !== 200) throw new Error(resp.message || '导入失败')
      if (resp.data?.length) added.push(...(resp.data as unknown as SongsInfo[]))
    }
    songs.value.push(...added)
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
      subtitle="管理你的演唱/翻唱曲目库，支持批量增删改查、从 CSV 导入导出及网易云同步"
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
                <component
                  :is="MoreHorizontal24Filled"
                  class="h-3.5 w-3.5 mr-1"
                />
                更多
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="handleMoreAction('template')"> 修改展示模板 </DropdownMenuItem>
              <DropdownMenuItem @click="handleMoreAction('export')"> 导出为 CSV </DropdownMenuItem>
              <DropdownMenuItem @click="handleMoreAction('import')"> 从 CSV 导入 </DropdownMenuItem>
              <DropdownMenuItem @click="handleMoreAction('live-request')"> 前往点播管理页 </DropdownMenuItem>
              <DropdownMenuItem @click="handleMoreAction('song-list')"> 前往歌单展示页 </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref="csvInputRef"
            type="file"
            accept=".csv,text/csv"
            style="display: none"
            @change="onCsvFileChange"
          />
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
      class="text-center py-20 text-xs text-muted-foreground"
    >
      正在加载歌单…
    </div>
    <SongList
      v-else
      :songs="songs"
      is-self
    />
  </div>
</template>
