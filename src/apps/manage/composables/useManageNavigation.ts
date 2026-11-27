import Board24Regular from '@vicons/fluent/es/Board24Regular'
import BookCoins20Filled from '@vicons/fluent/es/BookCoins20Filled'
import Bot24Regular from '@vicons/fluent/es/Bot24Regular'
import CalendarClock24Filled from '@vicons/fluent/es/CalendarClock24Filled'
import History24Regular from '@vicons/fluent/es/History24Regular'
import Live24Filled from '@vicons/fluent/es/Live24Filled'
import Lottery24Filled from '@vicons/fluent/es/Lottery24Filled'
import PeopleQueue24Filled from '@vicons/fluent/es/PeopleQueue24Filled'
import Receipt24Regular from '@vicons/fluent/es/Receipt24Regular'
import Settings24Regular from '@vicons/fluent/es/Settings24Regular'
import StoreMicrosoft24Regular from '@vicons/fluent/es/StoreMicrosoft24Regular'
import TabletSpeaker24Filled from '@vicons/fluent/es/TabletSpeaker24Filled'
import VehicleShip24Filled from '@vicons/fluent/es/VehicleShip24Filled'
import VideoAdd20Filled from '@vicons/fluent/es/VideoAdd20Filled'
import AnalyticsSharp from '@vicons/ionicons5/es/AnalyticsSharp'
import Chatbox from '@vicons/ionicons5/es/Chatbox'
import ChatbubbleEllipsesOutline from '@vicons/ionicons5/es/ChatbubbleEllipsesOutline'
import ColorPaletteOutline from '@vicons/ionicons5/es/ColorPaletteOutline'
import Eye from '@vicons/ionicons5/es/Eye'
import GridOutline from '@vicons/ionicons5/es/GridOutline'
import MusicalNote from '@vicons/ionicons5/es/MusicalNote'
import MusicalNotesOutline from '@vicons/ionicons5/es/MusicalNotesOutline'
import PlayCircleOutline from '@vicons/ionicons5/es/PlayCircleOutline'
import StatsChartOutline from '@vicons/ionicons5/es/StatsChartOutline'
import {
  Clapperboard,
  History,
  ListMusic,
  MessageSquareHeart,
  Receipt,
  Settings,
  Users,
  Wallet,
} from 'lucide-vue-next'
import { computed, type Component, type Ref } from 'vue'

import type { ResponseAccountInfo } from '@/api/generated/model'
import { usePersistedStorage } from '@/shared/storage/persist'

export type UserNavGroupId = 'user-assets' | 'user-activity' | 'user-account'
export type ManageNavGroupId = 'favorites' | 'user' | UserNavGroupId | 'common' | 'data' | 'tools' | 'danmaku'
export type ManageNavGroupKey = `group-${ManageNavGroupId}`
export type StreamerNavGroupId = Exclude<ManageNavGroupId, 'favorites' | 'user' | UserNavGroupId>

export interface ManageNavItem {
  key: string
  label: string
  description?: string
  icon: Component
  to?: { name: string; query?: Record<string, string> }
  disabled?: boolean
  disabledReason?: string
  group: Exclude<ManageNavGroupId, 'favorites'>
  accent?: 'brand'
  /** 已在侧边栏顶部拥有独立入口（如主页装修），不重复列在侧边栏分组列表中 */
  hideInSiderList?: boolean
}

export type QuickAccessSource = 'favorite' | 'recent' | 'recommended'

export interface ManageQuickAccessEntry {
  item: ManageNavItem
  source: QuickAccessSource
}

export const STREAMER_NAV_GROUP_LABELS: Record<StreamerNavGroupId, string> = {
  common: '常用',
  data: '数据',
  tools: '互动与工具',
  danmaku: '弹幕相关',
}

export const STREAMER_NAV_GROUP_ORDER: StreamerNavGroupId[] = ['common', 'data', 'tools', 'danmaku']

const QUICK_ACCESS_TARGET_COUNT = 8
const MAX_RECENT_ITEMS = 12

// 默认高频推荐顺序：未收藏满时按此补齐（含合并进来的主页装修入口）
const DEFAULT_RECOMMENDED_KEYS = [
  'manage-userPageBuilder',
  'manage-obsSceneEditor',
  'live-dashboard',
  'manage-danmuji',
  'manage-songList',
  'manage-questionBox',
  'manage-schedule',
  'manage-point',
  'manage-obsStore',
  'manage-liveRequest',
  'manage-musicRequest',
  'manage-live',
]

