import type { QAInfo } from '@/api/api-models'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useAccount } from '@/api/account'
import { ViolationTypes } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { ACCOUNT_API_URL, QUESTION_API_URL } from '@/shared/config'

export interface QATagInfo {
  name: string
  createAt: number
  visiable: boolean
}

export type SortMode = 'default' | 'newest' | 'oldest' | 'unreadFirst' | 'repliedFirst' | 'unrepliedFirst'

export const useQuestionBox = defineStore('QuestionBox', () => {
  const isLoading = ref(false)
  const isRepling = ref(false)
  const isChangingPublic = ref(false)
  const accountInfo = useAccount()
  const message = window.$message

  const recieveQuestions = ref<QAInfo[]>([])
  const sendQuestions = ref<QAInfo[]>([])
  const tags = ref<QATagInfo[]>([])
  const reviewing = ref(0)

  // 筛选状态
  const onlyFavorite = ref(false)
  const onlyPublic = ref(false)
  const onlyUnread = ref(false)
  const displayTag = ref<string>()
  const searchKeyword = ref('')
  const sortMode = ref<SortMode>('default')

  // 批量选择
  const selectedIds = ref<number[]>([])

  // 展示相关
  const currentQuestion = ref<QAInfo>()
  const displayQuestion = ref<QAInfo>()

  let isRecieveGetted = false
  let isSendGetted = false

  const trashQuestions = computed(() =>
    recieveQuestions.value.filter(q => q.reviewResult && q.reviewResult.isApproved === false),
  )

  function applySorting(list: QAInfo[]): QAInfo[] {
    const sorted = [...list]
    switch (sortMode.value) {
      case 'newest':
        return sorted.sort((a, b) => b.sendAt - a.sendAt)
      case 'oldest':
        return sorted.sort((a, b) => a.sendAt - b.sendAt)
      case 'repliedFirst':
        return sorted.sort((a, b) => {
          if (!!a.answer !== !!b.answer) return a.answer ? -1 : 1
          return b.sendAt - a.sendAt
        })
      case 'unrepliedFirst':
        return sorted.sort((a, b) => {
          if (!!a.answer !== !!b.answer) return a.answer ? 1 : -1
          return b.sendAt - a.sendAt
        })
      case 'unreadFirst':
      default:
        return sorted.sort((a, b) => {
          if (a.isReaded !== b.isReaded) return a.isReaded ? 1 : -1
          return b.sendAt - a.sendAt
        })
    }
  }

  const recieveQuestionsFiltered = computed(() => {
    const keyword = searchKeyword.value.toLowerCase()
    const filtered = recieveQuestions.value.filter(q =>
      (!q.reviewResult || q.reviewResult.isApproved === true)
      && (!onlyFavorite.value || q.isFavorite)
      && (!onlyPublic.value || q.isPublic)
      && (!onlyUnread.value || !q.isReaded)
      && (!displayTag.value || q.tag === displayTag.value)
      && (!keyword || q.question?.message?.toLowerCase().includes(keyword)),
    )
    return applySorting(filtered)
  })

  // --- API 方法 ---

  async function GetRecieveQAInfo() {
    isLoading.value = true
    try {
      const resp = await QueryGetAPI<{ questions: QAInfo[], reviewCount: number }>(`${QUESTION_API_URL}get-recieve`)
      if (resp.code === 200) {
        recieveQuestions.value = [...resp.data.questions].sort((a, b) => {
          if (a.isReaded !== b.isReaded) return a.isReaded ? 1 : -1
          return b.sendAt - a.sendAt
        })
        reviewing.value = resp.data.reviewCount
        const displayId = accountInfo.value?.settings.questionDisplay.currentQuestion
        if (displayId && displayQuestion.value?.id !== displayId) {
          displayQuestion.value = recieveQuestions.value.find(q => q.id === displayId)
        }
        isRecieveGetted = true
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
    isLoading.value = true
    try {
      const resp = await QueryGetAPI<QAInfo[]>(`${QUESTION_API_URL}get-send`)
      if (resp.code === 200) {
        sendQuestions.value = resp.data
        isSendGetted = true
      } else {
        message.error(resp.message)
      }
    } catch (err) {
      message.error(`发生错误: ${err}`)
    } finally {
      isLoading.value = false
    }
  }

  async function DelQA(id: number) {
    try {
      const resp = await QueryGetAPI(`${QUESTION_API_URL}del`, { id })
      if (resp.code === 200) {
        message.success('删除成功')
        recieveQuestions.value = recieveQuestions.value.filter(q => q.id !== id)
        selectedIds.value = selectedIds.value.filter(sid => sid !== id)
      } else {
        message.error(resp.message)
      }
    } catch (err) {
      message.error(`发生错误: ${err}`)
    }
  }

  async function GetTags() {
    isLoading.value = true
    try {
      const resp = await QueryGetAPI<QATagInfo[]>(`${QUESTION_API_URL}get-tags`, { id: accountInfo.value?.id })
      if (resp.code === 200) {
        tags.value = resp.data
      } else {
        message.error(resp.message)
      }
    } catch (err) {
      message.error(`发生错误: ${err}`)
    } finally {
      isLoading.value = false
    }
  }

  async function addTag(tag: string) {
    if (!tag) { message.warning('请输入标签'); return }
    if (tags.value.find(t => t.name === tag)) { message.warning('标签已存在'); return }
    try {
      const resp = await QueryGetAPI(`${QUESTION_API_URL}add-tag`, { tag })
      if (resp.code === 200) {
        message.success('添加成功')
        GetTags()
      } else {
        message.error(`添加失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`添加失败: ${err}`)
    }
  }

  async function delTag(tag: string) {
    if (!tag) { message.warning('请输入标签'); return }
    try {
      const resp = await QueryGetAPI(`${QUESTION_API_URL}del-tag`, { tag })
      if (resp.code === 200) {
        message.success('删除成功')
        GetTags()
      } else {
        message.error(`删除失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`删除失败: ${err}`)
    }
  }

  async function updateTagVisiable(tag: string, visiable: boolean) {
    if (!tag) { message.warning('请输入标签'); return }
    try {
      const resp = await QueryGetAPI(`${QUESTION_API_URL}update-tag-visiable`, { tag, visiable })
      if (resp.code === 200) {
        message.success('修改成功')
        GetTags()
      } else {
        message.error(`修改失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`修改失败: ${err}`)
    }
  }

  async function reply(id: number, msg: string) {
    isRepling.value = true
    try {
      const resp = await QueryPostAPI<QAInfo>(`${QUESTION_API_URL}reply`, { Id: id, Message: msg })
      if (resp.code === 200) {
        const index = recieveQuestions.value.findIndex(q => q.id === id)
        if (index > -1) recieveQuestions.value[index] = resp.data
        message.success('回复成功')
        currentQuestion.value = undefined
      } else {
        message.error(`发送失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`发送失败: ${err}`)
    } finally {
      isRepling.value = false
    }
  }

  async function read(question: QAInfo, isRead: boolean) {
    try {
      const resp = await QueryGetAPI(`${QUESTION_API_URL}read`, { id: question.id, read: isRead ? 'true' : 'false' })
      if (resp.code === 200) {
        question.isReaded = isRead
        if (isRead && displayQuestion.value?.id === question.id) {
          setCurrentQuestion(question)
        }
      } else {
        message.error(`修改失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`修改失败: ${err}`)
    }
  }

  async function favorite(question: QAInfo, fav: boolean) {
    try {
      const resp = await QueryGetAPI(`${QUESTION_API_URL}favorite`, { id: question.id, favorite: fav })
      if (resp.code === 200) {
        question.isFavorite = fav
      } else {
        message.error(`修改失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`修改失败: ${err}`)
    }
  }

  async function setPublic(pub: boolean) {
    isChangingPublic.value = true
    try {
      const resp = await QueryGetAPI(`${QUESTION_API_URL}public`, { id: currentQuestion.value?.id, public: pub })
      if (resp.code === 200) {
        if (currentQuestion.value) currentQuestion.value.isPublic = pub
        message.success('已修改公开状态')
      } else {
        message.error(`修改失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`修改失败: ${err}`)
    } finally {
      isChangingPublic.value = false
    }
  }

  async function blacklist(question: QAInfo) {
    try {
      const resp = await QueryGetAPI(`${ACCOUNT_API_URL}black-list/add`, { id: question.sender.id })
      if (resp.code === 200) {
        const delResp = await QueryGetAPI(`${QUESTION_API_URL}del`, { id: question.id })
        if (delResp.code === 200) {
          message.success(`已拉黑 ${question.sender.name}`)
          recieveQuestions.value = recieveQuestions.value.filter(q => q.id !== question.id)
        } else {
          message.error(`删除失败: ${delResp.message}`)
        }
      } else {
        message.error(`拉黑失败: ${resp.message}`)
      }
    } catch (err) {
      message.error(`拉黑失败: ${err}`)
    }
  }

  async function markAsNormal(question: QAInfo) {
    try {
      const resp = await QueryGetAPI(`${QUESTION_API_URL}mark-as-normal`, { id: question.id })
      if (resp.code === 200) {
        message.success('已标记为正常')
        question.reviewResult.isApproved = true
      }
    } catch (err) {
      message.error(`标记失败: ${err}`)
    }
  }

  async function setCurrentQuestion(item: QAInfo | undefined) {
    const isCurrent = displayQuestion.value?.id === item?.id
    displayQuestion.value = isCurrent ? undefined : item
    try {
      const resp = await QueryGetAPI(`${QUESTION_API_URL}set-current`, isCurrent || !item ? null : { id: item.id })
      if (resp.code !== 200) message.error(`设置失败: ${resp.message}`)
    } catch (err) {
      message.error(`设置失败: ${err}`)
    }
  }

  // --- 批量操作 ---

  function toggleSelect(id: number) {
    const idx = selectedIds.value.indexOf(id)
    if (idx > -1) selectedIds.value.splice(idx, 1)
    else selectedIds.value.push(id)
  }

  function selectAll(ids: number[]) {
    const current = new Set(selectedIds.value)
    ids.forEach(id => current.add(id))
    selectedIds.value = [...current]
  }

  function clearSelection() {
    selectedIds.value = []
  }

  async function batchRead(isRead: boolean) {
    const ids = [...selectedIds.value]
    if (!ids.length) return
    await Promise.allSettled(
      ids.map(async id => QueryGetAPI(`${QUESTION_API_URL}read`, { id, read: isRead ? 'true' : 'false' })),
    )
    ids.forEach(id => {
      const q = recieveQuestions.value.find(q => q.id === id)
      if (q) q.isReaded = isRead
    })
    clearSelection()
    message.success(`已批量${isRead ? '标记已读' : '标记未读'}`)
  }

  async function batchDelete() {
    const ids = [...selectedIds.value]
    if (!ids.length) return
    await Promise.allSettled(
      ids.map(async id => QueryGetAPI(`${QUESTION_API_URL}del`, { id })),
    )
    recieveQuestions.value = recieveQuestions.value.filter(q => !ids.includes(q.id))
    clearSelection()
    message.success('已批量删除')
  }

  async function batchSetPublic(pub: boolean) {
    const ids = [...selectedIds.value]
    if (!ids.length) return
    await Promise.allSettled(
      ids.map(async id => QueryGetAPI(`${QUESTION_API_URL}public`, { id, public: pub })),
    )
    ids.forEach(id => {
      const q = recieveQuestions.value.find(q => q.id === id)
      if (q) q.isPublic = pub
    })
    clearSelection()
    message.success(`已批量${pub ? '公开' : '取消公开'}`)
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
    }
    return map[violation] ?? '未知'
  }

  return {
    isLoading,
    isRecieveGetted,
    isSendGetted,
    isRepling,
    isChangingPublic,
    recieveQuestions,
    recieveQuestionsFiltered,
    sendQuestions,
    trashQuestions,
    reviewing,
    tags,
    currentQuestion,
    displayQuestion,
    // 筛选
    onlyFavorite,
    onlyPublic,
    onlyUnread,
    displayTag,
    searchKeyword,
    sortMode,
    // 批量
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    batchRead,
    batchDelete,
    batchSetPublic,
    // API
    GetRecieveQAInfo,
    GetSendQAInfo,
    DelQA,
    GetTags,
    addTag,
    delTag,
    updateTagVisiable,
    reply,
    read,
    favorite,
    setPublic,
    blacklist,
    markAsNormal,
    setCurrentQuestion,
    getViolationString,
  }
})
