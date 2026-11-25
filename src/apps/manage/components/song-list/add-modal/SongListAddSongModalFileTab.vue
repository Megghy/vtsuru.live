<script setup lang="ts">
// @ts-ignore
import { saveAs } from 'file-saver'
import { Download, FileSpreadsheet, Info } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'

import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { buildSongListCsvTemplate, parseSongOptionsFromCsv } from '@/apps/manage/composables/songListCsv'
import { useFilePicker } from '@/composables/useFilePicker'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { Transfer, type TransferOption } from '@/shared/ui/transfer'
import { useMessage } from '@/shared/utils'

interface ParsedFileSongRow {
  rowKey: string
  song: ResponseSongModel
}

const props = defineProps<{
  existingSongs: ResponseSongModel[]
}>()

const emit = defineEmits<{
  (e: 'added', songs: ResponseSongModel[]): void
  (e: 'loadingChange', value: boolean): void
}>()

const message = useMessage()

const DEFAULT_MAPPINGS = {
  id: 'id,平台id',
  from: '来自,来源,平台,from',
  name: '名称,歌名,标题,title,name',
  translateName: '翻译名称,译名,translated,translate,translateName',
  aliases: '别名,简称,aliases',
  author: '作者,歌手,演唱,singer,author,artist',
  description: '描述,备注,说明,description,note,remark',
  url: '链接,试听链接,地址,url,link',
  externalUrl: '外链,作品链接,externalUrl',
  instrumentalUrl: '伴奏链接,乐谱链接,instrumentalUrl',
  proficiency: '熟练度,proficiency',
  keyShift: '升降调,调性,keyShift',
  cover: '封面,cover',
  language: '语言,language',
  tags: '标签,类别,分类,tag,tags,category',
  options: '点歌门槛,点歌要求,options',
  isPinned: '置顶,isPinned',
  isDisabled: '暂不接歌,禁用,isDisabled',
}

const useCustomColumnMapping = ref(false)
const columnMappings = usePersistedStorage('song-list-column-mappings', { ...DEFAULT_MAPPINGS })

const selectedFile = ref<File | null>(null)
const dropZoneRef = ref<HTMLElement | null>(null)
const uploadSongsFromFile = ref<ParsedFileSongRow[]>([])
const selecteduploadSongs = ref<string[]>([])

const { open: openSheetPicker, isOverDropZone } = useFilePicker({
  dropZoneRef,
  accept: ['.xlsx', '.xls', '.csv'],
  onError: message.error,
  onSelect: ([file]) => {
    selectedFile.value = file
  },
})

defineExpose({
  add: addUploadFileSong,
  canAdd: computed(() => selecteduploadSongs.value.length > 0),
  label: computed(() => `添加到歌单 | ${selecteduploadSongs.value.length} 首`),
})

const uploadSongsOptions = computed<TransferOption[]>(() => {
  return uploadSongsFromFile.value.map(({ rowKey, song }) => ({
    label: `${song.name} - ${!song.author?.length ? '未知' : song.author.join('/')}`,
    value: rowKey,
    disabled: props.existingSongs.some((exist) => exist.name === song.name),
  }))
})

function parseMultipleValues(value: unknown): string[] {
  if (value === undefined || value === null) return []
  const raw = typeof value === 'string' ? value : String(value)
  return raw
    .replace('／', '/')
    .replace('，', ',')
    .split(/\/|,/)
    .map((a) => a.trim())
    .filter((v, index, self) => v && self.indexOf(v) === index)
}

function parseBoolValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
  return ['1', 'true', 'yes', 'y', '是', '置顶', '停接', '禁用'].includes(text)
}

function getMappingList(key: keyof typeof DEFAULT_MAPPINGS): string[] {
  const raw = columnMappings.value[key] ?? DEFAULT_MAPPINGS[key]
  return raw
    .split(/[,，]/)
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
}

function resetColumnMappings() {
  columnMappings.value = { ...DEFAULT_MAPPINGS }
  message.success('已重置为默认映射')
}

function saveColumnMappings() {
  message.success('映射已保存，下次导入将使用当前设置')
}

function downloadTemplate() {
  const BOM = new Uint8Array([0xef, 0xbb, 0xbf])
  const utf8array = new TextEncoder().encode(buildSongListCsvTemplate())
  saveAs(new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }), '歌单导入模板.csv')
}

