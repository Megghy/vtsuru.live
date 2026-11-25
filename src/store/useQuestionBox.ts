import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import { ViolationTypes } from '@/api/generated/model'
import type { QATagInfo, ResponseQAInfo, ResponseQAInfoToTarget } from '@/api/generated/model'
import {
  getApiQaGetReceive,
  getApiQaGetSend,
  getApiQaGetTags,
  postApiQaAddTag,
  postApiQaApprove,
  postApiQaBatch,
  postApiQaBlacklistSender,
  postApiQaDelete,
  postApiQaDeleteTag,
  postApiQaFavorite,
  postApiQaMarkAsNormal,
  postApiQaPin,
  postApiQaPublic,
  postApiQaRead,
  postApiQaReply,
  postApiQaSetCurrent,
  postApiQaUpdateTag,
  postApiQaUpdateTagVisible,
} from '@/api/generated/qa/qa'
import { groupQuestionThreads, threadContextOf } from '@/shared/questionThread'

export type SortMode = 'default' | 'newest' | 'oldest' | 'unreadFirst' | 'repliedFirst' | 'unrepliedFirst'

function toMsTimestamp(ts?: number | null): number {
  if (!ts) return 0
  return ts < 1e12 ? ts * 1000 : ts
}

export const useQuestionBox = defineStore('QuestionBox', () => {
  const isLoading = ref(false)
  const isLoadingSend = ref(false)
  const isRepling = ref(false)
  const isChangingPublic = ref(false)
  const accountInfo = useAccount()
  const message = {
    info: (msg?: string) => window.$message?.info(msg ?? ''),
    success: (msg?: string) => window.$message?.success(msg ?? ''),
    warning: (msg?: string) => window.$message?.warning(msg ?? ''),
    error: (msg?: string) => window.$message?.error(msg ?? ''),
  }

  const recieveQuestions = ref<ResponseQAInfoToTarget[]>([])
  const sendQuestions = ref<ResponseQAInfo[]>([])
  const tags = ref<QATagInfo[]>([])
  const reviewing = ref(0)

  // 筛选状态
  const onlyFavorite = ref(false)
  const onlyPublic = ref(false)
  const onlyUnread = ref(false)
  const onlyUnreplied = ref(false)
  const onlyPinned = ref(false)
  const displayTag = ref<string | null>()
  const searchKeyword = ref('')
  const sortMode = ref<SortMode>('default')

  // 批量选择
  const selectedIds = ref<number[]>([])

  // 展示相关
  const currentQuestion = ref<ResponseQAInfoToTarget>()
  const displayQuestion = ref<ResponseQAInfoToTarget>()

  const normalQuestions = computed(() =>
    recieveQuestions.value.filter((q) => !q.reviewResult || q.reviewResult.isApproved === true),
  )

  const trashQuestions = computed(() =>
    recieveQuestions.value.filter((q) => q.reviewResult && q.reviewResult.isApproved === false),
  )

  const stats = computed(() => {
    const list = normalQuestions.value
    let unread = 0
    let unreplied = 0
    let publicCount = 0
    let favoriteCount = 0
    let pinnedCount = 0
    for (const q of list) {
      if (!q.isReaded) unread++
      if (!q.answer) unreplied++
      if (q.isPublic) publicCount++
      if (q.isFavorite) favoriteCount++
      if (q.isPinned) pinnedCount++
    }
    return {
      total: list.length,
      unread,
      unreplied,
      publicCount,
      favoriteCount,
      pinnedCount,
      trashCount: trashQuestions.value.length,
      reviewing: reviewing.value,
    }
  })

  function applySorting(list: ResponseQAInfoToTarget[]): ResponseQAInfoToTarget[] {
    const sorted = [...list]
    switch (sortMode.value) {
      case 'newest':
        return sorted.toSorted((a, b) => b.sendAt - a.sendAt)
      case 'oldest':
        return sorted.toSorted((a, b) => a.sendAt - b.sendAt)
      case 'repliedFirst':
        return sorted.toSorted((a, b) => {
          if (!!a.answer !== !!b.answer) return a.answer ? -1 : 1
          return b.sendAt - a.sendAt
        })
      case 'unrepliedFirst':
        return sorted.toSorted((a, b) => {
          if (!!a.answer !== !!b.answer) return a.answer ? 1 : -1
          return b.sendAt - a.sendAt
        })
      case 'unreadFirst':
        return sorted.toSorted((a, b) => {
          if (a.isReaded !== b.isReaded) return a.isReaded ? 1 : -1
          return b.sendAt - a.sendAt
        })
      case 'default':
      default:
        return sorted.toSorted((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
          if (a.isReaded !== b.isReaded) return a.isReaded ? 1 : -1
          return b.sendAt - a.sendAt
        })
    }
  }

  const recieveQuestionsFiltered = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase()
    const filtered = normalQuestions.value.filter(
      (q) =>
        (!onlyFavorite.value || q.isFavorite) &&
        (!onlyPublic.value || q.isPublic) &&
        (!onlyUnread.value || !q.isReaded) &&
        (!onlyUnreplied.value || !q.answer) &&
        (!onlyPinned.value || q.isPinned) &&
        (!displayTag.value || q.tag === displayTag.value) &&
        (!keyword ||
          q.question?.message?.toLowerCase().includes(keyword) ||
          q.answer?.message?.toLowerCase().includes(keyword) ||
          q.sender?.name?.toLowerCase().includes(keyword) ||
          q.anonymousName?.toLowerCase().includes(keyword) ||
          q.tag?.toLowerCase().includes(keyword)),
    )
    return applySorting(filtered)
  })

  // --- API 方法 ---

  async function GetRecieveQAInfo() {
    isLoading.value = true
    try {
      const resp = await getApiQaGetReceive()
      if (resp.code === 200) {
        recieveQuestions.value = [...resp.data.questions].toSorted((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
          if (a.isReaded !== b.isReaded) return a.isReaded ? 1 : -1
          return b.sendAt - a.sendAt
        })
        reviewing.value = resp.data.reviewCount
        const displayId = accountInfo.value?.currentQuestionId
        displayQuestion.value = displayId ? recieveQuestions.value.find((q) => q.id === displayId) : undefined
      } else {
        message.error(resp.message)
      }
    } catch (err) {
      message.error(`发生错误: ${err}`)
    } finally {
      isLoading.value = false
    }
  }

  async function GetSendQAInfo() {
    isLoadingSend.value = true
    try {
      const resp = await getApiQaGetSend()
      if (resp.code === 200) {
        sendQuestions.value = resp.data
      } else {
        message.error(resp.message)
      }
    } catch (err) {
      message.error(`发生错误: ${err}`)
    } finally {
      isLoadingSend.value = false
    }
  }

  const sendThreads = computed(() => groupQuestionThreads(sendQuestions.value))

  function threadContext(item: ResponseQAInfoToTarget) {
    return threadContextOf(recieveQuestions.value, item)
  }

  async function DelQA(id: number) {
    try {
      const resp = await postApiQaDelete({ id })
      if (resp.code === 200) {
        message.success('删除成功')
        recieveQuestions.value = recieveQuestions.value.filter((q) => q.id !== id)
        selectedIds.value = selectedIds.value.filter((sid) => sid !== id)
        if (displayQuestion.value?.id === id) {
          displayQuestion.value = undefined
        }
      } else {
        message.error(resp.message)
      }
    } catch (err) {
      message.error(`发生错误: ${err}`)
    }
  }

  async function GetTags() {
    const id = accountInfo.value?.id
    if (!id) return

    try {
      const resp = await getApiQaGetTags({ id: String(id) })
      if (resp.code === 200) {
        tags.value = resp.data
      } else {
        message.error(resp.message)
      }
    } catch (err) {
      message.error(`发生错误: ${err}`)
    }
  }

  async function addTag(tagName: string) {
    if (!tagName.trim()) {
      message.warning('标签名称不能为空')
      return
    }

    try {
      const resp = await postApiQaAddTag({ tag: tagName.trim() })
      if (resp.code === 200) {
        message.success('添加成功')
        await GetTags()
      } else {
        message.error(`添加失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`添加失败: ${err}`)
    }
  }

  async function delTag(tagName: string) {
    try {
      const resp = await postApiQaDeleteTag({ tag: tagName })
      if (resp.code === 200) {
        message.success('删除成功')
        await GetTags()
      } else {
        message.error(`删除失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`删除失败: ${err}`)
    }
  }

  async function changeTagVisiable(tagName: string, isVisiable: boolean) {
    try {
      const resp = await postApiQaUpdateTagVisible({
        tag: tagName,
        visiable: isVisiable,
      })
      if (resp.code === 200) {
        message.success('修改成功')
        await GetTags()
      } else {
        message.error(`修改失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`修改失败: ${err}`)
    }
  }

  async function reply(id: number, replyMsg: string, files: File[] = []): Promise<boolean> {
    isRepling.value = true
    try {
      const resp = await postApiQaReply({
        id,
        message: replyMsg,
        files: files.length ? (files as any) : undefined,
      })
      if (resp.code === 200) {
        message.success('回复成功')
        const idx = recieveQuestions.value.findIndex((item) => item.id === id)
        if (idx !== -1) {
          const updated = resp.data
          if (updated?.answer) {
            recieveQuestions.value[idx] = {
              ...recieveQuestions.value[idx],
              ...updated,
            }
          } else {
            const target = recieveQuestions.value[idx]
            target.answer = { message: replyMsg, createdAt: Math.floor(Date.now() / 1000) }
            target.isReaded = true
          }
        }
        return true
      } else {
        message.error(`回复失败: ${resp.message}`)
        return false
      }
    } catch (err) {
      message.error(`回复失败: ${err}`)
      return false
    } finally {
      isRepling.value = false
    }
  }

  async function read(question: ResponseQAInfoToTarget, isRead: boolean) {
    try {
      const resp = await postApiQaRead({
        id: question.id,
        read: isRead ? 'true' : ('false' as any),
      })
      if (resp.code === 200) {
        question.isReaded = isRead
      } else {
        message.error(`修改失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`修改失败: ${err}`)
    }
  }

  async function favorite(question: ResponseQAInfoToTarget, fav: boolean) {
    try {
      const resp = await postApiQaFavorite({ id: question.id, favorite: fav as any })
      if (resp.code === 200) {
        question.isFavorite = fav
      } else {
        message.error(`修改失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`修改失败: ${err}`)
    }
  }

  async function pin(question: ResponseQAInfoToTarget, isPinned: boolean) {
    try {
      const resp = await postApiQaPin({ id: question.id, pin: isPinned })
      if (resp.code === 200) {
        question.isPinned = isPinned
        message.success(isPinned ? '已置顶' : '已取消置顶')
      } else {
        message.error(`修改失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`修改失败: ${err}`)
    }
  }

  async function updateQuestionTag(question: ResponseQAInfoToTarget, tag: string | null) {
    try {
      const resp = await postApiQaUpdateTag({ id: question.id, tag: tag ?? '' })
      if (resp.code === 200) {
        question.tag = tag
        message.success(tag ? `已设为话题 #${tag}` : '已清除话题')
      } else {
        message.error(`修改标签失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`修改标签失败: ${err}`)
    }
  }

  async function approve(question: ResponseQAInfoToTarget, isApproved: boolean) {
    try {
      const resp = await postApiQaApprove({ id: question.id, approve: isApproved })
      if (resp.code === 200) {
        if (!question.reviewResult) {
          question.reviewResult = { isApproved, violationType: [] }
        } else {
          question.reviewResult.isApproved = isApproved
        }
        message.success(isApproved ? '已移回正常收件箱' : '已移入垃圾站')
      } else {
        message.error(`操作失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`操作失败: ${err}`)
    }
  }

  async function setPublic(question: ResponseQAInfoToTarget, pub: boolean, options?: { force?: boolean }) {
    if (pub && question.senderAllowsPublic === false && !options?.force) {
      message.warning('提问者选择不公开展示，请确认后强制公开')
      return false
    }
    isChangingPublic.value = true
    try {
      const resp = await postApiQaPublic({
        id: question.id,
        public: pub as any,
        ...(options?.force ? { force: true } : {}),
      })
      if (resp.code === 200) {
        question.isPublic = pub
        if (currentQuestion.value?.id === question.id) currentQuestion.value.isPublic = pub
        message.success('已修改公开状态')
        return true
      }
      message.error(`修改失败: ${resp.message}`)
      return false
    } catch (err) {
      message.error(`修改失败: ${err}`)
      return false
    } finally {
      isChangingPublic.value = false
    }
  }

  async function blacklist(question: ResponseQAInfoToTarget) {
    const canBlacklist = (!question.isAnonymous && Boolean(question.sender?.id)) || question.canBlacklistAnonymous
    if (!canBlacklist) {
      message.warning('该历史匿名提问未记录来源标识，无法拉黑')
      return
    }

    try {
      const resp = await postApiQaBlacklistSender({ id: question.id, deleteQuestion: true })
      if (resp.code === 200) {
        const label = !question.isAnonymous && question.sender?.name ? question.sender.name : '该匿名提问来源'
        message.success(`已拉黑 ${label} 并移除该提问`)
        recieveQuestions.value = recieveQuestions.value.filter((q) => q.id !== question.id)
        selectedIds.value = selectedIds.value.filter((sid) => sid !== question.id)
        if (displayQuestion.value?.id === question.id) {
          displayQuestion.value = undefined
        }
      } else {
        message.error(`拉黑失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`拉黑失败: ${err}`)
    }
  }

  async function markAsNormal(question: ResponseQAInfoToTarget) {
    try {
      const resp = await postApiQaMarkAsNormal({ id: question.id })
      if (resp.code === 200) {
        message.success('已标记为正常')
        if (question.reviewResult) {
          question.reviewResult.isApproved = true
        }
      } else {
        message.error(`标记失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`标记失败: ${err}`)
    }
  }

  async function setCurrentQuestion(item: ResponseQAInfoToTarget | undefined) {
    const nextId = item?.id
    const previousQuestion = displayQuestion.value
    displayQuestion.value = item
    if (accountInfo.value) accountInfo.value.currentQuestionId = nextId
    try {
      const resp = await postApiQaSetCurrent(nextId ? { id: nextId } : undefined)
      if (resp.code !== 200) throw new Error(resp.message)
    } catch (err) {
      displayQuestion.value = previousQuestion
      if (accountInfo.value) accountInfo.value.currentQuestionId = previousQuestion?.id
      message.error(`设置失败: ${err instanceof Error ? err.message : err}`)
    }
  }

  async function clearCurrentQuestion() {
    await setCurrentQuestion(undefined)
  }

  // --- 批量操作（走后端原生批量接口） ---

  function toggleSelect(id: number) {
    const idx = selectedIds.value.indexOf(id)
    if (idx > -1) selectedIds.value.splice(idx, 1)
    else selectedIds.value.push(id)
  }

  function selectAll(ids: number[]) {
    const current = new Set(selectedIds.value)
    ids.forEach((id) => current.add(id))
    selectedIds.value = [...current]
  }

  function clearSelection() {
    selectedIds.value = []
  }

  async function batchRead(isRead: boolean) {
    const ids = [...selectedIds.value]
    if (!ids.length) return
    const resp = await postApiQaBatch({ ids, action: isRead ? 'read' : 'unread' })
    if (resp.code !== 200) {
      message.error(`批量操作失败: ${resp.message}`)
      return
    }
    ids.forEach((id) => {
      const q = recieveQuestions.value.find((item) => item.id === id)
      if (q) q.isReaded = isRead
    })
    clearSelection()
    message.success(`已批量${isRead ? '标记已读' : '标记未读'}`)
  }

  async function batchDelete() {
    const ids = [...selectedIds.value]
    if (!ids.length) return
    const resp = await postApiQaBatch({ ids, action: 'delete' })
    if (resp.code !== 200) {
      message.error(`批量删除失败: ${resp.message}`)
      return
    }
    recieveQuestions.value = recieveQuestions.value.filter((q) => !ids.includes(q.id))
    if (displayQuestion.value && ids.includes(displayQuestion.value.id)) {
      displayQuestion.value = undefined
    }
    clearSelection()
    message.success('已批量删除')
  }

  async function batchSetPublic(pub: boolean) {
    const ids = [...selectedIds.value]
    if (!ids.length) return
    const skippedIds = pub
      ? ids.filter((id) => recieveQuestions.value.find((item) => item.id === id)?.senderAllowsPublic === false)
      : []
    const targets = ids.filter((id) => !skippedIds.includes(id))
    if (!targets.length) {
      message.warning('所选提问均由提问者选择不公开，请逐条确认后强制公开')
      return
    }
    const resp = await postApiQaBatch({ ids: targets, action: pub ? 'public' : 'private' })
    if (resp.code !== 200) {
      message.error(`批量操作失败: ${resp.message}`)
      return
    }
    targets.forEach((id) => {
      const q = recieveQuestions.value.find((item) => item.id === id)
      if (q) q.isPublic = pub
    })
    clearSelection()
    if (skippedIds.length) {
      message.success(
        `已${pub ? '公开' : '设为私密'} ${targets.length} 条，跳过 ${skippedIds.length} 条提问者未同意的提问`,
      )
      return
    }
    message.success(`已批量${pub ? '公开' : '设为私密'}`)
  }

  async function batchFavorite(fav: boolean) {
    const ids = [...selectedIds.value]
    if (!ids.length) return
    const resp = await postApiQaBatch({ ids, action: fav ? 'favorite' : 'unfavorite' })
    if (resp.code !== 200) {
      message.error(`批量操作失败: ${resp.message}`)
      return
    }
    ids.forEach((id) => {
      const q = recieveQuestions.value.find((item) => item.id === id)
      if (q) q.isFavorite = fav
    })
    clearSelection()
    message.success(`已批量${fav ? '收藏' : '取消收藏'}`)
  }

  async function batchSetTag(tag: string | null) {
    const ids = [...selectedIds.value]
    if (!ids.length) return
    const resp = await postApiQaBatch({ ids, action: 'tag', tag })
    if (resp.code !== 200) {
      message.error(`批量修改标签失败: ${resp.message}`)
      return
    }
    ids.forEach((id) => {
      const q = recieveQuestions.value.find((item) => item.id === id)
      if (q) q.tag = tag
    })
    clearSelection()
    message.success(tag ? `已为 ${ids.length} 条提问设置话题 #${tag}` : `已清除 ${ids.length} 条提问的话题`)
  }

  async function batchReject() {
    const ids = [...selectedIds.value]
    if (!ids.length) return
    const resp = await postApiQaBatch({ ids, action: 'reject' })
    if (resp.code !== 200) {
      message.error(`批量移入垃圾站失败: ${resp.message}`)
      return
    }
    ids.forEach((id) => {
      const q = recieveQuestions.value.find((item) => item.id === id)
      if (q) {
        if (!q.reviewResult) q.reviewResult = { isApproved: false, violationType: [] }
        else q.reviewResult.isApproved = false
      }
    })
    clearSelection()
    message.success(`已将 ${ids.length} 条提问移入垃圾站`)
  }

  // --- 数据导出 ---

  function exportQuestions(format: 'markdown' | 'csv' | 'json') {
    const source = selectedIds.value.length
      ? recieveQuestionsFiltered.value.filter((q) => selectedIds.value.includes(q.id))
      : recieveQuestionsFiltered.value

    if (!source.length) {
      message.warning('当前没有可导出的提问')
      return
    }

    const dateStr = new Date().toISOString().slice(0, 10)
    const prefix = `vtsuru-提问箱-${accountInfo.value?.name || 'export'}-${dateStr}`

    if (format === 'json') {
      const payload = source.map((q) => ({
        id: q.id,
        sender: q.isAnonymous ? q.anonymousName || '匿名用户' : q.sender?.name || '观众',
        tag: q.tag || null,
        sendAt: new Date(toMsTimestamp(q.sendAt)).toISOString(),
        isPublic: q.isPublic,
        isFavorite: q.isFavorite,
        isPinned: q.isPinned,
        likeCount: q.likeCount,
        question: q.question?.message ?? '',
        answer: q.answer?.message ?? null,
      }))
      saveAs(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }), `${prefix}.json`)
      message.success(`已导出 ${source.length} 条提问 (JSON)`)
      return
    }

    if (format === 'csv') {
      const escapeCell = (val: unknown) => `"${String(val ?? '').replaceAll('"', '""')}"`
      const headers = ['ID', '提问者', '话题', '发送时间', '公开', '收藏', '置顶', '点赞', '提问内容', '回复内容']
      const rows = source.map((q) => [
        q.id,
        q.isAnonymous ? q.anonymousName || '匿名用户' : q.sender?.name || '观众',
        q.tag || '',
        new Date(toMsTimestamp(q.sendAt)).toLocaleString('zh-CN'),
        q.isPublic ? '是' : '否',
        q.isFavorite ? '是' : '否',
        q.isPinned ? '是' : '否',
        q.likeCount ?? 0,
        q.question?.message ?? '',
        q.answer?.message ?? '',
      ])
      const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n')}`
      saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${prefix}.csv`)
      message.success(`已导出 ${source.length} 条提问 (CSV)`)
      return
    }

    const lines = [
      `# 提问箱记录 (${accountInfo.value?.name || ''})`,
      '',
      `导出时间：${new Date().toLocaleString('zh-CN')} · 共 ${source.length} 条`,
      '',
    ]
    for (const q of source) {
      const sender = q.isAnonymous ? q.anonymousName || '匿名用户' : q.sender?.name || '观众'
      const time = new Date(toMsTimestamp(q.sendAt)).toLocaleString('zh-CN')
      const meta = [q.tag ? `#${q.tag}` : null, q.isPinned ? '置顶' : null, q.isPublic ? '公开' : '私密']
        .filter(Boolean)
        .join(' · ')
      lines.push(`## ${sender} (${time})${meta ? ` — ${meta}` : ''}`)
      lines.push('')
      lines.push(q.question?.message ?? '')
      if (q.answer?.message) {
        lines.push('')
        lines.push(`> **回复**：${q.answer.message.replaceAll('\n', '\n> ')}`)
      }
      lines.push('')
      lines.push('---')
      lines.push('')
    }
    saveAs(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }), `${prefix}.md`)
    message.success(`已导出 ${source.length} 条提问 (Markdown)`)
  }

  // --- 工具方法 ---

  function getViolationString(violation: ViolationTypes) {
    const map: Record<number, string> = {
      [ViolationTypes.SENSITIVE_TERM]: '敏感词',
      [ViolationTypes.HATE]: '辱骂',
      [ViolationTypes.VIOLENCE]: '暴力',
      [ViolationTypes.PORNOGRAPHY]: '色情',
      [ViolationTypes.POLITICS]: '政治',
      [ViolationTypes.ADVERTISING]: '广告',
      [ViolationTypes.AGGRESSION]: '攻击性',
      [ViolationTypes.PASSIVE_AGGRESSIVE]: '阴阳怪气',
      [ViolationTypes.THREAT]: '现实威胁',
      [ViolationTypes.TEASING]: '黑称调侃',
    }
    return map[violation] ?? '未知'
  }

  return {
    isLoading,
    isLoadingSend,
    isRepling,
    isChangingPublic,
    recieveQuestions,
    sendQuestions,
    tags,
    reviewing,
    onlyFavorite,
    onlyPublic,
    onlyUnread,
    onlyUnreplied,
    onlyPinned,
    displayTag,
    searchKeyword,
    sortMode,
    selectedIds,
    currentQuestion,
    displayQuestion,
    trashQuestions,
    recieveQuestionsFiltered,
    stats,
    sendThreads,
    threadContext,
    GetRecieveQAInfo,
    GetSendQAInfo,
    DelQA,
    GetTags,
    addTag,
    delTag,
    changeTagVisiable,
    reply,
    read,
    favorite,
    pin,
    updateQuestionTag,
    approve,
    setPublic,
    blacklist,
    markAsNormal,
    setCurrentQuestion,
    clearCurrentQuestion,
    toggleSelect,
    selectAll,
    clearSelection,
    batchRead,
    batchDelete,
    batchSetPublic,
    batchFavorite,
    batchSetTag,
    batchReject,
    exportQuestions,
    getViolationString,
  }
})
