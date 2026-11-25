import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'

export interface SongPreviewPlayerContext {
  previewSong: Ref<ResponseSongModel | undefined>
  isLrcLoading: Ref<string | undefined>
  isMinimized: Ref<boolean>
  playSong: (song: ResponseSongModel) => void
  closePlayer: () => void
  toggleMinimized: () => void
}

const SONG_PREVIEW_PLAYER_KEY: InjectionKey<SongPreviewPlayerContext> = Symbol('song-preview-player')

export function provideSongPreviewPlayer(): SongPreviewPlayerContext {
  const previewSong = ref<ResponseSongModel | undefined>()
  const isLrcLoading = ref<string | undefined>()
  const isMinimized = ref(false)

  function playSong(song: ResponseSongModel) {
    previewSong.value = song
    isMinimized.value = false
  }

  function closePlayer() {
    previewSong.value = undefined
    isLrcLoading.value = undefined
    isMinimized.value = false
  }

  function toggleMinimized() {
    isMinimized.value = !isMinimized.value
  }

  const ctx: SongPreviewPlayerContext = {
    previewSong,
    isLrcLoading,
    isMinimized,
    playSong,
    closePlayer,
    toggleMinimized,
  }

  provide(SONG_PREVIEW_PLAYER_KEY, ctx)
  return ctx
}

/**
 * 优先注入 SongListView 提供的全局吸底播放器；在独立预览（如 TemplateManager）中自动回退本地状态
 */
export function useSongPreviewPlayer(): SongPreviewPlayerContext & { isShared: boolean } {
  const injected = inject(SONG_PREVIEW_PLAYER_KEY, null)
  if (injected) {
    return { ...injected, isShared: true }
  }

  const previewSong = ref<ResponseSongModel | undefined>()
  const isLrcLoading = ref<string | undefined>()
  const isMinimized = ref(false)

  return {
    previewSong,
    isLrcLoading,
    isMinimized,
    playSong: (song: ResponseSongModel) => {
      previewSong.value = song
      isMinimized.value = false
    },
    closePlayer: () => {
      previewSong.value = undefined
      isLrcLoading.value = undefined
      isMinimized.value = false
    },
    toggleMinimized: () => {
      isMinimized.value = !isMinimized.value
    },
    isShared: false,
  }
}
