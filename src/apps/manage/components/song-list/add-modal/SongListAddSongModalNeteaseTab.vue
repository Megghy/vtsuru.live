<script setup lang="ts">
import type { SongsInfo } from '@/api/api-models'
import type { Option } from 'naive-ui/es/transfer/src/interface'
import { QueryGetAPI } from '@/api/query'
import { SONG_API_URL } from '@/shared/config'
import { computed, ref } from 'vue'
import { NButton, NDivider, NInput, NTag, NTransfer, useMessage } from 'naive-ui'
import { SongFrom } from '@/api/api-models'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'

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
const neteaseSongsOptions = ref<Option[]>([])
const selectedNeteaseSongs = ref<string[]>([])

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
    // ignore invalid URL, fallback to number parsing
  }

  const num = Number(input)
  if (Number.isFinite(num) && num > 0) return num
  return null
})

function updateNeteaseSongsOptions(newlyAddedSongs: SongsInfo[] = []) {
  neteaseSongsOptions.value = neteaseSongs.value.map(s => ({
    label: `${s.name} - ${s.author.join('/')}`,
    value: s.key,
    disabled:
      props.existingSongs.findIndex(exist => exist.id === s.id) > -1
      || newlyAddedSongs.findIndex(add => add.id === s.id) > -1,
  }))
}

async function getNeteaseSongList() {
  if (!neteaseSongListId.value) {
    message.error('请输入有效的网易云歌单ID')
    return
  }

  emit('loadingChange', true)
  try {
    const data = await QueryGetAPI<SongsInfo[]>(`${SONG_API_URL}get-netease-list`, { id: neteaseSongListId.value })
    if (data.code !== 200) {
      message.error(`获取歌单失败: ${data.message}`)
      return
    }

    neteaseSongs.value = data.data
    updateNeteaseSongsOptions()
    message.success(
      `成功获取歌曲信息, 共 ${data.data.length} 条, 歌单中已存在 ${neteaseSongsOptions.value.filter(s => s.disabled).length} 首`,
    )
  } catch (err) {
    message.error(`获取歌单失败: ${err}`)
  } finally {
    emit('loadingChange', false)
  }
}

async function addNeteaseSongs() {
  emit('loadingChange', true)
  try {
    const selected = neteaseSongs.value.filter(s => selectedNeteaseSongs.value.find(select => s.key === select))
    const data = await addSongsToSongList(selected, SongFrom.Netease)
    if (data.code !== 200) {
      message.error(`添加失败: ${data.message}`)
      return
    }

    message.success(`已添加 ${data.data.length} 首歌曲`)
    emit('added', data.data)
    updateNeteaseSongsOptions(data.data)
  } catch (err) {
    console.error(err)
    message.error('添加失败')
  } finally {
    emit('loadingChange', false)
  }
}
</script>

<template>
  <NInput
    v-model:value="neteaseIdInput"
    clearable
    style="width: 100%"
    autosize
    :status="neteaseSongListId ? 'success' : 'error'"
    placeholder="直接输入歌单Id或者网页链接"
  >
    <template #suffix>
      <NTag v-if="neteaseSongListId" type="success" size="small">
        歌单Id: {{ neteaseSongListId }}
      </NTag>
    </template>
  </NInput>
  <NDivider style="margin: 10px" />
  <NButton type="primary" :disabled="!neteaseSongListId" @click="getNeteaseSongList">
    获取
  </NButton>
  <template v-if="neteaseSongsOptions.length > 0">
    <NDivider style="margin: 10px" />
    <NTransfer v-model:value="selectedNeteaseSongs" style="height: 500px" :options="neteaseSongsOptions" source-filterable />
    <NDivider style="margin: 10px" />
    <NButton type="primary" @click="addNeteaseSongs">
      添加到歌单 | {{ selectedNeteaseSongs.length }} 首
    </NButton>
  </template>
</template>

