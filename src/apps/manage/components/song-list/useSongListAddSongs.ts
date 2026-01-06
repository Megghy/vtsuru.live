import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { QueryPostAPI } from '@/api/query'
import { SONG_API_URL } from '@/shared/config'

export async function addSongsToSongList(songsShouldAdd: SongsInfo[], from: SongFrom) {
  return QueryPostAPI<SongsInfo[]>(
    `${SONG_API_URL}add`,
    songsShouldAdd.map(s => ({
      Name: s.name,
      Id: from === SongFrom.Custom ? -1 : s.id,
      From: from,
      Author: s.author,
      Url: s.url,
      Description: s.description,
      Cover: s.cover,
      Tags: s.tags,
      Language: s.language,
      TranslateName: s.translateName,
      Options: s.options,
    })),
  )
}