// 与侧边栏共用历史持久化 key，保证已有收藏无缝同步
export const favoriteMenuItems = usePersistedStorage<string[]>('Settings.FavoriteMenuItems', [])
export const recentMenuItems = usePersistedStorage<string[]>('vtsuru:settings:recent-manage-menu-items', [])

export function isFavoriteMenuItem(key: string): boolean {
  return (favoriteMenuItems.value ?? []).includes(key)
}

export function toggleFavoriteMenuItem(key: string) {
  const list = [...(favoriteMenuItems.value ?? [])]
  const idx = list.indexOf(key)
  if (idx === -1) list.unshift(key)
  else list.splice(idx, 1)
  favoriteMenuItems.value = list
}

export function moveFavoriteMenuItem(key: string, direction: -1 | 1) {
  const list = [...(favoriteMenuItems.value ?? [])]
  const idx = list.indexOf(key)
  const targetIdx = idx + direction
  if (idx === -1 || targetIdx < 0 || targetIdx >= list.length) return
  ;[list[idx], list[targetIdx]] = [list[targetIdx], list[idx]]
  favoriteMenuItems.value = list
}

export function clearFavoriteMenuItems() {
  favoriteMenuItems.value = []
}

export function recordRecentMenuItem(key: string) {
  if (!key || key === 'manage-index') return
  const list = (recentMenuItems.value ?? []).filter((item) => item !== key)
  list.unshift(key)
  if (list.length > MAX_RECENT_ITEMS) list.length = MAX_RECENT_ITEMS
  recentMenuItems.value = list
}

const USER_WORKSPACE_ITEMS: ManageNavItem[] = [
  {
    key: 'bili-user-points',
    label: '我的积分',
    description: '各频道积分余额与打卡连签',
    icon: Wallet,
    to: { name: 'bili-user-points' },
    group: 'user-assets',
  },
  {
    key: 'bili-user-orders',
    label: '我的订单',
    description: '礼物兑换与服务委托订单',
    icon: Receipt,
    to: { name: 'bili-user-orders' },
    group: 'user-assets',
  },
  {
    key: 'bili-user-history',
    label: '积分记录',
    description: '各频道积分获取与消耗流水',
    icon: History,
    to: { name: 'bili-user-history' },
    group: 'user-assets',
  },
  {
    key: 'bili-user-qa',
    label: '我的棉花糖',
    description: '已发送的提问、回复与追问',
    icon: MessageSquareHeart,
    to: { name: 'bili-user-qa' },
    group: 'user-activity',
  },
  {
    key: 'bili-user-video-collect',
    label: '我的视频投稿',
    description: '视频征集投稿进度与撤回',
    icon: Clapperboard,
    to: { name: 'bili-user-video-collect' },
    group: 'user-activity',
  },
  {
    key: 'bili-user-requests',
    label: '点播与排队',
    description: '点歌与排队历史及自助撤回',
    icon: ListMusic,
    to: { name: 'bili-user-requests' },
    group: 'user-activity',
  },
  {
    key: 'bili-user-settings',
    label: '账户设置',
    description: '收货地址、密码与 B 站绑定',
    icon: Settings,
    to: { name: 'bili-user-settings' },
    group: 'user-account',
  },
]

