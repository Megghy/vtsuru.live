<script setup lang="ts">
import { computed, defineComponent, ref, watch } from 'vue'
import type { PropType, VNodeChild } from 'vue'

import type { SongRequestInfo, SongsInfo } from '@/api/api-models'
import { SongFrom, SongRequestStatus } from '@/api/api-models'
import SongBatchModal from '@/components/song-list/SongBatchModal.vue'
import SongEditModal from '@/components/song-list/SongEditModal.vue'
import { useSongList } from '@/components/song-list/useSongList'
import SongPlayer from '@/components/SongPlayer.vue'
import { usePersistedStorage } from '@/shared/storage/persist'

const props = defineProps<{
  songs: SongsInfo[]
  canEdit?: boolean
  isSelf: boolean
  extraButton?: (song: SongsInfo) => VNodeChild[]
  liveRequestActive?: SongRequestInfo[]
}>()

const ExtraSongButtons = defineComponent({
  props: {
    song: { type: Object as PropType<SongsInfo>, required: true },
    render: { type: Function as PropType<(song: SongsInfo) => VNodeChild[]>, required: true },
  },
  setup(componentProps) {
    return () => componentProps.render(componentProps.song)
  },
})

const state = useSongList(props)
const {
  songsInternal,
  isLoading,
  playingSong,
  isLrcLoading,
  searchKeyword,
  selectedLanguageFilter,
  selectedTagFilter,
  selectedAuthorFilter,
  selectedKeys,
  currentPage,
  pageSize,
  filteredSongs,
  languageOptions,
  tagOptions,
  authorOptions,
  updateSong,
  updateSongs,
  deleteSong,
  deleteBatch,
  batchUpdate,
  nextPage,
  prevPage,
} = state

const singingKeySet = computed(
  () =>
    new Set(
      props.liveRequestActive
        ?.filter((item) => item.status === SongRequestStatus.Singing && item.song?.key)
        .map((item) => item.song!.key),
    ),
)
const queuedKeySet = computed(
  () =>
    new Set(
      props.liveRequestActive
        ?.filter((item) => item.status !== SongRequestStatus.Singing && item.song?.key)
        .map((item) => item.song!.key),
    ),
)
const volume = usePersistedStorage('Settings.AplayerVolume', 0.8)
const showListenButton = usePersistedStorage('SongList.ShowListenButton', true)
const showLinkButton = usePersistedStorage('SongList.ShowLinkButton', true)
const editModalRef = ref<InstanceType<typeof SongEditModal>>()
const batchModalRef = ref<InstanceType<typeof SongBatchModal>>()
const deleteCandidate = ref<SongsInfo>()
const totalPages = computed(() => Math.max(1, Math.ceil(filteredSongs.value.length / pageSize.value)))
const pagedSongs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredSongs.value.slice(start, start + pageSize.value)
})
const selectedSongKeys = computed(() => new Set(selectedKeys.value))
const allVisibleSelected = computed(
  () => pagedSongs.value.length > 0 && pagedSongs.value.every((song) => selectedSongKeys.value.has(song.key)),
)
const someVisibleSelected = computed(() => pagedSongs.value.some((song) => selectedSongKeys.value.has(song.key)))
const pageSizeOptions = [10, 25, 50, 100, 200].map((value) => ({ label: `${value} / 页`, value }))

defineExpose({ nextPage, prevPage, currentPage })

const hasAudio = computed(() =>
  songsInternal.value.some((song) => song.url && /\.(?:mp3|flac|ogg|wav|m4a)$/i.test(song.url)),
)
const hasLinks = computed(() => songsInternal.value.some((song) => getExternalUrl(song)))

watch([filteredSongs, pageSize], () => {
  currentPage.value = Math.min(currentPage.value, totalPages.value)
})

function getSCColor(price: number): string {
  if (price < 50) return '#2a60b2'
  if (price < 100) return '#427d9e'
  if (price < 500) return '#c99801'
  if (price < 1000) return '#e09443'
  if (price < 2000) return '#e54d4d'
  return '#ab1a32'
}

function getGuardColor(level: number): string {
  if (level === 1) return 'rgb(122, 4, 35)'
  if (level === 2) return 'rgb(157, 155, 255)'
  return 'rgb(104, 136, 241)'
}

