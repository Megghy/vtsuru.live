<script setup lang="ts">
import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'

import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { usePersistedStorage } from '@/shared/storage/persist'

const props = defineProps<{ existingSongs: SongsInfo[] }>()
const emit = defineEmits<{ added: [songs: SongsInfo[]]; loadingChange: [value: boolean] }>()
const toast = useToast()
const useCustomColumnMapping = ref(false)
const selectedFile = ref<File>()
const uploadSongsFromFile = ref<SongsInfo[]>([])
const selectedUploadSongs = ref<string[]>([])

const columnMappings = usePersistedStorage('song-list-column-mappings', {
  name: '名称,歌名,标题,title,name',
  translateName: '翻译名称,译名,translated,translate',
  author: '作者,歌手,演唱,singer,author,artist',
  description: '描述,备注,说明,description,note,remark',
  url: '链接,地址,url,link',
  language: '语言,language',
  tags: '标签,类别,分类,tag,tags,category',
})

const selectableSongs = computed(() => uploadSongsFromFile.value.map((song) => ({
  song,
  id: song.key,
  unavailable: props.existingSongs.some((item) => item.name === song.name),
})))

function createSong(): SongsInfo {
  return {
    id: 0,
    key: crypto.randomUUID(),
    name: '',
    author: [],
    url: '',
    from: SongFrom.Custom,
    language: [],
    tags: [],
    createTime: Date.now(),
    updateTime: Date.now(),
  }
}

function parseMultipleValues(value: unknown): string[] {
  return String(value ?? '')
    .replaceAll('／', '/')
    .replaceAll('，', ',')
    .split(/[/,]/)
    .map((item) => item.trim())
    .filter((item, index, list) => item && list.indexOf(item) === index)
}

function headersFor(field: keyof typeof columnMappings.value) {
  return columnMappings.value[field]
    .split(/,|，/)
    .map((header) => header.trim().toLowerCase())
}

function setSelectedFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!/\.(?:xlsx|xls|csv)$/i.test(file.name)) {
    toast.add({ title: '只能选择 xlsx、xls 或 csv 文件', color: 'error' })
    return
  }
  selectedFile.value = file
}

function resetColumnMappings() {
  columnMappings.value = {
    name: '名称,歌名,标题,title,name',
    translateName: '翻译名称,译名,translated,translate',
    author: '作者,歌手,演唱,singer,author,artist',
    description: '描述,备注,说明,description,note,remark',
    url: '链接,地址,url,link',
    language: '语言,language',
    tags: '标签,类别,分类,tag,tags,category',
  }
  toast.add({ title: '已重置默认映射', color: 'success' })
}

