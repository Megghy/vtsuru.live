import {
  Activity,
  Award,
  BarChart3,
  Bot,
  CalendarDays,
  Clapperboard,
  Clock,
  Coins,
  Dices,
  Film,
  Flame,
  Gamepad2,
  Gift,
  HeartHandshake,
  Keyboard,
  LayoutDashboard,
  LayoutGrid,
  ListMusic,
  MessageCircleHeart,
  MessageSquareText,
  Mic,
  MonitorPlay,
  Music2,
  PlugZap,
  Radio,
  Smile,
  Sparkles,
  Subtitles,
  Target,
  Ticket,
  TrendingUp,
  Users,
  Vote,
  Wrench,
} from 'lucide-vue-next'
import type { Component } from 'vue'

export interface IndexStreamerModel {
  name: string
  uname: string
  avatar: string
  uid: number
  roomId: number
  title: string
  cover: string
  isStreaming: boolean
  parentArea: string
  area: string
  liveStartedAt: number
  reserveTitle?: string
  reserveAt?: number
}

export interface IndexDataModel {
  userCount: number
  streamers: IndexStreamerModel[]
}

export type FeatureCategory = 'all' | 'live' | 'page' | 'data' | 'efficiency'

export interface FeatureCategoryTab {
  value: FeatureCategory
  label: string
}

export interface FeatureGroupMeta {
  key: Exclude<FeatureCategory, 'all'>
  title: string
  subtitle: string
  accent: 'brand' | 'sakura' | 'amber' | 'emerald'
}

export interface IndexFeatureItem {
  id: string
  name: string
  desc: string
  category: Exclude<FeatureCategory, 'all'>
  route: string
  icon: Component
  accent: 'brand' | 'sakura' | 'amber' | 'emerald'
  tag?: string
}

export interface ObsWidgetItem {
  id: string
  name: string
  subtitle: string
  desc: string
  icon: Component
  accent: 'brand' | 'sakura' | 'amber' | 'emerald'
  previewKind: 'clock' | 'counter' | 'goal' | 'wheel' | 'subtitle' | 'pngtuber' | 'gamepad' | 'keycast'
}

export interface ClientCapabilityItem {
  id: string
  title: string
  desc: string
  icon: Component
}

export const EXTERNAL_LINKS = {
  huanxing: 'https://play-live.bilibili.com/details/1698742711771',
  clientDocs: 'https://www.wolai.com/carN6qvUm3FErze9Xo53ii',
  clientRepo: 'https://github.com/Megghy/vtsuru-fetcher-client',
  clientWebLogic: 'https://github.com/Megghy/vtsuru.live/tree/master/src/apps/client',
  authorBili: 'https://space.bilibili.com/10021741',
  userPagePreviewImg: 'https://files.vtsuru.suki.club/updatelog/屏幕截图 2026-01-16 213146.png',
} as const

export const FEATURE_CATEGORY_TABS: readonly FeatureCategoryTab[] = [
  { value: 'all', label: '全部能力' },
  { value: 'live', label: '直播互动' },
  { value: 'page', label: '主页与社区' },
  { value: 'data', label: '数据与运营' },
  { value: 'efficiency', label: 'AI 与工具箱' },
]

export const FEATURE_GROUPS: readonly FeatureGroupMeta[] = [
  {
    key: 'live',
    title: '直播互动与控场',
    subtitle: 'OBS 场景编排、实时中控、弹幕投票、多引擎 TTS 与点歌排队',
    accent: 'brand',
  },
  {
    key: 'page',
    title: '个人主页与社区',
    subtitle: '44 种积木区块、日程歌单模板、棉花糖提问箱与粉丝讨论区',
    accent: 'sakura',
  },
  {
    key: 'data',
    title: '数据统计与积分运营',
    subtitle: '积分兑换商城、直播收益统计、场次语音复盘与组织协作',
    accent: 'amber',
  },
  {
    key: 'efficiency',
    title: 'AI 助手与效率工具',
    subtitle: '页面上下文 AI 助手、11 合一直播工具箱与动态抽奖',
    accent: 'emerald',
  },
]

