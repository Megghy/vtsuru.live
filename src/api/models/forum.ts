import { UserBasicInfo } from '../api-models'

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

export interface ForumSetting {
  allowedViewerLevel: ForumUserLevels // Assuming the default value is handled elsewhere
  allowPost: boolean // Assuming the default value is handled elsewhere
  allowedPostLevel: ForumUserLevels // Assuming the default value is handled elsewhere
  requireApply: boolean // Assuming the default value is handled elsewhere
  requireAuthedToJoin: boolean // Assuming the default value is handled elsewhere
  sendTopicDelay: number // Assuming the default value is handled elsewhere
}
export interface ForumUserModel extends UserBasicInfo {
 isAdmin: boolean
}
export type ForumModel = {
  id: number
  name: string
  owner: ForumUserModel
  description: string
  topicCount: number

  settings: ForumSetting

  admins: ForumUserModel[]
  members: ForumUserModel[]
  applying: ForumUserModel[]
  blackList: ForumUserModel[]

  level: ForumUserLevels
  isApplied: boolean

  sections: ForumSectionModel[]
  createAt: number

  isAdmin: boolean
  isMember: boolean
}
export type ForumSectionModel = {
  id: number
  name: string
  description: string
  createAt: number
}
export enum ForumTopicTypes {
  Default,
  Vote,
}
export type ForumTopicSetting = {
  canReply?: boolean
}
export interface ForumTopicBaseModel {
  id: number // Primary and identity fields in C# typically correspond to required fields in TS
  user: UserBasicInfo
  section: ForumSectionModel
  title: string
  content: string

  latestRepliedBy?: UserBasicInfo
  repliedAt?: number

  likeCount: number // Assuming the default value is handled elsewhere
  commentCount: number // Assuming the default value is handled elsewhere
  viewCount: number // Assuming the default value is handled elsewhere
  sampleLikedBy: number[]

  createAt: Date // DateTime in C# translates to Date in TS
  editAt?: Date | null // Nullable DateTime in C# is optional or null in TS

  isLiked: boolean
  isLocked?: boolean // Assuming the default value is handled elsewhere
  isPinned?: boolean // Assuming the default value is handled elsewhere
  isHighlighted?: boolean // Assuming the default value is handled elsewhere
  isDeleted?: boolean // Assuming the default value is handled elsewhere
}
export interface ForumTopicModel extends ForumTopicBaseModel {
  isLocked?: boolean // Assuming the default value is handled elsewhere

  isHidden?: boolean // Assuming the default value is handled elsewhere

  type?: ForumTopicTypes // Assuming the default value is handled elsewhere
  extraTypeId?: number | null // Nullable int in C# is optional or null in TS
  likedBy?: number[] // Assuming the default value is handled elsewhere

  isAdmin: boolean
}
export interface ForumCommentModel {
  id: number
  user: UserBasicInfo
  content: string
  replies: ForumReplyModel[]
  sendAt: Date

  likeCount: number
  isLiked: boolean

  isDeleted: boolean
}
export interface ForumReplyModel {
  id: number
  user: UserBasicInfo
  content: string
  replyTo?: number
  sendAt: Date
}
export interface ForumPostTopicModel {
  section?: number
  title: string
  content: string
  owner: number
  type?: ForumTopicTypes
}