function getExternalUrl(song: SongsInfo) {
  if (song.from === SongFrom.FiveSing) return `http://5sing.kugou.com/bz/${song.id}.html`
  if (song.from === SongFrom.Netease) return `https://music.163.com/#/song?id=${song.id}`
  return song.from === SongFrom.Custom ? song.url : undefined
}

function isAudioSong(song: SongsInfo) {
  return /\.(?:mp3|flac|ogg|wav|m4a)$/i.test(song.url ?? '')
}

function updateSongSelection(songKey: string, value: boolean | string) {
  const selected = new Set(selectedKeys.value)
  if (value === true) selected.add(songKey)
  else selected.delete(songKey)
  selectedKeys.value = [...selected]
}

function updateVisibleSelection(value: boolean | string) {
  const selected = new Set(selectedKeys.value)
  for (const song of pagedSongs.value) {
    if (value === true) selected.add(song.key)
    else selected.delete(song.key)
  }
  selectedKeys.value = [...selected]
}

async function handleEditSave(song: SongsInfo) {
  const updated = await updateSong(song)
  if (updated) editModalRef.value?.close()
  else if (editModalRef.value) editModalRef.value.loading = false
}

async function handleBatchField(
  endpoint: string,
  field: keyof SongsInfo,
  value: string[],
  mode: 'replace' | 'append',
  label: string,
) {
  if (mode === 'append') {
    const selected = new Set(selectedKeys.value)
    const updates = songsInternal.value
      .filter((song) => selected.has(song.key))
      .map((song) => ({ ...song, [field]: [...new Set([...(song[field] as string[]), ...value])] }))
    await updateSongs(updates, label)
    return
  }

  await batchUpdate(endpoint, field, value, label)
}

async function handleBatchDelete() {
  if (await deleteBatch()) batchModalRef.value?.close()
}

async function confirmDelete() {
  if (!deleteCandidate.value) return
  await deleteSong(deleteCandidate.value)
  deleteCandidate.value = undefined
}
</script>

