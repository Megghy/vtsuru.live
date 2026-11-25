import { getApiBaseUrl } from '@/shared/config'

import { QueryGetAPI, QueryPostAPI, unwrapOk } from './query'

function api(path: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, '')
  return `${base}/${path.replace(/^\/+/, '')}`
}

export interface BiliEmoticonPackage {
  pkgId: number
  pkgType: number
  pkgName: string
  emoticons: Record<string, string>
}

export interface BiliRoomEmoticonsResult {
  roomId: number
  room: Record<string, string>
  packages: BiliEmoticonPackage[]
}

export interface BiliGiftConfigItem {
  id: number
  name: string
  price: number
  coinType: string
  imgBasic: string
  gif: string
  webp: string
  desc: string
  isBlindBox: boolean
}

export interface BiliSpaceVideoItem {
  bvid: string
  aid: number
  title: string
  pic: string
  duration: string
  durationSeconds: number
  play: number
  pubdate: number
  description: string
}

export interface BiliSpaceDynamicItem {
  id: string
  type: string
  pubTs: number
  text: string
  images: string[]
  jumpUrl: string
  videoBvid?: string
  videoTitle?: string
  videoCover?: string
}

export interface BiliCollectionVideoItem {
  bvid: string
  aid: number
  title: string
  cover: string
  ownerName: string
  ownerMid: number
  duration: number
  play: number
  like: number
  coin: number
  favorite: number
  pubdate: number
  pages: Array<{ page: number; cid: number; part: string; duration: number }>
  tags: string[]
}

export interface LiveReplayMatchCandidate {
  bvid: string
  aid: number
  title: string
  cover: string
  durationSeconds: number
  pubdate: number
  score: number
}

export interface LiveReplayInfo {
  liveId: string
  replayBvid?: string | null
  replayAid?: number | null
  replayTitle?: string | null
  replayOffsetSeconds: number
}

export interface LiveTimelineChapter {
  offsetSeconds: number
  timeText: string
  label: string
  source: 'marker' | 'song' | 'danmaku_peak' | 'transcript'
}

export async function fetchRoomEmoticons(roomId: number): Promise<BiliRoomEmoticonsResult> {
  const resp = await QueryGetAPI<BiliRoomEmoticonsResult>(api('bili/room-emoticons'), { roomId })
  return unwrapOk(resp, '获取房间专属表情失败')
}

export async function fetchGiftConfig(roomId = 0): Promise<BiliGiftConfigItem[]> {
  const resp = await QueryGetAPI<BiliGiftConfigItem[]>(api('bili/gift-config'), roomId > 0 ? { roomId } : undefined)
  return unwrapOk(resp, '获取礼物配置失败')
}

export async function fetchBiliSpaceVideos(
  uid: number,
  options?: { page?: number; pageSize?: number; keyword?: string; seasonId?: number },
): Promise<BiliSpaceVideoItem[]> {
  const resp = await QueryGetAPI<BiliSpaceVideoItem[]>(api('bili/space-videos'), {
    uid,
    page: options?.page ?? 1,
    pageSize: options?.pageSize ?? 12,
    keyword: options?.keyword || undefined,
    seasonId: options?.seasonId && options.seasonId > 0 ? options.seasonId : undefined,
  })
  return unwrapOk(resp, '获取 B 站投稿列表失败')
}

export async function fetchBiliSpaceDynamics(uid: number, limit = 10): Promise<BiliSpaceDynamicItem[]> {
  const resp = await QueryGetAPI<BiliSpaceDynamicItem[]>(api('bili/space-dynamics'), { uid, limit })
  return unwrapOk(resp, '获取 B 站动态列表失败')
}

export async function parseBiliCollection(input: string): Promise<{
  sourceType: 'fav' | 'season' | 'video'
  title: string
  items: BiliCollectionVideoItem[]
}> {
  const resp = await QueryPostAPI<{
    sourceType: 'fav' | 'season' | 'video'
    title: string
    items: BiliCollectionVideoItem[]
  }>(api('bili/parse-collection'), { input })
  return unwrapOk(resp, '解析 B 站合集/收藏夹失败')
}

export async function fetchLiveReplayInfo(liveId: string): Promise<LiveReplayInfo> {
  const resp = await QueryGetAPI<LiveReplayInfo>(api('live/replay'), { liveId })
  return unwrapOk(resp, '获取场次录播信息失败')
}

export async function saveLiveReplayInfo(payload: {
  liveId: string
  replayBvid: string
  replayAid?: number
  replayTitle?: string
  replayOffsetSeconds?: number
}): Promise<LiveReplayInfo> {
  const resp = await QueryPostAPI<LiveReplayInfo>(api('live/replay'), payload)
  return unwrapOk(resp, '保存场次录播关联失败')
}

export async function matchLiveReplayCandidates(liveId: string): Promise<LiveReplayMatchCandidate[]> {
  const resp = await QueryGetAPI<LiveReplayMatchCandidate[]>(api('live/replay/match'), { liveId })
  return unwrapOk(resp, '自动匹配录播失败')
}

export async function generateLiveTimelineChapters(liveId: string): Promise<{
  chapters: LiveTimelineChapter[]
  commentText: string
}> {
  const resp = await QueryGetAPI<{ chapters: LiveTimelineChapter[]; commentText: string }>(api('live/replay/chapters'), {
    liveId,
  })
  return unwrapOk(resp, '生成空降目录失败')
}

export async function batchImportVideoCollect(
  tableId: string,
  bvids: string[],
): Promise<{ imported: number; skipped: number; failed: string[] }> {
  const resp = await QueryPostAPI<{ imported: number; skipped: number; failed: string[] }>(
    api('video-collect/batch-import'),
    { tableId, bvids },
  )
  return unwrapOk(resp, '批量导入视频征集失败')
}

export async function syncFanMedalsToProfiles(
  members: Array<{
    uid: number
    uname: string
    medalLevel: number
    intimacy: number
    guardLevel: number
    isLighted: boolean
  }>,
): Promise<{ updated: number; created: number }> {
  const resp = await QueryPostAPI<{ updated: number; created: number }>(api('fan-profile/sync-medals'), { members })
  return unwrapOk(resp, '同步粉丝团至粉丝档案失败')
}

export async function recordTianxuanWinners(payload: {
  lotteryId: number
  awardName: string
  danmu: string
  winners: Array<{ uid: number; uname: string; face?: string }>
}): Promise<{ id: number; recorded: number }> {
  const resp = await QueryPostAPI<{ id: number; recorded: number }>(api('bili/tianxuan/record'), payload)
  return unwrapOk(resp, '同步天选时刻中奖记录失败')
}
