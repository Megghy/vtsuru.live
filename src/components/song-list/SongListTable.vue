<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import type { VNodeChild } from 'vue'
import type { SongRequestInfo, SongsInfo } from '@/api/api-models'
import { SongFrom, SongRequestStatus } from '@/api/api-models'
import { Delete24Filled, NotepadEdit20Filled, Play24Filled } from '@vicons/fluent'
import {
  NButton, NCard, NDataTable, NFlex, NIcon, NInput, NPopconfirm,
  NSelect, NSwitch, NTag, NText, NTooltip, useMessage,
} from 'naive-ui'
import { computed, h, ref } from 'vue'
import { usePersistedStorage } from '@/shared/storage/persist'
import { GetPlayButton } from '@/shared/utils'
import SongBatchModal from '@/components/song-list/SongBatchModal.vue'
import SongEditModal from '@/components/song-list/SongEditModal.vue'
import SongPlayer from '@/components/SongPlayer.vue'
import { useSongList } from '@/components/song-list/useSongList'

const props = defineProps<{
  songs: SongsInfo[]
  canEdit?: boolean
  isSelf: boolean
  extraButton?: (song: SongsInfo) => VNodeChild[]
  liveRequestActive?: SongRequestInfo[]
}>()

const message = useMessage()
const state = useSongList(props)
const {
  songsInternal, isLoading, playingSong, isLrcLoading,
  searchKeyword, selectedLanguageFilter, selectedTagFilter, selectedAuthorFilter,
  selectedKeys, currentPage, pageSize, filteredSongs,
  languageOptions, tagOptions, authorOptions,
  updateSong, updateSongs, deleteSong, deleteBatch, batchUpdate,
  nextPage, prevPage,
} = state

const singingKeySet = computed(() => {
  const set = new Set<string>()
  props.liveRequestActive?.forEach(item => {
    if (item.status === SongRequestStatus.Singing && item.song?.key) set.add(item.song.key)
  })
  return set
})
const queuedKeySet = computed(() => {
  const set = new Set<string>()
  props.liveRequestActive?.forEach(item => {
    if (item.status !== SongRequestStatus.Singing && item.song?.key) set.add(item.song.key)
  })
  return set
})

const volume = usePersistedStorage('Settings.AplayerVolume', 0.8)
const showListenButton = usePersistedStorage('SongList.ShowListenButton', true)
const showLinkButton = usePersistedStorage('SongList.ShowLinkButton', true)

const editModalRef = ref<InstanceType<typeof SongEditModal>>()
const batchModalRef = ref<InstanceType<typeof SongBatchModal>>()

defineExpose({ nextPage, prevPage, currentPage })

const hasAudio = computed(() =>
  songsInternal.value.some(s => s.url && /\.(?:mp3|flac|ogg|wav|m4a)$/i.test(s.url)))
const hasLinks = computed(() =>
  songsInternal.value.some(s => s.url || [SongFrom.Netease, SongFrom.FiveSing, SongFrom.Kugou].includes(s.from)))

function getSCColor(price: number): string {
  if (price < 50) return '#2a60b2'
  if (price < 100) return '#427d9e'
  if (price < 500) return '#c99801'
  if (price < 1000) return '#e09443'
  if (price < 2000) return '#e54d4d'
  return '#ab1a32'
}

function getGuardColor(level: number): string {
  return level === 1 ? 'rgb(122, 4, 35)' : level === 2 ? 'rgb(157, 155, 255)' : 'rgb(104, 136, 241)'
}

function actionWidth() {
  let w = props.isSelf ? 80 : 40
  if (showListenButton.value && hasAudio.value) w += 40
  if (showLinkButton.value && hasLinks.value) w += 50
  if (props.extraButton) w += 40
  return w
}