<template>
  <UCard class="song-list__filters">
    <div class="song-list__filter-grid">
      <UInput
        v-model="searchKeyword"
        placeholder="搜索曲名/译名"
        icon="i-lucide-search"
      />
      <USelectMenu
        v-model="selectedAuthorFilter"
        :items="authorOptions"
        value-key="value"
        placeholder="筛选歌手"
        clear
      />
      <USelectMenu
        v-model="selectedLanguageFilter"
        :items="languageOptions"
        value-key="value"
        placeholder="筛选语言"
        multiple
        clear
      />
      <USelectMenu
        v-model="selectedTagFilter"
        :items="tagOptions"
        value-key="value"
        placeholder="筛选标签"
        multiple
        clear
      />
      <div class="song-list__display-switches">
        <UCheckbox
          v-if="hasAudio"
          v-model="showListenButton"
          label="试听"
          size="sm"
        />
        <UCheckbox
          v-if="hasLinks"
          v-model="showLinkButton"
          label="链接"
          size="sm"
        />
      </div>
    </div>
  </UCard>

  <div class="song-list__summary">
    <span>共 {{ filteredSongs.length }} / {{ songsInternal.length }} 首</span>
    <UButton
      v-if="isSelf"
      color="primary"
      variant="soft"
      size="sm"
      :disabled="selectedKeys.length === 0"
      :label="`批量操作 (${selectedKeys.length})`"
      @click="batchModalRef?.open()"
    />
  </div>

  <Transition name="fade">
    <div
      v-if="playingSong"
      class="song-list__player"
    >
      <SongPlayer
        v-model:is-lrc-loading="isLrcLoading"
        :song="playingSong"
        :volume="volume"
        @update:volume="(value) => (volume = value)"
        @close="playingSong = undefined"
      />
    </div>
  </Transition>

  <div class="song-list__table-wrap">
    <table class="song-list__table">
      <thead>
        <tr>
          <th
            v-if="isSelf"
            class="song-list__selection-cell"
          >
            <UCheckbox
              :model-value="allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false"
              @update:model-value="updateVisibleSelection"
            />
          </th>
          <th>曲名</th>
          <th>作者</th>
          <th>语言</th>
          <th>描述</th>
          <th>点歌要求</th>
          <th>标签</th>
          <th class="song-list__actions-cell">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="isLoading && filteredSongs.length === 0">
          <td :colspan="isSelf ? 8 : 7">
            <div class="song-list__loading">
              <USkeleton class="song-list__loading-indicator" />
            </div>
          </td>
        </tr>
        <tr v-else-if="pagedSongs.length === 0">
          <td :colspan="isSelf ? 8 : 7">
            <UEmpty
              title="暂无歌曲"
              size="sm"
            />
          </td>
        </tr>
        <tr
          v-for="song in pagedSongs"
          :key="song.key"
        >
          <td
            v-if="isSelf"
            class="song-list__selection-cell"
          >
            <UCheckbox
              :model-value="selectedSongKeys.has(song.key)"
              @update:model-value="updateSongSelection(song.key, $event)"
            />
          </td>
          <td>
            <div class="song-list__song-name">
              <UBadge
                v-if="singingKeySet.has(song.key)"
                color="warning"
                variant="subtle"
                size="xs"
                label="演唱中"
              />
              <UBadge
                v-else-if="queuedKeySet.has(song.key)"
                color="success"
                variant="subtle"
                size="xs"
                label="排队中"
              />
              <strong :class="{ 'song-list__song-name--restricted': song.options?.scMinPrice }">{{ song.name }}</strong>
              <span v-if="song.translateName">{{ song.translateName }}</span>
            </div>
          </td>
          <td>
            <div class="song-list__badges">
              <UButton
                v-for="author in song.author"
                :key="author"
                color="info"
                variant="soft"
                size="xs"
                :label="author"
                @click="selectedAuthorFilter = selectedAuthorFilter === author ? null : author"
              />
            </div>
          </td>
          <td>
            <div class="song-list__badges">
              <UBadge
                v-for="language in song.language"
                :key="language"
                color="neutral"
                variant="subtle"
                size="xs"
                :label="language"
              />
            </div>
          </td>
          <td>
            <UTooltip
              v-if="song.description"
              :text="song.description"
            >
              <span class="song-list__ellipsis">{{ song.description }}</span>
            </UTooltip>
          </td>
          <td>
            <div
              v-if="song.options"
              class="song-list__badges"
            >
              <span
                v-if="song.options.needJianzhang"
                class="song-list__requirement"
                :style="{ '--requirement-color': getGuardColor(3) }"
                >舰长</span
              >
              <span
                v-if="song.options.needTidu"
                class="song-list__requirement"
                :style="{ '--requirement-color': getGuardColor(2) }"
                >提督</span
              >
              <span
                v-if="song.options.needZongdu"
                class="song-list__requirement"
                :style="{ '--requirement-color': getGuardColor(1) }"
                >总督</span
              >
              <span
                v-if="song.options.scMinPrice"
                class="song-list__requirement"
                :style="{ '--requirement-color': getSCColor(song.options.scMinPrice) }"
                >SC ≥ {{ song.options.scMinPrice }}</span
              >
              <UBadge
                v-if="song.options.fanMedalMinLevel"
                color="info"
                variant="subtle"
                size="xs"
                :label="`牌 ≥ ${song.options.fanMedalMinLevel}`"
              />
            </div>
          </td>
          <td>
            <div class="song-list__badges">
              <UBadge
                v-for="tag in song.tags"
                :key="tag"
                color="neutral"
                variant="subtle"
                size="xs"
                :label="tag"
              />
            </div>
          </td>
          <td class="song-list__actions-cell">
            <div class="song-list__actions">
              <UTooltip
                v-if="showLinkButton && getExternalUrl(song)"
                text="打开链接"
              >
                <UButton
                  :to="getExternalUrl(song)"
                  target="_blank"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  square
                  icon="i-lucide-external-link"
                />
              </UTooltip>
              <UTooltip
                v-if="showListenButton && isAudioSong(song)"
                text="试听"
              >
                <UButton
                  color="primary"
                  variant="soft"
                  size="xs"
                  square
                  icon="i-lucide-play"
                  :loading="isLrcLoading === song.key"
                  @click="playingSong = song"
                />
              </UTooltip>
              <UTooltip
                v-if="isSelf"
                text="修改"
              >
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  square
                  icon="i-lucide-pencil"
                  @click="editModalRef?.open(song)"
                />
              </UTooltip>
              <UTooltip
                v-if="isSelf"
                text="删除"
              >
                <UButton
                  color="error"
                  variant="ghost"
                  size="xs"
                  square
                  icon="i-lucide-trash-2"
                  @click="deleteCandidate = song"
                />
              </UTooltip>
              <ExtraSongButtons
                v-if="extraButton"
                :song="song"
                :render="extraButton"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="song-list__pagination">
    <USelect
      v-model="pageSize"
      :items="pageSizeOptions"
      size="sm"
    />
    <UPagination
      v-model:page="currentPage"
      :total="filteredSongs.length"
      :items-per-page="pageSize"
      :show-edges="false"
      size="sm"
    />
  </div>

  <SongEditModal
    ref="editModalRef"
    :language-options="languageOptions"
    :tag-options="tagOptions"
    :author-options="authorOptions"
    @save="handleEditSave"
  />
  <SongBatchModal
    ref="batchModalRef"
    :selected-count="selectedKeys.length"
    :language-options="languageOptions"
    :tag-options="tagOptions"
    :author-options="authorOptions"
    @delete="handleBatchDelete"
    @update-author="(value, mode) => handleBatchField('update-batch-author', 'author', value, mode, '作者')"
    @update-tag="(value, mode) => handleBatchField('update-batch-tag', 'tags', value, mode, '标签')"
    @update-language="(value, mode) => handleBatchField('update-batch-language', 'language', value, mode, '语言')"
    @update-option="batchUpdate('update-batch-option', 'options', $event ?? null, '点歌要求')"
  />
  <UModal
    :open="deleteCandidate != null"
    title="删除歌曲"
    @update:open="!$event && (deleteCandidate = undefined)"
  >
    <template #body>确认删除《{{ deleteCandidate?.name }}》？</template>
    <template #footer>
      <div class="song-list__delete-actions">
        <UButton
          color="neutral"
          variant="soft"
          label="取消"
          @click="deleteCandidate = undefined"
        />
        <UButton
          color="error"
          label="确认删除"
          @click="confirmDelete"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.song-list__filters {
  margin-bottom: 10px;
}

