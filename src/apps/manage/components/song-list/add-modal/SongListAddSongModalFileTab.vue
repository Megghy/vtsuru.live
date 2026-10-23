<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent'
import { ArchiveOutline } from '@vicons/ionicons5'
import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'

import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { Transfer, type TransferOption } from '@/shared/ui/transfer'
import { useMessage } from '@/shared/utils'

const props = defineProps<{
  existingSongs: ResponseSongModel[]
}>()

const emit = defineEmits<{
  (e: 'added', songs: ResponseSongModel[]): void
  (e: 'loadingChange', value: boolean): void
}>()

const message = useMessage()

const useCustomColumnMapping = ref(false)
const columnMappings = usePersistedStorage('song-list-column-mappings', {
  name: '名称,歌名,标题,title,name',
  translateName: '翻译名称,译名,translated,translate',
  author: '作者,歌手,演唱,singer,author,artist',
  description: '描述,备注,说明,description,note,remark',
  url: '链接,地址,url,link',
  language: '语言,language',
  tags: '标签,类别,分类,tag,tags,category',
})

const selectedFile = ref<File | null>(null)
const uploadSongsFromFile = ref<ResponseSongModel[]>([])
const selecteduploadSongs = ref<string[]>([])

defineExpose({
  add: addUploadFileSong,
  canAdd: computed(() => selecteduploadSongs.value.length > 0),
  label: computed(() => `添加到歌单 | ${selecteduploadSongs.value.length} 首`),
})

const uploadSongsOptions = computed<TransferOption[]>(() => {
  return uploadSongsFromFile.value.map((s) => ({
    label: `${s.name} - ${!s.author ? '未知' : s.author.join('/')}`,
    value: s.name,
    disabled: props.existingSongs.some((exist) => exist.name === s.name),
  }))
})

function parseMultipleValues(value: any): string[] {
  if (value === undefined || value === null) return []
  if (typeof value !== 'string') value = value.toString()

  return value
    ?.replace('／', '/')
    .replace('，', ',')
    .split(/\/|,/)
    .map((a: string) => a.trim())
    .filter((v: string, index: number, self: string[]) => v && self.indexOf(v) === index)
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  const file = target.files[0]
  const validExtensions = ['.xlsx', '.xls', '.csv']
  const isValid = validExtensions.some((ext) => file.name.endsWith(ext))

  if (!isValid) {
    message.error('只能选择 xlsx、xls 或 csv 文件')
    target.value = ''
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
  message.success('已重置为默认映射')
}

function saveColumnMappings() {
  message.success('映射已保存，下次导入将使用当前设置')
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

    const headers = json[0] as any
    const rows = json.slice(1) as any[]

    const parsedSongs = rows
      .map((row) => {
        const song = {} as ResponseSongModel

        for (let i = 0; i < headers.length; i++) {
          const headerFromFile = (headers[i] as string)?.toLowerCase().trim()
          if (!headerFromFile) continue

          const value = row[i]

          const nameHeaders = columnMappings.value.name.split(/,|，/).map((h) => h.trim().toLowerCase())
          if (nameHeaders.includes(headerFromFile)) {
            if (value) song.name = value
          }

          if (columnMappings.value.translateName) {
            const translateNameHeaders = columnMappings.value.translateName
              .split(/,|，/)
              .map((h) => h.trim().toLowerCase())
            if (translateNameHeaders.includes(headerFromFile)) {
              if (value) song.translateName = value
            }
          }

          if (columnMappings.value.author) {
            const authorHeaders = columnMappings.value.author.split(/,|，/).map((h) => h.trim().toLowerCase())
            if (authorHeaders.includes(headerFromFile)) {
              if (value) song.author = parseMultipleValues(value)
            }
          }

          if (columnMappings.value.description) {
            const descriptionHeaders = columnMappings.value.description.split(/,|，/).map((h) => h.trim().toLowerCase())
            if (descriptionHeaders.includes(headerFromFile)) {
              song.description = value
            }
          }

          if (columnMappings.value.url) {
            const urlHeaders = columnMappings.value.url.split(/,|，/).map((h) => h.trim().toLowerCase())
            if (urlHeaders.includes(headerFromFile)) {
              song.url = value
            }
          }

          if (columnMappings.value.language) {
            const languageHeaders = columnMappings.value.language.split(/,|，/).map((h) => h.trim().toLowerCase())
            if (languageHeaders.includes(headerFromFile)) {
              if (value) song.language = parseMultipleValues(value)
            }
          }

          if (columnMappings.value.tags) {
            const tagsHeaders = columnMappings.value.tags.split(/,|，/).map((h) => h.trim().toLowerCase())
            if (tagsHeaders.includes(headerFromFile)) {
              if (value) song.tags = parseMultipleValues(value)
            }
          }
        }

        if (!song.name) return null
        return song
      })
      .filter((s) => s !== null) as ResponseSongModel[]

    uploadSongsFromFile.value = parsedSongs
    message.success(`解析完成，共获取 ${uploadSongsFromFile.value.length} 首曲目`)
  }
}

