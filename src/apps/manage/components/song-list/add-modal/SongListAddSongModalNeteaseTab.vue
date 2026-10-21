<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { getApiSongListGetNeteaseList } from '@/api/generated/song-list/song-list'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { Tag } from '@/shared/ui/tag'
import { Transfer, type TransferOption } from '@/shared/ui/transfer'
import { useMessage } from '@/shared/utils'

const props = defineProps<{
  existingSongs: SongsInfo[]
}>()

const emit = defineEmits<{
  (e: 'added', songs: SongsInfo[]): void
  (e: 'loadingChange', value: boolean): void
}>()

const message = useMessage()

const neteaseIdInput = ref<string>('')
const neteaseSongs = ref<SongsInfo[]>([])
const neteaseSongsOptions = ref<TransferOption[]>([])
const selectedNeteaseSongs = ref<string[]>([])
/** 本会话已成功添加的网易云歌曲 Id，避免 props 未及时同步时重复提交 */
const sessionAddedIds = ref(new Set<number>())
const isAdding = ref(false)

const canAdd = computed(() => {
  if (isAdding.value || selectedNeteaseSongs.value.length === 0) return false
  return getSelectedNewSongs().length > 0
})

defineExpose({
  add: addNeteaseSongs,
  canAdd,
  label: computed(() => {
    const count = getSelectedNewSongs().length
    return `添加到歌单 | ${count} 首`
  }),
})

const neteaseSongListId = computed<number | null>(() => {
  const input = String(neteaseIdInput.value ?? '').trim()
  if (!input) return null

  try {
    const url = new URL(input)
    if (url.host === 'music.163.com') {
      const match = /id=(\d+)/.exec(input)
      if (match) return Number(match[1])
    }
  } catch {
    // ignore
  }

  const num = Number(input)
  if (Number.isFinite(num) && num > 0) return num
  return null
})

function isSongAlreadyInList(song: SongsInfo) {
  if (sessionAddedIds.value.has(song.id)) return true
  return props.existingSongs.some((exist) => exist.from === SongFrom.Netease && exist.id === song.id)
}

function getSelectedNewSongs() {
  return neteaseSongs.value.filter(
    (s) => selectedNeteaseSongs.value.includes(s.key) && !isSongAlreadyInList(s),
  )
}

function deselectAlreadyAddedSongs() {
  selectedNeteaseSongs.value = selectedNeteaseSongs.value.filter((key) => {
    const song = neteaseSongs.value.find((s) => s.key === key)
    return !!song && !isSongAlreadyInList(song)
  })
}

function updateNeteaseSongsOptions() {
  neteaseSongsOptions.value = neteaseSongs.value.map((s) => ({
    label: `${s.name} - ${s.author.join('/')}`,
    value: s.key,
    disabled: isSongAlreadyInList(s),
  }))
  deselectAlreadyAddedSongs()
}

watch(
  () => props.existingSongs,
  () => {
    if (neteaseSongs.value.length) updateNeteaseSongsOptions()
  },
  { deep: true },
)

async function getNeteaseSongList() {
  if (!neteaseSongListId.value) {
    message.error('请输入有效的网易云歌单ID')
    return
  }

  emit('loadingChange', true)
  try {
    const data = (await getApiSongListGetNeteaseList({
      id: neteaseSongListId.value,
    })) as unknown as {
      code: number
      message?: string
      data: SongsInfo[]
    }
    if (data.code !== 200) {
      message.error(`获取歌单失败: ${data.message}`)
      return
    }

    neteaseSongs.value = data.data
    selectedNeteaseSongs.value = []
    updateNeteaseSongsOptions()
    message.success(
      `成功获取歌曲信息，共 ${data.data.length} 条，已存在 ${neteaseSongsOptions.value.filter((s) => s.disabled).length} 首`,
    )
  } catch (err) {
    message.error(`获取歌单失败: ${err}`)
  } finally {
    emit('loadingChange', false)
  }
}

async function addNeteaseSongs() {
  if (isAdding.value) return

  const selected = getSelectedNewSongs()
  if (selected.length === 0) {
    message.warning('所选歌曲均已在歌单中')
    updateNeteaseSongsOptions()
    return
  }

  isAdding.value = true
  emit('loadingChange', true)
  try {
    const data = await addSongsToSongList(selected, SongFrom.Netease)
    if (data.code !== 200) {
      message.error(`添加失败: ${data.message}`)
      return
    }

    const nextIds = new Set(sessionAddedIds.value)
    for (const s of selected) nextIds.add(s.id)
    for (const s of data.data) nextIds.add(s.id)
    sessionAddedIds.value = nextIds

    const addedKeys = new Set(selected.map((s) => s.key))
    selectedNeteaseSongs.value = selectedNeteaseSongs.value.filter((key) => !addedKeys.has(key))
    updateNeteaseSongsOptions()
    await nextTick()
    deselectAlreadyAddedSongs()

    const addedCount = data.data.length
    const skipped = selected.length - addedCount
    if (addedCount === 0) {
      message.warning('所选歌曲均已在歌单中，未添加新曲目')
    } else if (skipped > 0) {
      message.success(`已添加 ${addedCount} 首歌曲（跳过重复 ${skipped} 首）`)
    } else {
      message.success(`已添加 ${addedCount} 首歌曲`)
    }

    if (addedCount > 0) emit('added', data.data as unknown as SongsInfo[])
  } catch (err) {
    console.error(err)
    message.error('添加失败')
  } finally {
    isAdding.value = false
    emit('loadingChange', false)
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <Input
          v-model="neteaseIdInput"
          placeholder="直接输入网易云歌单Id或网页链接"
          class="h-8 text-xs pr-20"
        />
        <div v-if="neteaseSongListId" class="absolute right-2 top-1.5">
          <Tag type="success" size="small">
            ID: {{ neteaseSongListId }}
          </Tag>
        </div>
      </div>
      <Button
        size="sm"
        :disabled="!neteaseSongListId"
        @click="getNeteaseSongList"
      >
        获取歌单
      </Button>
    </div>

    <template v-if="neteaseSongsOptions.length > 0">
      <Separator />
      <Transfer
        v-model="selectedNeteaseSongs"
        :options="neteaseSongsOptions"
        source-title="网易云歌单"
        target-title="待添加歌曲"
      />
    </template>
  </div>
</template>