// 每个分组卡片数为 3 的倍数（9 / 6 / 6 / 3 = 24），在桌面端 3 列网格下每一行完全对齐零空洞
export const INDEX_FEATURES: readonly IndexFeatureItem[] = [
  // ---- 直播互动与控场（9 项） ----
  {
    id: 'obs-scene-editor',
    name: 'OBS 场景编辑器',
    desc: '浏览器内编排多场景画布与全局常驻层，支持图层嵌套与异形遮罩，单浏览器源联动 OBS 切换画面。',
    category: 'live',
    route: 'manage-obsSceneEditor',
    icon: Clapperboard,
    accent: 'brand',
    tag: 'NEW',
  },
  {
    id: 'live-dashboard',
    name: '直播中控台',
    desc: '四栏可拖拽播控台，集中查看弹幕、醒目留言、礼物与投票，支持专注虚化与 Alt+M 高光时刻打点。',
    category: 'live',
    route: 'live-dashboard',
    icon: LayoutDashboard,
    accent: 'brand',
  },
  {
    id: 'danmaku-vote',
    name: '弹幕投票',
    desc: '直播间弹幕实时计票，支持预设模板、延长/暂停、合并选项与平局抽签，同步投屏到 OBS 与公开主页。',
    category: 'live',
    route: 'manage-danmakuVote',
    icon: Vote,
    accent: 'sakura',
    tag: '升级',
  },
  {
    id: 'speech',
    name: '多引擎读弹幕',
    desc: '支持 MiMo 自定义音色与导演指令、Azure、CosyVoice、OpenAI、Qwen 及本地语音，灵活过滤弹幕与礼物播报。',
    category: 'live',
    route: 'manage-speech',
    icon: Mic,
    accent: 'amber',
  },
  {
    id: 'danmuji',
    name: '弹幕机（OBS）',
    desc: '在 OBS 实时呈现弹幕、礼物、大航海与 SC，兼容 blivechat CSS 样式，预设与过滤规则云端同步。',
    category: 'live',
    route: 'manage-danmuji',
    icon: MessageSquareText,
    accent: 'brand',
  },
  {
    id: 'music-request',
    name: '弹幕点歌（歌势）',
    desc: '联动个人曲库与牌子门槛，观众发送弹幕即可自动点歌排队，方便歌回直播管理。',
    category: 'live',
    route: 'manage-musicRequest',
    icon: Music2,
    accent: 'sakura',
  },
  {
    id: 'live-request',
    name: '弹幕点播',
    desc: '支持弹幕搜索直放视频或音乐，附带今日已处理清单与多种极简无背景 OBS 风格。',
    category: 'live',
    route: 'manage-liveRequest',
    icon: MonitorPlay,
    accent: 'brand',
  },
  {
    id: 'live-queue',
    name: '弹幕排队',
    desc: '联机、上麦、水友赛一键排队，灵活配置牌子、礼物、舰长等入队门槛与公开队列状态页。',
    category: 'live',
    route: 'manage-liveQueue',
    icon: Users,
    accent: 'emerald',
  },
  {
    id: 'live-lottery',
    name: '直播间抽奖',
    desc: '从直播间实时弹幕、口令或礼物中抽取中奖观众，内置多款风格 OBS 开奖挂件。',
    category: 'live',
    route: 'manage-liveLottery',
    icon: Ticket,
    accent: 'amber',
  },

  // ---- 个人主页与粉丝社区（6 项） ----
  {
    id: 'user-page-builder',
    name: '可视化主页装修',
    desc: '44 种积木区块与 Bento 网格拼装个人主页、OC 设定集、约稿价目表、声按钮语音板与自定义 Vue 代码区块。',
    category: 'page',
    route: 'manage-userPageBuilder',
    icon: LayoutGrid,
    accent: 'sakura',
    tag: '44 区块',
  },
  {
    id: 'schedule',
    name: '直播日程表',
    desc: '内置 10 套风格迥异的公开日程模板（手帐、周刊、海报、复古桌面等），填写即出片。',
    category: 'page',
    route: 'manage-schedule',
    icon: CalendarDays,
    accent: 'brand',
  },
  {
    id: 'song-list',
    name: '公开歌单',
    desc: '6 套歌单展示模板与在线试听播放，观众可随时检索曲目并一键复制点歌口令。',
    category: 'page',
    route: 'manage-songList',
    icon: ListMusic,
    accent: 'sakura',
  },
  {
    id: 'question-box',
    name: '棉花糖（提问箱）',
    desc: '支持匿名与实名提问、追问互动、公开展示分享图以及专用 OBS 直播提问展示屏。',
    category: 'page',
    route: 'manage-questionBox',
    icon: MessageCircleHeart,
    accent: 'sakura',
  },
  {
    id: 'video-collect',
    name: '视频征集',
    desc: '创建主题征集页收集观众投稿的 B 站视频，支持前置审核筛选与结果公示。',
    category: 'page',
    route: 'manage-videoCollect',
    icon: Film,
    accent: 'amber',
  },
  {
    id: 'forum',
    name: '粉丝讨论区',
    desc: '主播专属公开交流区，支持观众发帖、评论回复与后台内容管理。',
    category: 'page',
    route: 'manage-forum',
    icon: HeartHandshake,
    accent: 'emerald',
  },

  // ---- 数据统计与积分运营（6 项） ----
  {
    id: 'point-mall',
    name: '积分兑换商城',
    desc: '打通上舰、SC、礼物、弹幕签到与每日首次互动，支持实体物流、服务类与随机 Key 虚拟兑换码。',
    category: 'data',
    route: 'manage-point',
    icon: Coins,
    accent: 'amber',
  },
  {
    id: 'analyze',
    name: '直播数据分析看板',
    desc: '按 7/30/60 天或自定义区间统计礼物、SC、大航海、下播收益、开播时段与分区表现。',
    category: 'data',
    route: 'manage-analyze',
    icon: BarChart3,
    accent: 'brand',
    tag: 'NEW',
  },
  {
    id: 'live-records',
    name: '场次记录与语音复盘',
    desc: '记录每场直播的弹幕、礼物营收曲线以及实时语音转写文稿，支持检索与导出。',
    category: 'data',
    route: 'manage-live',
    icon: Radio,
    accent: 'emerald',
  },
  {
    id: 'event-records',
    name: '上舰与 SC 事件记录',
    desc: '集中归档并快速检索历史大航海开通、续费与醒目留言明细，方便核对舰礼与感谢。',
    category: 'data',
    route: 'manage-event',
    icon: Activity,
    accent: 'brand',
  },
  {
    id: 'history-trend',
    name: '粉丝与舰长历史趋势',
    desc: '绑定账号后长期自动追踪粉丝数、舰长数与观看数变化曲线，直观掌握账号成长。',
    category: 'data',
    route: 'manage-history',
    icon: TrendingUp,
    accent: 'sakura',
  },
  {
    id: 'org',
    name: '多主播 / 公会组织',
    desc: '面向社团、企划与公会的多成员协作空间，统一展示成员动态与管理权限。',
    category: 'data',
    route: 'org-index',
    icon: Award,
    accent: 'amber',
  },

  // ---- AI 与效率工具（3 项） ----
  {
    id: 'ai-assistant',
    name: 'AI 智能工作台助手',
    desc: '工作台顶栏随时呼出：结合当前站点上下文对话与识图，并支持带风险分级的审批提案自动操作。',
    category: 'efficiency',
    route: 'manage-index',
    icon: Bot,
    accent: 'brand',
    tag: 'AI',
  },
  {
    id: 'tools-dashboard',
    name: '直播实用工具箱（11 合一）',
    desc: '常用创作者工具集合：AI 去背景、封面生成、动态九图、图片拼接压缩、OCR、音视频转换与翻译。',
    category: 'efficiency',
    route: 'manage-tools-dashboard',
    icon: Wrench,
    accent: 'emerald',
  },
  {
    id: 'dynamic-lottery',
    name: '动态评论转发抽奖',
    desc: '粘贴 B 站动态即可拉取评论与转发名单，支持条件过滤、去重与开奖记录留存。',
    category: 'efficiency',
    route: 'manage-lottery',
    icon: Gift,
    accent: 'amber',
  },
]