function parseExcelFile() {
  if (!selectedFile.value) {
    message.error('请选择文件')
    return
  }

  const reader = new FileReader()
  reader.readAsArrayBuffer(selectedFile.value)
  reader.onload = (e) => {
    const data = new Uint8Array(e?.target?.result as ArrayBuffer)
    const workbook = XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null })

    if (json.length === 0) {
      message.error('文件为空')
      return
    }

    const headers = json[0] as unknown[]
    const rows = json.slice(1) as unknown[][]

    const idHeaders = getMappingList('id')
    const fromHeaders = getMappingList('from')
    const nameHeaders = getMappingList('name')
    const translateHeaders = getMappingList('translateName')
    const aliasesHeaders = getMappingList('aliases')
    const authorHeaders = getMappingList('author')
    const descHeaders = getMappingList('description')
    const urlHeaders = getMappingList('url')
    const externalUrlHeaders = getMappingList('externalUrl')
    const instrumentalUrlHeaders = getMappingList('instrumentalUrl')
    const proficiencyHeaders = getMappingList('proficiency')
    const keyShiftHeaders = getMappingList('keyShift')
    const coverHeaders = getMappingList('cover')
    const languageHeaders = getMappingList('language')
    const tagsHeaders = getMappingList('tags')
    const optionsHeaders = getMappingList('options')
    const pinnedHeaders = getMappingList('isPinned')
    const disabledHeaders = getMappingList('isDisabled')

    const parsePlatform = (label: string): SongPlatform => {
      const lower = label.trim().toLowerCase()
      if (lower.includes('网易') || lower === 'netease') return SongPlatform.Netease
      if (lower.includes('5sing') || lower === 'fivesing') return SongPlatform.FiveSing
      if (lower.includes('酷狗') || lower === 'kugou') return SongPlatform.Kugou
      return SongPlatform.Custom
    }

    const parsedRows: ParsedFileSongRow[] = []
    rows.forEach((row, idx) => {
      const song = {
        id: -1,
        key: '',
        name: '',
        from: SongPlatform.Custom,
        author: [],
        tags: [],
        language: [],
        aliases: [],
        createTime: Date.now(),
        updateTime: Date.now(),
      } as ResponseSongModel

      for (let i = 0; i < headers.length; i++) {
        const headerFromFile = String(headers[i] ?? '')
          .toLowerCase()
          .trim()
        if (!headerFromFile) continue

        const value = row[i]
        const textVal = value !== null && value !== undefined ? String(value).trim() : ''

        if (idHeaders.includes(headerFromFile) && textVal) {
          const parsedId = Number(textVal)
          if (Number.isFinite(parsedId) && parsedId > 0) song.id = parsedId
        } else if (fromHeaders.includes(headerFromFile) && textVal) song.from = parsePlatform(textVal)
        else if (nameHeaders.includes(headerFromFile) && textVal) song.name = textVal
        else if (translateHeaders.includes(headerFromFile) && textVal) song.translateName = textVal
        else if (aliasesHeaders.includes(headerFromFile) && textVal) song.aliases = parseMultipleValues(value)
        else if (authorHeaders.includes(headerFromFile) && textVal) song.author = parseMultipleValues(value)
        else if (descHeaders.includes(headerFromFile) && textVal) song.description = textVal
        else if (urlHeaders.includes(headerFromFile) && textVal) song.url = textVal
        else if (externalUrlHeaders.includes(headerFromFile) && textVal) song.externalUrl = textVal
        else if (instrumentalUrlHeaders.includes(headerFromFile) && textVal) song.instrumentalUrl = textVal
        else if (proficiencyHeaders.includes(headerFromFile) && textVal) song.proficiency = textVal
        else if (keyShiftHeaders.includes(headerFromFile) && textVal) song.keyShift = textVal
        else if (coverHeaders.includes(headerFromFile) && textVal) song.cover = textVal
        else if (languageHeaders.includes(headerFromFile) && textVal) song.language = parseMultipleValues(value)
        else if (tagsHeaders.includes(headerFromFile) && textVal) song.tags = parseMultipleValues(value)
        else if (optionsHeaders.includes(headerFromFile) && textVal) song.options = parseSongOptionsFromCsv(textVal)
        else if (pinnedHeaders.includes(headerFromFile) && textVal) song.isPinned = parseBoolValue(value)
        else if (disabledHeaders.includes(headerFromFile) && textVal) song.isDisabled = parseBoolValue(value)
      }

      if (!song.name) return
      parsedRows.push({
        rowKey: `${idx}::${song.name}`,
        song,
      })
    })

    uploadSongsFromFile.value = parsedRows
    selecteduploadSongs.value = []
    message.success(`解析完成，共获取 ${parsedRows.length} 首曲目`)
  }
}

async function addUploadFileSong() {
  if (selecteduploadSongs.value.length === 0) {
    message.error('请选择歌曲')
    return
  }

  emit('loadingChange', true)
  try {
    const selectedSet = new Set(selecteduploadSongs.value)
    const songsToAdd = uploadSongsFromFile.value.filter((r) => selectedSet.has(r.rowKey)).map((r) => r.song)

    const groups = new Map<SongPlatform, ResponseSongModel[]>()
    for (const song of songsToAdd) {
      const platform = song.from ?? SongPlatform.Custom
      const list = groups.get(platform) ?? []
      list.push(song)
      groups.set(platform, list)
    }

    const added: ResponseSongModel[] = []
    for (const [platform, list] of groups) {
      const data = await addSongsToSongList(list, platform)
      if (data.code !== 200) {
        message.error(`添加失败: ${data.message}`)
        return
      }
      if (data.data?.length) {
        added.push(...(data.data as unknown as ResponseSongModel[]))
      }
    }

    message.success(`已添加 ${added.length} 首歌曲`)
    selecteduploadSongs.value = []
    emit('added', added)
  } catch (err) {
    message.error(`添加失败: ${err}`)
    console.error(err)
  } finally {
    emit('loadingChange', false)
  }
}
</script>

