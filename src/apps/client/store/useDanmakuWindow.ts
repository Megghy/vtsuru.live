import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow'

import type { EventModel } from '@/api/api-models'
import { EventDataTypes, GuardLevel } from '@/api/api-models'
import { fetchOfficialLiveStats, officialLiveStats } from '@/shared/services/officialLiveStats'
import { usePersistedStorage } from '@/shared/storage/persist'
import { postBroadcastMessage } from '@/shared/utils/broadcastChannel'
import { useDanmakuClient } from '@/store/useDanmakuClient'

export interface DanmakuWindowSettings {
  width: number
  height: number
  x: number
  y: number
  opacity: number // 窗口透明度
  showAvatar: boolean // 是否显示头像
  showUsername: boolean // 是否显示用户名
  showFansMedal: boolean // 是否显示粉丝牌
  showGuardIcon: boolean // 是否显示舰长图标
  fontSize: number // 弹幕字体大小
  maxDanmakuCount: number // 最大显示的弹幕数量
  reverseOrder: boolean // 是否倒序显示（从下往上）
  filterTypes: string[] // 要显示的弹幕类型
  animationDuration: number // 动画持续时间
  enableAnimation: boolean // 是否启用动画效果
  backgroundColor: string // 背景色
  windowBackgroundColor: string // 窗口背景色
  textColor: string // 文字颜色
  alwaysOnTop: boolean // 是否总在最前
  interactive: boolean // 是否可交互(穿透鼠标点击)
  borderRadius: number // 边框圆角
  itemSpacing: number // 项目间距
  enableShadow: boolean // 是否启用阴影
  shadowColor: string // 阴影颜色
  autoDisappearTime: number // 单位：秒，0表示不自动消失
  displayStyle: string // 新增：显示风格，可选值：'card'（卡片风格）, 'text'（纯文本风格）
  textStyleCompact: boolean // 新增：纯文本模式下是否使用紧凑布局
  textStyleShowType: boolean // 新增：纯文本模式下是否显示消息类型标签
  textStyleNameSeparator: string // 新增：纯文本模式下用户名和消息之间的分隔符
  showStatusBar?: boolean // 是否显示顶部实时状态栏
  showWatchedCount?: boolean // 是否显示观看人数
  showLikeCount?: boolean // 是否显示点赞数
  showIncome?: boolean // 是否显示本场收益
  hideIncomeAmount?: boolean // 是否脱敏隐藏金额
  showOnlineCount?: boolean // 是否显示在线人数
  contentProtected?: boolean // 是否开启防录屏/防OBS捕捉(内容保护)
}

export interface LiveStatsData {
  watchedCount: number // 累计观看人数 (官方观看人次)
  watchedText?: string | null // 观看人数文本 (如 "1.2万人看过")
  likeCount: number // 累计点赞数 (官方本场点赞总数)
  totalIncome: number // 本场总收益 (元)
  onlineCount: number // 实时在线活跃/高能人数
  popularity?: number | null // 官方人气值
}

export const DANMAKU_WINDOW_BROADCAST_CHANNEL = 'channel.danmaku.window'
export type DanmakuWindowBCData =
  | {
      type: 'danmaku'
      data: EventModel
    }
  | {
      type: 'update-setting'
      data: DanmakuWindowSettings
    }
  | {
      type: 'window-ready'
    }
  | {
      type: 'clear-danmaku' // 新增：清空弹幕消息
    }
  | {
      type: 'test-danmaku' // 新增：测试弹幕消息
      data: EventModel
    }
  | {
      type: 'live-stats' // 实时状态统计数据
      data: LiveStatsData
    }
  | {
      type: 'toggle-interactive' // 切换鼠标穿透状态
    }

