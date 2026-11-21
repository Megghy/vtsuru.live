import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { postApiSongListAdd } from '@/api/generated/song-list/song-list'

export async function addSongsToSongList(songsShouldAdd: ResponseSongModel[], from: SongPlatform) {
  return postApiSongListAdd(
    songsShouldAdd.map((s) => ({
      name: s.name,
      id: from === SongPlatform.Custom ? -1 : s.id,
      from: from as never,
      author: s.author ?? [],
      url: s.url ?? undefined,
      externalUrl: s.externalUrl ?? undefined,
      description: s.description ?? undefined,
      cover: s.cover ?? undefined,
      tags: s.tags ?? [],
      language: s.language ?? [],
      translateName: s.translateName ?? undefined,
      options: s.options as never,
      sortOrder: s.sortOrder ?? undefined,
      isPinned: s.isPinned ?? undefined,
      isDisabled: s.isDisabled ?? undefined,
    })),
  )
}
