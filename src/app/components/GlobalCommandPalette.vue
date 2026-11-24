<script setup lang="ts">
import {
  AppWindow,
  AudioWaveform,
  BookOpen,
  CloudUpload,
  Compass,
  CornerDownLeft,
  Gift,
  History,
  MessageSquare,
  Mic,
  Monitor,
  Palette,
  Radio,
  Search,
  Settings,
  Smile,
  Sparkles,
  UserCog,
  Users,
  Wrench,
  Zap,
} from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import { useAssistantStore } from '@/apps/assistant/store/useAssistantStore'
import { ALL_DOCS, getDocCategory } from '@/apps/docs/registry'
import { obsComponentList } from '@/apps/obs-store/registry'
import { type CommandItem, useCommandPalette } from '@/shared/composables/useCommandPalette'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { cycleThemeType, getThemeTypeLabel, themeType } from '@/shared/utils'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

type FilterTab = 'all' | 'client' | 'dynamic' | 'site'

const router = useRouter()
const route = useRoute()
const accountInfo = useAccount()
const assistant = useAssistantStore()
const { open, dynamicItems, recentIds, togglePalette, closePalette, recordRecent } = useCommandPalette()

const query = ref('')
const activeIndex = ref(0)
const activeFilter = ref<FilterTab>('all')
const inputWrapperRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const isInClient = computed(() => route.path.startsWith('/client'))
const isInOpenLive = computed(() => route.path.startsWith('/open-live'))
const isInManage = computed(() => route.path.startsWith('/manage'))

const filterTabs = computed<{ key: FilterTab; label: string }[]>(() => {
  if (isInClient.value || dynamicItems.value.length > 0) {
    return [
      { key: 'all', label: '全部' },
      { key: 'client', label: '客户端' },
      { key: 'dynamic', label: '动态控制' },
      { key: 'site', label: '后台与文档' },
    ]
  }
  return [
    { key: 'all', label: '全部' },
    { key: 'site', label: '页面与工具' },
    { key: 'client', label: '桌面客户端' },
  ]
})

function goRoute(name: string, params?: Record<string, string | string[]>, queryParams?: Record<string, string>) {
  void router.push({ name, params, query: queryParams })
}

