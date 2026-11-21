import { describe, expect, it } from 'vitest'

import { SongPlatform } from '@/api/generated/model'

import { getPlayableAudioUrl, getSongExternalLink, isAudioFileUrl, isSafeHttpUrl } from '../songMedia'

describe('songMedia', () => {
  it('filters unsafe schemes including blob: and javascript:', () => {
    expect(isSafeHttpUrl('https://example.com/a.mp3')).toBe('https://example.com/a.mp3')
    expect(isSafeHttpUrl('blob:https://vtsuru.live/123')).toBeUndefined()
    expect(isSafeHttpUrl('javascript:alert(1)')).toBeUndefined()
  })

  it('separates playable audio URLs from external web pages', () => {
    expect(isAudioFileUrl('https://cdn.example.com/track.mp3?token=1')).toBe(true)
    expect(isAudioFileUrl('https://www.bilibili.com/video/BV1xx')).toBe(false)

    const biliSong = {
      from: SongPlatform.Custom,
      id: -1,
      url: 'https://www.bilibili.com/video/BV1xx',
      externalUrl: undefined,
    }
    expect(getPlayableAudioUrl(biliSong)).toBeUndefined()
    expect(getSongExternalLink(biliSong)).toEqual({
      url: 'https://www.bilibili.com/video/BV1xx',
      label: '哔哩哔哩',
      platform: 'bilibili',
    })
  })

  it('generates fallback playable and external links for Netease and 5sing', () => {
    const neteaseSong = {
      from: SongPlatform.Netease,
      id: 123456,
      url: undefined,
      externalUrl: undefined,
    }
    expect(getPlayableAudioUrl(neteaseSong)).toBe('https://music.163.com/song/media/outer/url?id=123456.mp3')
    expect(getSongExternalLink(neteaseSong)).toEqual({
      url: 'https://music.163.com/#/song?id=123456',
      label: '网易云音乐',
      platform: 'netease',
    })

    const fivesingSong = {
      from: SongPlatform.FiveSing,
      id: 98765,
      url: 'https://audio.example.com/bz.mp3',
      externalUrl: undefined,
    }
    expect(getPlayableAudioUrl(fivesingSong)).toBe('https://audio.example.com/bz.mp3')
    expect(getSongExternalLink(fivesingSong)?.platform).toBe('fivesing')
  })
})
