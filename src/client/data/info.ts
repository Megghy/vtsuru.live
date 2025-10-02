import type { BiliRoomInfo, BiliStreamingInfo, FetcherStatisticData } from './models' // 假设模型路径
import { error, info } from '@tauri-apps/plugin-log'
import { format } from 'date-fns'
import { ref } from 'vue'
import { useAccount } from '@/api/account'
import { useTauriStore } from '../store/useTauriStore'
import { QueryBiliAPI } from './utils' // 假设 Bili API 工具路径
// import { useAccount } from '@/api/account'; // 如果需要账户信息

// const accountInfo = useAccount(); // 如果需要

export const STATISTIC_STORE_KEY = 'webfetcher.statistics'

/**
 * 当前日期 (YYYY-MM-DD) 的统计数据 (会被持久化)
 */
export const currentStatistic = ref<FetcherStatisticData>()
/**
 * 标记当前统计数据是否已更新且需要保存
 */
export const shouldUpdateStatistic = ref(false)

/**
 * 直播流信息 (从B站API获取)
 */
export const streamingInfo = ref<BiliStreamingInfo>({
  status: 'prepare', // 初始状态
} as BiliStreamingInfo)

/**
 * 房间基本信息 (从B站API获取)
 */
export const roomInfo = ref<BiliRoomInfo>() // 可以添加房间信息

// --- Bili API 更新相关 ---
const updateCount = ref(0) // 用于控制API调用频率的计数器

/**
 * 初始化统计和信息获取逻辑
 */
export function initInfo() {
  // 立即执行一次以加载或初始化当天数据
  updateCallback()
  // 设置定时器，定期检查和保存统计数据，并更新直播间信息
  setInterval(() => {
    updateCallback()
  }, 5000) // 每 5 秒检查一次统计数据保存和更新直播信息
}

/**
 * 定时回调函数: 处理统计数据持久化和B站信息更新
 */
async function updateCallback() {
  const store = useTauriStore()
  const currentDate = format(new Date(), 'yyyy-MM-dd')
  const key = `${STATISTIC_STORE_KEY}.${currentDate}`

  // --- 统计数据管理 ---
  // 检查是否需要加载或初始化当天的统计数据
  if (!currentStatistic.value || currentStatistic.value.date !== currentDate) {
    const loadedData = await store.get<FetcherStatisticData>(key)
    if (loadedData && loadedData.date === currentDate) {
      currentStatistic.value = loadedData
      // 确保 eventTypeCounts 存在
      if (!currentStatistic.value.eventTypeCounts) {
        currentStatistic.value.eventTypeCounts = {}
      }
      // info(`Loaded statistics for ${currentDate}`); // 日志保持不变
    } else {
      info(`Initializing statistics for new day: ${currentDate}`)
      currentStatistic.value = {
        date: currentDate,
        count: 0,
        eventTypeCounts: {}, // 初始化类型计数
      }
      await store.set(key, currentStatistic.value) // 立即保存新一天的初始结构
      shouldUpdateStatistic.value = false // 重置保存标记

      // 清理旧数据逻辑 (保持不变)
      const allKeys = (await store.store.keys()).filter(k => k.startsWith(STATISTIC_STORE_KEY))
      if (allKeys.length > 30) { // 例如，只保留最近30天的数据
        allKeys.sort() // 按日期字符串升序排序
        const oldestKey = allKeys[0]
        await store.store.delete(oldestKey)
        info(`清理过期统计数据: ${oldestKey}`)
      }
    }
  }

  // 如果数据有更新，则保存
  if (shouldUpdateStatistic.value && currentStatistic.value) {
    try {
      await store.set(key, currentStatistic.value)
      shouldUpdateStatistic.value = false // 保存后重置标记
    } catch (err) {
      error(`Failed to save statistics: ${err}`)
    }
  }

  // --- B站信息更新 ---
  let updateDelay = 30 // 默认30秒更新一次房间信息
  if (streamingInfo.value.status === 'streaming' && !import.meta.env.DEV) {
    updateDelay = 15 // 直播中15秒更新一次 (可以适当调整)
  }
  // 使用取模运算控制调用频率
  if (updateCount.value % (updateDelay / 5) === 0) { // 因为主循环是5秒一次
    updateRoomAndStreamingInfo()
  }
  updateCount.value++
}

/**
 * 记录一个接收到的事件 (由 useWebFetcher 调用)
 * @param eventType 事件类型字符串 (例如 "DANMU_MSG")
 */