const staticItems = computed<CommandItem[]>(() => {
  const items: CommandItem[] = []
  const nextTheme = cycleThemeType(themeType.value)

  // 1. 客户端一级工作台（覆盖全部 15 个侧边栏页面）
  const clientGroupName = isInClient.value ? '客户端功能' : '桌面客户端'
  const clientEntries: { name: string; label: string; desc?: string; icon: any; kw: string[] }[] = [
    {
      name: 'client-index',
      label: '客户端首页',
      desc: '系统状态总览与浮窗快捷控台',
      icon: AppWindow,
      kw: ['home', 'index', '首页'],
    },
    {
      name: 'client-live-dashboard',
      label: '客户端中控台',
      desc: '实时弹幕、礼物与互动中控面板',
      icon: Monitor,
      kw: ['dashboard', '中控台'],
    },
    {
      name: 'client-live-manage',
      label: '客户端直播管理',
      desc: '开关播、封面标题与 OBS 推流控制',
      icon: Radio,
      kw: ['live', 'obs', '开播', '直播管理'],
    },
    {
      name: 'client-danmaku-window-manage',
      label: '弹幕机浮窗管理',
      desc: '桌面弹幕机样式、交互与置顶设置',
      icon: MessageSquare,
      kw: ['danmaku', 'window', '弹幕机', '浮窗'],
    },
    {
      name: 'client-gift-window-manage',
      label: '礼物与排行浮窗管理',
      desc: '礼物、舰队排行与答谢列表窗口',
      icon: Gift,
      kw: ['gift', 'window', '礼物', '排行', '浮窗'],
    },
    {
      name: 'client-auto-action-manage',
      label: '自动操作与答谢',
      desc: '自动回复、礼物/上舰答谢与定时发送',
      icon: Zap,
      kw: ['auto', 'action', '自动操作', '答谢'],
    },
    {
      name: 'client-fans-viewer',
      label: '粉丝查看',
      desc: '观众牌子、消费与互动记录查询',
      icon: Users,
      kw: ['fans', '观众', '粉丝'],
    },
    {
      name: 'client-vts',
      label: 'VTubeStudio 控制',
      desc: 'VTS 热键、表情、机位预设与动作宏',
      icon: Smile,
      kw: ['vts', 'vtubestudio', '模型'],
    },
    {
      name: 'client-pngtuber',
      label: 'PNGtuber',
      desc: '轻量立绘驱动与音频口型联动',
      icon: Sparkles,
      kw: ['pngtuber', '立绘'],
    },
    {
      name: 'client-read-danmaku',
      label: '客户端读弹幕',
      desc: 'TTS 语音播报弹幕与礼物',
      icon: Mic,
      kw: ['tts', 'speech', '读弹幕'],
    },
    {
      name: 'client-transcription',
      label: '实时语音转写',
      desc: '本地 ASR 实时字幕识别与输出',
      icon: AudioWaveform,
      kw: ['asr', 'transcription', '字幕', '转写'],
    },
    {
      name: 'client-fetcher',
      label: 'EventFetcher 采集端',
      desc: '弹幕连接模式、上报统计与心跳状态',
      icon: CloudUpload,
      kw: ['fetcher', '采集', '弹幕'],
    },
    {
      name: 'client-account-manage',
      label: '账号与凭据',
      desc: 'B站主账号 Cookie 扫码与多账号池',
      icon: UserCog,
      kw: ['cookie', 'account', '凭据', '账号'],
    },
    {
      name: 'client-tools',
      label: '工具中心',
      desc: '托管外部工具、开播编排与全局热键',
      icon: Wrench,
      kw: ['tools', '工具中心', '托管'],
    },
    {
      name: 'client-settings',
      label: '客户端设置',
      desc: '常规、通知、备份、诊断与版本更新',
      icon: Settings,
      kw: ['settings', '设置'],
    },
  ]
  for (const c of clientEntries) {
    items.push({
      id: `client-${c.name}`,
      group: clientGroupName,
      scope: 'client',
      label: c.label,
      description: c.desc,
      keywords: ['client', '客户端', c.label, ...c.kw],
      icon: c.icon,
      run: () => goRoute(c.name),
    })
  }

  // 2. 客户端深层子页面 / Tab 直达
  const clientSubEntries: {
    id: string
    name: string
    tab: string
    label: string
    desc: string
    icon: any
    kw: string[]
  }[] = [
    {
      id: 'client-sub-settings-general',
      name: 'client-settings',
      tab: 'general',
      label: '常规与启动设置',
      desc: '客户端设置 · 主题、开机自启与托盘行为',
      icon: Settings,
      kw: ['autostart', 'theme', '开机自启', '托盘'],
    },
    {
      id: 'client-sub-settings-notification',
      name: 'client-settings',
      tab: 'notification',
      label: '系统通知设置',
      desc: '客户端设置 · 开播/礼物/舰长桌面通知',
      icon: Settings,
      kw: ['notification', '通知', '提醒'],
    },
    {
      id: 'client-sub-settings-backup',
      name: 'client-settings',
      tab: 'backup',
      label: '客户端数据备份与恢复',
      desc: '客户端设置 · 导出/导入本地配置备份',
      icon: Settings,
      kw: ['backup', 'restore', '备份', '导出', '导入'],
    },
    {
      id: 'client-sub-settings-diagnostics',
      name: 'client-settings',
      tab: 'diagnostics',
      label: '诊断与日志',
      desc: '客户端设置 · 本地 RPC 状态与运行日志',
      icon: Settings,
      kw: ['diagnostics', 'log', 'rpc', '诊断', '日志'],
    },
    {
      id: 'client-sub-settings-about',
      name: 'client-settings',
      tab: 'about',
      label: '关于客户端与更新',
      desc: '客户端设置 · 版本信息与更新检查',
      icon: Settings,
      kw: ['about', 'version', 'update', '关于', '版本'],
    },
    {
      id: 'client-sub-account-main',
      name: 'client-account-manage',
      tab: 'main',
      label: 'B站主账号扫码与 Cookie',
      desc: '账号与凭据 · 主账号登录与 CookieCloud 同步',
      icon: UserCog,
      kw: ['cookie', 'qrcode', '扫码', '主账号'],
    },
    {
      id: 'client-sub-account-pool',
      name: 'client-account-manage',
      tab: 'pool',
      label: '自动化多账号池',
      desc: '账号与凭据 · 管理发弹幕/私信小号池',
      icon: UserCog,
      kw: ['pool', 'account', '多账号', '账号池', '小号'],
    },
    {
      id: 'client-sub-tools-overview',
      name: 'client-tools',
      tab: 'overview',
      label: '托管工具总览',
      desc: '工具中心 · 统一管理 VTS / OBS / FFmpeg / 转写',
      icon: Wrench,
      kw: ['ffmpeg', 'obs', 'vts', '托管'],
    },
    {
      id: 'client-sub-tools-routine',
      name: 'client-tools',
      tab: 'routine',
      label: '一键开播编排配置',
      desc: '工具中心 · 自定义开播与下播自动化流程',
      icon: Wrench,
      kw: ['routine', '编排', '一键开播', '下播'],
    },
    {
      id: 'client-sub-tools-shortcuts',
      name: 'client-tools',
      tab: 'shortcuts',
      label: '全局热键中心',
      desc: '工具中心 · 配置系统级快捷键',
      icon: Wrench,
      kw: ['shortcut', 'hotkey', '全局热键', '快捷键'],
    },
    {
      id: 'client-sub-tools-capabilities',
      name: 'client-tools',
      tab: 'capabilities',
      label: '版本能力与本地 RPC',
      desc: '工具中心 · 查看宿主能力矩阵与 RPC 接口',
      icon: Wrench,
      kw: ['rpc', 'capabilities', '能力矩阵', '端口'],
    },
    {
      id: 'client-sub-auto-danmaku',
      name: 'client-auto-action-manage',
      tab: 'danmaku',
      label: '自动操作：自动回复',
      desc: '按弹幕关键词触发回复或执行动作',
      icon: Zap,
      kw: ['auto', 'reply', '自动回复', '关键词'],
    },
    {
      id: 'client-sub-auto-gift',
      name: 'client-auto-action-manage',
      tab: 'gift',
      label: '自动操作：礼物感谢',
      desc: '配置礼物答谢模板与价值过滤',
      icon: Zap,
      kw: ['auto', 'gift', '礼物感谢', '答谢'],
    },
    {
      id: 'client-sub-auto-guard',
      name: 'client-auto-action-manage',
      tab: 'guard',
      label: '自动操作：上舰感谢',
      desc: '配置大航海开通欢迎与自动私信',
      icon: Zap,
      kw: ['auto', 'guard', '上舰', '舰长', '私信'],
    },
    {
      id: 'client-sub-auto-follow',
      name: 'client-auto-action-manage',
      tab: 'follow',
      label: '自动操作：关注感谢',
      desc: '新关注直播间时自动感谢',
      icon: Zap,
      kw: ['auto', 'follow', '关注感谢'],
    },
    {
      id: 'client-sub-auto-enter',
      name: 'client-auto-action-manage',
      tab: 'enter',
      label: '自动操作：入场欢迎',
      desc: '观众进入直播间欢迎规则',
      icon: Zap,
      kw: ['auto', 'enter', '入场欢迎', '进房'],
    },
    {
      id: 'client-sub-auto-scheduled',
      name: 'client-auto-action-manage',
      tab: 'scheduled',
      label: '自动操作：定时发送',
      desc: '定时发送弹幕或触发定时动作',
      icon: Zap,
      kw: ['auto', 'scheduled', '定时', '轮播'],
    },
    {
      id: 'client-sub-auto-sc',
      name: 'client-auto-action-manage',
      tab: 'super_chat',
      label: '自动操作：SC 感谢',
      desc: '醒目留言感谢与联动动作',
      icon: Zap,
      kw: ['auto', 'sc', 'superchat', '醒目留言'],
    },
    {
      id: 'client-sub-auto-point',
      name: 'client-auto-action-manage',
      tab: 'point_redeem',
      label: '自动操作：积分兑换联动',
      desc: '观众兑换积分商品后自动执行动作',
      icon: Zap,
      kw: ['auto', 'point', '积分兑换', '商城'],
    },
    {
      id: 'client-sub-auto-checkin',
      name: 'client-auto-action-manage',
      tab: 'check-in-settings',
      label: '自动操作：签到设置',
      desc: '直播间弹幕签到规则与提示词',
      icon: Zap,
      kw: ['checkin', '签到'],
    },
    {
      id: 'client-sub-auto-history',
      name: 'client-auto-action-manage',
      tab: 'action-history',
      label: '自动操作：执行历史',
      desc: '查看已触发规则的执行日志与结果',
      icon: Zap,
      kw: ['history', '执行历史', '记录'],
    },
  ]
  for (const sub of clientSubEntries) {
    items.push({
      id: sub.id,
      group: '客户端配置与子页面',
      scope: 'client',
      label: sub.label,
      description: sub.desc,
      keywords: ['client', '客户端', sub.label, ...sub.kw],
      icon: sub.icon,
      run: () => goRoute(sub.name, undefined, { tab: sub.tab }),
    })
  }

  // 3. 通用快捷操作
  items.push({
    id: 'action-theme',
    group: '快捷操作',
    scope: isInClient.value ? 'client' : 'manage',
    label: `切换主题（当前：${getThemeTypeLabel(themeType.value)}）`,
    description: `切换为${getThemeTypeLabel(nextTheme)}`,
    keywords: ['theme', 'dark', 'light', 'auto', '主题', '暗色', '浅色', '深色'],
    icon: Palette,
    run: () => {
      themeType.value = cycleThemeType(themeType.value)
    },
  })

  if (isInManage.value) {
    items.push({
      id: 'action-assistant',
      group: '快捷操作',
      scope: 'manage',
      label: '打开 VTsuru 助手',
      description: '针对当前页面提问或执行辅助操作',
      keywords: ['assistant', 'ai', 'bot', '助手'],
      icon: Sparkles,
      run: () => {
        assistant.open({
          routeName: route.name?.toString() ?? '',
          title: (route.meta?.title as string) ?? '管理后台',
          path: route.path,
        })
      },
    })
  }

  if (accountInfo.value?.id > 0 && accountInfo.value?.name) {
    items.push({
      id: 'action-public-page',
      group: '快捷操作',
      scope: 'manage',
      label: `打开我的公开展示页 (@${accountInfo.value.name})`,
      description: '预览观众看到的主播主页与各模块',
      keywords: ['home', 'public', 'user', '展示页', '主页', accountInfo.value.name],
      icon: Compass,
      run: () => goRoute('user-index', { id: accountInfo.value.name }),
    })
  }

  // 4. 管理后台与直播互动
  const manageEntries: { name: string; label: string; desc?: string; kw: string[] }[] = [
    { name: 'manage-index', label: '管理面板', desc: '账号状态、Token 与功能开关', kw: ['dashboard', 'panel', '面板'] },
    {
      name: 'manage-userPageBuilder',
      label: '主页装修',
      desc: '积木化页面编排与自定义代码',
      kw: ['builder', 'page', '装修', '积木'],
    },
    { name: 'manage-liveQueue', label: '排队管理', desc: '弹幕排队与队列 OBS 源', kw: ['queue', '排队'] },
    { name: 'manage-musicRequest', label: '点歌机', desc: '曲库管理与网页音乐播放', kw: ['music', 'song', '点歌机'] },
    { name: 'manage-liveRequest', label: '弹幕点播', desc: '点播队列与点歌记录', kw: ['request', '点播'] },
    {
      name: 'manage-danmuji',
      label: '弹幕机',
      desc: 'OBS 弹幕姬样式与规则编辑',
      kw: ['danmuji', '弹幕机', 'blivechat'],
    },
    { name: 'manage-liveLottery', label: '弹幕抽奖', desc: '直播间关键词/条件弹幕抽奖', kw: ['lottery', '抽奖'] },
    { name: 'manage-danmakuVote', label: '弹幕投票', desc: '直播间实时弹幕投票统计', kw: ['vote', '投票'] },
    { name: 'manage-speech', label: '读弹幕', desc: '语音播报与 TTS 配置', kw: ['speech', 'tts', '读弹幕'] },
    { name: 'manage-songList', label: '歌单管理', desc: '维护与批量编辑主播歌单', kw: ['songlist', '歌单'] },
    { name: 'manage-schedule', label: '日程管理', desc: '周日程表与 B 站直播预约同步', kw: ['schedule', '日程'] },
    { name: 'manage-questionBox', label: '提问箱', desc: '收到的匿名提问与展示管理', kw: ['qa', 'question', '提问箱'] },
    {
      name: 'manage-point',
      label: '积分与商城',
      desc: '观众积分规则、兑换商品与订单核销',
      kw: ['point', 'goods', '积分', '商城'],
    },
    {
      name: 'manage-event',
      label: '舰长与 SC 记录',
      desc: '历史大航海与醒目留言流水',
      kw: ['event', 'guard', 'sc', '舰长'],
    },
    { name: 'manage-live', label: '直播记录', desc: '场次统计与语音转写字幕查看', kw: ['live', 'record', '直播记录'] },
    {
      name: 'manage-history',
      label: '历史趋势',
      desc: '粉丝与舰长增长趋势图表',
      kw: ['history', 'chart', '历史', '趋势'],
    },
    { name: 'manage-analyze', label: '直播数据分析', desc: '直播互动与收益分析', kw: ['analyze', '数据分析'] },
    {
      name: 'manage-videoCollect',
      label: '视频征集',
      desc: '观众投稿视频征集活动',
      kw: ['video', 'collect', '视频征集'],
    },
    { name: 'manage-lottery', label: '动态抽奖', desc: 'B 站动态转发/评论抽奖', kw: ['dynamic', '动态抽奖'] },
    { name: 'manage-forum', label: '粉丝讨论区', desc: '讨论区帖子与版务管理', kw: ['forum', '讨论区'] },
    { name: 'manage-obsStore', label: 'OBS 组件库', desc: '纯前端轻量 OBS 挂件生态', kw: ['obs', 'store', '组件库'] },
    { name: 'manage-qqBot', label: 'QQ 群机器人', desc: '开播通知与群指令绑定', kw: ['qq', 'bot', '机器人'] },
    { name: 'manage-feedback', label: '反馈工单', desc: '问题反馈与进度追踪', kw: ['feedback', '工单'] },
    {
      name: 'live-dashboard',
      label: '直播中控台',
      desc: '全屏多栏实时弹幕/礼物/投票中控',
      kw: ['live-dashboard', '中控台'],
    },
  ]
  for (const entry of manageEntries) {
    items.push({
      id: `manage-${entry.name}`,
      group: '管理后台',
      scope: 'manage',
      label: entry.label,
      description: entry.desc,
      keywords: [entry.label, ...entry.kw],
      icon: Compass,
      run: () => goRoute(entry.name),
    })
  }

  // 5. OBS 组件库直达
  for (const comp of obsComponentList) {
    if (comp.status === 'planned') continue
    items.push({
      id: `obs-${comp.id}`,
      group: 'OBS 组件库',
      scope: 'manage',
      label: comp.name,
      description: comp.shortDescription,
      keywords: [comp.id, comp.name, ...comp.tags],
      icon: Monitor,
      run: () => goRoute('manage-obsStore', undefined, { component: comp.id }),
    })
  }

  // 6. 直播工具箱 (11 个本地/浏览器工具)
  const toolScopePrefix = isInOpenLive.value ? 'open-live-tool-' : null
  const toolEntries: { path: string; manageName: string; label: string; kw: string[] }[] = [
    {
      path: 'dynamic-nine-grid',
      manageName: 'ManageToolDynamicNineGrid',
      label: '动态九图生成器',
      kw: ['nine', 'grid', '九图'],
    },
    { path: 'image-stitch', manageName: 'ManageToolImageStitch', label: '图片拼接', kw: ['stitch', '拼图'] },
    {
      path: 'media-convert',
      manageName: 'ManageToolMediaConvert',
      label: '音视频转换/压缩',
      kw: ['ffmpeg', 'media', '转换', '压缩'],
    },
    { path: 'cover-maker', manageName: 'ManageToolCoverMaker', label: '直播封面生成器', kw: ['cover', '封面'] },
    { path: 'text-to-image', manageName: 'ManageToolTextToImage', label: '文字转图片', kw: ['text', 'image', '长图'] },
    { path: 'sticker-maker', manageName: 'ManageToolStickerMaker', label: '表情包制作', kw: ['sticker', '表情包'] },
    { path: 'image-compress', manageName: 'ManageToolImageCompress', label: '图片压缩', kw: ['compress', '压缩'] },
    { path: 'qrcode', manageName: 'ManageToolQrcode', label: '二维码生成', kw: ['qr', 'qrcode', '二维码'] },
    { path: 'remove-bg', manageName: 'tools-remove-bg', label: 'AI 去背景', kw: ['remove-bg', '抠图', '去背景'] },
    { path: 'ocr', manageName: 'ManageToolOcr', label: '文字识别 (OCR)', kw: ['ocr', '识字'] },
    { path: 'translate', manageName: 'ManageToolTranslate', label: '翻译工具', kw: ['translate', '翻译'] },
  ]
  for (const tool of toolEntries) {
    items.push({
      id: `tool-${tool.path}`,
      group: '直播工具箱',
      scope: 'manage',
      label: tool.label,
      description: '纯浏览器本地处理',
      keywords: ['tool', '工具', tool.label, ...tool.kw],
      icon: Wrench,
      run: () => goRoute(toolScopePrefix ? `${toolScopePrefix}${tool.path}` : tool.manageName),
    })
  }

  // 7. 使用文档
  items.push({
    id: 'docs-index',
    group: '使用文档',
    scope: 'docs',
    label: '使用文档中心',
    description: '浏览全站功能图文说明与交互示例',
    keywords: ['doc', 'docs', 'help', 'guide', '文档', '说明', '帮助', '教程'],
    icon: BookOpen,
    run: () => goRoute('docs-index'),
  })
  for (const doc of ALL_DOCS) {
    items.push({
      id: `doc-${doc.slug}`,
      group: '使用文档',
      scope: 'docs',
      label: doc.title,
      description: `${getDocCategory(doc.category).title}${doc.description ? ` · ${doc.description}` : ''}`,
      keywords: ['doc', '文档', '教程', doc.title, ...doc.tags],
      icon: BookOpen,
      run: () => goRoute('docs-article', { slug: doc.slug.split('/') }),
    })
  }

  return items
})

