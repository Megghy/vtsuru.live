import { QueryPostAPI } from '@/api/query'
import { BASE_API_URL } from '@/shared/config'
import type { ActionStatus, ActionRisk } from '../schemas/assistant'

const ASSISTANT_API_URL = `${BASE_API_URL}assistant/`

/** 助手页面上下文, 由 Modal 打开时注入 */
export interface AssistantContext {
  routeName: string
  title: string
  path: string
}

/** 单条操作预览项 (新增/修改/删除), 与后端 AssistantPreviewItem 对应 */
export interface AssistantPreviewItem {
  op: 'add' | 'modify' | 'delete'
  id?: string
  title: string
  time?: string
  before?: string
  after?: string
  note?: string
}

/** 服务端待审批提案, id 为服务端 proposalId */
export interface AssistantProposal {
  id: string
  kind: string
  title: string
  summary: string
  risk: ActionRisk
  status: ActionStatus
  preview: AssistantPreviewItem[]
  error?: string
}

export interface AssistantReply {
  text: string
  proposals: AssistantProposal[]
}

/** 编辑提案的单项 (按预览下标改安全字段) */
export interface ScheduleEditItem {
  index: number
  title?: string
  time?: string
  tag?: string
  tagColor?: string
}

/** 发送消息, 返回 AI 回复与待审批提案 */
export async function sendMessage(
  message: string,
  context: AssistantContext,
  signal?: AbortSignal,
): Promise<AssistantReply> {
  const resp = await QueryPostAPI<AssistantReply>(
    `${ASSISTANT_API_URL}message`,
    { message, context },
    undefined,
    undefined,
    { signal },
  )
  if (resp.code !== 200) throw new Error(resp.message || 'AI 服务调用失败')
  return resp.data
}

/** 审批并执行提案 */
export async function approveAction(proposalId: string): Promise<AssistantProposal> {
  const resp = await QueryPostAPI<AssistantProposal>(`${ASSISTANT_API_URL}actions/${proposalId}/approve`)
  if (resp.code !== 200) throw new Error(resp.message || '执行失败')
  return resp.data
}

/** 拒绝提案 */
export async function rejectAction(proposalId: string): Promise<AssistantProposal> {
  const resp = await QueryPostAPI<AssistantProposal>(`${ASSISTANT_API_URL}actions/${proposalId}/reject`)
  if (resp.code !== 200) throw new Error(resp.message || '拒绝失败')
  return resp.data
}

/** 编辑提案展示字段, 重新校验后回到待确认 */
export async function updateAction(proposalId: string, items: ScheduleEditItem[]): Promise<AssistantProposal> {
  const resp = await QueryPostAPI<AssistantProposal>(`${ASSISTANT_API_URL}actions/${proposalId}/update`, { items })
  if (resp.code !== 200) throw new Error(resp.message || '保存失败')
  return resp.data
}