export function useManageNavigation(accountInfo: Ref<ResponseAccountInfo | null | undefined>) {
  const isBiliVerified = computed(() => Boolean(accountInfo.value?.isBiliVerified))
  const needsEmailVerified = computed(() => accountInfo.value?.isEmailVerified === false)

  const streamerItems = computed<ManageNavItem[]>(() => {
    const emailDisabled = needsEmailVerified.value
    const biliDisabled = !isBiliVerified.value
    const biliReason = biliDisabled ? '需要完成 Bilibili 认证后才能使用' : undefined

    return [
      {
        key: 'manage-userPageBuilder',
        label: '主页装修',
        description: '定制主页壁纸、主题与区块',
        icon: ColorPaletteOutline,
        to: { name: 'manage-userPageBuilder' },
        disabled: emailDisabled,
        group: 'tools',
        accent: 'brand',
        hideInSiderList: true,
      },
      {
        key: 'manage-history',
        label: '历史',
        description: '回溯历史互动与记录',
        icon: AnalyticsSharp,
        to: { name: 'manage-history' },
        disabled: emailDisabled,
        group: 'common',
      },
      {
        key: 'manage-live',
        label: '直播记录',
        description: '查看各场直播详情与复盘',
        icon: Live24Filled,
        to: { name: 'manage-live' },
        disabled: emailDisabled,
        group: 'common',
      },
      {
        key: 'manage-analyze',
        label: '直播数据',
        description: '统计直播趋势与观众活跃',
        icon: Eye,
        to: { name: 'manage-analyze' },
        disabled: emailDisabled,
        group: 'common',
      },
      {
        key: 'org-index',
        label: '组织',
        description: '多主播协作与组织管理',
        icon: PeopleQueue24Filled,
        to: { name: 'org-index' },
        disabled: emailDisabled,
        group: 'common',
      },

      {
        key: 'manage-fans',
        label: '粉丝档案',
        description: '粉丝称呼手记、AI 画像与生日提醒',
        icon: Users,
        to: { name: 'manage-fans' },
        disabled: emailDisabled,
        group: 'data',
      },
      {
        key: 'manage-event',
        label: '舰长和SC',
        description: '大航海与醒目留言记录',
        icon: VehicleShip24Filled,
        to: { name: 'manage-event' },
        disabled: emailDisabled,
        group: 'data',
      },
      {
        key: 'manage-point',
        label: '积分和礼物',
        description: '积分规则与礼物兑换管理',
        icon: BookCoins20Filled,
        to: { name: 'manage-point' },
        disabled: emailDisabled,
        group: 'data',
      },

      {
        key: 'manage-schedule',
        label: '日程',
        description: '编辑并发布直播日程表',
        icon: CalendarClock24Filled,
        to: { name: 'manage-schedule' },
        disabled: emailDisabled,
        group: 'tools',
      },
      {
        key: 'manage-songList',
        label: '歌单',
        description: '维护曲库与观众点歌列表',
        icon: MusicalNote,
        to: { name: 'manage-songList' },
        disabled: emailDisabled,
        group: 'tools',
      },
      {
        key: 'manage-questionBox',
        label: '棉花糖 (提问箱)',
        description: '收集回复与 OBS 展示提问',
        icon: Chatbox,
        to: { name: 'manage-questionBox' },
        disabled: emailDisabled,
        group: 'tools',
      },
      {
        key: 'manage-videoCollect',
        label: '视频征集',
        description: '向观众征集投稿与审核',
        icon: VideoAdd20Filled,
        to: { name: 'manage-videoCollect' },
        disabled: emailDisabled,
        group: 'tools',
      },
      {
        key: 'manage-lottery',
        label: '动态抽奖',
        description: '按动态评论转发抽取中奖',
        icon: Lottery24Filled,
        to: { name: 'manage-lottery' },
        disabled: emailDisabled,
        group: 'tools',
      },
      {
        key: 'manage-tools-dashboard',
        label: '工具箱',
        description: '封面制作、抠图等实用工具',
        icon: GridOutline,
        to: { name: 'manage-tools-dashboard' },
        disabled: emailDisabled,
        group: 'tools',
      },
      {
        key: 'manage-obsStore',
        label: 'OBS 组件库',
        description: '配置时钟、字幕、键显等挂件',
        icon: StoreMicrosoft24Regular,
        to: { name: 'manage-obsStore' },
        disabled: emailDisabled,
        group: 'tools',
      },
      {
        key: 'manage-obsSceneEditor',
        label: 'OBS 场景编辑器',
        description: '画布编排多场景与 OBS 联动',
        icon: Board24Regular,
        to: { name: 'manage-obsSceneEditor' },
        disabled: emailDisabled,
        group: 'tools',
      },
      {
        key: 'manage-qqBot',
        label: 'QQ 群机器人',
        description: '开播推送与群内互动指令',
        icon: Bot24Regular,
        to: { name: 'manage-qqBot' },
        disabled: emailDisabled,
        group: 'tools',
      },

      {
        key: 'live-dashboard',
        label: '中控台',
        description: '实时监控直播间数据与互动',
        icon: Board24Regular,
        to: { name: 'live-dashboard' },
        disabled: biliDisabled,
        disabledReason: biliReason,
        group: 'danmaku',
      },
      {
        key: 'manage-danmuji',
        label: '弹幕机',
        description: '自定义直播弹幕样式与展示',
        icon: ChatbubbleEllipsesOutline,
        to: { name: 'manage-danmuji' },
        disabled: biliDisabled,
        disabledReason: biliReason,
        group: 'danmaku',
      },
      {
        key: 'manage-liveRequest',
        label: '点播',
        description: '接收并管理观众弹幕点播',
        icon: PlayCircleOutline,
        to: { name: 'manage-liveRequest' },
        disabled: biliDisabled,
        disabledReason: biliReason,
        group: 'danmaku',
      },
      {
        key: 'manage-liveLottery',
        label: '弹幕抽奖',
        description: '按实时弹幕口令发起抽奖',
        icon: Lottery24Filled,
        to: { name: 'manage-liveLottery' },
        disabled: biliDisabled,
        disabledReason: biliReason,
        group: 'danmaku',
      },
      {
        key: 'manage-musicRequest',
        label: '点歌机',
        description: '直播间弹幕点歌与排队播控',
        icon: MusicalNotesOutline,
        to: { name: 'manage-musicRequest' },
        disabled: biliDisabled,
        disabledReason: biliReason,
        group: 'danmaku',
      },
      {
        key: 'manage-liveQueue',
        label: '排队',
        description: '车队/连麦等观众弹幕排队',
        icon: PeopleQueue24Filled,
        to: { name: 'manage-liveQueue' },
        disabled: biliDisabled,
        disabledReason: biliReason,
        group: 'danmaku',
      },
      {
        key: 'manage-speech',
        label: '读弹幕',
        description: 'TTS 语音播报弹幕与礼物',
        icon: TabletSpeaker24Filled,
        to: { name: 'manage-speech' },
        disabled: biliDisabled,
        disabledReason: biliReason,
        group: 'danmaku',
      },
      {
        key: 'manage-danmakuVote',
        label: '弹幕投票',
        description: '实时收集弹幕选项并统计',
        icon: StatsChartOutline,
        to: { name: 'manage-danmakuVote' },
        disabled: biliDisabled,
        disabledReason: biliReason,
        group: 'danmaku',
      },
    ]
  })

  const streamerItemMap = computed(() => new Map(streamerItems.value.map((item) => [item.key, item])))

  const favoriteItems = computed<ManageNavItem[]>(() => {
    const map = streamerItemMap.value
    return (favoriteMenuItems.value ?? [])
      .map((key) => map.get(key))
      .filter((item): item is ManageNavItem => Boolean(item))
  })

  // 主页快捷入口：主播收藏全部置顶；不足 8 项时按「最近访问 → 默认推荐」去重补齐
  const quickAccessEntries = computed<ManageQuickAccessEntry[]>(() => {
    const map = streamerItemMap.value
    const seen = new Set<string>()
    const result: ManageQuickAccessEntry[] = []

    const pushEntry = (key: string, source: QuickAccessSource) => {
      if (seen.has(key)) return
      const item = map.get(key)
      if (!item) return
      seen.add(key)
      result.push({ item, source })
    }

    for (const key of favoriteMenuItems.value ?? []) {
      pushEntry(key, 'favorite')
    }

    if (result.length < QUICK_ACCESS_TARGET_COUNT) {
      for (const key of recentMenuItems.value ?? []) {
        if (result.length >= QUICK_ACCESS_TARGET_COUNT) break
        pushEntry(key, 'recent')
      }
    }

    if (result.length < QUICK_ACCESS_TARGET_COUNT) {
      // 默认推荐兜底时，优先推荐当前账号立即可用的功能
      const orderedRecommended = [
        ...DEFAULT_RECOMMENDED_KEYS.filter((key) => {
          const item = map.get(key)
          return item && !item.disabled
        }),
        ...DEFAULT_RECOMMENDED_KEYS.filter((key) => {
          const item = map.get(key)
          return item && item.disabled
        }),
      ]
      for (const key of orderedRecommended) {
        if (result.length >= QUICK_ACCESS_TARGET_COUNT) break
        pushEntry(key, 'recommended')
      }
    }

    return result
  })

  const groupedStreamerItems = computed(() =>
    STREAMER_NAV_GROUP_ORDER.map((groupId) => ({
      id: groupId,
      label: STREAMER_NAV_GROUP_LABELS[groupId],
      items: streamerItems.value.filter((item) => item.group === groupId),
    })).filter((group) => group.items.length > 0),
  )

  return {
    isBiliVerified,
    needsEmailVerified,
    userItems: USER_WORKSPACE_ITEMS,
    streamerItems,
    streamerItemMap,
    favoriteMenuItems,
    recentMenuItems,
    favoriteItems,
    quickAccessEntries,
    groupedStreamerItems,
    isFavorite: isFavoriteMenuItem,
    toggleFavorite: toggleFavoriteMenuItem,
    moveFavorite: moveFavoriteMenuItem,
    clearFavorites: clearFavoriteMenuItems,
    recordRecent: recordRecentMenuItem,
  }
}
