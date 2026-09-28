import type { RequestCreateBulletVote, ResponseVoteSession, VoteConfig } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { VOTE_API_URL } from '@/shared/config'

// 弹幕投票接口：失败统一抛出后端消息，由调用方在交互边界提示

export async function getVoteConfig() {
  return unwrapOk(await QueryGetAPI<VoteConfig>(`${VOTE_API_URL}get-config`), '获取投票配置失败')
}

export async function getActiveVote() {
  return unwrapOk(await QueryGetAPI<ResponseVoteSession | null>(`${VOTE_API_URL}get-active`), '获取进行中的投票失败')
}

export async function getVoteHistory(limit: number) {
  return unwrapOk(await QueryGetAPI<ResponseVoteSession[]>(`${VOTE_API_URL}history`, { limit }), '获取投票历史失败')
}

export async function createVote(payload: RequestCreateBulletVote) {
  return unwrapOk(await QueryPostAPI<ResponseVoteSession>(`${VOTE_API_URL}create`, payload), '发起投票失败')
}

export async function extendVote(seconds: number) {
  return unwrapOk(await QueryGetAPI<ResponseVoteSession>(`${VOTE_API_URL}extend`, { seconds }), '延长投票失败')
}

export async function endVote(id: number) {
  return unwrapOk(await QueryGetAPI<ResponseVoteSession>(`${VOTE_API_URL}end`, { id }), '结束投票失败')
}