<template>
  <TooltipProvider>
    <div class="space-y-4">
      <Alert
        size="sm"
        variant="info"
      >
        <AlertDescription class="flex-between flex-wrap gap-2 w-full">
          <span>
            支持 Excel (.xlsx/.xls) 或 CSV 导入，必填「名称」列，可选「作者 / 语言 / 标签 / 别名 / 熟练度 / 升降调 / 来源 / 点歌门槛」等列。
          </span>
          <Button
            size="xs"
            variant="outline"
            class="gap-1"
            @click="downloadTemplate"
          >
            <Download class="size-3.5" />
            下载标准模板
          </Button>
        </AlertDescription>
      </Alert>

      <!-- 自定义列映射折叠 -->
      <div class="space-y-2">
        <label class="flex items-center gap-2 cursor-pointer text-xs select-none">
          <Checkbox v-model:checked="useCustomColumnMapping" />
          <span class="font-medium text-foreground">自定义列头映射</span>
          <Tooltip>
            <TooltipTrigger as-child>
              <Info class="size-3.5 text-muted-foreground/70 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p class="text-xs">启用后可以自定义 Excel/CSV 文件中列头与歌曲信息的对应关系</p>
            </TooltipContent>
          </Tooltip>
        </label>

        <div
          v-if="useCustomColumnMapping"
          class="p-3 rounded-lg border border-border bg-muted/20 space-y-3"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <FormField
              label="歌曲名称"
              required
              class="min-w-0"
            >
              <Input v-model="columnMappings.name" />
            </FormField>
            <FormField
              label="翻译名称"
              class="min-w-0"
            >
              <Input v-model="columnMappings.translateName" />
            </FormField>
            <FormField
              label="作者"
              class="min-w-0"
            >
              <Input v-model="columnMappings.author" />
            </FormField>
            <FormField
              label="语言"
              class="min-w-0"
            >
              <Input v-model="columnMappings.language" />
            </FormField>
            <FormField
              label="标签"
              class="min-w-0"
            >
              <Input v-model="columnMappings.tags" />
            </FormField>
            <FormField
              label="描述"
              class="min-w-0"
            >
              <Input v-model="columnMappings.description" />
            </FormField>
            <FormField
              label="音频试听链接"
              class="min-w-0"
            >
              <Input v-model="columnMappings.url" />
            </FormField>
            <FormField
              label="作品外链"
              class="min-w-0"
            >
              <Input v-model="columnMappings.externalUrl" />
            </FormField>
            <FormField
              label="封面"
              class="min-w-0"
            >
              <Input v-model="columnMappings.cover" />
            </FormField>
            <FormField
              label="点歌门槛"
              class="min-w-0"
            >
              <Input v-model="columnMappings.options" />
            </FormField>
          </div>

          <div class="flex items-center gap-2 pt-1">
            <Button
              size="xs"
              @click="saveColumnMappings"
            >
              保存映射
            </Button>
            <Button
              size="xs"
              variant="outline"
              @click="resetColumnMappings"
            >
              重置默认
            </Button>
          </div>
        </div>
      </div>

      <!-- 上传区域 -->
      <div class="space-y-2">
        <Button
          ref="dropZoneRef"
          variant="outline"
          class="w-full h-auto border-dashed rounded-lg p-6 flex-col-center font-normal"
          :class="isOverDropZone ? 'border-primary bg-primary/5' : 'bg-card'"
          @click="openSheetPicker()"
        >
          <FileSpreadsheet class="size-8 text-muted-foreground/60 mb-2" />
          <span class="text-xs font-medium text-foreground">
            {{ selectedFile ? selectedFile.name : '点击选择 Excel (.xlsx, .xls) 或 CSV 文件' }}
          </span>
          <span class="text-[11px] text-muted-foreground mt-1">支持拖拽或直接点击选择</span>
        </Button>

        <div class="flex justify-end">
          <Button
            :disabled="!selectedFile"
            @click="parseExcelFile"
          >
            解析文件
          </Button>
        </div>
      </div>

      <!-- 穿梭选择区 -->
      <template v-if="uploadSongsOptions.length > 0">
        <Separator />
        <Transfer
          v-model="selecteduploadSongs"
          :options="uploadSongsOptions"
          source-title="文件曲目"
          target-title="待添加歌曲"
        />
      </template>
    </div>
  </TooltipProvider>
</template>
