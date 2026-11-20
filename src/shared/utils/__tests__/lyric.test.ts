import { describe, expect, it, vi } from 'vitest'

vi.mock('@/api/generated/song-list/song-list', () => ({
  getApiSongListGetNeteaseLyric: vi.fn(),
}))

import { mergeLyrics } from '../lyric'

describe('mergeLyrics', () => {
  it('空字符串或空白行输入时返回空结果', () => {
    expect(mergeLyrics('', '')).toBe('')
    expect(mergeLyrics('[00:10.00]\n', '')).toBe('')
  })

  it('仅传入原版歌词时原样保留有效行与元数据', () => {
    const original = '[ti:晴天]\n[00:01.00]故事的小黄花\n[00:05.50]从出生那年就飘着'
    expect(mergeLyrics(original, '')).toBe('[ti:晴天]\n[00:01.00]故事的小黄花\n[00:05.50]从出生那年就飘着')
  })

  it('按相同时间戳将翻译拼接在原歌词行后，并保留多余翻译行', () => {
    const original = '[00:10.12]First line\n[00:20.34]Second line\n[00:30.00]'
    const translated = '[00:10.12]第一句\n[00:20.34]   \n[00:40.00]额外翻译'
    expect(mergeLyrics(original, translated)).toBe(
      '[00:10.12]First line (第一句)\n[00:20.34]Second line\n[00:40.00]额外翻译',
    )
  })

  it('支持两位/三位毫秒对齐、多时间戳展开去残留标签与未匹配译文按时间序插入', () => {
    const original = ['[00:10.12]Line A', '[00:12.340]Chorus', '[00:20.00]Line B', '[01:45.67]Chorus Repeat'].join('\n')
    const translated = [
      '[00:05.00]开场提示',
      '[00:10.120]第一行',
      '[00:12.34][01:45.67]副歌',
      '[00:15.50]间奏提示',
    ].join('\n')

    expect(mergeLyrics(original, translated)).toBe(
      [
        '[00:05.00]开场提示',
        '[00:10.12]Line A (第一行)',
        '[00:12.340]Chorus (副歌)',
        '[00:15.50]间奏提示',
        '[00:20.00]Line B',
        '[01:45.67]Chorus Repeat (副歌)',
      ].join('\n'),
    )
  })
})