export function recordEvent(eventType: string) {
  const currentDate = format(new Date(), 'yyyy-MM-dd')

  // 确保 currentStatistic 已为当天初始化
  if (!currentStatistic.value || currentStatistic.value.date !== currentDate) {
    // 理论上 updateCallback 会先执行初始化，这里加个警告以防万一
    console.warn('recordEvent called before currentStatistic was initialized for today.')
    // 可以选择在这里强制调用一次 updateCallback 来初始化，但这可能是异步的
    // await updateCallback(); // 可能会引入复杂性
    return // 或者直接返回，丢失这个事件计数
  }

  // 增加总数
  currentStatistic.value.count++

  // 增加对应类型的计数
  if (!currentStatistic.value.eventTypeCounts) {
    currentStatistic.value.eventTypeCounts = {} // 防御性初始化
  }
  currentStatistic.value.eventTypeCounts[eventType] = (currentStatistic.value.eventTypeCounts[eventType] || 0) + 1

  // 标记需要保存
  shouldUpdateStatistic.value = true
}

/**
 * 从 command 数据中解析事件类型
 * (需要根据实际接收到的数据结构调整)
 */
export function getEventType(command: any): string {
  if (typeof command === 'string') {
    try {
      command = JSON.parse(command)
    } catch (e) {
      return 'UNKNOWN_FORMAT'
    }
  }

  if (command && typeof command === 'object') {
    // 优先使用 'cmd' 字段 (常见于 Web 或 OpenLive)
    if (command.cmd) return command.cmd
    // 备选 'command' 字段
    if (command.command) return command.command
    // 备选 'type' 字段
    if (command.type) return command.type
  }
  return 'UNKNOWN' // 未知类型
}

/**
 * 获取指定天数的历史统计数据
 * @param days 要获取的天数，默认为 7
 */
export async function getHistoricalStatistics(days: number = 7): Promise<FetcherStatisticData[]> {
  const store = useTauriStore()
  const keys = (await store.store.keys())
    .filter(key => key.startsWith(STATISTIC_STORE_KEY))
    .sort((a, b) => b.localeCompare(a)) // 按日期降序排序

  const historicalData: FetcherStatisticData[] = []
  for (let i = 0; i < Math.min(days, keys.length); i++) {
    const data = await store.get<FetcherStatisticData>(keys[i])
    if (data) {
      historicalData.push(data)
    }
  }
  return historicalData.reverse() // 返回按日期升序排列的结果
}

/**
 * 更新房间和直播流信息
 */
async function updateRoomAndStreamingInfo() {
  const account = useAccount()
  if (!account.value.biliRoomId) {
    // error("无法获取房间ID以更新直播信息");
    return
  }

  try {
    // 查询房间基本信息
    const roomRes = await QueryBiliAPI(
      `https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${account.value.biliRoomId}`,
    )
    const json = await roomRes.json()
    if (json.code === 0) {
      roomInfo.value = json.data
    } else {
      error(`Failed to fetch Bili room info: ${json.message}`)
    }
    // 查询直播流信息 (开放平台或Web接口)
    // 注意：这里可能需要根据所选模式（openlive/direct）调用不同的API
    // 以下是Web接口示例
    const streamRes = await QueryBiliAPI(
      `https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids?uids[]=${roomInfo.value?.uid}`, // 通过 UID 查询
      // 或者使用 `https://api.live.bilibili.com/xlive/web-room/v1/index/getRoomBaseInfo?room_ids=${roomId}&req_biz=web_room_componet`
    )
    const streamJson = await streamRes.json()
    if (streamJson.code === 0 && streamJson.data && roomInfo.value?.uid) {
      // Web API 返回的是一个以 UID 为 key 的对象
      const uidData = streamJson.data[roomInfo.value.uid.toString()]
      if (uidData) {
        streamingInfo.value = {
          ...uidData, // 合并获取到的数据
          status: uidData.live_status === 1 ? 'streaming' : uidData.live_status === 2 ? 'rotating' : 'prepare',
        }
      } else {
        // 如果没有对应UID的数据，可能表示未开播或接口变更
        // streamingInfo.value = { status: 'prepare', ...streamingInfo.value }; // 保留旧数据，状态设为prepare
      }
    } else if (streamJson.code !== 0) {
      error(`Failed to fetch Bili streaming info: ${streamJson.message}`)
      // 可选：如果获取失败，将状态设为未知或准备
      // streamingInfo.value = { status: 'prepare', ...streamingInfo.value };
    }
  } catch (err) {
    error(`Error updating room/streaming info: ${err}`)
  }
}
