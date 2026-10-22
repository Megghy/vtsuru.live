<script setup lang="ts">
import { ArchiveOutline } from '@vicons/ionicons5'
import { computed, ref } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { Transfer, type TransferOption } from '@/shared/ui/transfer'
import { useMessage } from '@/shared/utils'

interface OptionItem {
  label: string
  value: string
}

const props = defineProps<{
  existingSongs: SongsInfo[]
  authors: OptionItem[]
  tags: OptionItem[]
  languageSelectOption: OptionItem[]
}>()

const emit = defineEmits<{
  (e: 'added', songs: SongsInfo[]): void
  (e: 'loadingChange', value: boolean): void
}>()

const message = useMessage()

const folderSongs = ref<SongsInfo[]>([])
const folderSongsOptions = ref<TransferOption[]>([])
const selectedFolderSongs = ref<string[]>([])
const isScanningFolder = ref(false)

const showBatchEdit = ref(false)
const batchAuthorInput = ref('')
const batchLanguageInput = ref('')
const batchTagInput = ref('')

defineExpose({
  add: addFolderSongs,
  canAdd: computed(() => selectedFolderSongs.value.length > 0),
  label: computed(() => `添加到歌单 | ${selectedFolderSongs.value.length} 首`),
})

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.ape'])

async function scanDirectory(
  directoryHandle: any,
  audioFiles: { name: string; file: File; path: string }[],
  currentPath: string,
) {
  for await (const entry of directoryHandle.values()) {
    const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name

    if (entry.kind === 'file') {
      const ext = entry.name.substring(entry.name.lastIndexOf('.')).toLowerCase()
      if (AUDIO_EXTENSIONS.has(ext)) {
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
    const parts = nameWithoutExt.split(' - ').map((p) => p.trim())
    if (parts.length >= 2) {
      author = parts[0]
        .split(/[/、&]/)
        .map((a) => a.trim())
        .filter((a) => a)
      name = parts.slice(1).join(' - ')

      if (parts[1].match(/[/、&]/)) {
        name = parts[0]
        author = parts
          .slice(1)
          .join(' - ')
          .split(/[/、&]/)
          .map((a) => a.trim())
          .filter((a) => a)
      }
    }
  } else if (nameWithoutExt.includes('-') && !nameWithoutExt.startsWith('-')) {
    const parts = nameWithoutExt.split('-').map((p) => p.trim())
    if (parts.length >= 2) {
      author = parts[0]
        .split(/[/、&]/)
        .map((a) => a.trim())
        .filter((a) => a)
      name = parts.slice(1).join('-')
    }
  } else if (nameWithoutExt.match(/^(?:\[|【)([^\]】]+)(?:\]|】)(.+)$/)) {
    const match = nameWithoutExt.match(/^(?:\[|【)([^\]】]+)(?:\]|】)(.+)$/)
    if (match) {
      author = match[1]
        .split(/[/、&]/)
        .map((a) => a.trim())
        .filter((a) => a)
      name = match[2].trim()
    }
  } else if (nameWithoutExt.match(/^([^《<]+)[《<]([^》>]+)[》>]$/)) {
    const match = nameWithoutExt.match(/^([^《<]+)[《<]([^》>]+)[》>]$/)
    if (match) {
      author = match[1]
        .split(/[/、&]/)
        .map((a) => a.trim())
        .filter((a) => a)
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
  folderSongsOptions.value = folderSongs.value.map((s) => ({
    label: `${s.name} - ${s.author?.join('/') || '未知'}`,
    value: `${s.name}_${(s as any)._filePath}`,
    disabled:
      props.existingSongs.some((exist) => exist.name === s.name) ||
      newlyAddedSongs.some((add) => add.name === s.name),
  }))
}

function batchEditFolderSongs(field: 'author' | 'language' | 'tags', value: string[]) {
  const selectedSongs = folderSongs.value.filter((s) =>
    selectedFolderSongs.value.includes(`${s.name}_${(s as any)._filePath}`),
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
  message.success(
    `已更新 ${selectedSongs.length} 首歌曲的${field === 'author' ? '作者' : field === 'language' ? '语言' : '标签'}信息`,
  )
}

async function addFolderSongs() {
  if (selectedFolderSongs.value.length === 0) {
    message.error('请选择要添加的歌曲')
    return
  }

  emit('loadingChange', true)
  try {
    const songsToAdd = folderSongs.value.filter((s) =>
      selectedFolderSongs.value.includes(`${s.name}_${(s as any)._filePath}`),
    )

    const result = await addSongsToSongList(
      songsToAdd.map((s) => ({
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
    emit('added', result.data as unknown as SongsInfo[])
    updateFolderSongsOptions(result.data as unknown as SongsInfo[])
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

    const audioFiles: { name: string; file: File; path: string }[] = []
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
  <div class="space-y-4">
    <Alert variant="default" class="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 py-2.5">
      <AlertTitle class="text-xs font-semibold">功能说明</AlertTitle>
      <AlertDescription class="text-xs space-y-1 mt-1">
        <div>选择本地文件夹，自动扫描其中的音频文件（支持 MP3、WAV、OGG、FLAC、M4A 等格式）</div>
        <p class="text-destructive font-medium">
          注意：导入的歌曲链接为本地文件地址，仅在当前浏览器会话有效。刷新页面后可能需要重新导入。
        </p>
      </AlertDescription>
    </Alert>

    <div class="flex items-center gap-2">
      <Button :disabled="isScanningFolder" class="gap-1.5" @click="selectFolder">
        <ArchiveOutline class="size-4" />
        {{ isScanningFolder ? '正在扫描...' : '选择本地文件夹' }}
      </Button>
    </div>

    <template v-if="folderSongsOptions.length > 0">
      <Separator />

      <!-- 批量工具 -->
      <div class="space-y-2">
        <Button variant="outline" size="xs" @click="showBatchEdit = !showBatchEdit">
          {{ showBatchEdit ? '收起批量设置工具' : '展开批量设置工具' }}
        </Button>

        <div v-if="showBatchEdit" class="p-3 rounded-lg border border-border bg-muted/20 space-y-2 text-xs">
          <p class="text-muted-foreground text-[11px]">选中歌曲后，可以批量设置作者、语言或标签信息</p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div class="flex items-center gap-1.5">
              <Input size="xs" v-model="batchAuthorInput" placeholder="输入作者" class="flex-1" />
              <Button size="xs" variant="outline" @click="batchEditFolderSongs('author', [batchAuthorInput]); batchAuthorInput = ''">
                设置作者
              </Button>
            </div>
            <div class="flex items-center gap-1.5">
              <Input size="xs" v-model="batchLanguageInput" placeholder="输入语言" class="flex-1" />
              <Button size="xs" variant="outline" @click="batchEditFolderSongs('language', [batchLanguageInput]); batchLanguageInput = ''">
                设置语言
              </Button>
            </div>
            <div class="flex items-center gap-1.5">
              <Input size="xs" v-model="batchTagInput" placeholder="输入标签" class="flex-1" />
              <Button size="xs" variant="outline" @click="batchEditFolderSongs('tags', [batchTagInput]); batchTagInput = ''">
                设置标签
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Transfer
        v-model="selectedFolderSongs"
        :options="folderSongsOptions"
        source-title="文件夹音频"
        target-title="待添加歌曲"
      />
    </template>
  </div>
</template>
