import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { QueryRequestError } from '@/api/query'
import type {
  AssistantContext,
  AssistantPreviewItem,
  AssistantProposal,
  ScheduleEditItem,
} from '../api/assistant'
import { approveAction, rejectAction, sendMessage, updateAction } from '../api/assistant'
import type { MessageRole, MessageStatus } from '../schemas/assistant'

let seq = 0
const nextId = () => `m_${Date.now()}_${++seq}`

/** 单条操作卡片 (审批卡片), proposal 即服务端提案 */
export interface AssistantAction {
  id: string
  proposal: AssistantProposal
}

/** 单条聊天消息 */
export interface AssistantMessage {
  id: string
  role: MessageRole
  text: string
  status: MessageStatus
  actions: AssistantAction[]
  error?: string
  /** 触发该回复的用户输入, 用于重试 */
  sourcePrompt?: string
}

export const useAssistantStore = defineStore('assistant', () => {
  const visible = ref(false)
  const context = ref<AssistantContext>({ routeName: '', title: '', path: '' })
  const messages = ref<AssistantMessage[]>([])
  const sending = ref(false)
  let abort: AbortController | null = null

  const lastError = computed(() => {
    const last = messages.value[messages.value.length - 1]
    return last?.status === 'error' ? last : null
  })

  function open(ctx: AssistantContext) {
    context.value = ctx
    visible.value = true
  }

  function close() {
    visible.value = false
  }

  function abortPending() {
    abort?.abort()
    abort = null
    sending.value = false
  }

  async function runReply(assistantMsg: AssistantMessage, prompt: string) {
    assistantMsg.status = 'sending'
    assistantMsg.text = ''
    assistantMsg.actions = []
    assistantMsg.error = undefined
    sending.value = true
    abort = new AbortController()

    try {
      const reply = await sendMessage(prompt, context.value, abort.signal)
      assistantMsg.text = reply.text
      assistantMsg.actions = reply.proposals.map(p => ({ id: nextId(), proposal: p }))
      assistantMsg.status = 'done'
    } catch (e) {
      if ((e instanceof QueryRequestError && e.kind === 'aborted') || (e instanceof DOMException && e.name === 'AbortError')) {
        assistantMsg.status = 'done'
        assistantMsg.text = assistantMsg.text || '已取消'
      } else {
        assistantMsg.status = 'error'
        assistantMsg.error = e instanceof Error ? e.message : String(e)
      }
    } finally {
      sending.value = false
      abort = null
    }
  }

  async function send(prompt: string) {
    const trimmed = prompt.trim()
    if (!trimmed || sending.value) return

    messages.value.push({
      id: nextId(), role: 'user', text: trimmed, status: 'done', actions: [],
    })
    const assistantMsg: AssistantMessage = {
      id: nextId(), role: 'assistant', text: '', status: 'sending', actions: [], sourcePrompt: trimmed,
    }
    messages.value.push(assistantMsg)
    await runReply(assistantMsg, trimmed)
  }

  /** 重试某条失败的 AI 消息 */
  async function retry(messageId: string) {
    const msg = messages.value.find(m => m.id === messageId)
    if (!msg || msg.role !== 'assistant' || !msg.sourcePrompt) return
    await runReply(msg, msg.sourcePrompt)
  }

  function findAction(messageId: string, actionId: string): AssistantAction | undefined {
    return messages.value.find(m => m.id === messageId)?.actions.find(a => a.id === actionId)
  }

  /** 确认执行操作: 仅凭 proposalId 调后端 */
  async function confirmAction(messageId: string, actionId: string) {
    const action = findAction(messageId, actionId)
    if (!action) return
    action.proposal.status = 'running'
    action.proposal.error = undefined
    try {
      action.proposal = await approveAction(action.proposal.id)
    } catch (e) {
      action.proposal.status = 'failed'
      action.proposal.error = e instanceof Error ? e.message : String(e)
    }
  }

  /** 取消/拒绝操作 */
  async function rejectActionById(messageId: string, actionId: string) {
    const action = findAction(messageId, actionId)
    if (!action) return
    try {
      action.proposal = await rejectAction(action.proposal.id)
    } catch {
      action.proposal.status = 'rejected'
    }
  }

  /** 保存编辑 (按预览下标改安全字段), 重新校验后回到待确认 */
  async function saveActionEdit(messageId: string, actionId: string, items: ScheduleEditItem[]) {
    const action = findAction(messageId, actionId)
    if (!action) return
    action.proposal = await updateAction(action.proposal.id, items)
  }

  function reset() {
    abortPending()
    messages.value = []
  }

  return {
    visible,
    context,
    messages,
    sending,
    lastError,
    open,
    close,
    send,
    retry,
    abortPending,
    confirmAction,
    rejectActionById,
    saveActionEdit,
    reset,
  }
})

export type { AssistantPreviewItem }
