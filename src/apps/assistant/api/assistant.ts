import { cookie } from '@/api/auth'
import {
  getApiAssistantConversations,
  getApiAssistantConversationsIdMessages,
  getApiAssistantDigest,
  postApiAssistantActionsIdApprove,
  postApiAssistantActionsIdCancelSchedule,
  postApiAssistantActionsIdReject,
  postApiAssistantActionsIdSchedule,
  postApiAssistantActionsIdUpdate,
  postApiAssistantConversationsIdDelete,
  postApiAssistantConversationsIdRename,
} from '@/api/generated/assistant/assistant'
import type {
  AssistantHistoryMessageDto,
  AssistantPreviewItem as ApiAssistantPreviewItem,
  AssistantProposalDto,
  EditableField as ApiEditableField,
} from '@/api/generated/model'
import { getApiBaseUrl } from '@/shared/config'

import { ACTION_STATUSES, type ActionRisk, type ActionStatus } from '../schemas/assistant'

const EDITABLE_FIELD_TYPES = new Set<EditableField['type']>([
  'text',
  'textarea',
  'time',
  'number',
  'tags',
  'select',
])

function normalizeRole(role: string): 'user' | 'assistant' {
  return role === 'user' ? 'user' : 'assistant'
}

function normalizeRisk(risk: string): ActionRisk {
  return risk === 'high' || risk === 'medium' ? risk : 'low'
}

function normalizeStatus(status: string): ActionStatus {
  return (ACTION_STATUSES as readonly string[]).includes(status) ? (status as ActionStatus) : 'draft'
}

function normalizeEditableField(field: ApiEditableField): EditableField {
  return {
    key: field.key,
    label: field.label,
    value: field.value,
    before: field.before ?? undefined,
    type: EDITABLE_FIELD_TYPES.has(field.type as EditableField['type'])
      ? (field.type as EditableField['type'])
      : 'text',
    options: field.options ?? undefined,
  }
}

function normalizePreviewItem(item: ApiAssistantPreviewItem): AssistantPreviewItem {
  const op: AssistantPreviewItem['op'] = item.op === 'modify' || item.op === 'delete' ? item.op : 'add'
  return {
    op,
    id: item.id ?? undefined,
    title: item.title,
    time: item.time ?? undefined,
    before: item.before ?? undefined,
    after: item.after ?? undefined,
    note: item.note ?? undefined,
    url: item.url ?? undefined,
    fields: item.fields?.map(normalizeEditableField),
  }
}

function toAssistantProposal(dto: AssistantProposalDto): AssistantProposal {
  return {
    ...dto,
    risk: normalizeRisk(dto.risk),
    status: normalizeStatus(dto.status),
    preview: dto.preview.map(normalizePreviewItem),
    error: dto.error ?? undefined,
    scheduledTime: dto.scheduledTime ?? undefined,
  }
}

function toAssistantHistoryMessage(dto: AssistantHistoryMessageDto): AssistantHistoryMessage {
  return {
    ...dto,
    role: normalizeRole(dto.role),
    images: dto.images ?? undefined,
    proposals: dto.proposals?.map(toAssistantProposal),
    process: dto.process?.map((step) => ({
      kind: step.kind === 'tool' ? 'tool' : 'reasoning',
      text: step.text ?? undefined,
      tool: step.tool
        ? {
            ...step.tool,
            status:
              step.tool.status === 'completed' || step.tool.status === 'failed'
                ? step.tool.status
                : 'running',
            summary: step.tool.summary ?? undefined,
            error: step.tool.error ?? undefined,
            durationMs: step.tool.durationMs ?? undefined,
          }
        : undefined,
    })),
  }
}

/** 会话列表 (按最后活动时间倒序, 分页) */
export async function listConversations(pn = 0, ps = 20): Promise<AssistantConversation[]> {
  const resp = await getApiAssistantConversations({ pn, ps })
  if (resp.code !== 200) throw new Error(resp.message || '获取会话列表失败')
  return resp.data ?? []
}

