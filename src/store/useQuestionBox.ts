import { useAccount } from '@/api/account'
import { QAInfo, ViolationTypes } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { ACCOUNT_API_URL, QUESTION_API_URL } from '@/data/constants'
import { List } from 'linqts'
import { useMessage } from 'naive-ui'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type QATagInfo = {
  name: string
  createAt: number
  visiable: boolean
}
//SENSITIVE_TERM, HATE, VIOLENCE, PORNOGRAPHY, POLITICS, ADVERTISING, AGGRESSION, EMOTIONAL

export const useQuestionBox = defineStore('QuestionBox', () => {
  const isLoading = ref(false)
  const isRepling = ref(false)
  const isChangingPublic = ref(false)

  const accountInfo = useAccount()

  const recieveQuestions = ref<QAInfo[]>([])
  const sendQuestions = ref<QAInfo[]>([])
  const trashQuestions = ref<QAInfo[]>([])
  const tags = ref<QATagInfo[]>([])
  const reviewing = ref(0)

  const onlyFavorite = ref(false)
  const onlyPublic = ref(false)
  const onlyUnread = ref(false)

  const recieveQuestionsFiltered = computed(() => {
    const result = recieveQuestions.value.filter((q) => {
      /*if (q.id == displayQuestion.value?.id) {
        return false
      }*/
      return (
        (q.isFavorite || !onlyFavorite.value) &&
        (q.isPublic || !onlyPublic.value) &&
        (!q.isReaded || !onlyUnread.value) &&
        (!displayTag.value || q.tag == displayTag.value)
      )
    })
    return result
    //displayQuestion排在最前面
    //return displayQuestion.value ? [displayQuestion.value, ...result] : result
  })
  const currentQuestion = ref<QAInfo>()
  const displayQuestion = ref<QAInfo>()
  const displayTag = ref<string>()

  let isRevieveGetted = false
  //const isSendGetted = false

  const message = window.$message

  async function GetRecieveQAInfo() {
    isLoading.value = true
    await QueryGetAPI<{ questions: QAInfo[]; reviewCount: number }>(
      QUESTION_API_URL + 'get-recieve'
    )
      .then((data) => {
        if (data.code == 200) {
          if (data.data.questions.length > 0) {
            recieveQuestions.value = new List(data.data.questions)
              .OrderBy((d) => d.isReaded)
              //.ThenByDescending(d => d.isFavorite)
              .Where(
                (d) => !d.reviewResult || d.reviewResult.isApproved == true
              ) //只显示审核通过的
              .ThenByDescending((d) => d.sendAt)
              .ToArray()
            reviewing.value = data.data.reviewCount
            trashQuestions.value = data.data.questions.filter(
              (d) => d.reviewResult && d.reviewResult.isApproved == false
            )

            const displayId =
              accountInfo.value?.settings.questionDisplay.currentQuestion
            if (displayId && displayQuestion.value?.id != displayId) {
              displayQuestion.value = recieveQuestions.value.find(
                (q) => q.id == displayId
              )
            }
          }
          //message.success('共收取 ' + data.data.length + ' 条提问')
          isRevieveGetted = true
        } else {
          message.error(data.message)
        }
      })
      .catch((err) => {
        message.error('发生错误: ' + err)
      })
      .finally(() => {
        isLoading.value = false
      })
  }
  async function GetSendQAInfo() {
    isLoading.value = true
    await QueryGetAPI<QAInfo[]>(QUESTION_API_URL + 'get-send')
      .then((data) => {
        if (data.code == 200) {
          sendQuestions.value = data.data
          //message.success('共发送 ' + data.data.length + ' 条提问')
        } else {
          message.error(data.message)
        }
      })
      .catch((err) => {
        message.error('发生错误: ' + err)
      })
      .finally(() => {
        isLoading.value = false
      })
  }
  async function DelQA(id: number) {
    await QueryGetAPI(QUESTION_API_URL + 'del', {
      id: id
    })
      .then((data) => {
        if (data.code == 200) {
          message.success('删除成功')
          recieveQuestions.value = recieveQuestions.value.filter(
            (q) => q.id != id
          )
        } else {
          message.error(data.message)
        }
      })
      .catch((err) => {
        message.error('发生错误: ' + err)
      })
  }
  async function GetTags() {
    isLoading.value = true
    await QueryGetAPI<QATagInfo[]>(QUESTION_API_URL + 'get-tags', {
      id: accountInfo.value?.id
    })
      .then((data) => {
        if (data.code == 200) {
          tags.value = data.data
        } else {
          message.error(data.message)
        }
      })
      .catch((err) => {
        message.error('发生错误: ' + err)
      })
      .finally(() => {
        isLoading.value = false
      })
  }
  function getViolationString(violation: ViolationTypes) {
    //SENSITIVE_TERM, HATE, VIOLENCE, PORNOGRAPHY, POLITICS, ADVERTISING, AGGRESSION
    switch (violation) {
      case ViolationTypes.SENSITIVE_TERM:
        return '敏感词'
      case ViolationTypes.HATE:
        return '辱骂'
      case ViolationTypes.VIOLENCE:
        return '暴力'
      case ViolationTypes.PORNOGRAPHY:
        return '色情'
      case ViolationTypes.POLITICS:
        return '政治'
      case ViolationTypes.ADVERTISING:
        return '广告'
      case ViolationTypes.AGGRESSION:
        return '攻击性'
    }
  }
  async function addTag(tag: string) {
    if (!tag) {
      message.warning('请输入标签')
      return
    }
    if (tags.value.find((t) => t.name == tag)) {
      message.warning('标签已存在')
      return
    }
    await QueryGetAPI(QUESTION_API_URL + 'add-tag', {
      tag: tag
    })
      .then((data) => {
        if (data.code == 200) {
          message.success('添加成功')
          GetTags()
        } else {
          message.error('添加失败: ' + data.message)
        }
      })
      .catch((err) => {
        message.error('添加失败: ' + err)
      })
  }
  async function delTag(tag: string) {
    if (!tag) {
      message.warning('请输入标签')
      return
    }
    if (!tags.value.find((t) => t.name == tag)) {
      message.warning('标签不存在')
      return
    }
    await QueryGetAPI(QUESTION_API_URL + 'del-tag', {
      tag: tag
    })
      .then((data) => {
        if (data.code == 200) {
          message.success('删除成功')
          GetTags()
        } else {
          message.error('删除失败: ' + data.message)
        }
      })
      .catch((err) => {
        message.error('删除失败: ' + err)
      })
  }
  async function updateTagVisiable(tag: string, visiable: boolean) {
    if (!tag) {
      message.warning('请输入标签')
      return
    }
    if (!tags.value.find((t) => t.name == tag)) {
      message.warning('标签不存在')
      return
    }
    await QueryGetAPI(QUESTION_API_URL + 'update-tag-visiable', {
      tag: tag,
      visiable: visiable
    })
      .then((data) => {
        if (data.code == 200) {
          message.success('修改成功')
          GetTags()
        } else {
          message.error('修改失败: ' + data.message)
        }
      })
      .catch((err) => {
        message.error('修改失败: ' + err)
      })
  }
  async function reply(id: number, msg: string) {
    isRepling.value = true
    await QueryPostAPI<QAInfo>(QUESTION_API_URL + 'reply', {
      Id: id,
      Message: msg
    })
      .then((data) => {
        if (data.code == 200) {
          const index = recieveQuestions.value.findIndex((q) => q.id == id)
          if (index > -1) {
            recieveQuestions.value[index] = data.data
          }
          message.success('回复成功')
          currentQuestion.value = undefined
          //replyModalVisiable.value = false
        } else {
          message.error('发送失败: ' + data.message)
        }
      })
      .catch((err) => {
        message.error('发送失败: ' + err)
      })
      .finally(() => {
        isRepling.value = false
      })
  }
  async function read(question: QAInfo, read: boolean) {
    await QueryGetAPI(QUESTION_API_URL + 'read', {
      id: question.id,
      read: read ? 'true' : 'false'
    })
      .then((data) => {
        if (data.code == 200) {
          question.isReaded = read
          if (read && displayQuestion.value?.id == question.id) {
            setCurrentQuestion(question) //取消设为当前展示的问题
          }
        } else {
          message.error('修改失败: ' + data.message)
        }
      })
      .catch((err) => {
        message.error('修改失败: ' + err)
      })
  }
  async function favorite(question: QAInfo, fav: boolean) {
    await QueryGetAPI(QUESTION_API_URL + 'favorite', {
      id: question.id,
      favorite: fav
    })
      .then((data) => {
        if (data.code == 200) {
          question.isFavorite = fav
        } else {
          message.error('修改失败: ' + data.message)
        }
      })
      .catch((err) => {
        message.error('修改失败: ' + err)
      })
  }
  async function setPublic(pub: boolean) {
    isChangingPublic.value = true
    await QueryGetAPI(QUESTION_API_URL + 'public', {
      id: currentQuestion.value?.id,
      public: pub
    })
      .then((data) => {
        if (data.code == 200) {
          if (currentQuestion.value) currentQuestion.value.isPublic = pub
          message.success('已修改公开状态')
        } else {
          message.error('修改失败: ' + data.message)
        }
      })
      .catch((err) => {
        message.error('修改失败: ' + err)
      })
      .finally(() => {
        isChangingPublic.value = false
      })
  }
  async function blacklist(question: QAInfo) {
    await QueryGetAPI(ACCOUNT_API_URL + 'black-list/add', {
      id: question.sender.id
    })
      .then(async (data) => {
        if (data.code == 200) {
          await QueryGetAPI(QUESTION_API_URL + 'del', {
            id: question.id
          }).then((data) => {
            if (data.code == 200) {
              message.success('已拉黑 ' + question.sender.name)
            } else {
              message.error('修改失败: ' + data.message)
            }
          })
        } else {
          message.error('拉黑失败: ' + data.message)
        }
      })
      .catch((err) => {
        message.error('拉黑失败: ' + err)
      })
  }
  async function setCurrentQuestion(item: QAInfo | undefined) {
    const isCurrent = displayQuestion.value?.id == item?.id
    if (!isCurrent) {
      displayQuestion.value = item
    } else {
      displayQuestion.value = undefined
    }
    try {
      const data = await QueryGetAPI(
        QUESTION_API_URL + 'set-current',
        isCurrent || !item
          ? null
          : {
              id: item.id
            }
      )
      if (data.code == 200) {
        //message.success('设置成功')
      } else {
        message.error('设置失败: ' + data.message)
      }
    } catch (err) {
      message.error('设置失败:' + err)
    }
  }

  return {
    currentQuestion,
    isLoading,
    isRevieveGetted,
    isRepling,
    isChangingPublic,
    recieveQuestions,
    recieveQuestionsFiltered,
    sendQuestions,
    trashQuestions,
    reviewing,
    tags,
    onlyFavorite,
    onlyPublic,
    onlyUnread,
    displayQuestion,
    displayTag,
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
    setCurrentQuestion,
    getViolationString
  }
})
