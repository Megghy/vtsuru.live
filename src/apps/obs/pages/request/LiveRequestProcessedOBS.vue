<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import type { SongRequestInfo } from '@/api/client-types'
import { getApiLiveRequestGetToday } from '@/api/generated/live-request/live-request'
import type { SettingSongRequest } from '@/api/generated/model'
import { SongRequestFrom } from '@/api/generated/model'
import ObsClassicPanel from '@/apps/obs/components/shared/ObsClassicPanel.vue'
import type { ObsDisplayCurrent, ObsDisplayFooterTag, ObsDisplayItem } from '@/apps/obs/components/shared/obsDisplay'
import ObsFreshPanel from '@/apps/obs/components/shared/ObsFreshPanel.vue'
import ObsGlassPanel from '@/apps/obs/components/shared/ObsGlassPanel.vue'
import ObsMinimalPanel from '@/apps/obs/components/shared/ObsMinimalPanel.vue'
import ObsTransparentPanel from '@/apps/obs/components/shared/ObsTransparentPanel.vue'
import { useObsRealtimeSync } from '@/apps/obs/composables/useObsRealtimeSync'
import { parsePositiveId } from '@/shared/obs/obsUrl'
import { normalizeTimestampMs, sortByQueueType } from '@/shared/utils/queue'

const props = withDefaults(
  defineProps<{
    id?: number
    active?: boolean
    visible?: boolean
    speedMultiplier?: number
    themeStyle?: 'classic' | 'fresh' | 'minimal' | 'glass' | 'transparent'
  }>(),
  { active: true, visible: true },
)

const route = useRoute()
const account = useAccount()
const currentId = computed<string>(() => {
  const v = props.id ?? (Array.isArray(route.query.id) ? route.query.id[0] : route.query.id)
  return v === undefined || v === null ? '' : String(v)
})
const targetUserId = computed(
  () => parsePositiveId(currentId.value) || (account.value.id > 0 ? String(account.value.id) : ''),
)

const speedMultiplier = computed(() => {
  if (props.speedMultiplier !== undefined && props.speedMultiplier > 0) {
    return props.speedMultiplier
  }
  const speedParam = route.query.speed
  const speed = Number.parseFloat(speedParam?.toString() ?? '1')
  return Number.isNaN(speed) || speed <= 0 ? 1 : speed
})

const styleType = computed(() => {
  const queryStyle = route.query.style
  return props.themeStyle || (typeof queryStyle === 'string' ? queryStyle : 'classic')
})

const panelComponent = computed(() => {
  switch (styleType.value) {
    case 'glass':
      return ObsGlassPanel
    case 'transparent':
      return ObsTransparentPanel
    case 'fresh':
      return ObsFreshPanel
    case 'minimal':
      return ObsMinimalPanel
    default:
      return ObsClassicPanel
  }
})

const originSongs = ref<SongRequestInfo[]>([])
const settings = ref<SettingSongRequest>({} as SettingSongRequest)

const songs = computed(() =>
  sortByQueueType(originSongs.value, settings.value.sortType, Boolean(settings.value.isReverse), {
    createAt: (q) => q.createAt,
    guardLevel: (q) => q.user?.guard_level,
    price: (q) => q.price,
    fansMedalLevel: (q) => q.user?.fans_medal_level,
    fansMedalWearing: (q) => q.user?.fans_medal_wearing_status,
    priorityLevel: (q) => q.priorityLevel,
  }),
)

const title = computed(() => settings.value.obsTitleToday?.trim() || '今日已唱')
const countText = computed(() => `${songs.value.length} 首`)

const latestSong = computed(() => {
  if (originSongs.value.length === 0) return undefined
  return [...originSongs.value].toSorted((a, b) => {
    const bTs = normalizeTimestampMs(b.finishAt) || normalizeTimestampMs(b.createAt)
    const aTs = normalizeTimestampMs(a.finishAt) || normalizeTimestampMs(a.createAt)
    return bTs - aTs
  })[0]
})

const current = computed<ObsDisplayCurrent>(() => {
  if (!latestSong.value) {
    return {
      active: false,
      emptyText: '今日暂无已唱曲目',
    }
  }
  return {
    active: true,
    title: latestSong.value.songName || '未知歌曲',
    subtitle:
      latestSong.value.from === SongRequestFrom.Manual
        ? '主播添加 · 最新完成'
        : `${latestSong.value.user?.name || '未知用户'} · 最新完成`,
    avatarUrl: latestSong.value.user?.face,
    hideAvatar: latestSong.value.from === SongRequestFrom.Manual,
    emptyText: '今日暂无已唱曲目',
  }
})

const items = computed<ObsDisplayItem[]>(() => {
  return songs.value.map((song) => ({
    id: song.id,
    primary: song.songName || '未知歌曲',
    badges: [
      settings.value.showUserName
        ? {
            text: song.from === SongRequestFrom.Manual ? '主播添加' : song.user?.name || '未知用户',
            tone: song.from === SongRequestFrom.Manual ? 'accent' : 'muted',
          }
        : null,
      settings.value.showFanMadelInfo && (song.user?.fans_medal_level ?? 0) > 0
        ? {
            text: `${song.user?.fans_medal_name || ''} ${song.user?.fans_medal_level || ''}`.trim(),
            tone: 'muted',
          }
        : null,
    ].filter(Boolean) as NonNullable<ObsDisplayItem['badges']>,
  }))
})

const footerTags = computed<ObsDisplayFooterTag[]>(() => [])

async function get() {
  try {
    const validId = parsePositiveId(currentId.value)
    const data = await getApiLiveRequestGetToday(validId ? { id: Number(validId) } : {})
    if (data.code === 200) {
      return data.data
    }
  } catch (err) {
    console.error(err)
  }
  return { songs: [], setting: {} as SettingSongRequest }
}

let requestSeq = 0

async function update() {
  const seq = ++requestSeq
  const r = await get()
  if (seq !== requestSeq) return
  if (r) {
    originSongs.value = (r.songs ?? []).toSorted(
      (a, b) => normalizeTimestampMs(b.createAt) - normalizeTimestampMs(a.createAt),
    )
    settings.value = r.setting ?? ({} as SettingSongRequest)
  }
}

const { on } = useObsRealtimeSync({
  topic: () => (targetUserId.value ? `obs:display:live-request:${targetUserId.value}` : ''),
  active: () => props.active,
  visible: () => props.visible,
  onSync: update,
})
on('Changed', () => {
  void update()
})
</script>

<template>
  <component
    :is="panelComponent"
    :title="title"
    :count-text="countText"
    :current="current"
    :items="items"
    :footer-tags="footerTags"
    :speed-multiplier="speedMultiplier"
    empty-text="今日暂无"
    v-bind="$attrs"
  />
</template>
