import {
  ForumCommentModel,
  ForumCommentSortTypes,
  ForumModel,
  ForumPostTopicModel,
  ForumReplyModel,
  ForumTopicBaseModel,
  ForumTopicModel,
  ForumTopicSortTypes,
} from '@/api/models/forum'
import { QueryGetAPI, QueryGetPaginationAPI, QueryPostAPI } from '@/api/query'
import { FORUM_API_URL } from '@/data/constants'
import { createDiscreteApi } from 'naive-ui'
import { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider'
import { defineStore } from 'pinia'
import { ref } from 'vue'

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
      const data = await QueryGetAPI<ForumModel>(FORUM_API_URL + 'get-forum', { owner: owner })
      if (data.code == 200) {
        return data.data
      } else if (data.code != 404) {
        message?.error('无法获取数据: ' + data.message)
        return undefined
      }
    } catch (err) {
      message?.error('无法获取数据: ' + err)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function GetManagedForums() {
    try {
      isLoading.value = true
      const data = await QueryGetAPI<ForumModel[]>(FORUM_API_URL + 'get-managed-forums')
      if (data.code == 200) {
        return data.data
      } else {
        message?.error('无法获取数据: ' + data.message)
        return undefined
      }
    } catch (err) {
      message?.error('无法获取数据: ' + err)
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
      const data = await QueryGetPaginationAPI<ForumTopicBaseModel[]>(FORUM_API_URL + 'get-topics', {
        owner,
        pageSize: ps,
        page: pn,
        sort,
        section: section,
      })
      if (data.code == 200) {
        return {
          data: data.data,
          total: data.total,
          more: data.more,
        }
      } else {
        message?.error('无法获取数据: ' + data.message)
        console.error('无法获取数据: ' + data.message)
        return undefined
      }
    } catch (err) {
      message?.error('无法获取数据: ' + err)
      console.error('无法获取数据: ' + err)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function GetTopicDetail(topic: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI<ForumTopicModel>(FORUM_API_URL + 'get-topic', { topic: topic })
      if (data.code == 200) {
        return data.data
      } else {
        message?.error('无法获取数据: ' + data.message)
        console.error('无法获取数据: ' + data.message)
        return undefined
      }
    } catch (err) {
      message?.error('无法获取数据: ' + err)
      console.error('无法获取数据: ' + err)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function GetComments(topic: number, pn: number, ps: number, sort: ForumCommentSortTypes) {
    try {
      isLoading.value = true
      const data = await QueryGetPaginationAPI<ForumCommentModel[]>(FORUM_API_URL + 'get-comments', {
        topic,
        pageSize: ps,
        page: pn,
        sort,
      })
      if (data.code == 200) {
        return data.data
      } else {
        console.error('无法获取数据: ' + data.message)
        message?.error('无法获取数据: ' + data.message)
        return undefined
      }
    } catch (err) {
      console.error('无法获取数据: ' + err)
      message?.error('无法获取数据: ' + err)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function ApplyToForum(owner: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI<ForumModel>(FORUM_API_URL + 'apply', { owner: owner })
      if (data.code == 200) {
        message?.success('已提交申请, 等待管理员审核')
        return true
      } else {
        message?.error('无法获取数据: ' + data.message)
        console.error('无法获取数据: ' + data.message)
        return false
      }
    } catch (err) {
      message?.error('无法获取数据: ' + err)
      console.error('无法获取数据: ' + err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function PostTopic(topic: ForumPostTopicModel, token: string) {
    try {
      isLoading.value = true
      const data = await QueryPostAPI<ForumTopicModel>(FORUM_API_URL + 'post-topic', topic, [['Turnstile', token]])
      if (data.code == 200) {
        message?.success('发布成功')
        return data.data
      } else {
        message?.error('发布失败: ' + data.message)
        console.error('发布失败: ' + data.message)
        return undefined
      }
    } catch (err) {
      message?.error('发布失败: ' + err)
      console.error('发布失败: ' + err)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function PostComment(model: { topic: number; content: string }, token: string) {
    try {
      isLoading.value = true
      const data = await QueryPostAPI<ForumCommentModel>(FORUM_API_URL + 'post-comment', model, [['Turnstile', token]])
      if (data.code == 200) {
        message?.success('评论成功')
        return data.data
      } else {
        message?.error('评论失败: ' + data.message)
        console.error('评论失败: ' + data.message)
        return undefined
      }
    } catch (err) {
      message?.error('评论失败: ' + err)
      console.error('评论失败: ' + err)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function PostReply(model: { comment: number; content: string; replyTo?: number }, token: string) {
    try {
      isLoading.value = true
      const data = await QueryPostAPI<ForumCommentModel>(FORUM_API_URL + 'post-reply', model, [['Turnstile', token]])
      if (data.code == 200) {
        message?.success('评论成功')
        return data.data
      } else {
        message?.error('评论失败: ' + data.message)
        console.error('评论失败: ' + data.message)
        return undefined
      }
    } catch (err) {
      message?.error('评论失败: ' + err)
      console.error('评论失败: ' + err)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function LikeTopic(topic: number, like: boolean) {
    try {
      isLikeLoading.value = true
      const data = await QueryGetAPI(FORUM_API_URL + 'like-topic', { topic: topic, like: like })
      if (data.code == 200) {
        //message?.success('已点赞')
        return true
      } else {
        message?.error('点赞失败: ' + data.message)
        console.error('点赞失败: ' + data.message)
        return false
      }
    } catch (err) {
      message?.error('点赞失败: ' + err)
      console.error('点赞失败: ' + err)
      return false
    } finally {
      isLikeLoading.value = false
    }
  }
  async function LikeComment(comment: number, like: boolean) {
    try {
      isLikeLoading.value = true
      const data = await QueryGetAPI(FORUM_API_URL + 'like-comment', { comment: comment, like: like })
      if (data.code == 200) {
        //message?.success('已点赞')
        return true
      } else {
        message?.error('点赞失败: ' + data.message)
        console.error('点赞失败: ' + data.message)
        return false
      }
    } catch (err) {
      message?.error('点赞失败: ' + err)
      console.error('点赞失败: ' + err)
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
      const data = await QueryGetAPI(FORUM_API_URL + 'manage/set-topic-top', { topic: topic, top: top })
      if (data.code == 200) {
        message?.success('完成')
        return true
      } else {
        message?.error('操作失败: ' + data.message)
        console.error('操作失败: ' + data.message)
        return false
      }
    } catch (err) {
      message?.error('操作失败: ' + err)
      console.error('操作失败: ' + err)
      return false
    } finally {
      isLoading.value = false
    }
  }
  async function DelTopic(topic: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI(FORUM_API_URL + 'manage/delete-topic', { topic: topic })
      if (data.code == 200) {
        message?.success('删除成功')
        return true
      } else {
        message?.error('删除失败: ' + data.message)
        console.error('删除失败: ' + data.message)
        return false
      }
    } catch (err) {
      message?.error('删除失败: ' + err)
      console.error('删除失败: ' + err)
      return false
    } finally {
      isLoading.value = false
    }
  }
  async function DelComment(comment: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI(FORUM_API_URL + 'manage/delete-comment', { comment: comment })
      if (data.code == 200) {
        message?.success('删除成功')
        return true
      } else {
        message?.error('删除失败: ' + data.message)
        console.error('删除失败: ' + data.message)
        return false
      }
    } catch (err) {
      message?.error('删除失败: ' + err)
      console.error('删除失败: ' + err)
      return false
    } finally {
      isLoading.value = false
    }
  }
  async function DelReply(reply: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI(FORUM_API_URL + 'manage/delete-reply', { reply: reply })
      if (data.code == 200) {
        message?.success('删除成功')
        return true
      } else {
        message?.error('删除失败: ' + data.message)
        console.error('删除失败: ' + data.message)
        return false
      }
    } catch (err) {
      message?.error('删除失败: ' + err)
      console.error('删除失败: ' + err)
      return false
    } finally {
      isLoading.value = false
    }
  }
  async function ConfirmApply(owner: number, id: number) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI(FORUM_API_URL + 'manage/confirm-apply', { owner: owner, id: id })
      if (data.code == 200) {
        message?.success('已通过申请')
        return true
      } else {
        message?.error('确认失败: ' + data.message)
        console.error('确认失败: ' + data.message)
        return false
      }
    } catch (err) {
      message?.error('确认失败: ' + err)
      console.error('确认失败: ' + err)
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
    isLoading,
    isLikeLoading,
    replyingComment,
    replyingReply,
    showReplyModal,
  }
})
