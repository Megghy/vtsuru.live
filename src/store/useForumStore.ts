
import { defineStore } from 'pinia'
import { ref } from 'vue'

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
import type { APIRoot, PaginationResponse } from '@/api/api-models'
import {
  getApiForumGetComments,
  getApiForumGetForum,
  getApiForumGetManagedForums,
  getApiForumGetTopic,
  getApiForumGetTopics,
  postApiForumApply,
  postApiForumLikeComment,
  postApiForumLikeTopic,
  postApiForumManageConfirmApply,
  postApiForumManageDeleteComment,
  postApiForumManageDeleteReply,
  postApiForumManageDeleteTopic,
  postApiForumManageRestoreComment,
  postApiForumManageRestoreTopic,
  postApiForumManageSetTopicTop,
  postApiForumPostComment,
  postApiForumPostReply,
  postApiForumPostTopic,
} from '@/api/generated/forum/forum'
import { requestWithCaptchaRetry } from '@/shared/captcha'
import { createNaiveUIApi } from '@/shared/utils'

export const useForumStore = defineStore('forum', () => {
  const { message } = createNaiveUIApi(['message'])

  const isLoading = ref(false)
  const isLikeLoading = ref(false)

  const replyingComment = ref<ForumCommentModel>()
  const replyingReply = ref<ForumReplyModel>()
  const showReplyModal = ref(false)

  async function GetForumInfo(owner: number) {
    try {
      isLoading.value = true
      const data = await getApiForumGetForum({ owner: String(owner) })
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
      const data = await getApiForumGetManagedForums()
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
    messageApi?: any,
  ) {
    try {
      isLoading.value = true
      const data = await getApiForumGetTopics({
        owner: String(owner),
        pageSize: ps,
        page: pn,
        sort: sort as any,
        section,
      })
      if (data.code == 200) {
        return {
          data: data.data,
          total: data.total,
          more: data.more,
        }
      } else {
        messageApi?.error(`无法获取数据: ${data.message}`)
        console.error(`无法获取数据: ${data.message}`)
        return undefined
      }
    } catch (err) {
      messageApi?.error(`无法获取数据: ${err}`)
      console.error(`无法获取数据: ${err}`)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  async function GetTopicDetail(topic: number) {
    try {
      isLoading.value = true
      const data = await getApiForumGetTopic({ topic })
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
      const data = await getApiForumGetComments({
        topic,
        pageSize: ps,
        page: pn,
        sort: sort as any,
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
      const data = await postApiForumApply({ owner })
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

  async function postWithCaptcha<T>(
    request: (token: string) => Promise<{ code: number; message?: string; data: T }>,
    token: string,
    refresh: (() => Promise<string>) | undefined,
    successText: string,
    failText: string,
  ) {
    try {
      isLoading.value = true
      const data = await requestWithCaptchaRetry({
        getToken: () => token,
        refresh,
        request,
      })
      if (data.code == 200) {
        message?.success(successText)
        return data.data
      }
      message?.error(`${failText}: ${data.message}`)
      console.error(`${failText}: ${data.message}`)
      return undefined
    } catch (err) {
      message?.error(`${failText}: ${err}`)
      console.error(`${failText}: ${err}`)
      return undefined
    } finally {
      isLoading.value = false
    }
  }
  function PostTopic(topic: ForumPostTopicModel, token: string, refresh?: () => Promise<string>) {
    return postWithCaptcha(
      (captchaToken) =>
        postApiForumPostTopic(topic as any, {
          headers: { Turnstile: captchaToken },
        }),
      token,
      refresh,
      '发布成功',
      '发布失败',
    )
  }
  function PostComment(
    model: { topic: number; content: string },
    token: string,
    refresh?: () => Promise<string>,
  ) {
    return postWithCaptcha(
      (captchaToken) =>
        postApiForumPostComment(model, {
          headers: { Turnstile: captchaToken },
        }),
      token,
      refresh,
      '评论成功',
      '评论失败',
    )
  }
  function PostReply(
    model: { comment: number; content: string; replyTo?: number },
    token: string,
    refresh?: () => Promise<string>,
  ) {
    return postWithCaptcha(
      (captchaToken) =>
        postApiForumPostReply(model, {
          headers: { Turnstile: captchaToken },
        }),
      token,
      refresh,
      '评论成功',
      '评论失败',
    )
  }
  async function LikeTopic(topic: number, like: boolean) {
    try {
      isLikeLoading.value = true
      const data = await postApiForumLikeTopic({ topic, like })
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
      const data = await postApiForumLikeComment({ comment, like })
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
      const data = await postApiForumManageSetTopicTop({ topic, top })
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
      const data = await postApiForumManageDeleteTopic({ topic })
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
      const data = await postApiForumManageDeleteComment({ comment })
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
      const data = await postApiForumManageDeleteReply({ reply })
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
      const data = await postApiForumManageRestoreComment({ comment })
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
      const data = await postApiForumManageRestoreTopic({ topic })
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
      const data = await postApiForumManageConfirmApply({ forum: owner, id })
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
