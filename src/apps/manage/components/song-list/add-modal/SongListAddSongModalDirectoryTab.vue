<script setup lang="ts">
import type { SongsInfo } from '@/api/api-models'
import type { SelectOption } from 'naive-ui'
import type { Option } from 'naive-ui/es/transfer/src/interface'
import { SongFrom } from '@/api/api-models'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { ArchiveOutline } from '@vicons/ionicons5'
import {
  NAlert, NButton, NCollapse, NCollapseItem, NDivider, NIcon, NSelect, NFlex, NText, NTransfer, useMessage } from 'naive-ui';
import { ref } from 'vue'

const props = defineProps<{
  existingSongs: SongsInfo[]
  authors: SelectOption[]
  tags: SelectOption[]
  languageSelectOption: SelectOption[]
}>()

const emit = defineEmits<{
  (e: 'added', songs: SongsInfo[]): void
  (e: 'loadingChange', value: boolean): void
}>()

const message = useMessage()

const folderSongs = ref<SongsInfo[]>([])
const folderSongsOptions = ref<Option[]>([])
const selectedFolderSongs = ref<string[]>([])
const isScanningFolder = ref(false)

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.ape']

async function scanDirectory(
  directoryHandle: any,
  audioFiles: { name: string, file: File, path: string }[],
  currentPath: string,
) {
  for await (const entry of directoryHandle.values()) {
    const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name

    if (entry.kind === 'file') {
      const ext = entry.name.substring(entry.name.lastIndexOf('.')).toLowerCase()
      if (AUDIO_EXTENSIONS.includes(ext)) {
        const file = await entry.getFile()
        audioFiles.push({ name: entry.name, file, path: entryPath })
      }
    } else if (entry.kind === 'directory') {
      await scanDirectory(entry, audioFiles, entryPath)
    }
  }
}

function parseAudioFileName(fileName: string, file: File, filePath: string): SongsInfo | null {
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'))

  let name = ''
  let author: string[] = []

  if (nameWithoutExt.includes(' - ')) {
    const parts = nameWithoutExt.split(' - ').map(p => p.trim())
    if (parts.length >= 2) {
      author = parts[0].split(/[/、&]/).map(a => a.trim()).filter(a => a)
      name = parts.slice(1).join(' - ')

      if (parts[1].match(/[/、&]/)) {
        name = parts[0]
        author = parts.slice(1).join(' - ').split(/[/、&]/).map(a => a.trim()).filter(a => a)
      }
    }
  } else if (nameWithoutExt.includes('-') && !nameWithoutExt.startsWith('-')) {
    const parts = nameWithoutExt.split('-').map(p => p.trim())
    if (parts.length >= 2) {
      author = parts[0].split(/[/、&]/).map(a => a.trim()).filter(a => a)
      name = parts.slice(1).join('-')
    }
  } else if (nameWithoutExt.match(/^(?:\[|【)([^\]】]+)(?:\]|】)(.+)$/)) {
    const match = nameWithoutExt.match(/^(?:\[|【)([^\]】]+)(?:\]|】)(.+)$/)
    if (match) {
      author = match[1].split(/[/、&]/).map(a => a.trim()).filter(a => a)
      name = match[2].trim()
    }
  } else if (nameWithoutExt.match(/^([^《<]+)[《<]([^》>]+)[》>]$/)) {
    const match = nameWithoutExt.match(/^([^《<]+)[《<]([^》>]+)[》>]$/)
    if (match) {
      author = match[1].split(/[/、&]/).map(a => a.trim()).filter(a => a)
      name = match[2].trim()
    }
  } else {
    name = nameWithoutExt.trim()
  }

  if (!name) return null

  const url = URL.createObjectURL(file)

  return {
    id: 0,
    key: '',
    name,
    author: author.length > 0 ? author : ['未知'],
    url,
    description: `从文件导入: ${filePath}`,
    language: [],
    tags: [],
    from: SongFrom.Custom,
    createTime: Date.now(),
    updateTime: Date.now(),
    // @ts-ignore
    _originalFile: file,
    // @ts-ignore
    _filePath: filePath,
  } as SongsInfo
}

function updateFolderSongsOptions(newlyAddedSongs: SongsInfo[] = []) {
  folderSongsOptions.value = folderSongs.value.map(s => ({
    label: `${s.name} - ${s.author?.join('/') || '未知'}`,
    value: `${s.name}_${(s as any)._filePath}`,
    disabled:
      props.existingSongs.findIndex(exist => exist.name === s.name) > -1
      || newlyAddedSongs.findIndex(add => add.name === s.name) > -1,
  }))
}

function batchEditFolderSongs(field: 'author' | 'language' | 'tags', value: string[]) {
  const selectedSongs = folderSongs.value.filter(s =>
    selectedFolderSongs.value.find(select => select === (`${s.name}_${(s as any)._filePath}`)),
  )

  selectedSongs.forEach((song) => {
    if (field === 'author') {
      song.author = value
    } else if (field === 'language') {
      song.language = value
    } else if (field === 'tags') {
      song.tags = value
    }
  })

  updateFolderSongsOptions()
  message.success(`已更新 ${selectedSongs.length} 首歌曲的${field === 'author' ? '作者' : field === 'language' ? '语言' : '标签'}信息`)
}

