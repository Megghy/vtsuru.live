import type { ForumControllerRequestPostTopic } from '../generated/model/forumControllerRequestPostTopic'
import type { ForumForumDataForumSetting } from '../generated/model/forumForumDataForumSetting'
import type { ForumForumSectionData } from '../generated/model/forumForumSectionData'
import type { ForumUserInfo } from '../generated/model/forumUserInfo'
import type { ResponseForumCommentBaseModel } from '../generated/model/responseForumCommentBaseModel'
import type { ResponseForumCommentReplyBaseModel } from '../generated/model/responseForumCommentReplyBaseModel'
import type { ResponseForumModel } from '../generated/model/responseForumModel'
import type { ResponseForumTopicModel } from '../generated/model/responseForumTopicModel'
import type { ResponseForumTopicSimpleModel } from '../generated/model/responseForumTopicSimpleModel'

export enum ForumTopicSortTypes {
  Time,
  Comment,
  Like,
}
export enum ForumCommentSortTypes {
  Time,
  Like,
}
export enum ForumUserLevels {
  Guest,
  User,
  Member,
  AuthedMember,
  Admin,
}
export enum ForumTopicTypes {
  Default,
  Vote,
}

export type ForumSetting = ForumForumDataForumSetting
export type ForumUserModel = ForumUserInfo
export type ForumModel = ResponseForumModel
export type ForumSectionModel = ForumForumSectionData
export type ForumTopicBaseModel = ResponseForumTopicSimpleModel
export type ForumTopicModel = ResponseForumTopicModel & { isLocked?: boolean }
export type ForumCommentModel = ResponseForumCommentBaseModel & { isDeleted?: boolean }
export type ForumReplyModel = ResponseForumCommentReplyBaseModel
export type ForumPostTopicModel = ForumControllerRequestPostTopic
export type ForumTopicSetting = { canReply?: boolean }