const columns = computed(() => {
  const cols: DataTableColumns<SongsInfo> = [
    { type: 'selection', disabled: () => !props.isSelf },
    {
    key: 'name', title: '曲名', resizable: true, minWidth: 150, width: 300, sorter: true,
    render: (row) => {
      const items: VNodeChild[] = []
      if (singingKeySet.value.has(row.key))
        items.push(h(NTag, { type: 'warning', size: 'small', style: { marginRight: '6px' } }, () => '演唱中'))
      else if (queuedKeySet.value.has(row.key))
        items.push(h(NTag, { type: 'success', size: 'small', style: { marginRight: '6px' } }, () => '排队中'))
      items.push(h(NFlex, { vertical: true, size: 0, wrap: false }, () => [
        h(NText, { style: { color: row.options?.scMinPrice ? '#c36767' : '' } }, () => row.name),
        row.translateName ? h(NText, { depth: '3', style: { fontSize: '12px' } }, () => row.translateName) : null,
      ]))
      return h(NFlex, { align: 'center', size: 0 }, () => items)
    },
  },
  {
    key: 'author', title: '作者', width: 200, resizable: true,
    filter: (value, row) => row.author?.includes(value.toString()) ?? false,
    filterOptions: authorOptions.value,
    filterOptionValue: selectedAuthorFilter.value,
    render: (row) => h(NFlex, { size: 5 }, () =>
      row.author?.map(a => h(NButton, {
        size: 'tiny', type: 'info', secondary: true,
        onClick: () => { selectedAuthorFilter.value = selectedAuthorFilter.value === a ? null : a },
      }, () => a)),
    ),
  },
  {
    key: 'language', title: '语言', width: 150, resizable: true,
    filterOptions: languageOptions.value,
    filter: (value, row) => row.language?.includes(value.toString()) ?? false,
    render: (row) => row.language?.length
      ? h(NFlex, { size: 5 }, () => row.language.map(l => h(NTag, { bordered: false, size: 'small' }, () => l)))
      : null,
  },
  { key: 'description', title: '描述', minWidth: 100, resizable: true, ellipsis: { tooltip: true } },
  {
    key: 'options', title: '点歌要求', width: 180, resizable: true,
    render: (row) => {
      if (!row.options) return null
      const t: VNodeChild[] = []
      if (row.options.needJianzhang) t.push(h(NTag, { color: { textColor: 'white', color: getGuardColor(3), borderColor: 'white' }, size: 'small' }, () => '舰长'))
      if (row.options.needTidu) t.push(h(NTag, { color: { textColor: 'white', color: getGuardColor(2), borderColor: 'white' }, size: 'small' }, () => '提督'))
      if (row.options.needZongdu) t.push(h(NTag, { color: { textColor: 'white', color: getGuardColor(1), borderColor: 'white' }, size: 'small' }, () => '总督'))
      if (row.options.scMinPrice) t.push(h(NTag, { color: { textColor: 'white', color: getSCColor(row.options.scMinPrice), borderColor: 'white' }, size: 'small' }, () => `SC ≥ ${row.options!.scMinPrice}`))
      if (row.options.fanMedalMinLevel) t.push(h(NTag, { type: 'info', size: 'small' }, () => `牌 ≥ ${row.options!.fanMedalMinLevel}`))
      return t.length ? h(NFlex, { size: 5 }, () => t) : null
    },
  },
  {
    key: 'tags', title: '标签', minWidth: 100, resizable: true,
    filterOptions: tagOptions.value,
    filter: (value, row) => row.tags?.includes(value.toString()) ?? false,
    render: (row) => row.tags?.length
      ? h(NFlex, { size: 5 }, () => row.tags!.map(t => h(NTag, { bordered: false, size: 'small' }, () => t)))
      : null,
  },
  {
    key: 'manage', title: '操作', fixed: 'right', width: actionWidth(),
    render: (row) => {
      const b: VNodeChild[] = []
      if (showLinkButton.value) { const p = GetPlayButton(row); if (p) b.push(p) }
      if (showListenButton.value && /\.(?:mp3|flac|ogg|wav|m4a)$/i.test(row.url ?? ''))
        b.push(h(NTooltip, null, { trigger: () => h(NButton, { type: 'primary', size: 'small', circle: true, loading: isLrcLoading.value === row.key, onClick: () => { playingSong.value = row } }, { icon: () => h(NIcon, { component: Play24Filled }) }), default: () => '试听' }))
      if (props.isSelf) {
        b.push(h(NTooltip, null, { trigger: () => h(NButton, { size: 'small', circle: true, secondary: true, onClick: () => editModalRef.value?.open(row) }, { icon: () => h(NIcon, { component: NotepadEdit20Filled }) }), default: () => '修改' }))
        b.push(h(NPopconfirm, { onPositiveClick: () => deleteSong(row) }, { trigger: () => h(NButton, { type: 'error', size: 'small', circle: true }, { icon: () => h(NIcon, { component: Delete24Filled }) }), default: () => `确认删除《${row.name}》？` }))
      }
      if (props.extraButton) b.push(...props.extraButton(row))
      return h(NFlex, { justify: 'end', size: 8, wrap: false }, () => b)
    },
  },
  ]
  return cols
})

async function handleEditSave(song: SongsInfo) {
  const ok = await updateSong(song)
  if (ok) editModalRef.value?.close()
  else if (editModalRef.value) editModalRef.value.loading = false
}

