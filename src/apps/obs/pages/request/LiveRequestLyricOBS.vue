<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { Music2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import { SongPlatform } from '@/api/generated/model'
import { useLiveRequestData } from '@/apps/obs/components/request/useLiveRequestData'
import { useObsRealtimeSync } from '@/apps/obs/composables/useObsRealtimeSync'
import { parsePositiveId } from '@/shared/obs/obsUrl'
import { fetchNeteaseSyncedLyricLines, type SyncedLyricLine } from '@/shared/utils/lyric'
import { normalizeTimestampMs } from '@/shared/utils/queue'

const props = withDefaults(
  defineProps<{
    id?: number
    active?: boolean
    visible?: boolean
    themeStyle?: 'classic' | 'fresh' | 'minimal' | 'glass' | 'transparent'
    lines?: number
    showTranslation?: boolean
  }>(),
  {
    active: true,
    visible: true,
    showTranslation: true,
  },
)

const route = useRoute()
const account = useAccount()

const currentId = computed<string>(() => {
  const value = props.id ?? (Array.isArray(route.query.id) ? route.query.id[0] : route.query.id)
  return value === undefined || value === null ? '' : String(value)
})

const targetUserId = computed(
  () => parsePositiveId(currentId.value) || (account.value.id > 0 ? String(account.value.id) : ''),
)

const styleType = computed(() => {
  const q = route.query.style
  return props.themeStyle || (typeof q === 'string' ? q : 'glass')
})

const visibleLines = computed(() => {
  if (props.lines && props.lines > 0) return Math.min(7, Math.max(1, props.lines))
  const parsed = Number(route.query.lines)
  if (Number.isFinite(parsed) && parsed > 0) return Math.min(7, Math.max(1, Math.round(parsed)))
  return 3
})

const showTranslationResolved = computed(() => {
  if (route.query.showTranslation === 'false' || route.query.showTranslation === '0') return false
  return props.showTranslation
})

const offsetMs = computed(() => {
  const parsed = Number(route.query.offset)
  return Number.isFinite(parsed) ? parsed : 0
})

const alignLeft = computed(() => route.query.align === 'left')

const { singing, activeSongs: waiting, settings, update } = useLiveRequestData(currentId)

const { on } = useObsRealtimeSync({
  topic: () => (targetUserId.value ? `obs:display:live-request:${targetUserId.value}` : ''),
  active: () => props.active,
  visible: () => props.visible,
  onSync: update,
})
on('Changed', () => {
  void update()
})

const lyricCache = new Map<number, SyncedLyricLine[]>()
const lyricLines = ref<SyncedLyricLine[]>([])
const isLoadingLyric = ref(false)
const nowMs = ref(Date.now())

useIntervalFn(
  () => {
    nowMs.value = Date.now()
  },
  160,
  { immediate: true },
)

const activeSongId = computed(() => {
  const song = singing.value?.song
  if (!song || !song.id || song.id <= 0) return 0
  if (song.from !== SongPlatform.Netease) return 0
  return song.id
})

watch(
  activeSongId,
  async (songId) => {
    if (!songId) {
      lyricLines.value = []
      return
    }
    const cached = lyricCache.get(songId)
    if (cached) {
      lyricLines.value = cached
      return
    }
    isLoadingLyric.value = true
    try {
      const lines = await fetchNeteaseSyncedLyricLines(songId)
      lyricCache.set(songId, lines)
      if (activeSongId.value === songId) {
        lyricLines.value = lines
      }
    } finally {
      if (activeSongId.value === songId) {
        isLoadingLyric.value = false
      }
    }
  },
  { immediate: true },
)

const startSingMs = computed(() => {
  if (!singing.value) return 0
  return normalizeTimestampMs(singing.value.startSingAt) || normalizeTimestampMs(singing.value.createAt)
})

const elapsedMs = computed(() => {
  if (!singing.value || !startSingMs.value) return 0
  return Math.max(0, nowMs.value - startSingMs.value + offsetMs.value)
})

const activeLineIndex = computed(() => {
  const lines = lyricLines.value
  if (lines.length === 0) return -1
  const current = elapsedMs.value
  let idx = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= current) idx = i
    else break
  }
  return idx
})

