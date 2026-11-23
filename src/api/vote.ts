import type { EventModel } from '@/api/client-types'
import {
  getApiVoteGetActive,
  getApiVoteGetConfig,
  getApiVoteHistory,
  postApiVoteCreate,
  postApiVoteDelete,
  postApiVoteEnd,
  postApiVoteExtend,
  postApiVoteSaveConfig,
} from '@/api/generated/bullet-vote/bullet-vote'
import type {
  ResponseResult,
  ResponseResultOfResponseVoteSession,
  ResponseVoteSession,
  VoteConfig,
  VoteOption,
  VoteOptionDto,
  VoteOBSData,
} from '@/api/generated/model'
import { vtsuruMutator } from '@/api/orval-mutator'
import { unwrapOk } from '@/api/query'

export const VoteMultiMode = {
  Single: 0,
  SingleReplace: 1,
  MultiOncePerOption: 2,
  MultiUnlimited: 3,
} as const

export type VoteMultiMode = (typeof VoteMultiMode)[keyof typeof VoteMultiMode]

export const VOTE_MULTI_MODE_OPTIONS: ReadonlyArray<{
  value: VoteMultiMode
  label: string
  shortLabel: string
  description: string
}> = [
  { value: VoteMultiMode.Single, label: '单人单票（不可改票）', shortLabel: '单选锁定', description: '每人整场仅限投 1 次，提交后不可更改' },
  { value: VoteMultiMode.SingleReplace, label: '单人单票（允许改票）', shortLabel: '单选改票', description: '每人限投 1 个选项，再次投票自动撤回旧票' },
  { value: VoteMultiMode.MultiOncePerOption, label: '多选（每项限 1 票）', shortLabel: '多选防刷', description: '可投多个不同选项，但同一选项每人仅计 1 次' },
  { value: VoteMultiMode.MultiUnlimited, label: '不限次数重复投票', shortLabel: '不限次数', description: '允许观众反复发送弹幕累加票数' },
]

export const VoteResultMode = {
  ByCount: 0,
  ByContribution: 1,
} as const

export type VoteResultMode = (typeof VoteResultMode)[keyof typeof VoteResultMode]

export interface VoteTemplateItem {
  id: string
  name: string
  title: string
  options: string[]
  durationSeconds: number
  multiVoteMode: VoteMultiMode
}

export interface VoteConfigModel extends Omit<VoteConfig, 'voteResultMode'> {
  allowDirectVote: boolean
  multiVoteMode: VoteMultiMode
  maxCustomOptions: number
  giftVoteStep: number
  voteResultMode: VoteResultMode
  requireFansMedal: boolean
  requireWearingFansMedal: boolean
  minFansMedalLevel: number
  requireGuard: boolean
  guardWeightJianzhang: number
  guardWeightTidu: number
  guardWeightZongdu: number
  fontFamily: string
  fontScale: number
  borderRadius: number
  cardOpacity: number
  backdropBlur: number
  accentColor: string
  leadingColor: string
  duelLeftColor: string
  duelRightColor: string
  showRecentVoter: boolean
  resultHoldSeconds: number
  templates: VoteTemplateItem[]
}

export interface VoteVoterInfo {
  voterId: string
  name: string
  ouId?: string | null
  count: number
  contribution?: number
  guardLevel?: number
  lastVoteTime: number
}

export type VoteOptionWithVoters = Omit<VoteOption, 'voterDetails'> & {
  voterDetails?: VoteVoterInfo[]
}

export type VoteOptionDtoModel = VoteOptionDto

export interface VoteSessionModel extends Omit<ResponseVoteSession, 'options' | 'multiVoteMode'> {
  options: VoteOptionWithVoters[]
  multiVoteMode: VoteMultiMode
}

export interface VoteOBSDataModel extends Omit<VoteOBSData, 'options' | 'resultMode'> {
  options: VoteOptionDtoModel[]
  resultMode: VoteResultMode
}

export interface CreateVotePayload {
  title: string
  options: string[]
  allowMultipleVotes?: boolean
  multiVoteMode?: VoteMultiMode
  durationSeconds?: number | null
}