const CLIENT_GROUP_ORDER = [
  '客户端快捷操作',
  'OBS 场景与控制',
  'VTS 动态控制',
  '自动操作规则',
  '客户端功能',
  '客户端配置与子页面',
  '快捷操作',
  '管理后台',
  'OBS 组件库',
  '直播工具箱',
  '使用文档',
]

const WEB_GROUP_ORDER = ['快捷操作', '管理后台', 'OBS 组件库', '直播工具箱', '桌面客户端', '使用文档']

const allItems = computed<CommandItem[]>(() => {
  const merged = [...dynamicItems.value, ...staticItems.value]
  const orderList = isInClient.value ? CLIENT_GROUP_ORDER : WEB_GROUP_ORDER
  const rankMap = new Map(orderList.map((name, idx) => [name, idx]))
  return merged.toSorted((a, b) => {
    const rankA = rankMap.get(a.group) ?? orderList.length
    const rankB = rankMap.get(b.group) ?? orderList.length
    return rankA - rankB
  })
})

function matchesFilter(item: CommandItem, tab: FilterTab): boolean {
  if (tab === 'all') return true
  if (tab === 'client') return item.scope === 'client' || item.scope === 'dynamic'
  if (tab === 'dynamic') return item.scope === 'dynamic'
  return item.scope === 'manage' || item.scope === 'docs'
}

