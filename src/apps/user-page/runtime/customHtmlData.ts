import { getApiCheckinKeyword, getApiCheckinRanking } from '@/api/generated/check-in/check-in'
import { getApiQaGetPublic, getApiQaGetTags } from '@/api/generated/qa/qa'
import { getApiScheduleBiliReserve, getApiScheduleGet } from '@/api/generated/schedule/schedule'
import { unwrapOk } from '@/api/query'
import {
  fetchPublicActiveVideoCollect,
  fetchPublicPointGoods,
  fetchPublicSongList,
  fetchPublicSongRequestState,
} from '@/apps/user-page/api'
import { resolveFileUrl } from '@/shared/config'

import { loadCached } from './query'

type OwnerId = () => number
const cacheSignal = new AbortController().signal
const cached = <T>(key: string, loader: (signal: AbortSignal) => Promise<T>, ttl = 30_000) =>
  loadCached(key, loader, cacheSignal, ttl, false)

function objectParam(value: unknown): Record<string, unknown> {
  if (value == null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid options')
  return value as Record<string, unknown>
}

function bounded(value: unknown, fallback: number, max: number) {
  if (value == null) return fallback
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > max)
    throw new RangeError('Invalid pagination value')
  return Number(value)
}

function loadSongs(userId: OwnerId) {
  return cached(`song-list:${userId()}`, (signal) => fetchPublicSongList(userId(), { signal }))
}

async function getSongs(userId: OwnerId, params: unknown) {
  const filter = objectParam(params)
  const songs = await loadSongs(userId)
  const languages = [...new Set(songs.flatMap((song) => song.language ?? []))]
  const tags = [...new Set(songs.flatMap((song) => song.tags))]
  const keyword = typeof filter.keyword === 'string' ? filter.keyword.trim().toLocaleLowerCase() : ''
  const items = songs.filter(
    (song) =>
      (!keyword ||
        [song.name, song.translateName, ...song.author].some((value) =>
          value?.toLocaleLowerCase().includes(keyword),
        )) &&
      (!filter.language || song.language?.includes(String(filter.language))) &&
      (!filter.tag || song.tags.includes(String(filter.tag))) &&
      (!filter.scOnly || Boolean(song.options?.scMinPrice)) &&
      (!filter.guardOnly || Boolean(song.options?.needJianzhang || song.options?.needTidu || song.options?.needZongdu)),
  )
  const offset = bounded(filter.offset, 0, 100_000)
  const limit = bounded(filter.limit, 50, 100)
  return { total: items.length, items: items.slice(offset, offset + limit), languages, tags }
}

async function getSongRequestState(userId: OwnerId) {
  const state = await cached(
    `song-request:${userId()}`,
    (signal) => fetchPublicSongRequestState(userId(), { signal }),
    5_000,
  )
  return {
    songs: state.songs.map((item) => ({
      id: item.id,
      songName: item.songName,
      song: item.song,
      status: item.status,
      from: item.from,
      createAt: item.createAt,
      finishAt: item.finishAt,
      requestBy: item.requestBy,
    })),
    setting: state.setting
      ? {
          orderPrefix: state.setting.orderPrefix,
          allowFromWeb: state.setting.allowFromWeb,
          allowAnonymousFromWeb: state.setting.allowAnonymousFromWeb,
          enableOnStreaming: state.setting.enableOnStreaming,
          queueMaxSize: state.setting.queueMaxSize,
        }
      : null,
  }
}

async function getSchedule(userId: OwnerId, params: unknown) {
  const options = objectParam(params)
  const [weeks, reserve] = await Promise.all([
    cached(
      `schedule:${userId()}`,
      (signal) =>
        getApiScheduleGet({ id: String(userId()) }, { signal }).then((value) => unwrapOk(value, '无法获取日程') ?? []),
      60_000,
    ),
    cached(`reserve:${userId()}`, (signal) =>
      getApiScheduleBiliReserve({ id: String(userId()) }, { signal }).then((value) =>
        unwrapOk(value, '无法获取直播预约'),
      ),
    ),
  ])
  const year = options.year == null ? undefined : bounded(options.year, 0, 9999)
  const week = options.week == null ? undefined : bounded(options.week, 0, 54)
  return {
    weeks: weeks.filter((item) => (year == null || item.year === year) && (week == null || item.week === week)),
    reserves: reserve?.items ?? [],
    liveRoomUrl: '',
  }
}