.song-list__filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr)) auto;
  gap: 10px;
  align-items: center;
}

.song-list__display-switches,
.song-list__summary,
.song-list__pagination,
.song-list__badges,
.song-list__actions,
.song-list__delete-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.song-list__summary {
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}

.song-list__player {
  margin-bottom: 12px;
}

.song-list__table-wrap {
  overflow-x: auto;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius-control);
}

.song-list__table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  font-size: 13px;
}

.song-list__table th,
.song-list__table td {
  padding: 10px 12px;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid var(--vtsuru-border);
}

.song-list__table th {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  background: var(--vtsuru-bg-muted);
}

.song-list__table tbody tr:last-child td {
  border-bottom: 0;
}

.song-list__table tbody tr:hover {
  background: var(--vtsuru-bg-muted);
}

.song-list__selection-cell {
  width: 36px;
}

.song-list__actions-cell {
  width: 1%;
  white-space: nowrap;
}

.song-list__song-name {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 180px;
}

.song-list__song-name span {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.song-list__song-name--restricted {
  color: #c36767;
}

.song-list__ellipsis {
  display: block;
  max-width: 240px;
  overflow: hidden;
  color: var(--vtsuru-fg-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-list__requirement {
  padding: 2px 6px;
  border-radius: var(--vtsuru-radius-control);
  color: var(--vtsuru-fg-inverted);
  font-size: 12px;
  white-space: nowrap;
  background: var(--requirement-color);
}

.song-list__pagination {
  justify-content: space-between;
  margin-top: 12px;
}

.song-list__delete-actions {
  justify-content: flex-end;
}

.song-list__loading {
  display: grid;
  min-height: 160px;
  place-items: center;
}

.song-list__loading-indicator {
  width: 32px;
  height: 32px;
  border-radius: 999px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 960px) {
  .song-list__filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .song-list__filter-grid {
    grid-template-columns: 1fr;
  }

  .song-list__pagination {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