function scoreItem(item: CommandItem, tokens: string[]): number {
  const labelLower = item.label.toLowerCase()
  const descLower = (item.description ?? '').toLowerCase()
  const groupLower = item.group.toLowerCase()
  const badgeLower = (item.badge ?? '').toLowerCase()
  const kwLower = item.keywords.map((k) => k.toLowerCase())

  let score = 0
  for (const token of tokens) {
    let tokenScore = 0
    if (labelLower === token) tokenScore = 120
    else if (labelLower.startsWith(token)) tokenScore = 70
    else if (labelLower.includes(token)) tokenScore = 45
    else if (kwLower.some((k) => k === token)) tokenScore = 35
    else if (kwLower.some((k) => k.includes(token))) tokenScore = 20
    else if (badgeLower.includes(token) || groupLower.includes(token)) tokenScore = 15
    else if (descLower.includes(token)) tokenScore = 8
    else return -1
    score += tokenScore
  }

  if (isInClient.value && (item.scope === 'client' || item.scope === 'dynamic')) {
    score += 15
  }
  return score
}

const recentItems = computed<CommandItem[]>(() => {
  const ids = Array.isArray(recentIds.value) ? recentIds.value : []
  if (ids.length === 0) return []
  const byId = new Map(allItems.value.map((item) => [item.id, item]))
  return ids
    .map((id) => byId.get(id))
    .filter((item): item is CommandItem => Boolean(item) && matchesFilter(item, activeFilter.value))
    .slice(0, 5)
})

