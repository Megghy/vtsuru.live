import { describe, expect, it } from 'vitest'

import { SongPlatform } from '@/api/generated/model'
import { objectsToCSV } from '@/shared/utils'

import {
  applySongOrder,
  buildSongListCsvTemplate,
  formatSongOptionsForCsv,
  moveSongInOrder,
  parseSongListCsv,
  parsedRowsToSongsInfo,
} from '../songListCsv'

describe('songListCsv', () => {
  it('parses exported-style CSV and maps to SongsInfo for add API', () => {
    const csv = `名称,翻译名称,作者,描述,来自,语言,标签,链接,外链,封面,点歌门槛,置顶,暂不接歌
歌A,Song A,Taylor Swift/作者2,"含""引号""与,逗号",网易云,中文,tag1,https://music.163.com/1,https://b23.tv/x,https://img/a.jpg,舰长;SC>=30,是,否
歌B,,作者B,,手动添加,日语,,`
    const rows = parseSongListCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('歌A')
    expect(rows[0].from).toBe(SongPlatform.Netease)
    expect(rows[0].author).toEqual(['Taylor Swift', '作者2'])
    expect(rows[0].description).toBe('含"引号"与,逗号')
    expect(rows[0].externalUrl).toBe('https://b23.tv/x')
    expect(rows[0].cover).toBe('https://img/a.jpg')
    expect(rows[0].isPinned).toBe(true)
    expect(rows[0].isDisabled).toBe(false)
    expect(rows[0].options).toEqual({
      needJianzhang: true,
      needTidu: false,
      needZongdu: false,
      scMinPrice: 30,
    })
    expect(rows[1].from).toBe(SongPlatform.Custom)

    const songs = parsedRowsToSongsInfo(rows)
    expect(songs[0].name).toBe('歌A')
    expect(songs[0].language).toContain('中文')
    expect(songs[0].isPinned).toBe(true)
  })

  it('supports round-trip objectsToCSV with empty array guard and RFC4180 quotes', () => {
    expect(objectsToCSV([])).toBe('')
    const csvText = objectsToCSV([
      {
        名称: 'Hello, "World"',
        点歌门槛: formatSongOptionsForCsv({ needJianzhang: true, needTidu: false, needZongdu: false, scMinPrice: 50 }),
      },
    ])
    const parsed = parseSongListCsv(csvText)
    expect(parsed[0].name).toBe('Hello, "World"')
    expect(parsed[0].options?.needJianzhang).toBe(true)
    expect(parsed[0].options?.scMinPrice).toBe(50)
  })

  it('builds valid template CSV', () => {
    const rows = parseSongListCsv(buildSongListCsvTemplate())
    expect(rows).toHaveLength(2)
    expect(rows[0].isPinned).toBe(true)
    expect(rows[0].options?.needJianzhang).toBe(true)
    expect(rows[0].options?.scMinPrice).toBe(30)
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