async function parseExcelFile() {
  if (!selectedFile.value) {
    toast.add({ title: '请选择文件', color: 'warning' })
    return
  }
  const workbook = XLSX.read(await selectedFile.value.arrayBuffer(), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const [headers, ...rows] = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
  if (!headers?.length) {
    toast.add({ title: '文件为空', color: 'warning' })
    return
  }

  uploadSongsFromFile.value = rows.flatMap((row) => {
    const song = createSong()
    headers.forEach((rawHeader, index) => {
      const header = String(rawHeader ?? '').trim().toLowerCase()
      const value = row[index]
      if (!header || value == null || value === '') return
      if (headersFor('name').includes(header)) song.name = String(value)
      if (headersFor('translateName').includes(header)) song.translateName = String(value)
      if (headersFor('author').includes(header)) song.author = parseMultipleValues(value)
      if (headersFor('description').includes(header)) song.description = String(value)
      if (headersFor('url').includes(header)) song.url = String(value)
      if (headersFor('language').includes(header)) song.language = parseMultipleValues(value)
      if (headersFor('tags').includes(header)) song.tags = parseMultipleValues(value)
    })
    return song.name ? [song] : []
  })
  selectedUploadSongs.value = []
  toast.add({ title: `解析完成，共获取 ${uploadSongsFromFile.value.length} 首曲目`, color: 'success' })
}

async function addUploadFileSongs() {
  const songs = uploadSongsFromFile.value.filter((song) => selectedUploadSongs.value.includes(song.key))
  if (!songs.length) {
    toast.add({ title: '请选择歌曲', color: 'warning' })
    return
  }
  emit('loadingChange', true)
  try {
    const result = await addSongsToSongList(songs, SongFrom.Custom)
    if (result.code !== 200) throw new Error(result.message)
    emit('added', result.data)
    selectedUploadSongs.value = []
    toast.add({ title: `已添加 ${result.data.length} 首歌曲`, color: 'success' })
  } catch (error) {
    toast.add({ title: `添加失败：${error instanceof Error ? error.message : String(error)}`, color: 'error' })
  } finally {
    emit('loadingChange', false)
  }
}
</script>

<template>
  <div class="file-import">
    <div class="file-import__notice">
      Excel 文件格式请参考
      <a href="https://www.wolai.com/hZWizjCnAdc6hDdntuWgcU" target="_blank" rel="noopener">导入说明</a>
    </div>
    <details>
      <summary>
        <UCheckbox v-model="useCustomColumnMapping" label="自定义列头映射" @click.stop />
      </summary>
      <div v-if="useCustomColumnMapping" class="file-import__mapping">
        <p>多个候选列头以逗号分隔，匹配时不区分大小写。</p>
        <UFormField
v-for="label in [
          ['name', '歌曲名称（必填）'], ['translateName', '翻译名称'], ['author', '作者'], ['description', '描述'],
          ['url', '链接'], ['language', '语言'], ['tags', '标签'],
        ] as const" :key="label[0]" :label="label[1]">
          <UInput v-model="columnMappings[label[0]]" />
        </UFormField>
        <div class="file-import__actions">
          <UButton label="保存映射" @click="toast.add({ title: '映射已保存', color: 'success' })" />
          <UButton color="warning" variant="soft" label="重置默认映射" @click="resetColumnMappings" />
        </div>
      </div>
    </details>
    <label class="file-import__picker">
      <UIcon name="i-lucide-file-spreadsheet" class="file-import__picker-icon" />
      <span>{{ selectedFile ? selectedFile.name : '选择 Excel 或 CSV 文件' }}</span>
      <input type="file" accept=".xlsx,.xls,.csv" @change="setSelectedFile">
    </label>
    <UButton :disabled="!selectedFile" label="解析文件" @click="parseExcelFile" />
    <template v-if="selectableSongs.length">
      <USeparator />
      <label v-for="{ song, id, unavailable } in selectableSongs" :key="id" class="file-import__song" :class="{ 'is-disabled': unavailable }">
        <input v-model="selectedUploadSongs" type="checkbox" :value="id" :disabled="unavailable">
        <span>{{ song.name }}</span>
        <span class="file-import__meta">{{ song.author.join(' / ') || '未知作者' }}</span>
        <UBadge v-if="unavailable" label="已存在" color="neutral" variant="subtle" />
      </label>
      <UButton :disabled="selectedUploadSongs.length === 0" :label="`添加到歌单（${selectedUploadSongs.length}）`" @click="addUploadFileSongs" />
    </template>
  </div>
</template>

<style scoped>
.file-import, .file-import__mapping { display: grid; gap: 14px; }
.file-import__notice { padding: 10px 12px; color: var(--vtsuru-fg-muted); background: var(--vtsuru-brand-soft); border-radius: 8px; }
.file-import__mapping { padding: 14px 2px; }
.file-import__picker { display: grid; place-items: center; gap: 8px; min-height: 130px; padding: 24px; border: 1px dashed var(--vtsuru-border); border-radius: 10px; cursor: pointer; }
.file-import__picker input { display: none; }
.file-import__picker-icon { width: 36px; height: 36px; color: var(--vtsuru-fg-muted); }
.file-import__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.file-import__song { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(120px, .7fr) auto; gap: 10px; align-items: center; padding: 9px 10px; border: 1px solid var(--vtsuru-border); border-radius: 8px; }
.file-import__meta { color: var(--vtsuru-fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-import__song.is-disabled { opacity: .58; }
</style>
