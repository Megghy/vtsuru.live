import { afterEach, describe, expect, it, vi } from 'vitest'

import { QueueGiftFilterType, QueueSortType, SongPlatform } from '@/api/generated/model'
import type { ResponseSongModel, ResponseUserInfo, SettingSongRequest } from '@/api/generated/model'

import { canRequestSong, getSongRequestButtonType, getSongRequestTooltip } from '../songRequestUtils'

const baseSettings: SettingSongRequest = {
  orderPrefix: '点播',
  sortType: QueueSortType.TimeFirst,
  enableOnStreaming: false,
  onlyAllowSongList: false,
  queueMaxSize: 20,
  allowAllDanmaku: true,
  allowFromWeb: true,
  allowAnonymousFromWeb: false,
  needWearFanMedal: false,
  needJianzhang: false,
  needTidu: false,
  needZongdu: false,
  allowSC: true,
  fanMedalMinLevel: 0,
  allowReorderSong: false,
  allowGift: false,
  giftFilterType: QueueGiftFilterType.Or,
  allowIncreasePaymentBySendGift: false,
  allowIncreaseByAnyPayment: false,
  enableCooldown: false,
  cooldownSecond: 0,
  zongduCooldownSecond: 0,
  tiduCooldownSecond: 0,
  jianzhangCooldownSecond: 0,
  enableWebCooldown: false,
  webCooldownSecond: 0,
  showRequireInfo: true,
  showUserName: true,
  showFanMadelInfo: true,
  isReverse: false,
  enablePointRequest: false,
  pointRequestCost: 0,
  pointIgnoreLimit: false,
  allowPointPriority: false,
  pointPriorityKeyword: '插队',
  pointPriorityCost: 100,
  maxSongsPerUserInQueue: 0,
  preventSameSongToday: false,
  songCooldownMinute: 0,
  autoClearOnLiveStart: false,
  showAuthor: true,
  showDescription: true,
  showPrice: true,
  hideWhenEmpty: false,
}

const streamer: ResponseUserInfo = {
  id: 1,
  name: 'Streamer',
  biliId: 1000,
  biliRoomId: 1000,
  createAt: 0,
  isBiliVerified: true,
  canRequestSong: true,
  isBiliAuthed: true,
  streamerInfo: {} as ResponseUserInfo['streamerInfo'],
  extra: {} as ResponseUserInfo['extra'],
}

function createSong(
  options?: Partial<NonNullable<ResponseSongModel['options']>>,
  extra?: Partial<ResponseSongModel>,
): ResponseSongModel {
  return {
    id: 1,
    key: 'song-1',
    name: '测试曲目',
    author: ['歌手'],
    from: SongPlatform.Netease,
    url: '',
    tags: [],
    aliases: [],
    createTime: 0,
    updateTime: 0,
    options: options
      ? {
          needJianzhang: false,
          needTidu: false,
          needZongdu: false,
          fanMedalMinLevel: 0,
          scMinPrice: 0,
          ...options,
        }
      : undefined,
    ...extra,
  }
}