export function createDefaultVoteConfig(): VoteConfigModel {
  return {
    isEnabled: true,
    showResults: true,
    voteDurationSeconds: 60,
    voteCommand: '投票',
    voteEndCommand: '结束投票',
    allowDirectVote: true,
    voteTitle: '观众投票',
    allowMultipleVotes: false,
    multiVoteMode: VoteMultiMode.Single,
    allowCustomOptions: false,
    maxCustomOptions: 12,
    defaultOptions: ['选项1', '选项2'],
    theme: 'glass',
    roundedCorners: true,
    displayPosition: 'center',
    allowGiftVoting: false,
    minGiftPrice: 1,
    giftVoteStep: 1,
    voteResultMode: VoteResultMode.ByCount,
    requireFansMedal: false,
    requireWearingFansMedal: false,
    minFansMedalLevel: 0,
    requireGuard: false,
    guardWeightJianzhang: 1,
    guardWeightTidu: 1,
    guardWeightZongdu: 1,
    fontFamily: '',
    fontScale: 1,
    borderRadius: 20,
    cardOpacity: 0.88,
    backdropBlur: 24,
    accentColor: '',
    leadingColor: '',
    duelLeftColor: '',
    duelRightColor: '',
    showRecentVoter: true,
    resultHoldSeconds: 30,
    templates: [],
  }
}

export function normalizeVoteConfig(raw?: Partial<VoteConfigModel> | null): VoteConfigModel {
  const base = createDefaultVoteConfig()
  const merged = { ...base, ...raw }
  merged.allowDirectVote = raw?.allowDirectVote ?? true
  if (raw?.multiVoteMode === undefined && raw?.allowMultipleVotes) {
    merged.multiVoteMode = VoteMultiMode.MultiUnlimited
  }
  merged.allowMultipleVotes =
    merged.multiVoteMode === VoteMultiMode.MultiOncePerOption || merged.multiVoteMode === VoteMultiMode.MultiUnlimited
  merged.defaultOptions =
    Array.isArray(merged.defaultOptions) && merged.defaultOptions.length >= 2
      ? [...merged.defaultOptions]
      : ['选项1', '选项2']
  merged.templates = Array.isArray(merged.templates)
    ? merged.templates.map((tpl) => ({
        ...tpl,
        options: Array.isArray(tpl.options) ? [...tpl.options] : [],
      }))
    : []
  return merged
}

export function getOptionVoters(option: VoteOptionWithVoters): VoteVoterInfo[] {
  const details = option.voterDetails
  if (details && details.length > 0) {
    return details
  }
  return (option.voters ?? []).map((voterId) => ({
    voterId,
    name: voterId,
    count: 1,
    contribution: 0,
    guardLevel: 0,
    lastVoteTime: 0,
  }))
}

export function getMultiVoteModeLabel(mode?: VoteMultiMode, fallbackMultiple?: boolean): string {
  const effective = mode ?? (fallbackMultiple ? VoteMultiMode.MultiUnlimited : VoteMultiMode.Single)
  return VOTE_MULTI_MODE_OPTIONS.find((item) => item.value === effective)?.shortLabel ?? '单选锁定'
}