async function addFolderSongs() {
  if (selectedFolderSongs.value.length === 0) {
    message.error('请选择要添加的歌曲')
    return
  }

  emit('loadingChange', true)
  try {
    const songsToAdd = folderSongs.value.filter(s =>
      selectedFolderSongs.value.find(select => select === (`${s.name}_${(s as any)._filePath}`)),
    )

    const result = await addSongsToSongList(
      songsToAdd.map(s => ({
        ...s,
        description: `${s.description || ''} [注意: 链接为本地文件，刷新页面后可能失效]`,
      })),
      SongFrom.Custom,
    )

    if (result.code !== 200) {
      message.error(`添加失败: ${result.message}`)
      return
    }

    message.success(`已添加 ${result.data.length} 首歌曲`)
    emit('added', result.data)
    updateFolderSongsOptions(result.data)
  } catch (err: any) {
    message.error(`添加失败: ${err.message}`)
    console.error(err)
  } finally {
    emit('loadingChange', false)
  }
}

async function selectFolder() {
  try {
    if (!('showDirectoryPicker' in window)) {
      message.error('您的浏览器不支持文件夹选择功能，请使用最新版本的 Chrome、Edge 或其他现代浏览器')
      return
    }

    isScanningFolder.value = true
    folderSongs.value = []

    // @ts-ignore
    const directoryHandle = await window.showDirectoryPicker({ mode: 'read' })
    message.info('正在扫描文件夹...')

    const audioFiles: { name: string, file: File, path: string }[] = []
    await scanDirectory(directoryHandle, audioFiles, '')

    if (audioFiles.length === 0) {
      message.warning('未在文件夹中找到音频文件')
      return
    }

    message.info(`找到 ${audioFiles.length} 个音频文件，正在解析...`)
    for (const audioFile of audioFiles) {
      const songInfo = parseAudioFileName(audioFile.name, audioFile.file, audioFile.path)
      if (songInfo) folderSongs.value.push(songInfo)
    }

    updateFolderSongsOptions()
    message.success(`成功解析 ${folderSongs.value.length} 首歌曲`)
  } catch (err: any) {
    if (err.name === 'AbortError') {
      message.info('已取消选择')
      return
    }
    console.error(err)
    message.error(`扫描文件夹失败: ${err.message}`)
  } finally {
    isScanningFolder.value = false
  }
}
</script>

<template>
  <NAlert type="info" style="margin-bottom: 16px">
    <template #header>
      功能说明
    </template>
    <NFlex vertical>
      <div>选择本地文件夹，自动扫描其中的音频文件（支持 MP3、WAV、OGG、FLAC、M4A 等格式）</div>
      <div>支持的文件名格式：</div>
      <ul style="margin: 8px 0; padding-left: 20px">
        <li>歌名.mp3</li>
        <li>歌手 - 歌名.mp3</li>
        <li>歌手-歌名.mp3</li>
        <li>[歌手] 歌名.mp3</li>
        <li>歌手 《歌名》.mp3</li>
      </ul>
      <NText type="error">
        <strong>注意：</strong>导入的歌曲链接为本地文件地址，仅在当前浏览器会话有效。刷新页面后可能需要重新导入。
      </NText>
    </NFlex>
  </NAlert>

  <NButton type="primary" :loading="isScanningFolder" @click="selectFolder">
    <template #icon>
      <NIcon :component="ArchiveOutline" />
    </template>
    选择文件夹
  </NButton>

  <template v-if="folderSongsOptions.length > 0">
    <NDivider style="margin: 16px 0" />

    <NCollapse>
      <NCollapseItem title="批量编辑工具" name="batch-edit">
        <NFlex vertical style="width: 100%">
          <NAlert type="info">
            选中歌曲后，可以批量设置作者、语言或标签信息
          </NAlert>
          <NFlex align="center">
            <span>批量设置作者：</span>
            <NSelect
              style="width: 300px"
              :options="authors"
              filterable
              multiple
              tag
              placeholder="选择或输入作者"
              @update:value="(value) => batchEditFolderSongs('author', value)"
            />
          </NFlex>
          <NFlex align="center">
            <span>批量设置语言：</span>
            <NSelect
              style="width: 300px"
              :options="languageSelectOption"
              filterable
              multiple
              tag
              placeholder="选择或输入语言"
              @update:value="(value) => batchEditFolderSongs('language', value)"
            />
          </NFlex>
          <NFlex align="center">
            <span>批量设置标签：</span>
            <NSelect
              style="width: 300px"
              :options="tags"
              filterable
              multiple
              tag
              placeholder="选择或输入标签"
              @update:value="(value) => batchEditFolderSongs('tags', value)"
            />
          </NFlex>
        </NFlex>
      </NCollapseItem>
    </NCollapse>

    <NDivider style="margin: 16px 0" />

    <NButton type="primary" @click="addFolderSongs">
      添加到歌单 | {{ selectedFolderSongs.length }} 首
    </NButton>

    <NDivider style="margin: 16px 0" />

    <NTransfer
      v-model:value="selectedFolderSongs"
      style="height: 500px"
      :options="folderSongsOptions"
      source-filterable
    />
  </template>
</template>