describe('songRequestUtils', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('有大航海要求的曲目：未绑定 B 站仅复制，已绑定 B 站可网页直点并展示要求', () => {
    const song = createSong({ needJianzhang: true })

    const unauthed = canRequestSong(song, streamer, baseSettings, true, false)
    expect(unauthed.canRequest).toBe(false)
    expect(unauthed.shouldCopyOnly).toBe(true)
    expect(getSongRequestButtonType(song, baseSettings, { isLoggedIn: true, isBiliAuthed: false })).toBe('warning')
    expect(getSongRequestTooltip(song, baseSettings, { isLoggedIn: true, isBiliAuthed: false })).toContain('绑定 B 站')

    const authed = canRequestSong(song, streamer, baseSettings, false, true)
    expect(authed).toEqual({ canRequest: true })
    expect(getSongRequestButtonType(song, baseSettings, { isLoggedIn: false, isBiliAuthed: true })).toBe('info')
    expect(getSongRequestTooltip(song, baseSettings, { isLoggedIn: false, isBiliAuthed: true })).toContain('要求 舰长')
  })

  it('有粉丝牌等级要求的曲目：与后端口径一致，一律引导直播间弹幕点歌并走复制', () => {
    const song = createSong({ fanMedalMinLevel: 10 })

    const result = canRequestSong(song, streamer, baseSettings, true, true)
    expect(result.canRequest).toBe(false)
    expect(result.shouldCopyOnly).toBe(true)
    expect(result.reason).toContain('粉丝牌 ≥ 10')
    expect(getSongRequestTooltip(song, baseSettings, { isLoggedIn: true, isBiliAuthed: true })).toContain('粉丝牌 ≥ 10')
    expect(getSongRequestButtonType(song, baseSettings, { isLoggedIn: true, isBiliAuthed: true })).toBe('warning')
  })

  it('暂不接歌的曲目直接拒绝点歌且不自动复制', () => {
    const song = createSong(undefined, { isDisabled: true })

    const result = canRequestSong(song, streamer, baseSettings, true, true)
    expect(result.canRequest).toBe(false)
    expect(result.shouldCopyOnly).toBeUndefined()
    expect(result.reason).toContain('暂未开放')
    expect(getSongRequestTooltip(song, baseSettings, { isLoggedIn: true, isBiliAuthed: true })).toBe('暂不接歌')
  })

  it('有 SC 金额门槛的曲目无论是否绑定 B 站均走复制指令提示', () => {
    const song = createSong({ scMinPrice: 50, needJianzhang: true })

    const result = canRequestSong(song, streamer, baseSettings, true, true)
    expect(result.canRequest).toBe(false)
    expect(result.shouldCopyOnly).toBe(true)
    expect(result.reason).toContain('¥50')
    expect(getSongRequestTooltip(song, baseSettings, { isLoggedIn: true, isBiliAuthed: true })).toContain('SC ≥ ¥50')
    expect(getSongRequestButtonType(song, baseSettings, { isLoggedIn: true, isBiliAuthed: true })).toBe('warning')
  })

  it('关闭网页点歌或未登录且禁止匿名时应阻止直点并返回复制原因', () => {
    const song = createSong()

    const webDisabled = canRequestSong(song, streamer, { ...baseSettings, allowFromWeb: false }, true, true)
    expect(webDisabled.canRequest).toBe(false)
    expect(webDisabled.shouldCopyOnly).toBe(true)

    const anonBlocked = canRequestSong(song, streamer, baseSettings, false, false)
    expect(anonBlocked.canRequest).toBe(false)
    expect(anonBlocked.shouldCopyOnly).toBe(true)

    const undefinedSettingsTooltip = getSongRequestTooltip(song, undefined, { isLoggedIn: true, isBiliAuthed: true })
    expect(undefinedSettingsTooltip).toContain('不允许从网页点歌')
  })

  it('canRequestSong 兼容 Date / 字符串 / 数字时间戳格式的 nextRequestTime 冷却判定', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-20T12:00:00Z'))
    const song = createSong()
    const targetMs = Date.now() + 15_000

    const byDate = canRequestSong(
      song,
      streamer,
      { ...baseSettings, allowAnonymousFromWeb: true },
      false,
      false,
      new Date(targetMs),
    )
    expect(byDate.canRequest).toBe(false)
    expect(byDate.reason).toContain('15秒')

    const byIso = canRequestSong(
      song,
      streamer,
      { ...baseSettings, allowAnonymousFromWeb: true },
      false,
      false,
      new Date(targetMs).toISOString(),
    )
    expect(byIso.canRequest).toBe(false)
    expect(byIso.reason).toContain('15秒')

    const bySeconds = canRequestSong(
      song,
      streamer,
      { ...baseSettings, allowAnonymousFromWeb: true },
      false,
      false,
      Math.floor(targetMs / 1000),
    )
    expect(bySeconds.canRequest).toBe(false)
    expect(bySeconds.reason).toContain('15秒')
  })
})