const filteredItems = computed<CommandItem[]>(() => {
  const scoped = allItems.value.filter((item) => matchesFilter(item, activeFilter.value))
  const raw = query.value.trim().toLowerCase()
  if (!raw) return scoped

  const tokens = raw.split(/\s+/).filter(Boolean)
  const scored: { item: CommandItem; score: number }[] = []
  for (const item of scoped) {
    const score = scoreItem(item, tokens)
    if (score >= 0) {
      scored.push({ item, score })
    }
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.map((entry) => entry.item)
})

const groupedItems = computed(() => {
  const groups: { name: string; items: { item: CommandItem; flatIndex: number }[] }[] = []
  let flatIndex = 0

  // 无搜索词时置顶显示最近使用
  if (!query.value.trim() && recentItems.value.length > 0) {
    groups.push({
      name: '最近使用',
      items: recentItems.value.map((item) => ({ item, flatIndex: flatIndex++ })),
    })
  }

  const map = new Map<string, { item: CommandItem; flatIndex: number }[]>()
  for (const item of filteredItems.value) {
    let list = map.get(item.group)
    if (!list) {
      list = []
      map.set(item.group, list)
      groups.push({ name: item.group, items: list })
    }
    list.push({ item, flatIndex: flatIndex++ })
  }
  return groups
})

const flatDisplayItems = computed(() => groupedItems.value.flatMap((g) => g.items.map((x) => x.item)))

watch([filteredItems, activeFilter], () => {
  activeIndex.value = 0
})

watch(open, async (val) => {
  if (!val) {
    query.value = ''
    activeIndex.value = 0
    activeFilter.value = 'all'
    return
  }
  await nextTick()
  const el = inputWrapperRef.value?.querySelector('input')
  el?.focus()
})

function setFilter(tab: FilterTab) {
  activeFilter.value = tab
  void nextTick(() => {
    inputWrapperRef.value?.querySelector('input')?.focus()
  })
}

function cycleFilter() {
  const tabs = filterTabs.value
  const idx = tabs.findIndex((t) => t.key === activeFilter.value)
  const next = tabs[(idx + 1) % tabs.length]
  if (next) setFilter(next.key)
}

function executeItem(item: CommandItem | undefined) {
  if (!item) return
  recordRecent(item.id)
  closePalette()
  void item.run()
}

function scrollActiveIntoView() {
  void nextTick(() => {
    const el = listRef.value?.querySelector(`[data-cmd-index="${activeIndex.value}"]`)
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest' })
    }
  })
}

function handlePaletteKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    event.preventDefault()
    cycleFilter()
    return
  }

  const total = flatDisplayItems.value.length
  if (total === 0) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % total
    scrollActiveIntoView()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + total) % total
    scrollActiveIntoView()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    executeItem(flatDisplayItems.value[activeIndex.value])
  }
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    togglePalette()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="p-0 gap-0 overflow-hidden sm:max-w-lg [&>button]:hidden"
      @keydown="handlePaletteKeydown"
    >
      <DialogTitle class="sr-only">全局命令面板</DialogTitle>
      <DialogDescription class="sr-only">搜索并快速跳转到功能页面、工具箱或执行快捷操作</DialogDescription>

      <div
        ref="inputWrapperRef"
        class="flex items-center gap-2 border-b border-border px-3 py-2"
      >
        <Search class="size-4 text-muted-foreground shrink-0" />
        <Input
          v-model="query"
          size="default"
          :placeholder="
            isInClient ? '搜索页面、设置 Tab、VTS/OBS 控制或自动操作规则...' : '搜索页面、OBS 组件、工具箱或操作...'
          "
          class="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <kbd
          class="pointer-events-none inline-flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
        >
          Esc
        </kbd>
      </div>

      <!-- 范围筛选栏 -->
      <div
        class="flex items-center gap-1 border-b border-border/70 bg-muted/20 px-3 py-1.5 overflow-x-auto no-scrollbar"
      >
        <Button
          v-for="tab in filterTabs"
          :key="tab.key"
          size="xs"
          :variant="activeFilter === tab.key ? 'secondary' : 'ghost'"
          class="shrink-0"
          :class="activeFilter === tab.key ? 'font-semibold text-foreground' : 'text-muted-foreground'"
          @mousedown.prevent
          @click="setFilter(tab.key)"
        >
          {{ tab.label }}
        </Button>
      </div>

      <div
        ref="listRef"
        class="max-h-[min(60vh,420px)] overflow-y-auto p-1.5 scrollbar-thin"
      >
        <div
          v-if="groupedItems.length === 0"
          class="py-10 text-center text-xs text-muted-foreground"
        >
          未找到匹配的命令、页面或规则
        </div>

        <template
          v-for="group in groupedItems"
          :key="group.name"
        >
          <div class="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">
            <History
              v-if="group.name === '最近使用'"
              class="size-3 shrink-0"
            />
            <span>{{ group.name }}</span>
          </div>
          <Button
            v-for="{ item, flatIndex } in group.items"
            :key="`${group.name}-${item.id}`"
            :data-cmd-index="flatIndex"
            variant="ghost"
            class="flex w-full h-auto justify-start items-center gap-2.5 rounded-md px-2.5 py-2 text-left font-normal"
            :class="flatIndex === activeIndex ? 'bg-accent text-accent-foreground' : ''"
            @mouseenter="activeIndex = flatIndex"
            @click="executeItem(item)"
          >
            <component
              :is="item.icon"
              class="size-4 shrink-0 text-muted-foreground"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="font-medium truncate">{{ item.label }}</span>
                <Badge
                  v-if="item.badge"
                  variant="secondary"
                  size="xs"
                  class="shrink-0"
                >
                  {{ item.badge }}
                </Badge>
              </div>
              <div
                v-if="item.description"
                class="text-[11px] text-muted-foreground truncate"
              >
                {{ item.description }}
              </div>
            </div>
            <CornerDownLeft
              v-if="flatIndex === activeIndex"
              class="size-3.5 shrink-0 text-muted-foreground"
            />
          </Button>
        </template>
      </div>

      <div class="flex-between border-t border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>↑↓ 选择 · Enter 确认 · Tab 切换范围</span>
        <span>Ctrl+K 呼出</span>
      </div>
    </DialogContent>
  </Dialog>
</template>