async function addUploadFileSong() {
  if (selecteduploadSongs.value.length === 0) {
    message.error('请选择歌曲')
    return
  }

  emit('loadingChange', true)
  try {
    const songsToAdd = uploadSongsFromFile.value.filter((s) => selecteduploadSongs.value.includes(s.name))

    const data = await addSongsToSongList(songsToAdd, SongPlatform.Custom)
    if (data.code !== 200) {
      message.error(`添加失败: ${data.message}`)
      return
    }

    message.success(`已添加 ${data.data.length} 首歌曲`)
    emit('added', data.data as unknown as ResponseSongModel[])
  } catch (err) {
    message.error(`添加失败: ${err}`)
    console.error(err)
  } finally {
    emit('loadingChange', false)
  }
}
</script>

<template>
  <div class="space-y-4">
    <Alert
      variant="default"
      class="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 py-2"
    >
      <AlertDescription class="text-xs">
        Excel 文件格式详见:
        <a
          href="https://www.wolai.com/hZWizjCnAdc6hDdntuWgcU"
          target="_blank"
          rel="noreferrer"
          class="underline font-medium hover:text-foreground ml-1"
        >
          导入说明页面
        </a>
      </AlertDescription>
    </Alert>

    <!-- 自定义列映射折叠 -->
    <div class="space-y-2">
      <label class="flex items-center gap-2 cursor-pointer text-xs select-none">
        <Checkbox v-model:checked="useCustomColumnMapping" />
        <span class="font-medium text-foreground">自定义列头映射</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Info24Filled class="size-3.5 text-muted-foreground/70 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p class="text-xs">启用后可以自定义Excel文件中列头与歌曲信息的对应关系</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </label>

      <div
        v-if="useCustomColumnMapping"
        class="p-3 rounded-lg border border-border bg-muted/20 space-y-3"
      >
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="space-y-1">
            <label class="text-muted-foreground">歌曲名称 (必填)</label>
            <Input
              v-model="columnMappings.name"
              size="xs"
            />
          </div>
          <div class="space-y-1">
            <label class="text-muted-foreground">翻译名称</label>
            <Input
              v-model="columnMappings.translateName"
              size="xs"
            />
          </div>
          <div class="space-y-1">
            <label class="text-muted-foreground">作者</label>
            <Input
              v-model="columnMappings.author"
              size="xs"
            />
          </div>
          <div class="space-y-1">
            <label class="text-muted-foreground">描述</label>
            <Input
              v-model="columnMappings.description"
              size="xs"
            />
          </div>
          <div class="space-y-1">
            <label class="text-muted-foreground">链接</label>
            <Input
              v-model="columnMappings.url"
              size="xs"
            />
          </div>
          <div class="space-y-1">
            <label class="text-muted-foreground">语言</label>
            <Input
              v-model="columnMappings.language"
              size="xs"
            />
          </div>
          <div class="space-y-1 col-span-full">
            <label class="text-muted-foreground">标签</label>
            <Input
              v-model="columnMappings.tags"
              size="xs"
            />
          </div>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <Button
            size="xs"
            @click="saveColumnMappings"
            >保存映射</Button
          >
          <Button
            size="xs"
            variant="outline"
            @click="resetColumnMappings"
            >重置默认</Button
          >
        </div>
      </div>
    </div>

    <!-- 上传区域 -->
    <div class="space-y-2">
      <label
        class="border border-dashed border-input hover:border-primary rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-card hover:bg-muted/30"
      >
        <ArchiveOutline class="size-8 text-muted-foreground/60 mb-2" />
        <span class="text-xs font-medium text-foreground">
          {{ selectedFile ? selectedFile.name : '点击选择 Excel (.xlsx, .xls) 或 CSV 文件' }}
        </span>
        <span class="text-[11px] text-muted-foreground mt-1">支持拖拽或直接点击选择</span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          class="hidden"
          @change="onFileSelect"
        />
      </label>

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
</template>