const HEX32_REGEX = /^[0-9a-f]{32}$/i
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function normalizeGuid(raw?: string): string | undefined {
  const clean = raw?.trim()
  if (!clean) return undefined
  if (HEX32_REGEX.test(clean)) {
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`
  }
  return UUID_REGEX.test(clean) ? clean : undefined
}

export async function getVoteConfig(): Promise<VoteConfigModel> {
  const raw = await unwrapOk(await getApiVoteGetConfig(), '获取投票配置失败')
  return normalizeVoteConfig(raw as Partial<VoteConfigModel>)
}

export async function saveVoteConfig(config: VoteConfigModel): Promise<void> {
  const res = await postApiVoteSaveConfig(config as unknown as VoteConfig)
  if (res.code !== 200) {
    throw new Error(res.message || '保存投票配置失败')
  }
}

export async function getActiveVote(): Promise<VoteSessionModel | null> {
  const res = await getApiVoteGetActive()
  if (res.code !== 200) {
    throw new Error(res.message || '获取进行中的投票失败')
  }
  return (res.data as VoteSessionModel | null | undefined) ?? null
}

export async function getVoteHistory(limit = 20, offset = 0, keyword?: string): Promise<VoteSessionModel[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  if (keyword?.trim()) {
    params.set('keyword', keyword.trim())
  }
  const res =
    offset === 0 && !keyword?.trim()
      ? await getApiVoteHistory({ limit })
      : await vtsuruMutator<{ code: number; message: string; data?: VoteSessionModel[] }>(`/api/vote/history?${params.toString()}`, {
          method: 'GET',
        })
  if (res.code !== 200) {
    throw new Error(res.message || '获取投票历史失败')
  }
  return (res.data as VoteSessionModel[] | undefined) ?? []
}

export async function createVote(payload: CreateVotePayload): Promise<VoteSessionModel> {
  const mode = payload.multiVoteMode ?? (payload.allowMultipleVotes ? VoteMultiMode.MultiUnlimited : VoteMultiMode.Single)
  const body = {
    title: payload.title,
    options: payload.options,
    allowMultipleVotes: mode === VoteMultiMode.MultiOncePerOption || mode === VoteMultiMode.MultiUnlimited,
    multiVoteMode: mode,
    durationSeconds: payload.durationSeconds && payload.durationSeconds > 0 ? payload.durationSeconds : null,
  }
  const res = await postApiVoteCreate(body as any)
  return unwrapOk(res, '发起投票失败') as VoteSessionModel
}

export async function extendVote(seconds: number): Promise<VoteSessionModel> {
  return (await unwrapOk(await postApiVoteExtend({ seconds }), '延长投票失败')) as VoteSessionModel
}

export async function pauseVote(): Promise<VoteSessionModel> {
  const res = await vtsuruMutator<ResponseResultOfResponseVoteSession>('/api/vote/pause', { method: 'POST' })
  return unwrapOk(res, '暂停投票失败') as VoteSessionModel
}

export async function resumeVote(): Promise<VoteSessionModel> {
  const res = await vtsuruMutator<ResponseResultOfResponseVoteSession>('/api/vote/resume', { method: 'POST' })
  return unwrapOk(res, '恢复投票失败') as VoteSessionModel
}

export async function removeVoteOption(optionText: string): Promise<VoteSessionModel> {
  const res = await vtsuruMutator<ResponseResultOfResponseVoteSession>('/api/vote/remove-option', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ optionText }),
  })
  return unwrapOk(res, '删除选项失败') as VoteSessionModel
}

export async function mergeVoteOption(sourceOptionText: string, targetOptionText: string): Promise<VoteSessionModel> {
  const res = await vtsuruMutator<ResponseResultOfResponseVoteSession>('/api/vote/merge-option', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceOptionText, targetOptionText }),
  })
  return unwrapOk(res, '合并选项失败') as VoteSessionModel
}

export async function tiebreakDraw(sessionId?: number): Promise<{ session: VoteSessionModel; winner: string }> {
  const res = await vtsuruMutator<ResponseResultOfResponseVoteSession>('/api/vote/tiebreak-draw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '平票抽签失败')
  }
  return {
    session: res.data as VoteSessionModel,
    winner: res.message || (res.data as VoteSessionModel).winnerOverride || '',
  }
}

export async function tiebreakOvertime(seconds = 60): Promise<VoteSessionModel> {
  const res = await vtsuruMutator<ResponseResultOfResponseVoteSession>('/api/vote/tiebreak-overtime', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seconds }),
  })
  return unwrapOk(res, '开启平票加时失败') as VoteSessionModel
}

export async function endVote(id: number): Promise<VoteSessionModel> {
  return (await unwrapOk(await postApiVoteEnd({ id }), '结束投票失败')) as VoteSessionModel
}

export async function deleteVote(id: number): Promise<void> {
  const res = (await postApiVoteDelete({ id })) as ResponseResult
  if (res.code !== 200) {
    throw new Error(res.message || '删除投票失败')
  }
}

export async function tryVoteEvent(
  event: EventModel,
): Promise<{ status: string; session: VoteSessionModel | null }> {
  const payload = {
    type: event.type,
    uname: event.uname,
    uid: event.uid > 0 ? event.uid : undefined,
    open_id: normalizeGuid(event.open_id) ?? normalizeGuid(event.ouid),
    msg: event.msg,
    time: event.time,
    num: Math.max(1, event.num || 1),
    price: event.price,
    guard_level: event.guard_level ?? 0,
    fans_medal_level: event.fans_medal_level ?? 0,
    fans_medal_name: event.fans_medal_name ?? '',
    fans_medal_wearing_status: !!event.fans_medal_wearing_status,
    eventId: event.eventId,
  }
  const res = await vtsuruMutator<ResponseResultOfResponseVoteSession>('/api/vote/try-vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return {
    status: res.code === 200 ? res.message : 'error',
    session: res.code === 200 ? ((res.data as VoteSessionModel | null | undefined) ?? null) : null,
  }
}
