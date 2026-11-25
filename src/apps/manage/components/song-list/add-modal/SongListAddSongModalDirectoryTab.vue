<script setup lang="ts">
import { FolderOpen } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { Transfer, type TransferOption } from '@/shared/ui/transfer'
import { useMessage } from '@/shared/utils'

interface OptionItem {
  label: string
  value: string
}

const props = defineProps<{
  existingSongs: ResponseSongModel[]
  authors: OptionItem[]
  tags: OptionItem[]
  languageSelectOption: OptionItem[]
}>()

const emit = defineEmits<{
  (e: 'added', songs: ResponseSongModel[]): void
  (e: 'loadingChange', value: boolean): void
}>()

const message = useMessage()

const folderSongs = ref<ResponseSongModel[]>([])
const folderSongsOptions = ref<TransferOption[]>([])
const selectedFolderSongs = ref<string[]>([])
const isScanningFolder = ref(false)
const useFolderAsTag = ref(true)

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
  audioFiles: { name: string; path: string; folderTags: string[] }[],
  folderParts: string[],
) {
  for await (const entry of directoryHandle.values()) {
    if (entry.kind === 'file') {
      const dotIdx = entry.name.lastIndexOf('.')
      const ext = dotIdx >= 0 ? entry.name.substring(dotIdx).toLowerCase() : ''
      if (AUDIO_EXTENSIONS.has(ext)) {
        const entryPath = folderParts.length ? `${folderParts.join('/')}/${entry.name}` : entry.name
        audioFiles.push({ name: entry.name, path: entryPath, folderTags: [...folderParts] })
      }
    } else if (entry.kind === 'directory') {
      await scanDirectory(entry, audioFiles, [...folderParts, entry.name])
    }
  }
}

function parseAudioFileName(fileName: string, filePath: string, folderTags: string[]): ResponseSongModel | null {
  const dotIdx = fileName.lastIndexOf('.')
  const nameWithoutExt = dotIdx >= 0 ? fileName.substring(0, dotIdx) : fileName

  let name = ''
  let author: string[] = []

  if (nameWithoutExt.includes(' - ')) {
    const parts = nameWithoutExt.split(' - ').map((p) => p.trim())
    if (parts.length >= 2) {
      author = parts[0]
        .split(/[/、&]/)
        .map((a) => a.trim())
        .filter(Boolean)
      name = parts.slice(1).join(' - ')

      if (parts[1].match(/[/、&]/)) {
        name = parts[0]
        author = parts
          .slice(1)
          .join(' - ')
          .split(/[/、&]/)
          .map((a) => a.trim())
          .filter(Boolean)
      }
    }
  } else if (nameWithoutExt.includes('-') && !nameWithoutExt.startsWith('-')) {
    const parts = nameWithoutExt.split('-').map((p) => p.trim())
    if (parts.length >= 2) {
      author = parts[0]
        .split(/[/、&]/)
        .map((a) => a.trim())
        .filter(Boolean)
      name = parts.slice(1).join('-')
    }
  } else if (nameWithoutExt.match(/^(?:\[|【)([^\]】]+)(?:\]|】)(.+)$/)) {
    const match = nameWithoutExt.match(/^(?:\[|【)([^\]】]+)(?:\]|】)(.+)$/)
    if (match) {
      author = match[1]
        .split(/[/、&]/)
        .map((a) => a.trim())
        .filter(Boolean)
      name = match[2].trim()
    }
  } else if (nameWithoutExt.match(/^([^《<]+)[《<]([^》>]+)[》>]$/)) {
    const match = nameWithoutExt.match(/^([^《<]+)[《<]([^》>]+)[》>]$/)
    if (match) {
      author = match[1]
        .split(/[/、&]/)
        .map((a) => a.trim())
        .filter(Boolean)
      name = match[2].trim()
    }
  } else {
    name = nameWithoutExt.trim()
  }

  if (!name) return null

  return {
    id: -1,
    key: '',
    name,
    author: author.length > 0 ? author : ['未知'],
    url: undefined,
    description: undefined,
    language: [],
    tags: useFolderAsTag.value ? folderTags.filter(Boolean) : [],
    aliases: [],
    from: SongPlatform.Custom,
    createTime: Date.now(),
    updateTime: Date.now(),
    // @ts-ignore
    _filePath: filePath,
  } as ResponseSongModel
}