/** 某会话的全部历史消息 */
export async function getConversationMessages(id: number): Promise<AssistantHistoryMessage[]> {
  const resp = await getApiAssistantConversationsIdMessages(id)
  if (resp.code !== 200) throw new Error(resp.message || '获取会话消息失败')
  return (resp.data ?? []).map(toAssistantHistoryMessage)
}

/** 主动建议提示: 后台待办概览 */
export async function getDigest(): Promise<AssistantDigestItem[]> {
  const resp = await getApiAssistantDigest()
  if (resp.code !== 200) throw new Error(resp.message || '获取建议失败')
  return resp.data ?? []
}

/** 重命名会话 */
export async function renameConversation(id: number, title: string): Promise<void> {
  const resp = await postApiAssistantConversationsIdRename(id, { title })
  if (resp.code !== 200) throw new Error(resp.message || '重命名失败')
}

/** 删除会话 */
export async function deleteConversation(id: number): Promise<void> {
  const resp = await postApiAssistantConversationsIdDelete(id)
  if (resp.code !== 200) throw new Error(resp.message || '删除失败')
}

/** 审批并执行提案 */
export async function approveAction(proposalId: string): Promise<AssistantProposal> {
  const resp = await postApiAssistantActionsIdApprove(Number(proposalId))
  if (resp.code !== 200) throw new Error(resp.message || '执行失败')
  return toAssistantProposal(resp.data)
}

/** 拒绝提案 */
export async function rejectAction(proposalId: string): Promise<AssistantProposal> {
  const resp = await postApiAssistantActionsIdReject(Number(proposalId))
  if (resp.code !== 200) throw new Error(resp.message || '拒绝失败')
  return toAssistantProposal(resp.data)
}

/** 设定提案定时执行 (scheduledTime: Unix 毫秒, UTC) */
export async function scheduleAction(proposalId: string, scheduledTime: number): Promise<AssistantProposal> {
  const resp = await postApiAssistantActionsIdSchedule(Number(proposalId), {
    scheduledTime,
  })
  if (resp.code !== 200) throw new Error(resp.message || '定时设定失败')
  return toAssistantProposal(resp.data)
}

/** 取消提案定时执行 */
export async function cancelScheduleAction(proposalId: string): Promise<AssistantProposal> {
  const resp = await postApiAssistantActionsIdCancelSchedule(Number(proposalId))
  if (resp.code !== 200) throw new Error(resp.message || '取消定时失败')
  return toAssistantProposal(resp.data)
}

/** 编辑提案展示字段, 重新校验后回到待确认 */
export async function updateAction(proposalId: string, items: ProposalEditItem[]): Promise<AssistantProposal> {
  const resp = await postApiAssistantActionsIdUpdate(Number(proposalId), { items: items as any })
  if (resp.code !== 200) throw new Error(resp.message || '保存失败')
  return toAssistantProposal(resp.data)
}
export interface AssistantContext {
  routeName: string
  title: string
  path: string
}

/** 预览项里一个可编辑字段, 与后端 EditableField 对应 */
export interface EditableField {
  key: string
  label: string
  value: string
  /** 原值 (修改前), 用于只读对比; 新增项为空 */
  before?: string
  /** text(默认) / textarea / time / number / tags(逗号分隔) / select */
  type: 'text' | 'textarea' | 'time' | 'number' | 'tags' | 'select'
  options?: Array<{ label: string; value: string }>
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
  url?: string
  /** 可编辑字段, 为空表示该项不可编辑 */
  fields?: EditableField[]
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
  /** 定时执行的目标时间 (Unix 毫秒, UTC); 仅 status=scheduled 时有值 */
  scheduledTime?: number
}

/** 工具调用状态, 与后端 AssistantToolEventDto 对应 */
export interface AssistantToolEvent {
  id: string
  name: string
  title: string
  status: 'running' | 'completed' | 'failed'
  summary?: string
  error?: string
  time: number
  durationMs?: number
}

/** 工作过程有序片段, 与后端 AssistantProcessStepDto 对应 */
export interface AssistantProcessStepDto {
  kind: 'reasoning' | 'tool'
  text?: string
  tool?: AssistantToolEvent
}

