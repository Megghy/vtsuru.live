<script setup lang="ts">
import { computed, ref } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import type { SelectOption } from '@/shared/types/VTsuruConfigTypes'

const props = defineProps<{
  existingSongs: SongsInfo[]
  authors: SelectOption[]
  tags: SelectOption[]
  languageSelectOption: SelectOption[]
}>()
const emit = defineEmits<{ added: [songs: SongsInfo[]]; loadingChange: [value: boolean] }>()
const toast = useToast()
const folderSongs = ref<SongsInfo[]>([])
const selectedFolderSongs = ref<string[]>([])
const isScanningFolder = ref(false)
const batchAuthors = ref<string[]>([])
const batchLanguages = ref<string[]>([])
const batchTags = ref<string[]>([])
const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.ape'])

const selectableSongs = computed(() => folderSongs.value.map((song) => ({
  song,
  id: song.key,
  unavailable: props.existingSongs.some((item) => item.name === song.name),
})))

async function scanDirectory(directory: any, files: { file: File; path: string }[], path: string): Promise<void> {
  for await (const entry of directory.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name
    if (entry.kind === 'directory') await scanDirectory(entry, files, entryPath)
    if (entry.kind === 'file' && audioExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase())) {
      files.push({ file: await entry.getFile(), path: entryPath })
    }
  }
}

function parseAudioFile(file: File, path: string): SongsInfo | null {
  const basename = file.name.slice(0, file.name.lastIndexOf('.')).trim()
  if (!basename) return null
  const spacedDashIndex = basename.indexOf(' - ')
  const plainDashIndex = basename.startsWith('-') ? -1 : basename.indexOf('-')
  const bracketMatch = /^(?:\[|【)([^\]】]+)(?:\]|】)(.+)$/.exec(basename)
  const titleMatch = /^([^《<]+)[《<]([^》>]+)[》>]$/.exec(basename)
  let rawAuthors = ''
  let name = basename

  if (spacedDashIndex > 0) {
    const firstPart = basename.slice(0, spacedDashIndex).trim()
    const remainingParts = basename.slice(spacedDashIndex + 3).trim()
    if (/[/、&]/.test(remainingParts)) {
      name = firstPart
      rawAuthors = remainingParts
    } else {
      rawAuthors = firstPart
      name = remainingParts
    }
  } else if (plainDashIndex > 0) {
    rawAuthors = basename.slice(0, plainDashIndex).trim()
    name = basename.slice(plainDashIndex + 1).trim()
  } else if (bracketMatch) {
    rawAuthors = bracketMatch[1]
    name = bracketMatch[2].trim()
  } else if (titleMatch) {
    rawAuthors = titleMatch[1]
    name = titleMatch[2].trim()
  }

  if (!name) return null
  return {
    id: 0,
    key: crypto.randomUUID(),
    name,
    author: rawAuthors ? rawAuthors.split(/[/、&]/).map((item) => item.trim()).filter(Boolean) : ['未知'],
    url: URL.createObjectURL(file),
    description: `从文件导入：${path}`,
    from: SongFrom.Custom,
    language: [],
    tags: [],
    createTime: Date.now(),
    updateTime: Date.now(),
  }
}

function selectedSongs() {
  return folderSongs.value.filter((song) => selectedFolderSongs.value.includes(song.key))
}

function batchEdit(field: 'author' | 'language' | 'tags', value: string[]) {
  const songs = selectedSongs()
  songs.forEach((song) => { song[field] = [...value] })
  toast.add({ title: `已更新 ${songs.length} 首歌曲的${field === 'author' ? '作者' : field === 'language' ? '语言' : '标签'}`, color: 'success' })
}

