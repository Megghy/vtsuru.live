<script setup lang="ts">
import { MusicNote224Filled, Search24Regular } from '@vicons/fluent'
import { useVirtualList } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { Badge } from '@/shared/ui/badge'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'

import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import { filterSongs } from './utils/songListData'
import { getSongRequestTooltip } from './utils/songRequestUtils'
import { useSongListTemplateCore } from './utils/useSongListTemplateCore'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])

const {
  requestAuthState,
  isSelf,
  requestingKey,
  singingSongKeys: singingSongKeySet,
  queuedSongKeys: queuedSongKeySet,
  beginRequest,
} = useSongListTemplateCore({
  userInfo: () => props.userInfo,
  liveRequestActive: () => props.liveRequestActive,
})

const searchKeyword = ref('')
const selectedSong = ref<ResponseSongModel>()
const isLrcLoading = ref('')

const filteredSongs = computed<ResponseSongModel[]>(() => {
  return filterSongs(props.data, { keyword: searchKeyword.value })
})

const { list, containerProps, wrapperProps } = useVirtualList(filteredSongs, {
  itemHeight: 52,
  overscan: 10,
})

// 默认选中第一首
watch(
  filteredSongs,
  (songs) => {
    if (!selectedSong.value && songs.length) selectedSong.value = songs[0]
  },
  { immediate: true },
)

const stageEpoch = ref(0)
function selectSong(song: ResponseSongModel) {
  if (selectedSong.value?.key === song.key) return
  selectedSong.value = song
  stageEpoch.value += 1
}

function requestSong(song: ResponseSongModel) {
  if (!beginRequest(song)) return
  emits('requestSong', song)
}

const stageRequestLabel = computed(() => {
  if (!selectedSong.value) return '点歌'
  return getSongRequestTooltip(selectedSong.value, props.liveRequestSettings, requestAuthState.value)
})
</script>

<template>
  <div
    class="relative grid grid-cols-[minmax(280px,380px)_minmax(320px,1fr)] max-[768px]:grid-cols-1 gap-[clamp(16px,3vw,40px)] w-full max-w-[var(--vtsuru-page-max-width,1280px)] min-w-0 mx-auto p-[clamp(16px,3vw,36px)]"
  >
    <aside class="flex flex-col gap-3">
      <span class="text-[10px] font-bold tracking-widest text-primary">NOW SELECTED</span>
      <Transition
        name="stage-cover"
        mode="out-in"
      >
        <div
          :key="selectedSong?.key ?? 'empty'"
          class="w-full aspect-square rounded-xl overflow-hidden bg-muted flex-center"
        >
          <img
            v-if="selectedSong?.cover"
            :src="selectedSong.cover"
            :alt="selectedSong.name"
            class="size-full object-cover"
            referrerpolicy="no-referrer"
          />
          <component
            :is="MusicNote224Filled"
            v-else
            class="stage-cover-icon size-12 text-muted-foreground"
          />
        </div>
      </Transition>

      <Transition
        name="stage-meta"
        mode="out-in"
      >
        <div
          v-if="selectedSong"
          :key="`${selectedSong.key}-${stageEpoch}`"
          class="stage-meta"
        >
          <div class="text-lg font-bold text-card-foreground">
            {{ selectedSong.name }}
          </div>
          <div
            v-if="selectedSong.translateName"
            class="text-xs text-muted-foreground"
          >
            {{ selectedSong.translateName }}
          </div>
          <div
            v-if="selectedSong.author?.length"
            class="text-[13px] text-muted-foreground"
          >
            {{ selectedSong.author.join(' / ') }}
          </div>

          <div
            v-if="selectedSong.language?.length || selectedSong.tags?.length"
            class="stage-tags flex flex-wrap gap-1"
          >
            <Badge
              v-for="lang in selectedSong.language ?? []"
              :key="`l-${lang}`"
              variant="secondary"
              class="text-xs h-5 px-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-normal"
            >
              {{ lang }}
            </Badge>
            <Badge
              v-for="tag in (selectedSong.tags ?? []).slice(0, 4)"
              :key="`t-${tag}`"
              variant="secondary"
              class="text-xs h-5 px-2 font-normal"
            >
              {{ tag }}
            </Badge>
          </div>

          <SongOptionBadges
            v-if="selectedSong.options"
            :options="selectedSong.options"
            variant="guard"
          />

          <SongRequestButton
            v-if="!isSelf"
            class="stage-request"
            :song="selectedSong"
            :live-request-settings="liveRequestSettings"
            :auth-state="requestAuthState"
            :loading="requestingKey === selectedSong.key"
            :circle="false"
            :secondary="false"
            size="medium"
            :label="stageRequestLabel"
            @request="requestSong"
          />

          <SongPlayer
            v-if="selectedSong.url"
            v-model:is-lrc-loading="isLrcLoading"
            :song="selectedSong"
            class="stage-player"
          />
        </div>
      </Transition>
    </aside>

    <section>
      <header class="flex items-end justify-between mb-3">
        <div>
          <span class="text-[10px] font-bold tracking-widest text-primary">LIBRARY</span>
          <h2 class="m-0 text-xl text-card-foreground">选择一首歌</h2>
        </div>
        <span class="text-xs font-mono text-muted-foreground">{{ filteredSongs.length }} 首</span>
      </header>

      <div class="search-shell mb-3">
        <div class="relative w-full">
          <component
            :is="Search24Regular"
            class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="searchKeyword"
            class="pl-8 w-full"
            placeholder="搜索曲库…"
          />
        </div>
      </div>

      <Empty
        v-if="filteredSongs.length === 0"
        description="暂无曲目"
        class="mt-12 py-8"
      />

      <div
        v-else
        v-bind="containerProps"
        class="h-[clamp(400px,65vh,760px)] overflow-y-auto"
      >
        <div v-bind="wrapperProps">
          <div
            v-for="{ data: song } in list"
            :key="song.key"
            class="flex items-center gap-2 h-[52px] px-2 rounded-lg transition-colors hover:bg-muted"
            :class="{ 'bg-muted': selectedSong?.key === song.key }"
          >
            <button
              type="button"
              class="flex items-center gap-2.5 flex-1 min-w-0 bg-transparent border-0 p-0 cursor-pointer text-left"
              :aria-current="selectedSong?.key === song.key ? 'true' : undefined"
              @click="selectSong(song)"
            >
              <span
                class="size-9 rounded-md overflow-hidden bg-muted flex-center text-xs font-semibold text-muted-foreground shrink-0"
              >
                <img
                  v-if="song.cover"
                  :src="song.cover"
                  :alt="song.name"
                  class="size-full object-cover"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                />
                <span v-else>{{ song.name.charAt(0) }}</span>
              </span>
              <span class="flex flex-col min-w-0">
                <span
                  class="text-[13px] font-medium text-card-foreground truncate"
                  :title="song.name"
                  >{{ song.name }}</span
                >
                <span
                  v-if="song.author?.length"
                  class="text-[11px] text-muted-foreground truncate"
                  >{{ song.author.join(' / ') }}</span
                >
              </span>
            </button>
            <SongStatusBadge
              :song-key="song.key"
              :singing-keys="singingSongKeySet"
              :queued-keys="queuedSongKeySet"
              variant="text"
            />
            <SongRequestButton
              :song="song"
              :live-request-settings="liveRequestSettings"
              :auth-state="requestAuthState"
              :loading="requestingKey === song.key"
              :hidden="isSelf"
              @request="requestSong"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
