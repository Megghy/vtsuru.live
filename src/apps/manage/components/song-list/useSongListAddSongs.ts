import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { postApiSongListAdd } from '@/api/generated/song-list/song-list'

export async function addSongsToSongList(songsShouldAdd: ResponseSongModel[], from: SongPlatform) {
  return postApiSongListAdd(
    songsShouldAdd.map((s) => ({
      name: s.name,
      id: from === SongPlatform.Custom ? -1 : s.id,
      from: from as never,
      author: s.author,
      url: s.url,
      description: s.description,
      cover: s.cover,
      tags: s.tags,
      language: s.language,
      translateName: s.translateName,
      options: s.options as never,
    })),
  )
}
