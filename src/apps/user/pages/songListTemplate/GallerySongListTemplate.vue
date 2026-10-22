<script setup lang="ts">
import { Play24Filled, Search24Regular } from '@vicons/fluent'
import { computed, ref } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import { filterSongs, getSongFieldOptions } from './utils/songListData'
import { useProgressiveList } from './utils/useProgressiveList'
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
const previewSong = ref<SongsInfo>()
const isLrcLoading = ref('')

const tagOptions = computed(() => {
  return getSongFieldOptions(props.data, 'tags')
})

const filteredSongs = computed<SongsInfo[]>(() => {
  return filterSongs(props.data, {
    keyword: searchKeyword.value,
    tag: selectedTag.value,
  })
})

const { visibleItems, hasMore, loadMoreTrigger, loadMore } = useProgressiveList(filteredSongs, 24)
const { listKey } = useFilterListKey({ tag: selectedTag })

function requestSong(song: SongsInfo) {
  if (!beginRequest(song)) return
  emits('requestSong', song)
}
</script>

<template>
  <TooltipProvider>
    <div class="w-full max-w-[var(--vtsuru-page-max-width,1180px)] mx-auto p-[clamp(12px,2vw,24px)]">
      <header class="flex items-end justify-between mb-3.5 gap-3.5">
        <div>
          <span class="block mb-0.5 text-primary text-[10px] font-bold">COVER ARCHIVE</span>
          <h2 class="m-0 text-card-foreground text-[clamp(20px,3vw,28px)] leading-[1.15]">封面曲库</h2>
        </div>
        <span
          :key="listKey"
          class="text-xs font-mono text-muted-foreground"
        >
          {{ filteredSongs.length }} 首
        </span>
      </header>

      <div class="toolbar flex flex-wrap gap-2.5 items-center mb-4">
        <div class="relative search flex-1 min-w-48">
          <component
            :is="Search24Regular"
            class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="searchKeyword"
            class="pl-8 w-full"
            placeholder="搜索歌曲 / 歌手 / 标签…"
          />
        </div>
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
        class="preview-player mb-4"
      />

      <Transition
        name="gallery-swap"
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
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5"
        >
          <div
            v-for="(song, index) in visibleItems"
            :key="song.key"
            class="cover-card flex flex-col gap-2 rounded-lg border border-border/80 bg-card p-2 transition hover:border-primary/50"
            :class="{
              'is-singing': singingSongKeySet.has(song.key),
              'is-queued': queuedSongKeySet.has(song.key),
            }"
          >
            <div class="cover relative aspect-square w-full rounded-md overflow-hidden bg-muted/60 group">
              <img
                v-if="song.cover"
                :src="song.cover"
                :alt="song.name"
                loading="lazy"
                referrerpolicy="no-referrer"
                class="w-full h-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div
                v-else
                class="cover-placeholder w-full h-full flex items-center justify-center font-bold text-lg text-muted-foreground"
              >
                <span>{{ song.name.charAt(0) }}</span>
              </div>

              <span
                class="cover-index absolute top-1.5 left-1.5 text-[10px] font-mono px-1 py-0.5 rounded bg-black/60 text-white"
              >
                {{ String(index + 1).padStart(2, '0') }}
              </span>

              <SongStatusBadge
                class="status-overlay absolute top-1.5 right-1.5"
                :song-key="song.key"
                :singing-keys="singingSongKeySet"
                :queued-keys="queuedSongKeySet"
                variant="text"
              />
              <span
                v-if="song.options?.scMinPrice"
                class="status-flag flag-sc absolute bottom-1.5 left-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/80 text-white"
              >
                SC ¥{{ song.options.scMinPrice }}
              </span>

              <div
                class="cover-overlay absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2"
              >
                <Tooltip v-if="song.url">
                  <TooltipTrigger as-child>
                    <Button
                      variant="secondary"
                      size="icon"
                      class="size-9 rounded-full bg-background/90 text-foreground hover:bg-background"
                      :aria-label="`试听：${song.name}`"
                      :disabled="isLrcLoading === song.key"
                      @click="previewSong = song"
                    >
                      <component
                        :is="Play24Filled"
                        class="size-4"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>试听</TooltipContent>
                </Tooltip>
                <SongRequestButton
                  v-if="!isSelf"
                  :song="song"
                  :live-request-settings="liveRequestSettings"
                  :auth-state="requestAuthState"
                  :loading="requestingKey === song.key"
                  :circle="true"
                  size="large"
                  @request="requestSong"
                />
              </div>
            </div>

            <div class="info flex flex-col gap-0.5 text-xs">
              <div
                class="title font-medium truncate text-foreground"
                :title="song.name"
              >
                {{ song.name }}
              </div>
              <div
                v-if="song.translateName"
                class="translate text-[11px] text-muted-foreground truncate"
                :title="song.translateName"
              >
                {{ song.translateName }}
              </div>
              <div
                v-if="song.author?.length"
                class="author text-[11px] text-muted-foreground truncate"
                :title="song.author.join(' / ')"
              >
                {{ song.author.join(' / ') }}
              </div>

              <SongOptionBadges
                :options="song.options"
                variant="guard"
                class="mt-1"
              />
            </div>
          </div>

          <button
            v-if="hasMore"
            ref="loadMoreTrigger"
            type="button"
            class="load-more-trigger col-span-full py-4 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            @click="loadMore"
          >
            加载更多
          </button>
        </div>
      </Transition>
    </div>
  </TooltipProvider>
</template>