export const OBS_WIDGETS: readonly ObsWidgetItem[] = [
  {
    id: 'clock',
    name: '时钟与倒计时',
    subtitle: '13 套精选预设',
    desc: '瑞士版式、辉光管、像素街机等风格，支持开播倒计时与速通正计时。',
    icon: Clock,
    accent: 'brand',
    previewKind: 'clock',
  },
  {
    id: 'goal',
    name: '目标进度与耐久加钟',
    subtitle: '舰长 / 营收 / 加钟',
    desc: '绑定舰长或营收目标，收到礼物与 SC 自动触发耐久加钟倒计时。',
    icon: Target,
    accent: 'sakura',
    previewKind: 'goal',
  },
  {
    id: 'pngtuber',
    name: 'PNGtuber 反应立绘',
    subtitle: '6 位码多人联动',
    desc: '麦克风实时驱动双图反应立绘，输入房间码即可实现多人联动同屏。',
    icon: Smile,
    accent: 'amber',
    previewKind: 'pngtuber',
  },
  {
    id: 'subtitle',
    name: '实时语音字幕条',
    subtitle: '桌面端实时推送',
    desc: '直连桌面客户端本地语音转写，在直播画面底部实时滚动显示字幕。',
    icon: Subtitles,
    accent: 'emerald',
    previewKind: 'subtitle',
  },
  {
    id: 'wheel',
    name: '物理大转盘',
    subtitle: '权重配置 · 跨端同步',
    desc: '带物理阻尼手感的 Canvas 大转盘，后台触发即可同步在 OBS 开奖。',
    icon: Dices,
    accent: 'sakura',
    previewKind: 'wheel',
  },
  {
    id: 'counter',
    name: '受苦挑战计数器',
    subtitle: '死亡 / 重试 / 目标',
    desc: '适合高难挑战与连胜计数，支持快捷键与网页端实时增减进度。',
    icon: Flame,
    accent: 'amber',
    previewKind: 'counter',
  },
  {
    id: 'gamepad',
    name: '游戏手柄投屏',
    subtitle: 'Xbox / PS / Switch',
    desc: '低延迟还原手柄按键、双摇杆偏移与线性扳机行程。',
    icon: Gamepad2,
    accent: 'brand',
    previewKind: 'gamepad',
  },
  {
    id: 'keycast',
    name: '键鼠按键投屏',
    subtitle: '键盘与鼠标操作',
    desc: '实时显示键盘组合键与鼠标点击状态，适合教程、音游或动作游戏直播。',
    icon: Keyboard,
    accent: 'emerald',
    previewKind: 'keycast',
  },
]

