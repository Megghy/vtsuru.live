<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
// @ts-ignore
import APlayer from 'vue3-aplayer'

import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { fetchNeteaseMergedLyric } from '@/shared/utils/lyric'
import { getPlayableAudioUrl } from '@/shared/utils/songMedia'

const props = defineProps<{
  song: ResponseSongModel | undefined
  isLrcLoading?: string
}>()
const emits = defineEmits(['update:isLrcLoading', 'update:close', 'update:volume', 'close'])

const aplayerRef = ref<any>()
const aplayerMusic = ref({
  title: '',
  artist: '',
  src: '',
  pic: '',
  lrc: '',
})
let lyricSeq = 0

function triggerPlay(seq: number) {
  void nextTick(() => {
    if (seq !== lyricSeq) return
    aplayerRef.value?.thenPlay?.()
  })
}

async function onPlayMusic(song: ResponseSongModel, seq: number) {
  const src = getPlayableAudioUrl(song) ?? ''
  const pic = song.cover || ''
  if (song.from === SongPlatform.Netease && src) {
    await loadNeteaseLyric(song, src, pic, seq)
    return
  }
  emits('update:isLrcLoading', undefined)
  aplayerMusic.value = {
    title: song.name,
    artist: song.author?.join('/') ?? '',
    src,
    pic,
    lrc: '',
  }
  if (src) triggerPlay(seq)
}

async function loadNeteaseLyric(song: ResponseSongModel, src: string, pic: string, seq: number) {
  emits('update:isLrcLoading', song.key)
  try {
    const lrc = await fetchNeteaseMergedLyric(song.id)
    if (seq !== lyricSeq) return
    aplayerMusic.value = {
      title: song.name,
      artist: song.author?.join('/') ?? '',
      src,
      pic,
      lrc,
    }
    triggerPlay(seq)
  } finally {
    if (seq === lyricSeq) {
      emits('update:isLrcLoading', undefined)
    }
  }
}

function handleClose() {
  lyricSeq++
  aplayerRef.value?.pause?.()
  emits('update:isLrcLoading', undefined)
  emits('update:close', false)
  emits('close')
}

watch(
  () => props.song,
  (newSong) => {
    const seq = ++lyricSeq
    if (!newSong) {
      aplayerMusic.value = { title: '', artist: '', src: '', pic: '', lrc: '' }
      emits('update:isLrcLoading', undefined)
      return
    }
    void onPlayMusic(newSong, seq)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  lyricSeq++
  emits('update:isLrcLoading', undefined)
  aplayerRef.value?.pause?.()
})
</script>

<template>
  <div
    v-if="song"
    class="rounded-lg border border-border/80 bg-card overflow-hidden"
  >
    <div class="flex-between gap-2 px-3 py-1.5 border-b border-border/60 bg-muted/30 text-xs">
      <div class="flex items-center gap-2 min-w-0">
        <span class="font-medium text-foreground truncate">{{ song.name }}</span>
        <span
          v-if="song.author?.length"
          class="text-muted-foreground truncate"
        >
          {{ song.author.join(' / ') }}
        </span>
      </div>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="关闭试听"
        @click="handleClose"
      >
        <X class="size-3.5" />
      </Button>
    </div>

    <Empty
      v-if="!aplayerMusic.src"
      :description="props.isLrcLoading ? '歌词加载中...' : '暂无可播放的音频直链'"
      class="py-6"
    />
    <APlayer
      v-else
      ref="aplayerRef"
      :music="aplayerMusic"
      autoplay
      :show-lrc="Boolean(aplayerMusic.lrc)"
    />
  </div>
</template>