async function handleBatchField(
  endpoint: string, field: keyof SongsInfo, value: string[], mode: 'replace' | 'append', label: string,
) {
  if (mode === 'append') {
    const ids = new Set(selectedKeys.value)
    const updates = songsInternal.value
      .filter(s => ids.has(s.key))
      .map(song => ({ ...song, [field]: [...new Set([...(song[field] as string[]), ...value])] }))
    await updateSongs(updates, label)
    return
  }
  await batchUpdate(endpoint, field, value, label)
}

async function handleBatchAuthor(value: string[], mode: 'replace' | 'append') {
  await handleBatchField('update-batch-author', 'author', value, mode, '作者')
}
async function handleBatchTag(value: string[], mode: 'replace' | 'append') {
  await handleBatchField('update-batch-tag', 'tags', value, mode, '标签')
}
async function handleBatchLanguage(value: string[], mode: 'replace' | 'append') {
  await handleBatchField('update-batch-language', 'language', value, mode, '语言')
}
async function handleBatchOption(value: any) {
  await batchUpdate('update-batch-option', 'options', value ?? null, '点歌要求')
}
async function handleBatchDelete() {
  const ok = await deleteBatch()
  if (ok) batchModalRef.value?.close()
}
</script>

<template>
  <NCard embedded size="small" :bordered="false" style="margin-bottom: 10px;">
    <NFlex align="center" wrap item-style="margin-bottom: 5px;">
      <NInput
        v-model:value="searchKeyword" placeholder="搜索曲名/译名"
        size="medium" clearable style="min-width: 150px; flex: 1;"
      />
      <NSelect
        v-model:value="selectedAuthorFilter" placeholder="筛选歌手"
        :options="authorOptions" clearable filterable size="medium"
        style="min-width: 150px; flex: 1;"
      />
      <NSelect
        v-model:value="selectedLanguageFilter" placeholder="筛选语言"
        :options="languageOptions" multiple clearable filterable size="medium"
        style="min-width: 150px; flex: 1;" max-tag-count="responsive"
      />
      <NSelect
        v-model:value="selectedTagFilter" placeholder="筛选标签"
        :options="tagOptions" multiple clearable filterable size="medium"
        style="min-width: 150px; flex: 1;" max-tag-count="responsive"
      />
      <NFlex :size="8" align="center">
        <template v-if="hasAudio">
          <NSwitch v-model:value="showListenButton" size="small" />
          <NText style="font-size: 12px;">
            试听
          </NText>
        </template>
        <template v-if="hasLinks">
          <NSwitch v-model:value="showLinkButton" size="small" />
          <NText style="font-size: 12px;">
            链接
          </NText>
        </template>
      </NFlex>
    </NFlex>
  </NCard>

  <NFlex justify="space-between" align="center" style="margin-bottom: 6px;">
    <NText depth="3">
      共 {{ filteredSongs.length }} / {{ songsInternal.length }} 首
    </NText>
    <NButton
      v-if="isSelf" :disabled="selectedKeys.length === 0"
      type="primary" size="small" ghost @click="batchModalRef?.open()"
    >
      批量操作 ({{ selectedKeys.length }})
    </NButton>
  </NFlex>

  <Transition name="fade">
    <div v-if="playingSong" style="margin-bottom: 12px;">
      <SongPlayer
        v-model:is-lrc-loading="isLrcLoading" :song="playingSong" :volume="volume"
        @update:volume="v => volume = v" @close="playingSong = undefined"
      />
    </div>
  </Transition>

  <NDataTable
    v-model:checked-row-keys="selectedKeys" :columns="columns" :data="filteredSongs"
    size="small" :scroll-x="800" striped :row-key="(r: SongsInfo) => r.key"
    :loading="isLoading && filteredSongs.length === 0"
    :pagination="{
      defaultPageSize: pageSize, pageSizes: [10, 25, 50, 100, 200],
      showSizePicker: true, showQuickJumper: true,
      page: currentPage, onUpdatePage: (p: number) => currentPage = p,
    }"
  />

  <SongEditModal
    ref="editModalRef"
    :language-options="languageOptions" :tag-options="tagOptions" :author-options="authorOptions"
    @save="handleEditSave"
  />
  <SongBatchModal
    ref="batchModalRef" :selected-count="selectedKeys.length"
    :language-options="languageOptions" :tag-options="tagOptions" :author-options="authorOptions"
    @delete="handleBatchDelete" @update-author="handleBatchAuthor"
    @update-tag="handleBatchTag" @update-language="handleBatchLanguage"
    @update-option="handleBatchOption"
  />
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

<style>
.netease path:nth-child(2) { fill: #c20c0c; }
.fivesing path:first-child { fill: #00bbb3; }
.bilibili path { fill: #00a1d6; }
</style>