export const CLIENT_CAPABILITIES: readonly ClientCapabilityItem[] = [
  {
    id: 'live-manage',
    title: '一键开播与 OBS 推流',
    desc: '直接修改标题、分区、封面并获取推流码用 OBS 推流，无需开启官方直播姬。',
    icon: Radio,
  },
  {
    id: 'auto-action',
    title: '自动操作与弹幕签到',
    desc: '弹幕回复、礼物/SC 感谢、上舰私信、入场欢迎与定时发送，内置模板与 JS 脚本沙箱。',
    icon: Sparkles,
  },
  {
    id: 'floating-window',
    title: '桌面透明浮窗',
    desc: '独立置顶的弹幕机浮窗与礼物/舰队排行浮窗，单屏游戏也能轻松看互动。',
    icon: MessageSquareText,
  },
  {
    id: 'avatar-bridge',
    title: 'VTube Studio & PNGtuber 联动',
    desc: '直连 VTS 触发热键、表情与动作，同时内置本地 PNGtuber 驱动。',
    icon: Smile,
  },
  {
    id: 'transcription',
    title: '本地语音同传字幕',
    desc: '实时本地语音转写，低延迟推送至 OBS 字幕条并自动归档为场次复盘文稿。',
    icon: Subtitles,
  },
  {
    id: 'rpc-fans',
    title: '本地 RPC 桥接与粉丝大V查看',
    desc: '为 OBS 场景编辑器与中控台提供本地安全桥接，支持按粉丝量排查大V关注。',
    icon: PlugZap,
  },
]