async function getCheckInRanking(userId: OwnerId, params: unknown) {
  const options = objectParam(params)
  const count = bounded(options.count, 20, 100)
  if (count < 1) throw new RangeError('Count must be at least 1')
  const [keyword, totalRanking, monthlyRanking] = await Promise.all([
    cached(`checkin-keyword:${userId()}`, (signal) =>
      getApiCheckinKeyword({ vId: userId() }, { signal }).then((value) => unwrapOk(value, '无法获取签到口令')),
    ),
    cached(`check-in-ranking:${userId()}:${count}`, (signal) =>
      getApiCheckinRanking({ vId: userId(), count }, { signal }).then(
        (value) => unwrapOk(value, '无法获取签到排行') ?? [],
      ),
    ),
    options.monthly
      ? cached(`checkin-monthly:${userId()}:${count}`, (signal) =>
          getApiCheckinRanking(
            {
              vId: userId(),
              count,
              startTime: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
            },
            { signal },
          ).then((value) => unwrapOk(value, '无法获取月度签到排行') ?? []),
        )
      : Promise.resolve([]),
  ])
  return { keyword: keyword?.keyword ?? '', totalRanking, monthlyRanking }
}

async function getQuestions(userId: OwnerId, params: unknown, showPublic: boolean) {
  const options = objectParam(params)
  const [rawTags, questions] = await Promise.all([
    cached(`qa-tags:${userId()}`, (signal) =>
      getApiQaGetTags({ id: String(userId()) }, { signal }).then((value) => unwrapOk(value, '无法获取提问话题') ?? []),
    ),
    showPublic
      ? cached(`qa-public:${userId()}`, (signal) =>
          getApiQaGetPublic({ id: String(userId()) }, { signal }).then(
            (value) => unwrapOk(value, '无法获取公开提问') ?? [],
          ),
        )
      : Promise.resolve([]),
  ])
  const tags = rawTags.map((item) => (typeof item === 'string' ? item : (item as { name: string }).name))
  return {
    tags,
    questions: questions
      .filter((item) => !options.tag || item.tag === options.tag)
      .map((item) => ({
        id: item.id,
        tag: item.tag,
        question: { message: item.question.message, createdAt: item.question.createdAt },
        answer: item.answer ? { message: item.answer.message, createdAt: item.answer.createdAt } : null,
        sendAt: item.sendAt,
        isAnonymous: item.isAnonymous,
        senderName: item.isAnonymous ? (item.anonymousName ?? '匿名') : item.sender.name,
        questionImages: item.questionImages?.map((file) => ({ path: file.path })) ?? [],
        answerImages: item.answerImages?.map((file) => ({ path: file.path })) ?? [],
      })),
  }
}

async function getPointGoods(userId: OwnerId) {
  const goods = await cached(
    `featured-goods:${userId()}`,
    (signal) => fetchPublicPointGoods(userId(), { signal }),
    60_000,
  )
  return goods.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    count: item.count,
    tags: item.tags,
    status: item.status,
    type: item.type,
    coverUrl: item.cover?.path ? resolveFileUrl(item.cover.path) : null,
    canPurchase: item.canPurchase,
    cannotPurchaseReason: item.cannotPurchaseReason ?? null,
  }))
}

async function getVideoCollects(userId: OwnerId) {
  const activities = await cached(
    `video-collect:${userId()}`,
    (signal) => fetchPublicActiveVideoCollect(userId(), { signal }),
    60_000,
  )
  return activities.map((item) => ({
    id: item.id,
    shortId: item.shortId,
    name: item.name,
    description: item.description,
    createAt: item.createAt,
    startAt: item.startAt,
    endAt: item.endAt,
    videoCount: item.videoCount,
    maxVideoCount: item.maxVideoCount,
    minVideoDuration: item.minVideoDuration,
    maxVideoDuration: item.maxVideoDuration,
    allowedPartitions: item.allowedPartitions,
    allowUnregisteredUser: item.allowUnregisteredUser,
    maxVideoPerUser: item.maxVideoPerUser,
    requireDescription: item.requireDescription,
    isFinish: item.isFinish,
  }))
}

export function createCustomHtmlDataHandlers(userId: OwnerId) {
  return {
    findSong: async (keyOrName: string) =>
      (await loadSongs(userId)).find((item) => item.key === keyOrName || item.name === keyOrName),
    getSongs: (params: unknown) => getSongs(userId, params),
    getSongRequestState: () => getSongRequestState(userId),
    getSchedule: (params: unknown) => getSchedule(userId, params),
    getCheckInRanking: (params: unknown) => getCheckInRanking(userId, params),
    getQuestions: (params: unknown, showPublic: boolean) => getQuestions(userId, params, showPublic),
    getPointGoods: () => getPointGoods(userId),
    getVideoCollects: () => getVideoCollects(userId),
  }
}
