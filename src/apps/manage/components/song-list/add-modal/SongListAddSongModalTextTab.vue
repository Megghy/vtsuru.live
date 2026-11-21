<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import SongTagChipInput, { type ChipOption } from '@/components/song-list/SongTagChipInput.vue'
import { FormField } from '@/shared/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Textarea } from '@/shared/ui/textarea'
import { Transfer, type TransferOption } from '@/shared/ui/transfer'
import { useMessage } from '@/shared/utils'

type TextParseFormat = 'song-artist' | 'artist-song' | 'name-only' | 'delimited'

interface ParsedTextRow {
  rowKey: string
  song: ResponseSongModel
}

const props = defineProps<{
  existingSongs: ResponseSongModel[]
  tags: ChipOption[]
  languageOptions: ChipOption[]
}>()

const emit = defineEmits<{
  (e: 'added', songs: ResponseSongModel[]): void
  (e: 'loadingChange', value: boolean): void
}>()

const message = useMessage()

const rawText = ref('')
const parseFormat = ref<TextParseFormat>('song-artist')
const defaultLanguages = ref<string[]>([])
const defaultTags = ref<string[]>([])
const parsedRows = ref<ParsedTextRow[]>([])
const selectedKeys = ref<string[]>([])
const sessionAddedNames = ref(new Set<string>())
const isAdding = ref(false)

function splitMulti(text: string): string[] {
  return text
    .split(/[/、,，]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function isSongExists(name: string): boolean {
  if (sessionAddedNames.value.has(name)) return true
  return props.existingSongs.some((s) => s.name === name)
}

function parseLines() {
  const lines = rawText.value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (!lines.length) {
    parsedRows.value = []
    selectedKeys.value = []
    return
  }

  const seenInBatch = new Set<string>()
  const nextRows: ParsedTextRow[] = []

  lines.forEach((line, idx) => {
    let name = ''
    let author: string[] = []
    let language: string[] = [...defaultLanguages.value]
    let tags: string[] = [...defaultTags.value]
    let description: string | undefined

    if (parseFormat.value === 'name-only') {
      name = line
    } else if (parseFormat.value === 'delimited') {
      const parts = line.split(/[|\t]/).map((p) => p.trim())
      name = parts[0] ?? ''
      if (parts[1]) author = splitMulti(parts[1])
      if (parts[2]) language = splitMulti(parts[2])
      if (parts[3]) tags = splitMulti(parts[3])
      if (parts[4]) description = parts[4]
    } else {
      const sepMatch = /\s+[-–—]\s+/.exec(line) ?? /[-–—]/.exec(line)
      if (sepMatch && sepMatch.index !== undefined) {
        const left = line.slice(0, sepMatch.index).trim()
        const right = line.slice(sepMatch.index + sepMatch[0].length).trim()
        if (parseFormat.value === 'song-artist') {
          name = left
          author = splitMulti(right)
        } else {
          author = splitMulti(left)
          name = right
        }
      } else {
        name = line
      }
    }

    if (!name || seenInBatch.has(name)) return
    seenInBatch.add(name)

    const now = Date.now()
    nextRows.push({
      rowKey: `${idx}::${name}`,
      song: {
        id: -1,
        key: '',
        name,
        author: author.length ? author : ['未知'],
        from: SongPlatform.Custom,
        language,
        tags,
        description,
        createTime: now,
        updateTime: now,
      },
    })
  })

  parsedRows.value = nextRows
  selectedKeys.value = nextRows.filter((r) => !isSongExists(r.song.name)).map((r) => r.rowKey)
}

watch([rawText, parseFormat, defaultLanguages, defaultTags], parseLines, { deep: true })

const transferOptions = computed<TransferOption[]>(() =>
  parsedRows.value.map((row) => ({
    label: `${row.song.name} - ${row.song.author.join('/')}`,
    value: row.rowKey,
    disabled: isSongExists(row.song.name),
  })),
)

const selectedNewRows = computed(() => {
  const chosen = new Set(selectedKeys.value)
  return parsedRows.value.filter((r) => chosen.has(r.rowKey) && !isSongExists(r.song.name))
})

const canAdd = computed(() => !isAdding.value && selectedNewRows.value.length > 0)

async function addTextSongs() {
  if (isAdding.value) return
  const targets = selectedNewRows.value.map((r) => r.song)
  if (!targets.length) {
    message.warning('没有可添加的新歌曲')
    return
  }

  isAdding.value = true
  emit('loadingChange', true)
  try {
    const res = await addSongsToSongList(targets, SongPlatform.Custom)
    if (res.code !== 200) {
      message.error(`添加失败: ${res.message}`)
      return
    }
    const nextNames = new Set(sessionAddedNames.value)
    for (const s of targets) nextNames.add(s.name)
    sessionAddedNames.value = nextNames
    selectedKeys.value = []

    const added = (res.data ?? []) as unknown as ResponseSongModel[]
    message.success(`已添加 ${added.length} 首歌曲`)
    if (added.length) emit('added', added)
  } catch (err) {
    message.error(`添加失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isAdding.value = false
    emit('loadingChange', false)
  }
}

defineExpose({
  add: addTextSongs,
  canAdd,
  label: computed(() => `添加到歌单 | ${selectedNewRows.value.length} 首`),
})
</script>

<template>
  <div class="space-y-4 text-xs">
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <FormField
        label="文本格式"
        class="min-w-0"
      >
        <Select v-model="parseFormat">
          <SelectTrigger class="w-full">
            <SelectValue placeholder="选择每行格式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="song-artist">歌名 - 歌手（每行一首）</SelectItem>
            <SelectItem value="artist-song">歌手 - 歌名（每行一首）</SelectItem>
            <SelectItem value="name-only">仅歌名（每行一首）</SelectItem>
            <SelectItem value="delimited">分隔符（歌名 | 歌手 | 语言 | 标签 | 备注）</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField
        label="默认语言（单行未指定时套用）"
        class="min-w-0"
      >
        <SongTagChipInput
          v-model="defaultLanguages"
          :options="languageOptions"
          placeholder="可选默认语言"
          :max-suggestions="8"
        />
      </FormField>

      <FormField
        label="默认标签（单行未指定时套用）"
        class="min-w-0"
      >
        <SongTagChipInput
          v-model="defaultTags"
          :options="tags"
          placeholder="可选默认标签"
          :max-suggestions="8"
        />
      </FormField>
    </div>

    <FormField
      label="粘贴歌单文本"
      :description="
        parseFormat === 'delimited'
          ? '支持 | 或 Tab 分列：歌名 | 歌手1/歌手2 | 语言 | 标签1,标签2 | 备注'
          : '每行一首歌，自动识别并跳过已存在的曲目'
      "
    >
      <Textarea
        v-model="rawText"
        rows="6"
        placeholder="晴天 - 周杰伦&#10;Lemon - 米津玄師&#10;打上花火 - DAOKO/米津玄師"
      />
    </FormField>

    <template v-if="transferOptions.length > 0">
      <Separator />
      <Transfer
        v-model="selectedKeys"
        :options="transferOptions"
        source-title="解析结果"
        target-title="待添加歌曲"
      />
    </template>
  </div>
</template>
