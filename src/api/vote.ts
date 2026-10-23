import {
  getApiVoteGetActive,
  getApiVoteGetConfig,
  getApiVoteHistory,
  postApiVoteCreate,
  postApiVoteEnd,
  postApiVoteExtend,
} from '@/api/generated/bullet-vote/bullet-vote'
import type { RequestCreateBulletVote } from '@/api/generated/model'
import { unwrapOk } from '@/api/query'

export async function getVoteConfig() {
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