/** 本轮助手回复 token 用量 */
export interface AssistantTokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cachedInputTokens: number
  reasoningTokens: number
}

/** 流式事件 (与后端 AssistantStreamEvent 对应) */
export interface AssistantStreamEvent {
  type: 'reasoning' | 'text' | 'tool' | 'proposal' | 'done' | 'error'
  delta?: string
  tool?: AssistantToolEvent
  proposal?: AssistantProposal
  conversationId?: number
  messageId?: number
  userMessageId?: number
  title?: string
  usage?: AssistantTokenUsage
  message?: string
}

export interface StreamHandlers {
  onReasoning?: (delta: string) => void
  onText?: (delta: string) => void
  onTool?: (tool: AssistantToolEvent) => void
  onProposal?: (p: AssistantProposal) => void
  onDone?: (e: {
    conversationId: number
    messageId: number
    userMessageId?: number
    title?: string
    usage?: AssistantTokenUsage
  }) => void
}

/** 会话列表项 */
export interface AssistantConversation {
  id: number
  title: string
  createTime: number
  updateTime: number
}

/** 会话内单条历史消息 */
export interface AssistantHistoryMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  createTime: number
  images?: string[]
  hasImage?: boolean
  usage?: AssistantTokenUsage
  /** 本条回复关联的待审批提案 (可能多个) */
  proposals?: AssistantProposal[]
  /** 答复前的工作过程 (思考 + 工具调用), 按时序排列; 仅 assistant 消息有 */
  process?: AssistantProcessStepDto[]
}

/** 编辑提案的单项: index 对齐预览下标, values 为 字段key -> 新值, 与后端 ProposalEditItem 对应 */
export interface ProposalEditItem {
  index: number
  values: Record<string, string>
}

/** 主动建议提示项, 与后端 AssistantDigestItem 对应 */
export interface AssistantDigestItem {
  kind: string
  text: string
  prompt: string
}

/**
 * 发送消息, 以 SSE 流式接收回复。增量通过 handlers 回调推送, 结束时 onDone 带会话/消息 Id。
 * conversationId 为空则新建会话; images 为 base64 data URL 数组。
 */
export async function streamMessage(
  message: string,
  context: AssistantContext,
  conversationId: number | null,
  images: string[] | undefined,
  editMessageId: number | undefined,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${getApiBaseUrl()}assistant/message`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie.value?.cookie) headers.Authorization = `Bearer ${cookie.value.cookie}`

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      context,
      conversationId: conversationId ?? undefined,
      images: images && images.length ? images : undefined,
      editMessageId,
    }),
    signal,
  })
  if (!resp.ok || !resp.body) throw new Error(`AI 服务调用失败 (${resp.status})`)

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let errorMsg: string | null = null

  // SSE 帧以空行分隔, 每帧形如 "data: {json}"
  const handleFrame = (frame: string) => {
    const line = frame.split('\n').find((l) => l.startsWith('data:'))
    if (!line) return
    const ev = JSON.parse(line.slice(5).trim()) as AssistantStreamEvent
    switch (ev.type) {
      case 'reasoning':
        if (ev.delta) handlers.onReasoning?.(ev.delta)
        break
      case 'text':
        if (ev.delta) handlers.onText?.(ev.delta)
        break
      case 'tool':
        if (ev.tool) handlers.onTool?.(ev.tool)
        break
      case 'proposal':
        if (ev.proposal) handlers.onProposal?.(ev.proposal)
        break
      case 'done':
        handlers.onDone?.({
          conversationId: ev.conversationId ?? 0,
          messageId: ev.messageId ?? 0,
          userMessageId: ev.userMessageId,
          title: ev.title,
          usage: ev.usage,
        })
        break
      case 'error':
        errorMsg = ev.message ?? 'AI 服务异常'
        break
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      handleFrame(buf.slice(0, idx))
      buf = buf.slice(idx + 2)
    }
  }
  if (buf.trim()) handleFrame(buf)
  if (errorMsg) throw new Error(errorMsg)
}

/** 助手页面上下文, 由 Modal 打开时注入 */
