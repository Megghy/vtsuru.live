import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { QueryRequestError } from '@/api/query'
import type {
  AssistantContext,
  AssistantConversation,
  AssistantHistoryMessage,
  AssistantPreviewItem,
  AssistantProposal,
  AssistantTokenUsage,
  AssistantToolEvent,
  ProposalEditItem,
} from '../api/assistant'
import {
  approveAction,
  cancelScheduleAction,
  deleteConversation,
  getConversationMessages,
  listConversations,
  rejectAction,
  renameConversation,
  scheduleAction,
  streamMessage,
  updateAction,
} from '../api/assistant'
import type { MessageRole, MessageStatus } from '../schemas/assistant'

let seq = 0
const nextId = () => `m_${Date.now()}_${++seq}`
const serverMessageId = (id: string) => {
  if (!id.startsWith('s_')) return null
  const parsed = Number(id.slice(2))
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

/** 单条操作卡片 (审批卡片), proposal 即服务端提案 */
export interface AssistantAction {
  id: string
  proposal: AssistantProposal
}

/**
 * 答复前"工作过程"的有序片段: 思考文本与只读工具调用按到达时序交错。
 * reasoning 片段可累积 (连续思考并入同一段), tool 片段引用工具事件 (按 id 原地更新)。
 */
export type AssistantProcessStep =
  | { kind: 'reasoning'; text: string }
  | { kind: 'tool'; tool: AssistantToolEvent }

/** 单条聊天消息 */
export interface AssistantMessage {
  id: string
  role: MessageRole
  text: string
  /** 答复前的工作过程 (思考 + 工具调用), 按时序排列 */
  process: AssistantProcessStep[]
  /** 思考是否结束 (用于 UI 自动收起思考文本) */
  reasoningDone?: boolean
  /** 本轮 token 用量 */
  usage?: AssistantTokenUsage
  status: MessageStatus
  actions: AssistantAction[]
  error?: string
  /** 该消息附带的图片 (base64 data URL); 用户消息回显用 */
  images?: string[]
  /** 历史消息标注曾带图片 (不含图片数据) */
  hasImage?: boolean
  /** 触发该回复的用户输入, 用于重试 */
  sourcePrompt?: string
  /** 触发该回复的图片, 用于重试 */
  sourceImages?: string[]
}

export const useAssistantStore = defineStore('assistant', () => {
  const visible = ref(false)
  const context = ref<AssistantContext>({ routeName: '', title: '', path: '' })
  const messages = ref<AssistantMessage[]>([])
  const sending = ref(false)
  let abort: AbortController | null = null

  /** 左侧会话列表 */
  const conversations = ref<AssistantConversation[]>([])
  /** 当前会话 Id, null 表示尚未创建 (新对话草稿) */
  const currentConversationId = ref<number | null>(null)
  const conversationsLoading = ref(false)
  const messagesLoading = ref(false)
  /** 会话分页: 已加载页码与是否还有更多 */
  const CONV_PAGE_SIZE = 20
  const conversationsPage = ref(0)
  const conversationsHasMore = ref(true)
  const conversationsLoadingMore = ref(false)

  const lastError = computed(() => {
    const last = messages.value[messages.value.length - 1]
    return last?.status === 'error' ? last : null
  })

  function open(ctx: AssistantContext) {
    context.value = ctx
    visible.value = true
    void loadConversations()
  }

  function close() {
    visible.value = false
  }

  function abortPending() {
    abort?.abort()
    abort = null
    sending.value = false
  }

  /** 拉取会话列表 (首页, 重置分页) */
  async function loadConversations() {
    conversationsLoading.value = true
    conversationsPage.value = 0
    try {
      const list = await listConversations(0, CONV_PAGE_SIZE)
      conversations.value = list
      conversationsHasMore.value = list.length >= CONV_PAGE_SIZE
    } catch (e) {
      console.warn('[assistant] 加载会话列表失败', e)
    } finally {
      conversationsLoading.value = false
    }
  }

  /** 加载下一页会话, 追加到列表尾部 */
  async function loadMoreConversations() {
    if (conversationsLoadingMore.value || !conversationsHasMore.value || conversationsLoading.value) return
    conversationsLoadingMore.value = true
    try {
      const next = conversationsPage.value + 1
      const list = await listConversations(next, CONV_PAGE_SIZE)
      // 去重追加 (并发刷新时可能重叠)
      const existing = new Set(conversations.value.map(c => c.id))
      conversations.value.push(...list.filter(c => !existing.has(c.id)))
      conversationsPage.value = next
      conversationsHasMore.value = list.length >= CONV_PAGE_SIZE
    } catch (e) {
      console.warn('[assistant] 加载更多会话失败', e)
    } finally {
      conversationsLoadingMore.value = false
    }
  }

  /** 把后端历史消息映射为本地消息结构 */
  function mapHistory(history: AssistantHistoryMessage[]): AssistantMessage[] {
    return history.map(h => ({
      id: `s_${h.id}`,
      role: h.role,
      text: h.text,
      status: 'done' as MessageStatus,
      // 后端片段结构与本地一致, 仅过滤掉缺字段的脏数据
      process: (h.process ?? []).filter(
        (s): s is AssistantProcessStep =>
          (s.kind === 'reasoning' && typeof s.text === 'string') || (s.kind === 'tool' && !!s.tool),
      ),
      reasoningDone: true,
      usage: h.usage,
      actions: h.proposal ? [{ id: nextId(), proposal: h.proposal }] : [],
      images: h.images,
      hasImage: h.hasImage || !!h.images?.length,
    }))
  }

  /** 切换到某个会话, 拉取其历史消息 */
  async function switchConversation(id: number) {
    if (id === currentConversationId.value || sending.value) return
    abortPending()
    currentConversationId.value = id
    messages.value = []
    messagesLoading.value = true
    try {
      messages.value = mapHistory(await getConversationMessages(id))
    } catch (e) {
      console.warn('[assistant] 加载会话消息失败', e)
    } finally {
      messagesLoading.value = false
    }
  }

  /** 新建对话 (清空当前, 等首条消息发送时后端再建会话) */
  function newConversation() {
    if (sending.value) return
    abortPending()
    currentConversationId.value = null
    messages.value = []
  }

  /** 重命名会话 */
  async function renameConversationById(id: number, title: string) {
    await renameConversation(id, title)
    const target = conversations.value.find(c => c.id === id)
    if (target) target.title = title
  }

  /** 删除会话; 若删的是当前会话则回到新对话 */
  async function deleteConversationById(id: number) {
    await deleteConversation(id)
    conversations.value = conversations.value.filter(c => c.id !== id)
    if (id === currentConversationId.value) newConversation()
  }

  async function runReply(
    assistantMsg: AssistantMessage,
    prompt: string,
    images?: string[],
    options: { editMessageId?: number; sourceUserMsg?: AssistantMessage } = {},
  ) {
    assistantMsg.status = 'sending'
    assistantMsg.text = ''
    assistantMsg.process = []
    assistantMsg.reasoningDone = false
    assistantMsg.usage = undefined
    assistantMsg.actions = []
    assistantMsg.error = undefined
    sending.value = true
    abort = new AbortController()

    try {
      let gotDone = false
      await streamMessage(
        prompt, context.value, currentConversationId.value, images, options.editMessageId,
        {
          onReasoning: d => {
            // 并入最后一个 reasoning 片段; 若末尾是工具调用则新开一段, 保留交错时序
            const last = assistantMsg.process[assistantMsg.process.length - 1]
            if (last?.kind === 'reasoning') last.text += d
            else assistantMsg.process.push({ kind: 'reasoning', text: d })
          },
          onText: d => {
            // 首个正文增量到达 => 思考结束, UI 收起思考文本
            if (!assistantMsg.reasoningDone) assistantMsg.reasoningDone = true
            assistantMsg.text += d
          },
          onTool: tool => {
            const existing = assistantMsg.process.find(
              (s): s is Extract<AssistantProcessStep, { kind: 'tool' }> => s.kind === 'tool' && s.tool.id === tool.id,
            )
            if (existing) Object.assign(existing.tool, tool)
            else assistantMsg.process.push({ kind: 'tool', tool })
          },
          onProposal: p => { assistantMsg.actions.push({ id: nextId(), proposal: p }) },
          onDone: e => {
            gotDone = true
            currentConversationId.value = e.conversationId
            if (e.userMessageId && options.sourceUserMsg) {
              options.sourceUserMsg.id = `s_${e.userMessageId}`
            }
            assistantMsg.id = `s_${e.messageId}`
            assistantMsg.reasoningDone = true
            assistantMsg.usage = e.usage
            assistantMsg.status = 'done'
          },
        },
        abort.signal,
      )
      // 兜底: 流正常结束但未收到 done 事件
      if (!gotDone) assistantMsg.status = 'done'
      // 刷新列表: 新会话需补入, 已有会话需更新顺序/标题
      void loadConversations()
    } catch (e) {
      if ((e instanceof QueryRequestError && e.kind === 'aborted') || (e instanceof DOMException && e.name === 'AbortError')) {
        assistantMsg.status = 'done'
        assistantMsg.text = assistantMsg.text || '已取消'
      } else {
        assistantMsg.status = 'error'
        assistantMsg.error = e instanceof Error ? e.message : String(e)
      }
    } finally {
      assistantMsg.reasoningDone = true
      sending.value = false
      abort = null
    }
  }

  async function send(prompt: string, images?: string[]) {
    const trimmed = prompt.trim()
    const imgs = images && images.length ? images : undefined
    if ((!trimmed && !imgs) || sending.value) return

    const userMsg: AssistantMessage = reactive({
      id: nextId(), role: 'user', text: trimmed, status: 'done', process: [], actions: [], images: imgs,
    })
    const assistantMsg: AssistantMessage = reactive({
      id: nextId(), role: 'assistant', text: '', status: 'sending', process: [], actions: [],
      sourcePrompt: trimmed, sourceImages: imgs,
    })
    messages.value.push(userMsg, assistantMsg)
    await runReply(assistantMsg, trimmed, imgs, { sourceUserMsg: userMsg })
  }

  /** 重试某条失败的 AI 消息 */
  async function retry(messageId: string) {
    const msg = messages.value.find(m => m.id === messageId)
    if (!msg || msg.role !== 'assistant' || (!msg.sourcePrompt && !msg.sourceImages?.length)) return
    await runReply(msg, msg.sourcePrompt ?? '', msg.sourceImages)
  }

  async function rerun(messageId: string) {
    if (sending.value) return
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index < 0) return
    const source = [...messages.value.slice(0, index)].reverse()
      .find(m => m.role === 'user' && (m.text || m.images?.length || m.hasImage))
    if (!source) return
    await editAndRerun(source.id, source.text)
  }

  async function editAndRerun(messageId: string, nextText: string) {
    if (sending.value) return
    const index = messages.value.findIndex(m => m.id === messageId)
    const msg = messages.value[index]
    const editMessageId = serverMessageId(messageId)
    if (!msg || msg.role !== 'user' || !editMessageId) return

    const text = nextText.trim()
    const hasImages = !!msg.images?.length || !!msg.hasImage
    if (!text && !hasImages) return

    msg.text = text
    msg.status = 'done'
    msg.error = undefined
    messages.value.splice(index + 1)

    const assistantMsg: AssistantMessage = reactive({
      id: nextId(),
      role: 'assistant',
      text: '',
      status: 'sending',
      process: [],
      actions: [],
      sourcePrompt: text,
      sourceImages: msg.images,
    })
    messages.value.push(assistantMsg)
    await runReply(assistantMsg, text, undefined, { editMessageId, sourceUserMsg: msg })
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
      window.$message?.success('操作已执行')
    } catch (e) {
      action.proposal.status = 'failed'
      action.proposal.error = e instanceof Error ? e.message : String(e)
      window.$message?.error(action.proposal.error)
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
  async function saveActionEdit(messageId: string, actionId: string, items: ProposalEditItem[]) {
    const action = findAction(messageId, actionId)
    if (!action) return
    action.proposal = await updateAction(action.proposal.id, items)
  }

  /** 设定定时执行 (scheduledTime: Unix 毫秒) */
  async function scheduleActionById(messageId: string, actionId: string, scheduledTime: number) {
    const action = findAction(messageId, actionId)
    if (!action) return
    try {
      action.proposal = await scheduleAction(action.proposal.id, scheduledTime)
      window.$message?.success('已设定定时执行')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      window.$message?.error(msg)
    }
  }

  /** 取消定时执行, 回到待确认 */
  async function cancelScheduleById(messageId: string, actionId: string) {
    const action = findAction(messageId, actionId)
    if (!action) return
    try {
      action.proposal = await cancelScheduleAction(action.proposal.id)
      window.$message?.info('已取消定时执行')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      window.$message?.error(msg)
    }
  }

  function reset() {
    newConversation()
  }

  return {
    visible,
    context,
    messages,
    sending,
    lastError,
    conversations,
    currentConversationId,
    conversationsLoading,
    conversationsHasMore,
    conversationsLoadingMore,
    messagesLoading,
    open,
    close,
    send,
    retry,
    rerun,
    editAndRerun,
    abortPending,
    confirmAction,
    rejectActionById,
    saveActionEdit,
    scheduleActionById,
    cancelScheduleById,
    reset,
    loadConversations,
    loadMoreConversations,
    switchConversation,
    newConversation,
    renameConversationById,
    deleteConversationById,
  }
})

export type { AssistantPreviewItem }