async function selectFolder() {
  const picker = (window as Window & { showDirectoryPicker?: () => Promise<any> }).showDirectoryPicker
  if (!picker) {
    toast.add({ title: '当前浏览器不支持文件夹选择，请使用新版 Chrome 或 Edge', color: 'error' })
    return
  }
  isScanningFolder.value = true
  try {
    const files: { file: File; path: string }[] = []
    await scanDirectory(await picker(), files, '')
    folderSongs.value = files.flatMap(({ file, path }) => {
      const song = parseAudioFile(file, path)
      return song ? [song] : []
    })
    selectedFolderSongs.value = []
    toast.add({ title: folderSongs.value.length ? `成功解析 ${folderSongs.value.length} 首歌曲` : '未找到音频文件', color: folderSongs.value.length ? 'success' : 'warning' })
  } catch (error) {
    if ((error as DOMException).name !== 'AbortError') {
      toast.add({ title: `扫描文件夹失败：${error instanceof Error ? error.message : String(error)}`, color: 'error' })
    }
  } finally {
    isScanningFolder.value = false
  }
}

async function addFolderSongs() {
  const songs = selectedSongs()
  if (!songs.length) {
    toast.add({ title: '请选择要添加的歌曲', color: 'warning' })
    return
  }
  emit('loadingChange', true)
  try {
    const result = await addSongsToSongList(songs.map((song) => ({ ...song, description: `${song.description ?? ''}（本地文件链接仅在当前浏览器会话有效）` })), SongFrom.Custom)
    if (result.code !== 200) throw new Error(result.message)
    emit('added', result.data)
    selectedFolderSongs.value = []
    toast.add({ title: `已添加 ${result.data.length} 首歌曲`, color: 'success' })
  } catch (error) {
    toast.add({ title: `添加失败：${error instanceof Error ? error.message : String(error)}`, color: 'error' })
  } finally {
    emit('loadingChange', false)
  }
}
</script>

<template>
  <div class="directory-import">
    <div class="directory-import__notice">
      选择本地文件夹后会递归读取音频文件。导入链接仅在当前浏览器会话有效，刷新后需要重新导入。
    </div>
    <UButton icon="i-lucide-folder-open" :loading="isScanningFolder" label="选择文件夹" @click="selectFolder" />
    <template v-if="selectableSongs.length">
      <details>
        <summary>批量编辑已选歌曲</summary>
        <div class="directory-import__batch">
          <UFormField label="作者"><USelectMenu v-model="batchAuthors" :items="authors" value-key="value" multiple create-item placeholder="选择或输入作者" @update:model-value="batchEdit('author', batchAuthors)" /></UFormField>
          <UFormField label="语言"><USelectMenu v-model="batchLanguages" :items="languageSelectOption" value-key="value" multiple create-item placeholder="选择或输入语言" @update:model-value="batchEdit('language', batchLanguages)" /></UFormField>
          <UFormField label="标签"><USelectMenu v-model="batchTags" :items="tags" value-key="value" multiple create-item placeholder="选择或输入标签" @update:model-value="batchEdit('tags', batchTags)" /></UFormField>
        </div>
      </details>
      <UButton :disabled="selectedFolderSongs.length === 0" :label="`添加到歌单（${selectedFolderSongs.length}）`" @click="addFolderSongs" />
      <label v-for="{ song, id, unavailable } in selectableSongs" :key="id" class="directory-import__song" :class="{ 'is-disabled': unavailable }">
        <input v-model="selectedFolderSongs" type="checkbox" :value="id" :disabled="unavailable">
        <span>{{ song.name }}</span>
        <span class="directory-import__meta">{{ song.author.join(' / ') }}</span>
        <UBadge v-if="unavailable" label="已存在" color="neutral" variant="subtle" />
      </label>
    </template>
  </div>
</template>

<style scoped>
.directory-import, .directory-import__batch { display: grid; gap: 14px; }
.directory-import__notice { padding: 10px 12px; color: var(--vtsuru-fg-muted); background: var(--vtsuru-brand-soft); border-radius: 8px; }
.directory-import__batch { padding: 14px 2px; }
.directory-import__song { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(120px, .7fr) auto; gap: 10px; align-items: center; padding: 9px 10px; border: 1px solid var(--vtsuru-border); border-radius: 8px; }
.directory-import__meta { color: var(--vtsuru-fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.directory-import__song.is-disabled { opacity: .58; }
</style>
