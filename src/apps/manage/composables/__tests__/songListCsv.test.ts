import { describe, expect, it } from 'vitest'

import { SongFrom } from '@/api/api-models'

import { applySongOrder, moveSongInOrder, parseSongListCsv, parsedRowsToSongsInfo } from '../songListCsv'

describe('songListCsv', () => {
  it('parses exported-style CSV and maps to SongsInfo for add API', () => {
    const csv = `名称,翻译名称,作者,描述,来自,语言,标签,链接
歌A,Song A,作者1/作者2,desc,网易云,中文,tag1,https://music.163.com/1
歌B,,作者B,,手动添加,日语,,`
    const rows = parseSongListCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('歌A')
    expect(rows[0].from).toBe(SongFrom.Netease)
    expect(rows[0].author).toEqual(['作者1', '作者2'])
    expect(rows[1].from).toBe(SongFrom.Custom)

    const songs = parsedRowsToSongsInfo(rows)
    expect(songs[0].name).toBe('歌A')
    expect(songs[0].language).toContain('中文')
  })

  it('reorders songs by key list and moveSongInOrder', () => {
    const songs = parsedRowsToSongsInfo(
      parseSongListCsv(`名称,作者,来自,语言,链接
A,a,手动添加,中文,
B,b,手动添加,中文,
C,c,手动添加,中文,`),
    )
    const order = songs.map((s) => s.key)
    const moved = moveSongInOrder(order, order[0], 1)
    const reordered = applySongOrder(songs, moved)
    expect(reordered.map((s) => s.name)).toEqual(['B', 'A', 'C'])
  })
})