const displayLines = computed(() => {
  const lines = lyricLines.value
  if (lines.length === 0) return []
  const count = visibleLines.value
  const currentIdx = Math.max(0, activeLineIndex.value)
  const before = Math.floor((count - 1) / 2)
  let start = currentIdx - before
  if (start < 0) start = 0
  if (start + count > lines.length) start = Math.max(0, lines.length - count)
  return lines.slice(start, start + count).map((line, offset) => ({
    ...line,
    index: start + offset,
    isCurrent: start + offset === currentIdx,
    isPast: start + offset < currentIdx,
  }))
})

const shouldHide = computed(() => {
  if (props.id !== undefined) return false
  return Boolean(settings.value.hideWhenEmpty) && !singing.value
})

const containerThemeClass = computed(() => {
  switch (styleType.value) {
    case 'transparent':
      return 'bg-transparent text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]'
    case 'minimal':
      return 'bg-zinc-950/75 text-white border border-white/10'
    case 'fresh':
      return 'bg-white/90 text-zinc-900 border border-zinc-200/80 shadow-md'
    case 'classic':
      return 'bg-zinc-900/90 text-zinc-50 border border-zinc-700/80 shadow-lg'
    default:
      return 'bg-zinc-950/60 backdrop-blur-md text-white border border-white/15 shadow-lg'
  }
})

const mutedTextClass = computed(() => (styleType.value === 'fresh' ? 'text-zinc-500' : 'text-white/65'))
</script>

<template>
  <div
    v-if="!shouldHide"
    class="w-full h-full flex flex-col justify-center p-3 select-none box-border"
    :class="alignLeft ? 'items-start text-left' : 'items-center text-center'"
  >
    <div
      class="w-full max-w-[540px] rounded-xl px-4 py-3 transition-opacity duration-200"
      :class="containerThemeClass"
    >
      <template v-if="singing">
        <!-- 顶部曲目信息 -->
        <div
          class="flex items-center gap-2 pb-2 mb-2 border-b"
          :class="[
            styleType === 'fresh' ? 'border-zinc-200/80' : 'border-white/12',
            alignLeft ? 'justify-between' : 'justify-center',
          ]"
        >
          <div class="flex items-center gap-1.5 min-w-0">
            <Music2
              class="size-3.5 shrink-0"
              :class="styleType === 'fresh' ? 'text-zinc-900' : 'text-sky-300'"
            />
            <span class="text-sm font-semibold truncate">{{ singing.songName }}</span>
            <span
              v-if="singing.song?.author?.length"
              class="text-xs truncate"
              :class="mutedTextClass"
            >
              - {{ singing.song.author.join(' / ') }}
            </span>
          </div>
          <span
            v-if="singing.user?.name"
            class="text-[11px] shrink-0"
            :class="mutedTextClass"
          >
            点歌：{{ singing.user.name }}
          </span>
        </div>

        <!-- 同步歌词区 -->
        <div
          v-if="displayLines.length > 0"
          class="space-y-2 py-1"
        >
          <div
            v-for="line in displayLines"
            :key="`${line.timeMs}-${line.index}`"
            class="transition-all duration-200"
            :class="
              line.isCurrent
                ? 'opacity-100 scale-[1.02] font-semibold text-base leading-snug'
                : line.isPast
                  ? 'opacity-45 text-xs leading-snug'
                  : 'opacity-70 text-xs leading-snug'
            "
          >
            <div class="break-words">{{ line.text }}</div>
            <div
              v-if="showTranslationResolved && line.translation"
              class="text-[11px] font-normal mt-0.5 break-words"
              :class="mutedTextClass"
            >
              {{ line.translation }}
            </div>
          </div>
        </div>

        <!-- 无同步歌词降级 -->
        <div
          v-else
          class="py-2 text-xs"
          :class="mutedTextClass"
        >
          <template v-if="isLoadingLyric">正在加载同步歌词…</template>
          <template v-else>
            正在演唱中{{ waiting.length > 0 ? ` · 下一首：${waiting[0].songName}` : '' }}
          </template>
        </div>
      </template>

      <div
        v-else
        class="py-3 text-xs flex items-center justify-center gap-1.5"
        :class="mutedTextClass"
      >
        <Music2 class="size-3.5 shrink-0" />
        <span>当前暂无正在演唱曲目</span>
      </div>
    </div>
  </div>
</template>
