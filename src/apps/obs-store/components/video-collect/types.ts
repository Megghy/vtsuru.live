import { DuplicateVideoPolicy, VideoFrom, VideoStatus } from '@/api/generated/model'
import type { ReponseVideoCollectVideo, ResponseVideoCollectModel } from '@/api/generated/model'
import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'
import { formatVideoDuration, normalizeBiliCoverUrl } from '@/shared/utils/videoCollect'

export { formatVideoDuration, normalizeBiliCoverUrl }

export type VideoCollectMode = 'watch' | 'summary' | 'manual'

export interface VideoCollectState {
  mode: VideoCollectMode
  selectedTableId: string
  currentIndex: number
  currentBvid: string
  badgeLabel: string
  showMessage: boolean
  showUpName: boolean
  theme: ObsWidgetTheme
  accentColor: string
  fontFamily: string
  useSampleData: boolean
  manualTitle: string
  manualSender: string
  manualUpName: string
  manualMessage: string
  manualCover: string
  manualIndexLabel: string
  manualDuration: string
}

export type VideoCollectAction = { type: 'REFRESH' }

export const VIDEO_COLLECT_MODE_OPTIONS: { label: string; value: VideoCollectMode }[] = [
  { label: '茶话会鉴赏', value: 'watch' },
  { label: '征集进度', value: 'summary' },
  { label: '手动编辑', value: 'manual' },
]

export const DEFAULT_VIDEO_COLLECT_STATE: VideoCollectState = {
  mode: 'watch',
  selectedTableId: '',
  currentIndex: 0,
  currentBvid: '',
  badgeLabel: '正在鉴赏',
  showMessage: true,
  showUpName: true,
  theme: 'card',
  accentColor: '#ec4899',
  fontFamily: '',
  useSampleData: false,
  manualTitle: '【手书】主播一周年高能名场面混剪',
  manualSender: '茶话会课代表',
  manualUpName: '剪辑小能手',
  manualMessage: '从头笑到尾，强烈建议开声音一起看！',
  manualCover: '',
  manualIndexLabel: '1 / 12',
  manualDuration: '03:42',
}

export function createSampleVideoCollectTable(nowMs = Date.now()): ResponseVideoCollectModel {
  return {
    id: 'sample-table',
    shortId: 'sample',
    owner: {
      id: 0,
      name: '示例主播',
      isBiliAuthed: true,
    },
    name: '周末茶话会 · 沙雕二创视频征集',
    description: '欢迎投递鬼畜、手书、名场面切片，周末直播间一起看！',
    createAt: nowMs - 2 * 24 * 3600_000,
    startAt: nowMs - 24 * 3600_000,
    endAt: nowMs + 32 * 3600_000 + 18 * 60_000,
    videoCount: 18,
    maxVideoCount: 50,
    minVideoDuration: 10,
    maxVideoDuration: 600,
    allowedPartitions: [],
    allowUnregisteredUser: true,
    maxVideoPerUser: 3,
    requireDescription: false,
    duplicatePolicy: DuplicateVideoPolicy.MergeRecommendations,
    isFinish: false,
  }
}

export function createSampleVideoCollectItems(nowMs = Date.now()): ReponseVideoCollectVideo[] {
  return [
    {
      info: {
        bvid: 'BV1Sample0001',
        status: VideoStatus.Accepted,
        senders: [
          {
            sendAt: nowMs - 3600_000,
            from: VideoFrom.Collect,
            sender: '星尘观测者',
            senderId: 1001,
            description: '这段翻车名场面我反复看了十遍，必须放茶话会！',
          },
        ],
      },
      video: {
        title: '【高能切片】当主播自信立下 Flag 的三秒后发生了什么',
        description: '经典回放合集',
        publistTime: Math.floor((nowMs - 86400_000) / 1000),
        ownerName: '烤肉曼一号机',
        ownerUId: 10001,
        cover: '',
        length: 222,
        partitionId: 17,
        partitionName: '单机游戏',
        id: 'sample-v1',
        createTime: '',
        updateTime: '',
        isDeleted: false,
        sort: 1,
      },
    },
    {
      info: {
        bvid: 'BV1Sample0002',
        status: VideoStatus.Accepted,
        senders: [
          {
            sendAt: nowMs - 1800_000,
            from: VideoFrom.Collect,
            sender: '柚子茶加冰',
            senderId: 1002,
            description: '手绘动画肝了两周，祝一周年快乐！',
          },
        ],
      },
      video: {
        title: '【纪念手书】星光与晚风 · 直播一周年特别企划',
        description: '一周年手书',
        publistTime: Math.floor((nowMs - 43200_000) / 1000),
        ownerName: '摸鱼画师阿柚',
        ownerUId: 10002,
        cover: '',
        length: 195,
        partitionId: 25,
        partitionName: 'MMD·3D',
        id: 'sample-v2',
        createTime: '',
        updateTime: '',
        isDeleted: false,
        sort: 2,
      },
    },
    {
      info: {
        bvid: 'BV1Sample0003',
        status: VideoStatus.Accepted,
        senders: [
          {
            sendAt: nowMs - 900_000,
            from: VideoFrom.Collect,
            sender: '夜航船长',
            senderId: 1003,
            description: '深夜听歌回混音版，太治愈了',
          },
        ],
      },
      video: {
        title: '【歌回精选】原声吉他弹唱串烧 · 晚安合集',
        description: '歌回剪辑',
        publistTime: Math.floor((nowMs - 21600_000) / 1000),
        ownerName: '音频调音师小夜',
        ownerUId: 10003,
        cover: '',
        length: 314,
        partitionId: 31,
        partitionName: '翻唱',
        id: 'sample-v3',
        createTime: '',
        updateTime: '',
        isDeleted: false,
        sort: 3,
      },
    },
  ]
}