// Helper function to generate random test data
function generateTestDanmaku(): EventModel {
  const types = [
    EventDataTypes.Message,
    EventDataTypes.Gift,
    EventDataTypes.SC,
    EventDataTypes.Guard,
    EventDataTypes.Enter,
  ]
  const randomType = types[Math.floor(Math.random() * types.length)]
  const randomUid = Math.floor(Math.random() * 1000000)
  const randomName = `测试用户${randomUid % 100}`
  const randomTime = Date.now()
  const randomOuid = `oid_${randomUid}`

  // 扩展粉丝勋章相关的随机数据
  const hasMedal = Math.random() > 0.3 // 70% 概率拥有粉丝勋章
  const isWearingMedal = hasMedal && Math.random() > 0.2 // 佩戴粉丝勋章的概率
  const medalNames = ['鸽子团', '鲨鱼牌', '椰奶', '饼干', '猫猫头', '南极', '狗妈', '可爱', '团子', '喵']
  const randomMedalName = medalNames[Math.floor(Math.random() * medalNames.length)]
  const randomMedalLevel = isWearingMedal ? Math.floor(Math.random() * 40) + 1 : 0

  const baseEvent: Partial<EventModel> = {
    uname: randomName,
    uface: `https://i0.hdslb.com/bfs/face/member/noface.jpg`, // Placeholder for user avatar
    uid: randomUid,
    open_id: randomOuid, // Assuming open_id is same as ouid for test
    time: randomTime,
    guard_level: Math.floor(Math.random() * 4),
    fans_medal_level: randomMedalLevel,
    fans_medal_name: randomMedalName,
    fans_medal_wearing_status: isWearingMedal,
    ouid: randomOuid,
  }

  switch (randomType) {
    case EventDataTypes.Message:
      return {
        ...baseEvent,
        type: EventDataTypes.Message,
        msg: `这是一条测试弹幕消息 ${Math.random().toString(36).substring(7)}`,
        num: 0, // Not applicable
        price: 0, // Not applicable
        emoji: Math.random() > 0.8 ? '😀' : undefined, // Randomly add emoji
      } as EventModel
    case EventDataTypes.Gift: {
      const giftNames = ['小花花', '辣条', '能量饮料', '小星星']
      const giftNums = [1, 5, 10]
      const giftPrices = [100, 1000, 5000] // Price in copper coins (100 = 0.1 yuan)
      return {
        ...baseEvent,
        type: EventDataTypes.Gift,
        msg: giftNames[Math.floor(Math.random() * giftNames.length)],
        num: giftNums[Math.floor(Math.random() * giftNums.length)],
        price: giftPrices[Math.floor(Math.random() * giftPrices.length)],
      } as EventModel
    }
    case EventDataTypes.SC: {
      const scPrices = [30, 50, 100, 500, 1000, 2000] // Price in yuan
      return {
        ...baseEvent,
        type: EventDataTypes.SC,
        msg: `这是一条测试SC消息！感谢老板！`,
        num: 1, // Not applicable
        price: scPrices[Math.floor(Math.random() * scPrices.length)],
      } as EventModel
    }
    case EventDataTypes.Guard: {
      const guardLevels = [GuardLevel.Jianzhang, GuardLevel.Tidu, GuardLevel.Zongdu]
      const guardPrices = {
        [GuardLevel.Jianzhang]: 198,
        [GuardLevel.Tidu]: 1998,
        [GuardLevel.Zongdu]: 19998,
        [GuardLevel.None]: 0, // Add missing GuardLevel.None case
      }
      const selectedGuardLevel = guardLevels[Math.floor(Math.random() * guardLevels.length)]
      return {
        ...baseEvent,
        type: EventDataTypes.Guard,
        msg: `开通了${selectedGuardLevel === GuardLevel.Jianzhang ? '舰长' : selectedGuardLevel === GuardLevel.Tidu ? '提督' : '总督'}`,
        num: 1, // Represents 1 month usually
        price: guardPrices[selectedGuardLevel],
        guard_level: selectedGuardLevel, // Ensure guard level matches
      } as EventModel
    }
    case EventDataTypes.Enter:
      return {
        ...baseEvent,
        type: EventDataTypes.Enter,
        msg: '进入了直播间',
        num: 0, // Not applicable
        price: 0, // Not applicable
      } as EventModel
    default: // Fallback to Message
      return {
        ...baseEvent,
        type: EventDataTypes.Message,
        msg: `默认测试弹幕`,
        num: 0,
        price: 0,
      } as EventModel
  }
}

