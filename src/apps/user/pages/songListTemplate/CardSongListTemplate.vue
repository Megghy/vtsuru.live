<script setup lang="ts">
import { Search24Regular } from '@vicons/fluent'
import { MusicalNote } from '@vicons/ionicons5'
import { computed, ref } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import { filterSongs } from './utils/songListData'
import { getSongRequestTooltip } from './utils/songRequestUtils'
import { useProgressiveList } from './utils/useProgressiveList'
import { useFilterListKey, useSongListTemplateCore } from './utils/useSongListTemplateCore'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])

const {
  requestAuthState,
  isSelf,
  activeSongKeys: activeSongKeySet,
  singingSongKeys: singingSongKeySet,
  beginRequest,
} = useSongListTemplateCore({
  userInfo: () => props.userInfo,
  liveRequestActive: () => props.liveRequestActive,
})

const inputKeyword = ref('')
const searchKeyword = ref('')

const filteredSongs = computed<SongsInfo[]>(() => {
  return filterSongs(props.data, { keyword: searchKeyword.value })
})
const { visibleItems, hasMore, loadMoreTrigger, loadMore } = useProgressiveList(filteredSongs, 24)
const { listKey } = useFilterListKey({ committedKeyword: searchKeyword })

function commitSearch() {
  searchKeyword.value = inputKeyword.value.trim()
}

function requestSong(song: SongsInfo) {
  if (!beginRequest(song)) return
  emits('requestSong', song)
}

function getMetaText(song: SongsInfo) {
  const tags = (song.tags ?? []).filter(Boolean)
  const languages = (song.language ?? []).filter(Boolean)
  const left = tags.slice(0, 2).join(', ')
  const right = languages.slice(0, 2).join(', ')
  return [left, right].filter(Boolean).join(' · ')
}
</script>

<template>
  <TooltipProvider>
    <div class="w-full max-w-[var(--vtsuru-page-max-width,1180px)] mx-auto p-[clamp(12px,2vw,24px)]">
      <div class="search-row flex gap-2 mb-3">
        <div class="relative search-field flex-1">
          <component
            :is="Search24Regular"
            class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="inputKeyword"
            class="pl-8 w-full"
            placeholder="搜索歌曲或歌手…"
            @keyup.enter="commitSearch"
          />
        </div>
        <Button
          class="px-4"
          @click="commitSearch"
        >
          搜索
        </Button>
      </div>

      <div
        :key="listKey"
        class="count-row is-pulsing text-xs text-muted-foreground font-mono mb-3"
      >
        共 {{ filteredSongs.length }} 首歌曲
      </div>

      <Empty
        v-if="!data || filteredSongs.length === 0"
        :key="`empty-${listKey}`"
        class="empty-state py-12"
        description="暂无曲目"
      />

      <div
        v-else
        :key="listKey"
        class="song-cards grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <div
          v-for="song in visibleItems"
          :key="song.key"
          class="song-card p-3 rounded-lg border border-border/80 bg-card flex flex-col justify-between gap-2 transition hover:border-primary/50"
          :class="{
            'is-active': activeSongKeySet.has(song.key),
            'is-singing': singingSongKeySet.has(song.key),
          }"
        >
          <div class="card-top flex items-start justify-between gap-2">
            <div class="title-left flex items-start gap-2.5 min-w-0 flex-1">
              <div
                class="left-icon size-8 rounded-md bg-muted/60 flex items-center justify-center shrink-0 text-muted-foreground"
              >
                <component
                  :is="MusicalNote"
                  class="size-4"
                />
              </div>
              <div class="title-block min-w-0 flex-1">
                <Tooltip :disabled="isSelf">
                  <TooltipTrigger as-child>
                    <button
                      class="song-title text-left font-medium text-xs text-foreground hover:text-primary transition truncate block w-full cursor-pointer disabled:cursor-default"
                      type="button"
                      :disabled="isSelf"
                      @click="requestSong(song)"
                    >
                      {{ song.name }}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent class="text-xs">
                    {{ getSongRequestTooltip(song, liveRequestSettings, requestAuthState) }}
                  </TooltipContent>
                </Tooltip>

                <div class="sub flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 truncate">
                  <span
                    v-if="song.author?.length"
                    class="song-author truncate"
                  >
                    {{ song.author.join(' / ') }}
                  </span>
                  <span class="dot">·</span>
                  <span class="meta truncate">
                    {{ getMetaText(song) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="title-right flex items-center gap-1.5 shrink-0">
              <SongStatusBadge
                :song-key="song.key"
                :singing-keys="singingSongKeySet"
                :queued-keys="activeSongKeySet"
                variant="text"
              />
              <SongRequestButton
                :song="song"
                :live-request-settings="liveRequestSettings"
                :auth-state="requestAuthState"
                :hidden="isSelf"
                size="small"
                :circle="false"
                @request="requestSong"
              />
            </div>
          </div>

          <div class="card-bottom flex items-center justify-between gap-2 pt-1.5 border-t border-border/40 text-[11px]">
            <div class="pills flex items-center gap-1 flex-wrap">
              <span
                v-for="tag in (song.tags ?? []).slice(0, 2)"
                :key="tag"
                class="pill px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground text-[10px] truncate max-w-24"
              >
                {{ tag }}
              </span>
              <span
                v-for="lang in (song.language ?? []).slice(0, 2)"
                :key="lang"
                class="pill pill-muted px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground/80 text-[10px] truncate max-w-24"
              >
                {{ lang }}
              </span>
            </div>

            <SongOptionBadges
              :options="song.options"
              variant="guard"
            />

            <div class="desc text-muted-foreground truncate max-w-40 text-right">
              {{ song.translateName || song.description || '' }}
            </div>
          </div>
        </div>

        <div
          v-if="hasMore"
          ref="loadMoreTrigger"
          class="load-more col-span-full flex justify-center py-4"
        >
          <Button
            variant="outline"
            @click="loadMore"
          >
            加载更多
          </Button>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>

