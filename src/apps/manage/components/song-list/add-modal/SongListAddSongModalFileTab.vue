<script setup lang="ts">
import type { UploadFileInfo } from 'naive-ui'
import type { Option } from 'naive-ui/es/transfer/src/interface'
import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { Info24Filled } from '@vicons/fluent'
import { ArchiveOutline } from '@vicons/ionicons5'
import {
  NAlert, NButton, NCheckbox, NCollapse, NCollapseItem, NDivider, NFormItem, NIcon, NInput, NP, NFlex, NText, NTooltip, NTransfer, NUpload, NUploadDragger, useMessage } from 'naive-ui';
import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { usePersistedStorage } from '@/shared/storage/persist'

const props = defineProps<{
  existingSongs: SongsInfo[]
}>()

const emit = defineEmits<{
  (e: 'added', songs: SongsInfo[]): void
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

const uploadFiles = ref<UploadFileInfo[]>([])
const uploadSongsFromFile = ref<SongsInfo[]>([])
const selecteduploadSongs = ref<string[]>([])

const uploadSongsOptions = computed<Option[]>(() => {
  return uploadSongsFromFile.value.map(s => ({
    label: `${s.name} - ${!s.author ? '未知' : s.author.join('/')}`,
    value: s.name,
    disabled: props.existingSongs.findIndex(exist => exist.name === s.name) > -1,
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

function beforeUpload(data: { file: UploadFileInfo, fileList: UploadFileInfo[] }) {
  const validExtensions = ['.xlsx', '.xls', '.csv']
  const isValid = validExtensions.some(ext => data.file.name.endsWith(ext))

  if (isValid) return true

  message.error('只能选择xlsx和xls和csv')
  return false
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
  if (uploadFiles.value.length === 0) {
    message.error('请选择文件')
    return
  }

  const file = uploadFiles.value[0]
  if (!file.file) {
    message.error('无效的文件')
    return
  }

  const reader = new FileReader()
  reader.readAsArrayBuffer(file.file)
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

    const parsedSongs = rows.map((row) => {
      const song = {} as SongsInfo

      for (let i = 0; i < headers.length; i++) {
        const headerFromFile = (headers[i] as string)?.toLowerCase().trim()
        if (!headerFromFile) continue

        const value = row[i]

        const nameHeaders = columnMappings.value.name.split(/,|，/).map(h => h.trim().toLowerCase())
        if (nameHeaders.includes(headerFromFile)) {
          if (value) song.name = value
        }

        if (columnMappings.value.translateName) {
          const translateNameHeaders = columnMappings.value.translateName.split(/,|，/).map(h => h.trim().toLowerCase())
          if (translateNameHeaders.includes(headerFromFile)) {
            if (value) song.translateName = value
          }
        }

        if (columnMappings.value.author) {
          const authorHeaders = columnMappings.value.author.split(/,|，/).map(h => h.trim().toLowerCase())
          if (authorHeaders.includes(headerFromFile)) {
            if (value) song.author = parseMultipleValues(value)
          }
        }

        if (columnMappings.value.description) {
          const descriptionHeaders = columnMappings.value.description.split(/,|，/).map(h => h.trim().toLowerCase())
          if (descriptionHeaders.includes(headerFromFile)) {
            song.description = value
          }
        }

        if (columnMappings.value.url) {
          const urlHeaders = columnMappings.value.url.split(/,|，/).map(h => h.trim().toLowerCase())
          if (urlHeaders.includes(headerFromFile)) {
            song.url = value
          }
        }

        if (columnMappings.value.language) {
          const languageHeaders = columnMappings.value.language.split(/,|，/).map(h => h.trim().toLowerCase())
          if (languageHeaders.includes(headerFromFile)) {
            if (value) song.language = parseMultipleValues(value)
          }
        }

        if (columnMappings.value.tags) {
          const tagsHeaders = columnMappings.value.tags.split(/,|，/).map(h => h.trim().toLowerCase())
          if (tagsHeaders.includes(headerFromFile)) {
            if (value) song.tags = parseMultipleValues(value)
          }
        }
      }

      if (!song.name) {
        console.log(`忽略无效记录（未找到歌名或歌名为空）: ${row.join(',')}`)
        return null
      }

      return song
    }).filter(s => s !== null) as SongsInfo[]

    uploadSongsFromFile.value = parsedSongs
    message.success(`解析完成, 共获取 ${uploadSongsFromFile.value.length} 首曲目`)
  }
}

async function addUploadFileSong() {
  if (selecteduploadSongs.value.length === 0) {
    message.error('请选择歌曲')
    return
  }

  emit('loadingChange', true)
  try {
    const songsToAdd = uploadSongsFromFile.value.filter(s =>
      selecteduploadSongs.value.find(select => s.name === select),
    )

    const data = await addSongsToSongList(songsToAdd, SongFrom.Custom)
    if (data.code !== 200) {
      message.error(`添加失败: ${data.message}`)
      return
    }

    message.success(`已添加 ${data.data.length} 首歌曲`)
    emit('added', data.data)
  } catch (err) {
    message.error(`添加失败: ${err}`)
    console.error(err)
  } finally {
    emit('loadingChange', false)
  }
}
</script>

<template>
  <NAlert type="info">
    Excel 文件格式详见:
    <NButton
      type="info"
      tag="a"
      href="https://www.wolai.com/hZWizjCnAdc6hDdntuWgcU"
      target="_blank"
      size="tiny"
    >
      此页面
    </NButton>
  </NAlert>

  <NDivider>
    导入设置
  </NDivider>

  <NFlex vertical>
    <NCheckbox v-model:checked="useCustomColumnMapping">
      自定义列头映射
      <NTooltip>
        <template #trigger>
          <NIcon :component="Info24Filled" />
        </template>
        启用后可以自定义Excel文件中列头与歌曲信息的对应关系
      </NTooltip>
    </NCheckbox>

    <NCollapse v-if="useCustomColumnMapping">
      <NCollapseItem title="自定义列头映射" name="custom-mapping">
        <NFlex vertical>
          <NAlert type="info">
            请输入各字段对应的Excel列头名称，多个名称用逗号分隔。导入时会自动匹配这些名称，不区分大小写。
          </NAlert>
          <NFormItem label="歌曲名称 (必填)">
            <NInput v-model:value="columnMappings.name" placeholder="使用逗号分隔多个可能的列头名称" />
          </NFormItem>
          <NFormItem label="翻译名称">
            <NInput v-model:value="columnMappings.translateName" placeholder="使用逗号分隔多个可能的列头名称" />
          </NFormItem>
          <NFormItem label="作者">
            <NInput v-model:value="columnMappings.author" placeholder="使用逗号分隔多个可能的列头名称" />
          </NFormItem>
          <NFormItem label="描述">
            <NInput v-model:value="columnMappings.description" placeholder="使用逗号分隔多个可能的列头名称" />
          </NFormItem>
          <NFormItem label="链接">
            <NInput v-model:value="columnMappings.url" placeholder="使用逗号分隔多个可能的列头名称" />
          </NFormItem>
          <NFormItem label="语言">
            <NInput v-model:value="columnMappings.language" placeholder="使用逗号分隔多个可能的列头名称" />
          </NFormItem>
          <NFormItem label="标签">
            <NInput v-model:value="columnMappings.tags" placeholder="使用逗号分隔多个可能的列头名称" />
          </NFormItem>
          <NFlex>
            <NButton type="primary" @click="saveColumnMappings">
              保存映射
            </NButton>
            <NButton type="warning" @click="resetColumnMappings">
              重置为默认映射
            </NButton>
          </NFlex>
          <NAlert type="info">
            设置完成后请点击"保存映射"，设置将自动保存到本地浏览器，下次访问时仍会使用
          </NAlert>
        </NFlex>
      </NCollapseItem>
    </NCollapse>
  </NFlex>

  <NDivider>
    文件上传
  </NDivider>

  <NUpload
    v-model:file-list="uploadFiles"
    :default-upload="false"
    :max="1"
    directory-dnd
    @before-upload="beforeUpload"
  >
    <NUploadDragger>
      <div style="margin-bottom: 12px">
        <NIcon size="48" :depth="3">
          <ArchiveOutline />
        </NIcon>
      </div>
      <NText style="font-size: 16px">
        点击或者拖动文件到该区域来上传
      </NText>
      <NP depth="3" style="margin: 8px 0 0 0">
        仅限 Excel 文件(.xlsx和.xls) 以及 csv 文件
      </NP>
    </NUploadDragger>
  </NUpload>
  <NButton type="primary" @click="parseExcelFile">
    解析
  </NButton>
  <template v-if="uploadSongsOptions.length > 0">
    <NDivider style="margin: 10px" />
    <NButton type="primary" @click="addUploadFileSong">
      添加到歌单 | {{ selecteduploadSongs.length }} 首
    </NButton>
    <NDivider style="margin: 10px" />
    <NTransfer
      v-model:value="selecteduploadSongs"
      style="height: 400px"
      :options="uploadSongsOptions"
      source-filterable
    />
  </template>
</template>
