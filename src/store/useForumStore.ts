import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider'
import type {
  ForumCommentModel,
  ForumCommentSortTypes,
  ForumModel,
  ForumPostTopicModel,
  ForumReplyModel,
  ForumTopicBaseModel,
  ForumTopicModel,
  ForumTopicSortTypes,
} from '@/api/models/forum'
import { createDiscreteApi } from 'naive-ui'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { QueryGetAPI, QueryGetPaginationAPI, QueryPostAPI } from '@/api/query'
import { FORUM_API_URL } from '@/shared/config'

export const useForumStore = defineStore('forum', () => {
  const { message } = createDiscreteApi(['message'])

  const isLoading = ref(false)
  const isLikeLoading = ref(false)

  const replyingComment = ref<ForumCommentModel>()
  const replyingReply = ref<ForumReplyModel>()
  const showReplyModal = ref(false)

  async function GetForumInfo(owner: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI<ForumModel>(`${FORUM_API_URL}get-forum`, { owner })
      if (data.code == 200) {
        return data.data
      } else if (data.code != 404) {
        message?.error(`无法获取数据: ${data.message}`)
        return undefined
      }
    } catch (err) {
      message?.error(`无法获取数据: ${err}`)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function GetManagedForums() {
    try {
      isLoading.value = true
      const data = await QueryGetAPI<ForumModel[]>(`${FORUM_API_URL}get-managed-forums`)
      if (data.code == 200) {
        return data.data
      } else {
        message?.error(`无法获取数据: ${data.message}`)
        return undefined
      }
    } catch (err) {
      message?.error(`无法获取数据: ${err}`)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function GetTopics(
    owner: number,
    pn: number,
    ps: number,
    sort: ForumTopicSortTypes,
    section?: number,
    message?: MessageApiInjection,
  ) {
    try {
      isLoading.value = true
      const data = await QueryGetPaginationAPI<ForumTopicBaseModel[]>(`${FORUM_API_URL}get-topics`, {
        owner,
        pageSize: ps,
        page: pn,
        sort,
        section,
      })
      if (data.code == 200) {
        return {
          data: data.data,
          total: data.total,
          more: data.more,
        }
      } else {
        message?.error(`无法获取数据: ${data.message}`)
        console.error(`无法获取数据: ${data.message}`)
        return undefined
      }
    } catch (err) {
      message?.error(`无法获取数据: ${err}`)
      console.error(`无法获取数据: ${err}`)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function GetTopicDetail(topic: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI<ForumTopicModel>(`${FORUM_API_URL}get-topic`, { topic })
      if (data.code == 200) {
        return data.data
      } else {
        message?.error(`无法获取数据: ${data.message}`)
        console.error(`无法获取数据: ${data.message}`)
        return undefined
      }
    } catch (err) {
      message?.error(`无法获取数据: ${err}`)
      console.error(`无法获取数据: ${err}`)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function GetComments(topic: number, pn: number, ps: number, sort: ForumCommentSortTypes) {
    try {
      isLoading.value = true
      const data = await QueryGetPaginationAPI<ForumCommentModel[]>(`${FORUM_API_URL}get-comments`, {
        topic,
        pageSize: ps,
        page: pn,
        sort,
      })
      if (data.code == 200) {
        return data
      } else {
        console.error(`无法获取数据: ${data.message}`)
        message?.error(`无法获取数据: ${data.message}`)
        return undefined
      }
    } catch (err) {
      console.error(`无法获取数据: ${err}`)
      message?.error(`无法获取数据: ${err}`)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function ApplyToForum(owner: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI<ForumModel>(`${FORUM_API_URL}apply`, { owner })
      if (data.code == 200) {
        message?.success('已提交申请, 等待管理员审核')
        return true
      } else {
        message?.error(`无法获取数据: ${data.message}`)
        console.error(`无法获取数据: ${data.message}`)
        return false
      }
    } catch (err) {
      message?.error(`无法获取数据: ${err}`)
      console.error(`无法获取数据: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function PostTopic(topic: ForumPostTopicModel, token: string) {
    try {
      isLoading.value = true
      const data = await QueryPostAPI<ForumTopicModel>(`${FORUM_API_URL}post-topic`, topic, [['Turnstile', token]])
      if (data.code == 200) {
        message?.success('发布成功')
        return data.data
      } else {
        message?.error(`发布失败: ${data.message}`)
        console.error(`发布失败: ${data.message}`)
        return undefined
      }
    } catch (err) {
      message?.error(`发布失败: ${err}`)
      console.error(`发布失败: ${err}`)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function PostComment(model: { topic: number, content: string }, token: string) {
    try {
      isLoading.value = true
      const data = await QueryPostAPI<ForumCommentModel>(`${FORUM_API_URL}post-comment`, model, [['Turnstile', token]])
      if (data.code == 200) {
        message?.success('评论成功')
        return data.data
      } else {
        message?.error(`评论失败: ${data.message}`)
        console.error(`评论失败: ${data.message}`)
        return undefined
      }
    } catch (err) {
      message?.error(`评论失败: ${err}`)
      console.error(`评论失败: ${err}`)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function PostReply(model: { comment: number, content: string, replyTo?: number }, token: string) {
    try {
      isLoading.value = true
      const data = await QueryPostAPI<ForumCommentModel>(`${FORUM_API_URL}post-reply`, model, [['Turnstile', token]])
      if (data.code == 200) {
        message?.success('评论成功')
        return data.data
      } else {
        message?.error(`评论失败: ${data.message}`)
        console.error(`评论失败: ${data.message}`)
        return undefined
      }
    } catch (err) {
      message?.error(`评论失败: ${err}`)
      console.error(`评论失败: ${err}`)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function LikeTopic(topic: number, like: boolean) {
    try {
      isLikeLoading.value = true
      const data = await QueryGetAPI(`${FORUM_API_URL}like-topic`, { topic, like })
      if (data.code == 200) {
        // message?.success('已点赞')
        return true
      } else {
        message?.error(`点赞失败: ${data.message}`)
        console.error(`点赞失败: ${data.message}`)
        return false
      }
    } catch (err) {
      message?.error(`点赞失败: ${err}`)
      console.error(`点赞失败: ${err}`)
      return false
    } finally {
      isLikeLoading.value = false
    }
  }
  async function LikeComment(comment: number, like: boolean) {
    try {
      isLikeLoading.value = true
      const data = await QueryGetAPI(`${FORUM_API_URL}like-comment`, { comment, like })
      if (data.code == 200) {
        // message?.success('已点赞')
        return true
      } else {
        message?.error(`点赞失败: ${data.message}`)
        console.error(`点赞失败: ${data.message}`)
        return false
      }
    } catch (err) {
      message?.error(`点赞失败: ${err}`)
      console.error(`点赞失败: ${err}`)
      return false
    } finally {
      isLikeLoading.value = false
    }
  }
  async function SetReplyingComment(
    comment: ForumCommentModel | undefined = undefined,
    reply: ForumReplyModel | undefined = undefined,
  ) {
    if (!comment) {
      replyingComment.value = undefined
      replyingReply.value = undefined
      showReplyModal.value = false
      return
    }
    replyingComment.value = comment
    replyingReply.value = reply
    showReplyModal.value = true
  }

  async function SetTopicTop(topic: number, top: boolean) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI(`${FORUM_API_URL}manage/set-topic-top`, { topic, top })
      if (data.code == 200) {
        message?.success('完成')
        return true
      } else {
        message?.error(`操作失败: ${data.message}`)
        console.error(`操作失败: ${data.message}`)
        return false
      }
    } catch (err) {
      message?.error(`操作失败: ${err}`)
      console.error(`操作失败: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
  }
  async function DelTopic(topic: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI(`${FORUM_API_URL}manage/delete-topic`, { topic })
      if (data.code == 200) {
        message?.success('删除成功')
        return true
      } else {
        message?.error(`删除失败: ${data.message}`)
        console.error(`删除失败: ${data.message}`)
        return false
      }
    } catch (err) {
      message?.error(`删除失败: ${err}`)
      console.error(`删除失败: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
  }
  async function DelComment(comment: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI(`${FORUM_API_URL}delete-comment`, { comment })
      if (data.code == 200) {
        message?.success('删除成功')
        return true
      } else {
        message?.error(`删除失败: ${data.message}`)
        console.error(`删除失败: ${data.message}`)
        return false
      }
    } catch (err) {
      message?.error(`删除失败: ${err}`)
      console.error(`删除失败: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
  }
  async function DelReply(reply: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI(`${FORUM_API_URL}manage/delete-reply`, { reply })
      if (data.code == 200) {
        message?.success('删除成功')
        return true
      } else {
        message?.error(`删除失败: ${data.message}`)
        console.error(`删除失败: ${data.message}`)
        return false
      }
    } catch (err) {
      message?.error(`删除失败: ${err}`)
      console.error(`删除失败: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
  }
  async function RestoreComment(comment: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI(`${FORUM_API_URL}manage/restore-comment`, { comment })
      if (data.code == 200) {
        message?.success('恢复成功')
        return true
      } else {
        message?.error(`恢复失败: ${data.message}`)
        console.error(`恢复失败: ${data.message}`)
        return false
      }
    } catch (err) {
      message?.error(`恢复失败: ${err}`)
      console.error(`恢复失败: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
  }
  async function RestoreTopic(topic: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI(`${FORUM_API_URL}manage/restore-topic`, { topic })
      if (data.code == 200) {
        message?.success('恢复成功')
        return true
      } else {
        message?.error(`恢复失败: ${data.message}`)
        console.error(`恢复失败: ${data.message}`)
        return false
      }
    } catch (err) {
      message?.error(`恢复失败: ${err}`)
      console.error(`恢复失败: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
  }
  async function ConfirmApply(owner: number, id: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI(`${FORUM_API_URL}manage/confirm-apply`, { forum: owner, id })
      if (data.code == 200) {
        message?.success('已通过申请')
        return true
      } else {
        message?.error(`确认失败: ${data.message}`)
        console.error(`确认失败: ${data.message}`)
        return false
      }
    } catch (err) {
      message?.error(`确认失败: ${err}`)
      console.error(`确认失败: ${err}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    GetForumInfo,
    GetManagedForums,
    GetTopics,
    GetTopicDetail,
    GetComments,
    ApplyToForum,
    PostTopic,
    PostComment,
    PostReply,
    LikeTopic,
    LikeComment,
    SetReplyingComment,
    SetTopicTop,
    DelTopic,
    DelComment,
    DelReply,
    ConfirmApply,
    RestoreComment,
    RestoreTopic,
    isLoading,
    isLikeLoading,
    replyingComment,
    replyingReply,
    showReplyModal,
  }
})