function updateFolderSongsOptions(newlyAddedSongs: ResponseSongModel[] = []) {
  folderSongsOptions.value = folderSongs.value.map((s) => ({
    label: `${s.name} - ${s.author?.join('/') || '未知'}`,
    value: `${s.name}_${(s as any)._filePath}`,
    disabled:
      props.existingSongs.some((exist) => exist.name === s.name) || newlyAddedSongs.some((add) => add.name === s.name),
  }))
}

function batchEditFolderSongs(field: 'author' | 'language' | 'tags', rawInput: string) {
  const values = rawInput
    .split(/[,，]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!values.length) {
    message.warning('请输入有效内容')
    return
  }

  const selectedSongs = folderSongs.value.filter((s) =>
    selectedFolderSongs.value.includes(`${s.name}_${(s as any)._filePath}`),
  )
  if (!selectedSongs.length) {
    message.warning('请先在右侧勾选要设置的歌曲')
    return
  }

  selectedSongs.forEach((song) => {
    if (field === 'author') song.author = values
    else if (field === 'language') song.language = values
    else if (field === 'tags') song.tags = [...new Set([...(song.tags ?? []), ...values])]
  })

  if (field === 'author') batchAuthorInput.value = ''
  else if (field === 'language') batchLanguageInput.value = ''
  else batchTagInput.value = ''

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

    const result = await addSongsToSongList(songsToAdd, SongPlatform.Custom)

    if (result.code !== 200) {
      message.error(`添加失败: ${result.message}`)
      return
    }

    message.success(`已添加 ${result.data.length} 首歌曲`)
    emit('added', result.data as unknown as ResponseSongModel[])
    updateFolderSongsOptions(result.data as unknown as ResponseSongModel[])
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

    const audioFiles: { name: string; path: string; folderTags: string[] }[] = []
    await scanDirectory(directoryHandle, audioFiles, [])

    if (audioFiles.length === 0) {
      message.warning('未在文件夹中找到音频文件')
      return
    }

    for (const audioFile of audioFiles) {
      const songInfo = parseAudioFileName(audioFile.name, audioFile.path, audioFile.folderTags)
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
    <Alert
      size="sm"
      variant="info"
    >
      <AlertTitle>本地伴奏 / 曲库文件扫描</AlertTitle>
      <AlertDescription class="space-y-1 mt-1">
        <div>仅从本地文件夹解析文件名中的歌名、歌手与子目录分类并入库（不会将本机临时文件链接写入云端歌单）。</div>
      </AlertDescription>
    </Alert>

    <div class="flex flex-wrap items-center gap-3">
      <Button
        :disabled="isScanningFolder"
        class="gap-1.5"
        @click="selectFolder"
      >
        <FolderOpen class="size-4" />
        {{ isScanningFolder ? '正在扫描...' : '选择本地文件夹' }}
      </Button>

      <label class="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground select-none">
        <Checkbox v-model:checked="useFolderAsTag" />
        <span>将子文件夹名自动设为歌曲标签</span>
      </label>
    </div>

    <template v-if="folderSongsOptions.length > 0">
      <Separator />

      <!-- 批量工具 -->
      <div class="space-y-2">
        <Button
          variant="outline"
          size="xs"
          @click="showBatchEdit = !showBatchEdit"
        >
          {{ showBatchEdit ? '收起批量设置工具' : '展开批量设置工具' }}
        </Button>

        <div
          v-if="showBatchEdit"
          class="p-3 rounded-lg border border-border bg-muted/20 space-y-2 text-xs"
        >
          <p class="text-muted-foreground text-[11px]">选中右侧待添加歌曲后，可批量覆盖或追加作者、语言或标签信息</p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div class="flex items-center gap-1.5 min-w-0">
              <Input
                v-model="batchAuthorInput"
                placeholder="输入作者"
                class="flex-1 min-w-0"
              />
              <Button
                size="xs"
                variant="outline"
                @click="batchEditFolderSongs('author', batchAuthorInput)"
              >
                设置作者
              </Button>
            </div>
            <div class="flex items-center gap-1.5 min-w-0">
              <Input
                v-model="batchLanguageInput"
                placeholder="输入语言"
                class="flex-1 min-w-0"
              />
              <Button
                size="xs"
                variant="outline"
                @click="batchEditFolderSongs('language', batchLanguageInput)"
              >
                设置语言
              </Button>
            </div>
            <div class="flex items-center gap-1.5 min-w-0">
              <Input
                v-model="batchTagInput"
                placeholder="输入标签"
                class="flex-1 min-w-0"
              />
              <Button
                size="xs"
                variant="outline"
                @click="batchEditFolderSongs('tags', batchTagInput)"
              >
                追加标签
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
