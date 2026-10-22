<script setup lang="ts">
import { Play24Filled, Search24Regular } from '@vicons/fluent'
import { useVirtualList } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import { filterSongs, getSongFieldOptions } from './utils/songListData'
import { useFilterListKey, useSongListTemplateCore } from './utils/useSongListTemplateCore'

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
const selectedTag = ref<string | null>(null)
const selectedAuthor = ref<string | null>(null)
const previewSong = ref<SongsInfo>()
const isLrcLoading = ref('')

const tagOptions = computed(() => {
  return getSongFieldOptions(props.data, 'tags')
})
const authorOptions = computed(() => {
  return getSongFieldOptions(props.data, 'author')
})

const filteredSongs = computed<SongsInfo[]>(() => {
  return filterSongs(props.data, {
    keyword: searchKeyword.value,
    tag: selectedTag.value,
    author: selectedAuthor.value,
  })
})

const { listKey } = useFilterListKey({ tag: selectedTag, author: selectedAuthor })

const { list, containerProps, wrapperProps } = useVirtualList(filteredSongs, {
  itemHeight: 60,
  overscan: 8,
})

function requestSong(song: SongsInfo) {
  if (!beginRequest(song)) return
  emits('requestSong', song)
}
</script>

<template>
  <div class="w-full max-w-[var(--vtsuru-page-max-width,1180px)] min-w-0 mx-auto p-[clamp(12px,2vw,24px)]">
    <header class="flex items-end justify-between mb-3.5 gap-3.5">
      <div>
        <span class="block mb-0.5 text-primary text-[10px] font-bold">QUICK INDEX</span>
        <h2 class="m-0 text-card-foreground text-[clamp(20px,3vw,28px)] leading-[1.15]">快速曲库</h2>
      </div>
      <span
        :key="listKey"
        class="text-xs font-mono text-muted-foreground"
      >
        {{ filteredSongs.length }} 首
      </span>
    </header>

    <div class="toolbar flex flex-wrap gap-2.5 items-center mb-3.5">
      <div class="relative search flex-1 min-w-48">
        <component
          :is="Search24Regular"
          class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="searchKeyword"
          class="pl-8"
          placeholder="搜索歌曲 / 歌手 / 标签…"
        />
      </div>
      <Select
        :model-value="selectedAuthor || 'all'"
        @update:model-value="selectedAuthor = $event === 'all' ? null : String($event)"
      >
        <SelectTrigger class="w-36">
          <SelectValue placeholder="歌手" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value="all"
            class="text-xs"
            >全部歌手</SelectItem
          >
          <SelectItem
            v-for="opt in authorOptions"
            :key="opt.value"
            :value="opt.value"
            class="text-xs"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Select
        :model-value="selectedTag || 'all'"
        @update:model-value="selectedTag = $event === 'all' ? null : String($event)"
      >
        <SelectTrigger class="w-36">
          <SelectValue placeholder="标签" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value="all"
            class="text-xs"
            >全部标签</SelectItem
          >
          <SelectItem
            v-for="opt in tagOptions"
            :key="opt.value"
            :value="opt.value"
            class="text-xs"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <SongPlayer
      v-if="previewSong"
      v-model:is-lrc-loading="isLrcLoading"
      :song="previewSong"
      class="preview-player mb-3"
    />

    <Transition
      name="compact-swap"
      mode="out-in"
    >
      <Empty
        v-if="filteredSongs.length === 0"
        :key="`empty-${listKey}`"
        description="暂无曲目"
        class="mt-12 py-8"
      />

      <div
        v-else
        :key="listKey"
        v-bind="containerProps"
        class="h-[clamp(480px,68vh,840px)] overflow-y-auto"
      >
        <div v-bind="wrapperProps">
          <div
            v-for="{ data: song, index } in list"
            :key="song.key"
            class="grid grid-cols-[36px_40px_minmax(140px,1fr)_auto_auto] items-center gap-3 h-[60px] px-3 border-b border-border transition-colors hover:bg-muted"
            :class="{
              'bg-muted/30': index % 2 === 1,
            }"
          >
            <div class="text-xs font-mono text-muted-foreground text-center">
              {{ index + 1 }}
            </div>
            <div class="size-10 rounded-md overflow-hidden bg-muted">
              <img
                v-if="song.cover"
                :src="song.cover"
                :alt="song.name"
                class="size-full object-cover"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
              <span
                v-else
                class="flex-center size-full text-sm font-semibold text-muted-foreground"
                >{{ song.name.charAt(0) }}</span
              >
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 text-[13px] font-medium text-card-foreground">
                <span
                  class="truncate"
                  :title="song.name"
                  >{{ song.name }}</span
                >
                <span
                  v-if="song.translateName"
                  class="text-[11px] text-muted-foreground"
                  >{{ song.translateName }}</span
                >
                <SongStatusBadge
                  :song-key="song.key"
                  :singing-keys="singingSongKeySet"
                  :queued-keys="queuedSongKeySet"
                  variant="tag"
                />
                <SongOptionBadges
                  :options="song.options"
                  variant="semantic"
                  size="tiny"
                />
              </div>
              <div
                v-if="song.author?.length"
                class="text-[11px] text-muted-foreground truncate"
                :title="song.author.join(' / ')"
              >
                {{ song.author.join(' / ') }}
              </div>
            </div>
            <div class="flex gap-1">
              <button
                v-for="tag in (song.tags ?? []).slice(0, 3)"
                :key="tag"
                type="button"
                 class="px-1.5 py-0.5 rounded text-[10px] text-muted-foreground bg-muted border-0 cursor-pointer transition-colors hover:text-primary hover:bg-primary/15"
                 :class="{ 'text-primary bg-primary/15': selectedTag === tag }"
                :aria-pressed="selectedTag === tag"
                @click="selectedTag = selectedTag === tag ? null : tag"
              >
                {{ tag }}
              </button>
            </div>
            <div class="row-actions flex items-center gap-1">
              <Button
                v-if="song.url"
                variant="ghost"
                size="icon"
                class="size-7 rounded-full text-muted-foreground hover:text-foreground"
                :disabled="isLrcLoading === song.key"
                title="试听"
                @click="previewSong = song"
              >
                <component
                  :is="Play24Filled"
                  class="size-3.5"
                />
              </Button>
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
      </div>
    </Transition>
  </div>
</template>

