import type { EventModel } from '@/api/client-types'
import {
  getApiVoteGetActive,
  getApiVoteGetConfig,
  getApiVoteHistory,
  postApiVoteCreate,
  postApiVoteEnd,
  postApiVoteExtend,
} from '@/api/generated/bullet-vote/bullet-vote'
import type {
  RequestCreateBulletVote,
  ResponseResultOfResponseVoteSession,
  ResponseVoteSession,
  VoteConfig,
  VoteOption,
} from '@/api/generated/model'
import { vtsuruMutator } from '@/api/orval-mutator'
import { unwrapOk } from '@/api/query'

export interface VoteVoterInfo {
  voterId: string
  name: string
  ouId?: string | null
  count: number
  lastVoteTime: number
}

export type VoteOptionWithVoters = VoteOption & {
  voterDetails?: VoteVoterInfo[]
}

export function getOptionVoters(option: VoteOption): VoteVoterInfo[] {
  const details = (option as VoteOptionWithVoters).voterDetails
  if (details && details.length > 0) {
    return details
  }
  return (option.voters ?? []).map((voterId) => ({
    voterId,
    name: voterId,
    count: 1,
    lastVoteTime: 0,
  }))
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

export async function getVoteConfig(): Promise<VoteConfig> {
  return unwrapOk(await getApiVoteGetConfig(), '获取投票配置失败')
}

export async function getActiveVote() {
  return unwrapOk(await getApiVoteGetActive(), '获取进行中的投票失败')
}

export async function getVoteHistory(limit: number) {
  return unwrapOk(await getApiVoteHistory({ limit }), '获取投票历史失败')
}

export async function createVote(payload: RequestCreateBulletVote) {
  return unwrapOk(await postApiVoteCreate(payload), '发起投票失败')
}

export async function extendVote(seconds: number) {
  return unwrapOk(await postApiVoteExtend({ seconds }), '延长投票失败')
}

export async function endVote(id: number) {
  return unwrapOk(await postApiVoteEnd({ id }), '结束投票失败')
}

export async function tryVoteEvent(
  event: EventModel,
): Promise<{ status: string; session: ResponseVoteSession | null }> {
  const payload = {
    type: event.type,
    uname: event.uname,
    uid: event.uid > 0 ? event.uid : undefined,
    open_id: normalizeGuid(event.open_id) ?? normalizeGuid(event.ouid),
    msg: event.msg,
    time: event.time,
    price: event.price,
    eventId: event.eventId,
  }
  const res = await vtsuruMutator<ResponseResultOfResponseVoteSession>('/api/vote/try-vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return {
    status: res.code === 200 ? res.message : 'error',
    session: res.code === 200 ? (res.data ?? null) : null,
  }
}