export const useDanmakuWindow = defineStore('danmakuWindow', () => {
  const danmakuWindow = ref<WebviewWindow>()
  const danmakuWindowSetting = usePersistedStorage<DanmakuWindowSettings>('Setting.DanmakuWindow', {
    width: 400,
    height: 600,
    x: 100,
    y: 100,
    opacity: 0.9,
    showAvatar: true,
    showUsername: true,
    showFansMedal: true,
    showGuardIcon: true,
    fontSize: 14,
    maxDanmakuCount: 30,
    reverseOrder: false,
    filterTypes: ['Message', 'Gift', 'SC', 'Guard'],
    animationDuration: 300,
    backgroundColor: 'rgba(0,0,0,0.6)',
    windowBackgroundColor: 'rgba(0,0,0,0)',
    textColor: '#ffffff',
    alwaysOnTop: true,
    interactive: false,
    borderRadius: 8,
    itemSpacing: 5,
    enableShadow: true,
    shadowColor: 'rgba(0,0,0,0.5)',
    autoDisappearTime: 0, // 默认不自动消失
    displayStyle: 'card', // 新增：默认使用卡片风格
    textStyleCompact: false, // 新增：默认不使用紧凑布局
    textStyleShowType: true, // 新增：默认显示消息类型标签
    textStyleNameSeparator: ': ', // 新增：默认用户名和消息之间的分隔符为冒号+空格
    enableAnimation: true, // 新增：默认启用动画效果
    showStatusBar: true, // 新增：默认开启顶部实时数据状态栏
    showWatchedCount: true, // 新增：默认显示观看人数
    showLikeCount: true, // 新增：默认显示点赞数
    showIncome: true, // 新增：默认显示本场收益
    hideIncomeAmount: false, // 新增：默认不隐藏金额
    showOnlineCount: true, // 新增：默认显示在场人数
    contentProtected: false, // 新增：默认不开启防OBS抓屏保护
  })
  const danmakuClient = useDanmakuClient()
  const isWindowOpened = ref(false)
  let bc: BroadcastChannel | undefined

  const liveStats = ref<LiveStatsData>({
    watchedCount: 0,
    likeCount: 0,
    totalIncome: 0,
    onlineCount: 0,
  })

  const activeUsers = new Map<string, number>()
  const ONLINE_THRESHOLD_MS = 20 * 60 * 1000

  // 监听官方统计数据更新并同步
  watch(
    () => officialLiveStats.value,
    (stats) => {
      let changed = false
      if (stats.watchedCount !== null && stats.watchedCount !== liveStats.value.watchedCount) {
        liveStats.value.watchedCount = stats.watchedCount
        liveStats.value.watchedText = stats.watchedText
        changed = true
      }
      if (stats.totalLikes !== null && stats.totalLikes !== liveStats.value.likeCount) {
        liveStats.value.likeCount = stats.totalLikes
        changed = true
      }
      if (stats.onlineRank !== null && stats.onlineRank !== liveStats.value.onlineCount) {
        liveStats.value.onlineCount = stats.onlineRank
        changed = true
      }
      if (stats.popularity !== null && stats.popularity !== liveStats.value.popularity) {
        liveStats.value.popularity = stats.popularity
        changed = true
      }
      if (changed) syncLiveStats()
    },
    { deep: true, immediate: true },
  )

  function refreshOnlineCount() {
    const cutoff = Date.now() - ONLINE_THRESHOLD_MS
    for (const [key, time] of activeUsers.entries()) {
      if (time < cutoff) activeUsers.delete(key)
    }
    // 优先使用官方在线高能观众数，未获取时回退到本地互动活跃人数
    if (officialLiveStats.value.onlineRank !== null) {
      liveStats.value.onlineCount = officialLiveStats.value.onlineRank
    } else {
      liveStats.value.onlineCount = activeUsers.size
    }
  }

  function recordActivity(uid: number | string, uname?: string) {
    const key = String(uid || uname || '')
    if (key && key !== '0') {
      activeUsers.set(key, Date.now())
      refreshOnlineCount()
    }
  }

  function syncLiveStats() {
    if (!isWindowOpened.value || !bc) return
    postBroadcastMessage(bc, {
      type: 'live-stats',
      data: { ...liveStats.value },
    } satisfies DanmakuWindowBCData)
  }

  function closeWindow() {
    danmakuWindow.value?.hide()
    isWindowOpened.value = false
  }
  function openWindow() {
    if (!isInited) {
      init()
    }
    checkAndUseSetting(danmakuWindowSetting.value)
    danmakuWindow.value?.show()
    isWindowOpened.value = true
  }

  function setDanmakuWindowSize(width: number, height: number) {
    danmakuWindowSetting.value.width = width
    danmakuWindowSetting.value.height = height
    danmakuWindow.value?.setSize(new PhysicalSize(width, height))
  }

  function setDanmakuWindowPosition(x: number, y: number) {
    danmakuWindowSetting.value.x = x
    danmakuWindowSetting.value.y = y
    danmakuWindow.value?.setPosition(new PhysicalPosition(x, y))
  }
  function updateWindowPosition() {
    danmakuWindow.value?.setPosition(new PhysicalPosition(danmakuWindowSetting.value.x, danmakuWindowSetting.value.y))
  }
  let isInited = false

  async function init() {
    if (isInited) return
    danmakuWindow.value = (await getAllWebviewWindows()).find((win) => win.label === 'danmaku-window')
    if (!danmakuWindow.value) {
      window.$message.error('弹幕窗口不存在，请先打开弹幕窗口。')
      return
    }
    console.log('打开弹幕窗口', danmakuWindow.value.label, danmakuWindowSetting.value)

    danmakuWindow.value.onCloseRequested((event) => {
      event.preventDefault() // 阻止默认关闭行为
      closeWindow()
      console.log('弹幕窗口关闭')
    })
    danmakuWindow.value.onMoved(({ payload: position }) => {
      danmakuWindowSetting.value.x = position.x
      danmakuWindowSetting.value.y = position.y
    })

    bc = new BroadcastChannel(DANMAKU_WINDOW_BROADCAST_CHANNEL)
    bc.onmessage = (event: MessageEvent<DanmakuWindowBCData>) => {
      if (event.data.type === 'window-ready') {
        console.log(`[danmaku-window] 窗口已就绪`)
        postBroadcastMessage(bc, {
          type: 'update-setting',
          data: danmakuWindowSetting.value,
        } satisfies DanmakuWindowBCData)
        postBroadcastMessage(bc, {
          type: 'live-stats',
          data: { ...liveStats.value },
        } satisfies DanmakuWindowBCData)
      } else if (event.data.type === 'toggle-interactive') {
        danmakuWindowSetting.value.interactive = !danmakuWindowSetting.value.interactive
        console.log(`[danmaku-window] 鼠标穿透已切换为: ${danmakuWindowSetting.value.interactive}`)
      }
    }
    postBroadcastMessage(bc, { type: 'window-ready' } satisfies DanmakuWindowBCData)
    postBroadcastMessage(bc, {
      type: 'update-setting',
      data: danmakuWindowSetting.value,
    } satisfies DanmakuWindowBCData)
    postBroadcastMessage(bc, {
      type: 'live-stats',
      data: { ...liveStats.value },
    } satisfies DanmakuWindowBCData)

    postBroadcastMessage(bc, {
      type: 'danmaku',
      data: {
        type: EventDataTypes.Message,
        msg: '弹幕窗口已打开',
      } as EventModel,
    } satisfies DanmakuWindowBCData)

    danmakuClient.onEvent('danmaku', (event) => onGetDanmakus(event))
    danmakuClient.onEvent('gift', (event) => onGetDanmakus(event))
    danmakuClient.onEvent('sc', (event) => onGetDanmakus(event))
    danmakuClient.onEvent('guard', (event) => onGetDanmakus(event))
    danmakuClient.onEvent('enter', (event) => onGetDanmakus(event))
    danmakuClient.onEvent('scDel', (event) => onGetDanmakus(event))
    danmakuClient.onEvent('like', (event) => onGetDanmakus(event))

    watch(
      () => danmakuWindowSetting,
      async (newValue) => {
        if (danmakuWindow.value) {
          postBroadcastMessage(bc, {
            type: 'update-setting',
            data: newValue.value,
          } satisfies DanmakuWindowBCData)
          await checkAndUseSetting(newValue.value)
        }
      },
      { deep: true },
    )

    console.log('[danmaku-window] 初始化完成')

    isInited = true
  }
  async function checkAndUseSetting(setting: DanmakuWindowSettings) {
    if (setting.alwaysOnTop) {
      await danmakuWindow.value?.setAlwaysOnTop(true)
    } else {
      await danmakuWindow.value?.setAlwaysOnTop(false)
    }
    if (setting.interactive) {
      await danmakuWindow.value?.setIgnoreCursorEvents(true)
    } else {
      await danmakuWindow.value?.setIgnoreCursorEvents(false)
    }
    if (setting.contentProtected) {
      await danmakuWindow.value?.setContentProtected(true)
    } else {
      await danmakuWindow.value?.setContentProtected(false)
    }
  }

  function onGetDanmakus(data: EventModel) {
    if (!isWindowOpened.value || !bc) return

    // 统计数据维护
    recordActivity(data.uid, data.uname)

    if (data.type === EventDataTypes.Like) {
      // 若官方本场总点赞未获取，使用单次累加；若已获取官方总点赞，保留官方总点赞
      if (officialLiveStats.value.totalLikes === null) {
        liveStats.value.likeCount += Math.max(1, data.num || 1)
      }
    } else if (data.type === EventDataTypes.Gift) {
      // 礼物价格转换为元 (B站金瓜子 1000 = 1元，或者直接按元)
      const giftYuan = (data.price || 0) >= 100 ? (data.price || 0) / 1000 : (data.price || 0)
      liveStats.value.totalIncome = Math.round((liveStats.value.totalIncome + giftYuan) * 100) / 100
    } else if (data.type === EventDataTypes.SC) {
      liveStats.value.totalIncome = Math.round((liveStats.value.totalIncome + (data.price || 0)) * 100) / 100
    } else if (data.type === EventDataTypes.Guard) {
      const guardPrice = data.price || (data.guard_level === GuardLevel.Zongdu ? 19998 : data.guard_level === GuardLevel.Tidu ? 1998 : 198)
      liveStats.value.totalIncome = Math.round((liveStats.value.totalIncome + guardPrice) * 100) / 100
    }

    syncLiveStats()

    postBroadcastMessage(bc, {
      type: 'danmaku',
      data,
    } satisfies DanmakuWindowBCData)
  }

  // 新增：清空弹幕函数
  function clearAllDanmaku() {
    if (!isWindowOpened.value || !bc) {
      console.warn('[danmaku-window] 窗口未打开或 BC 未初始化，无法清空弹幕')
      return
    }
    postBroadcastMessage(bc, {
      type: 'clear-danmaku',
    } satisfies DanmakuWindowBCData)
    console.log('[danmaku-window] 发送清空弹幕指令')
  }

  // 新增：重置实时统计
  function resetLiveStats() {
    liveStats.value = {
      watchedCount: officialLiveStats.value.watchedCount ?? 0,
      watchedText: officialLiveStats.value.watchedText,
      likeCount: officialLiveStats.value.totalLikes ?? 0,
      totalIncome: 0,
      onlineCount: officialLiveStats.value.onlineRank ?? 0,
      popularity: officialLiveStats.value.popularity,
    }
    activeUsers.clear()
    syncLiveStats()
  }

  // 新增：发送测试弹幕函数
  function sendTestDanmaku() {
    if (!isWindowOpened.value || !bc) {
      console.warn('[danmaku-window] 窗口未打开或 BroadcastChannel 未初始化，无法发送测试弹幕')
      return
    }
    const testData = generateTestDanmaku()

    // 仅在官方数据为空时模拟推进观看与点赞统计
    if (officialLiveStats.value.watchedCount === null) {
      liveStats.value.watchedCount = Math.max(liveStats.value.watchedCount + Math.floor(Math.random() * 5) + 1, 10)
    }
    if (officialLiveStats.value.totalLikes === null) {
      liveStats.value.likeCount += Math.floor(Math.random() * 3) + 1
    }
    onGetDanmakus(testData)

    postBroadcastMessage(bc, {
      type: 'test-danmaku',
      data: testData,
    } satisfies DanmakuWindowBCData)
    console.log('[danmaku-window] 发送测试弹幕指令:', testData)
  }

  return {
    danmakuWindow,
    danmakuWindowSetting,
    setDanmakuWindowSize,
    setDanmakuWindowPosition,
    updateWindowPosition,
    isDanmakuWindowOpen: isWindowOpened,
    openWindow,
    closeWindow,
    init,
    liveStats,
    resetLiveStats,
    clearAllDanmaku, // 导出新函数
    sendTestDanmaku, // 导出新函数
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDanmakuWindow, import.meta.hot))
}
