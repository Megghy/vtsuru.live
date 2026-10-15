import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { postApiSongListAdd } from '@/api/generated/song-list/song-list'

export async function addSongsToSongList(songsShouldAdd: SongsInfo[], from: SongFrom) {
  return postApiSongListAdd(
    songsShouldAdd.map((s) => ({
      name: s.name,
      id: from === SongFrom.Custom ? -1 : s.id,
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
