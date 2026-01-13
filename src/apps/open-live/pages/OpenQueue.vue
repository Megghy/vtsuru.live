<script setup lang="ts">
import type {
  DataTableColumns,
} from 'naive-ui'
import type { CSSProperties, VNodeChild } from 'vue'
import type {
  DanmakuUserInfo,
  EventModel,
  OpenLiveInfo,
  ResponseQueueModel,
  Setting_Queue,
} from '@/api/api-models'
import {
  Checkmark12Regular,
  ClipboardTextLtr24Filled,
  Delete24Filled,
  Dismiss16Filled,
  Info24Filled,
  PeopleQueue24Filled,
  PresenceBlocked16Regular,
} from '@vicons/fluent'
import { ReloadCircleSharp } from '@vicons/ionicons5'
import { useStorage } from '@vueuse/core'
import { isSameDay } from 'date-fns'
import { List } from 'linqts'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NDataTable,
  NDivider,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NSpace,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
  useNotification,
} from 'naive-ui'
import { computed, h, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'
import { AddBiliBlackList, SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import {
  EventDataTypes,
  FunctionTypes,
  KeywordMatchType, // 保留 props 类型定义
  QueueFrom,
  QueueGiftFilterType,
  QueueSortType,
  QueueStatus,
} from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI, QueryPostAPIWithParams } from '@/api/query'
import { QUEUE_API_URL } from '@/shared/config'
import { useDanmakuClient } from '@/store/useDanmakuClient'
// import { useRoute } from 'vue-router' // 未使用
import QueueObsModal from '@/apps/open-live/components/queue/QueueObsModal.vue'
import QueueSettingsTab from '@/apps/open-live/components/queue/QueueSettingsTab.vue'
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'

// Props 定义 (虽然未在逻辑中直接使用，但可能由父组件传入或用于类型检查)
defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

// 默认队列设置
const defaultSettings = {
  keyword: '排队',
  enableOnStreaming: false,
  queueMaxSize: 10,
  allowAllDanmaku: true,
  allowFromWeb: true,
  needWearFanMedal: false,
  needJianzhang: false,
  needTidu: false,
  needZongdu: false,
  allowGift: true,
  giftNames: [],
  minGiftPrice: 0.1,
  allowIncreaseByAnyPayment: true,
  allowIncreasePaymentBySendGift: true,
  fanMedalMinLevel: 0,
  enableCooldown: false,
  cooldownSecond: 86400,
  zongduCooldownSecond: 10800,
  tiduCooldownSecond: 21600,
  jianzhangCooldownSecond: 43200,
  matchType: KeywordMatchType.Contains,
  sortType: QueueSortType.TimeFirst,
  giftFilterType: QueueGiftFilterType.Or,
  showRequireInfo: true,
  isReverse: false,
  showFanMadelInfo: true,
  showPayment: true,
  sendGiftDirectJoin: true,
  sendGiftIgnoreLimit: false,
} as Setting_Queue

// 队列状态映射
const STATUS_MAP = {
  [QueueStatus.Waiting]: '等待中',
  [QueueStatus.Progressing]: '处理中',
  [QueueStatus.Finish]: '已完成',
  [QueueStatus.Cancel]: '已取消',
}

// const route = useRoute() // 未使用
const accountInfo = useAccount()
const message = useMessage()
const notice = useNotification()
const client = await useDanmakuClient().initOpenlive() // 初始化弹幕客户端

const isWarnMessageAutoClose = useStorage('Queue.Settings.WarnMessageAutoClose', false) // 警告消息是否自动关闭
const isReverse = useStorage('Queue.Settings.Reverse', false) // 本地存储的倒序设置 (未登录时使用)
// const volumn = useStorage('Settings.Volumn', 0.5) // 未使用

const isLoading = ref(false) // 加载状态
const showOBSModal = ref(false) // OBS 组件模态框显示状态
const obsScrollSpeed = ref(1.0) // OBS 组件滚动速度

const filterName = ref('') // 历史记录筛选用户名
const filterNameContains = ref(false) // 历史记录筛选是否包含

// 队列设置 (登录后使用账户设置, 否则使用默认设置)
const settings = computed({
  get: () => {
    if (accountInfo.value.id) {
      return accountInfo.value.settings.queue
    }
    return defaultSettings
  },
  set: (value) => {
    if (accountInfo.value.id) {
      accountInfo.value.settings.queue = value
    }
  },
})

const localQueues = useStorage('Local.Queue', [] as ResponseQueueModel[]) // 本地存储的队列 (未登录时使用)
const originQueue = ref<ResponseQueueModel[]>([]) // 从 API 获取或本地存储的原始队列数据
const queue = computed(() => { // 当前显示的活动队列 (过滤、排序后)
  let list = new List(accountInfo.value ? originQueue.value : localQueues.value)
    .Where( // 按用户名筛选
      q =>
        !filterName.value
        || (filterNameContains.value
          ? q?.user?.name.toLowerCase().includes(filterName.value.toLowerCase()) == true
          : q?.user?.name.toLowerCase() == filterName.value.toLowerCase()),
    )
    .Where(q => (q?.status ?? QueueStatus.Cancel) < QueueStatus.Finish) // 仅显示未完成或取消的

  // 根据设置进行排序
  switch (settings.value.sortType) {
    case QueueSortType.TimeFirst: { // 时间优先
      list = list.OrderBy(q => q.createAt)
      break
    }
    case QueueSortType.GuardFirst: { // 舰长优先 (总督 > 提督 > 舰长 > 普通)
      list = list
        .OrderBy(q => (q.user?.guard_level == 0 || q.user?.guard_level == null ? 4 : q.user.guard_level))
        .ThenBy(q => q.createAt)
      break
    }
    case QueueSortType.PaymentFist: { // 付费优先
      list = list.OrderByDescending(q => q.giftPrice).ThenBy(q => q.createAt)
      break
    }
    case QueueSortType.FansMedalFirst: { // 粉丝牌优先 (佩戴 > 未佩戴, 等级高 > 等级低)
      list = list
        .OrderByDescending(q => (q.user?.fans_medal_wearing_status ? 1 : 0))
        .ThenByDescending(q => q.user?.fans_medal_level ?? 0)
        .ThenBy(q => q.createAt)
      break
    }
  }
  // 处理倒序
  if (configCanEdit.value ? settings.value.isReverse : isReverse.value) {
    list = list.Reverse()
  }
  // 将处理中的项置顶
  list = list.OrderByDescending(q => (q.status == QueueStatus.Progressing ? 1 : 0))
  return list.ToArray()
})
const historySongs = computed(() => { // 历史队列 (已完成或取消)
  return (accountInfo.value ? originQueue.value : localQueues.value)
    .filter((song) => {
      return song.status == QueueStatus.Finish || song.status == QueueStatus.Cancel
    })
    .sort((a, b) => (b.finishAt ?? b.createAt) - (a.finishAt ?? a.createAt)) // 按完成/创建时间降序
})

const newQueueName = ref('') // 手动添加的用户名

const defaultKeyword = useStorage('Settings.Queue.DefaultKeyword', '排队') // 本地存储的默认关键词
const configCanEdit = computed(() => { // 配置是否可编辑 (是否已登录)
  return accountInfo.value != null && accountInfo.value != undefined
})

const table = ref() // NDataTable 引用

// 获取所有队列数据
async function getAll() {
  if (accountInfo.value.id) {
    try {
      isLoading.value = true
      const data = await QueryGetAPI<ResponseQueueModel[]>(`${QUEUE_API_URL}get-all`, {
        id: accountInfo.value.id,
      })
      if (data.code == 200) {
        console.log('[OPEN-LIVE-Queue] 已获取所有数据')
        return data.data ?? [] // 确保返回数组
      } else {
        message.error(`无法获取队列数据: ${data.message}`)
        return []
      }
    } catch (err: any) {
      message.error(`获取队列数据失败: ${err.message || err}`)
      console.error('[OPEN-LIVE-Queue] 获取数据失败:', err)
      return []
    } finally {
      isLoading.value = false
    }
  } else {
    // 未登录时返回本地数据
    return localQueues.value
  }
}

// 尝试添加队列 (处理弹幕、礼物事件)
async function add(danmaku: EventModel) {
  // 检查消息是否符合加入条件
  if (!checkMessage(danmaku)) {
    return
  }
  console.log(`[OPEN-LIVE-QUEUE] 收到 [${danmaku.uname}] 的排队请求`)
  // 检查是否仅直播时允许加入
  if (settings.value.enableOnStreaming && accountInfo.value?.streamerInfo?.isStreaming != true) {
    message.info('当前未在直播中, 无法添加排队请求. 或者关闭设置中的仅允许直播时加入')
    return
  }

  if (accountInfo.value.id) { // 已登录，调用 API
    // 检查功能是否启用
    if (!accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.Queue)) {
      return
    }
    try {
      const data = await QueryPostAPI<ResponseQueueModel>(`${QUEUE_API_URL}try-add`, danmaku)
      if (data.code == 200) {
        if (data.message != 'EventFetcher') { // 避免重复处理 EventFetcher 的消息
          const existingIndex = originQueue.value.findIndex(q => q.id == data.data.id)
          if (existingIndex > -1) { // 用户已在队列中 (通常是送礼增加金额)
            const oldPrice = originQueue.value[existingIndex]?.giftPrice ?? 0
            const newPrice = data.data?.giftPrice ?? 0
            if (newPrice > oldPrice) {
              message.info(
                `${data.data.user?.name} 通过发送礼物再次付费: ¥ ${(newPrice - oldPrice).toFixed(1)}, 当前总计付费: ¥ ${newPrice.toFixed(1)}`,
              )
            }
            originQueue.value.splice(existingIndex, 1, data.data) // 替换现有条目
          } else { // 新用户加入
            originQueue.value.push(data.data) // 添加到末尾 (排序由 computed 处理)
            message.success(`[${danmaku.uname}] 添加至队列`)
          }
        }
      } else { // 添加失败
        const time = Date.now()
        notice.warning({
          title: `${danmaku.uname} 排队失败`,
          description: data.message,
          duration: isWarnMessageAutoClose.value ? 3000 : 0,
          meta: () => h(NTime, { type: 'relative', time, key: updateKey.value }), // 使用 updateKey 强制更新时间显示
        })
        console.log(`[OPEN-LIVE-QUEUE] [${danmaku.uname}] 排队失败: ${data.message}`)
      }
    } catch (err: any) {
      message.error(`[${danmaku.uname}] 添加队列时出错: ${err.message || err}`)
      console.error(`[OPEN-LIVE-QUEUE] 添加队列出错:`, err)
    }
  } else { // 未登录，操作本地队列
    const songData = {
      status: QueueStatus.Waiting,
      from: danmaku.type == EventDataTypes.Message ? QueueFrom.Danmaku : QueueFrom.Gift,
      giftPrice: danmaku.type == EventDataTypes.SC ? danmaku.price : undefined,
      user: {
        name: danmaku.uname,
        uid: danmaku.uid,
        oid: danmaku.open_id,
        fans_medal_level: danmaku.fans_medal_level,
        fans_medal_name: danmaku.fans_medal_name,
        fans_medal_wearing_status: danmaku.fans_medal_wearing_status,
        guard_level: danmaku.guard_level,
      } as DanmakuUserInfo,
      createAt: Date.now(),
      isInLocal: true,
      id: localQueues.value.length == 0 ? 1 : (new List(localQueues.value).Max(s => s.id) ?? 0) + 1, // 本地 ID
    } as ResponseQueueModel
    localQueues.value.unshift(songData) // 添加到本地队列开头
    message.success(`[${danmaku.uname}] 添加至本地队列`)
  }
}

// 手动添加用户至队列
async function addManual() {
  if (!newQueueName.value) {
    message.error('请输入用户名')
    return
  }
  if (accountInfo.value.id) { // 已登录，调用 API
    try {
      const data = await QueryPostAPIWithParams<ResponseQueueModel>(`${QUEUE_API_URL}add`, {
        name: newQueueName.value,
      })
      if (data.code == 200) {
        message.success(`已手动添加用户至队列: ${data.data.user?.name}`)
        originQueue.value.unshift(data.data) // 添加到原始队列开头
        newQueueName.value = ''
        console.log(`[OPEN-LIVE-QUEUE] 已手动添加用户至队列: ${data.data.user?.name}`)
      } else {
        message.error(`手动添加失败: ${data.message}`)
      }
    } catch (err: any) {
      message.error(`手动添加时出错: ${err.message || err}`)
      console.error(`[OPEN-LIVE-QUEUE] 手动添加出错:`, err)
    }
  } else { // 未登录，操作本地队列
    const songData = {
      status: QueueStatus.Waiting,
      from: QueueFrom.Manual,
      scPrice: undefined,
      user: { name: newQueueName.value } as DanmakuUserInfo,
      createAt: Date.now(),
      isInLocal: true,
      id: localQueues.value.length == 0 ? 1 : (new List(localQueues.value).Max(s => s.id) ?? 0) + 1,
    } as ResponseQueueModel
    localQueues.value.unshift(songData)
    message.success(`已手动添加用户至队列: ${newQueueName.value}`)
    newQueueName.value = ''
  }
}

// 更新队列状态
async function updateStatus(queueData: ResponseQueueModel, status: QueueStatus) {
  if (!configCanEdit.value) { // 未登录，直接修改本地状态
    const localItem = localQueues.value.find(q => q.id === queueData.id)
    if (localItem) {
      localItem.status = status
      if (status > QueueStatus.Progressing) {
        localItem.finishAt = Date.now()
      }
      message.success(`已更新本地 [${queueData.user?.name}] 队列状态为: ${STATUS_MAP[status]}`)
    }
    return
  }
  // 已登录，调用 API
  isLoading.value = true
  try {
    const data = await QueryGetAPI(`${QUEUE_API_URL}set-status`, {
      id: queueData.id,
      status,
    })
    if (data.code == 200) {
      console.log(`[OPEN-LIVE-QUEUE] 更新队列状态: ${queueData.user?.name} -> ${STATUS_MAP[status]}`)
      // 直接修改原始数据以触发响应式更新
      const itemInOrigin = originQueue.value.find(q => q.id === queueData.id)
      if (itemInOrigin) {
        itemInOrigin.status = status
        if (status > QueueStatus.Progressing) {
          itemInOrigin.finishAt = Date.now()
        }
      }
      message.success(`已更新 [${queueData.user?.name}] 队列状态为: ${STATUS_MAP[status]}`)
    } else {
      console.log(`[OPEN-LIVE-QUEUE] 更新队列状态失败: ${data.message}`)
      message.error(`更新队列状态失败: ${data.message}`)
    }
  } catch (err: any) {
    message.error(`更新队列状态时出错: ${err.message || err}`)
    console.error(`[OPEN-LIVE-QUEUE] 更新状态出错:`, err)
  } finally {
    isLoading.value = false
  }
}

// 弹幕事件处理
function onGetDanmaku(danmaku: EventModel) {
  add(danmaku)
}
// 礼物事件处理
function onGetGift(danmaku: EventModel) {
  add(danmaku)
}

// 检查消息是否符合加入队列的条件
function checkMessage(eventData: EventModel): boolean {
  // 未登录时，如果用户已在本地队列，则不允许重复添加 (简单检查)
  if (!configCanEdit.value && localQueues.value.some(q => q.user?.uid == eventData.uid && q.status < QueueStatus.Finish)) {
    console.log(`[OPEN-LIVE-QUEUE] 本地队列已存在用户 [${eventData.uname}]，跳过`)
    return false
  }

  // 检查弹幕消息
  if (eventData.type === EventDataTypes.Message) {
    if (!settings.value.keyword) return false // 未设置关键词则不允许弹幕加入
    if (!checkMatch(eventData.msg)) {
      return false // 弹幕内容不匹配关键词
    }
  }
  // 检查礼物消息
  else if (eventData.type === EventDataTypes.Gift) {
    // 如果不允许礼物加入，并且不允许通过送礼增加金额，则直接拒绝
    if (!settings.value.allowGift && !settings.value.allowIncreasePaymentBySendGift) {
      return false
    }
    // 如果允许礼物加入，则进行详细检查
    if (settings.value.allowGift) {
      const nameMatch = (settings.value.giftNames?.length ?? 0) === 0 // 未设置礼物名要求
        || settings.value.giftNames?.some(n => eventData.msg.toLowerCase() === n.toLowerCase()) == true // 礼物名匹配
      const priceMatch = !settings.value.minGiftPrice || eventData.price >= settings.value.minGiftPrice // 价格匹配

      if (settings.value.giftFilterType === QueueGiftFilterType.Or) { // 或逻辑：满足任一即可
        if (!nameMatch && !priceMatch) return false // 名称和价格都不满足
      } else { // 与逻辑：必须同时满足
        if (!nameMatch || !priceMatch) return false // 名称或价格不满足
      }
      // 如果设置了送礼直接加入，则检查通过
      if (settings.value.sendGiftDirectJoin) return true
      // 如果未设置直接加入，则送礼本身不触发加入，需要额外发弹幕
      else return false
    }
    // 如果只允许通过送礼增加金额 (不允许直接通过礼物加入)
    else if (settings.value.allowIncreasePaymentBySendGift) {
      // 检查是否允许任意礼物叠加 或 礼物是否在指定列表内
      const isAllowedGiftForIncrease = settings.value.allowIncreaseByAnyPayment
        || settings.value.giftNames?.some(n => eventData.msg.toLowerCase() === n.toLowerCase()) == true
      // 只有当礼物允许叠加时，才认为这是一个有效的（潜在增加金额的）事件，但不直接触发加入
      return isAllowedGiftForIncrease
    } else {
      return false // 其他情况不允许
    }
  }
  // 检查 SC 消息 (如果需要单独处理)
  // else if (eventData.type === EventDataTypes.SC) { ... }

  return true // 默认通过 (例如，手动添加或网页添加不经过此检查)

  // 内部函数：检查关键词匹配
  function checkMatch(word: string): boolean {
    const keyword = settings.value.keyword?.trim().toLowerCase()
    if (!keyword) return false // 没有关键词直接返回 false
    const message = word.trim().toLowerCase()
    switch (settings.value.matchType) {
      case KeywordMatchType.Full:
        return keyword === message
      case KeywordMatchType.Contains:
        return message.includes(keyword)
      case KeywordMatchType.Regex:
        try {
          return new RegExp(settings.value.keyword).test(word) // 使用原始 keyword 进行正则匹配
        } catch (e) {
          console.warn('[OPEN-LIVE-QUEUE] 正则表达式无效:', settings.value.keyword, e)
          return false
        }
      default:
        return false
    }
  }
}

// 更新功能启用状态
async function onUpdateFunctionEnable() {
  if (accountInfo.value.id) {
    const oldValue = JSON.parse(JSON.stringify(accountInfo.value.settings.enableFunctions))
    const isEnabling = !accountInfo.value.settings.enableFunctions.includes(FunctionTypes.Queue)

    if (isEnabling) {
      accountInfo.value.settings.enableFunctions.push(FunctionTypes.Queue)
      // 启用时检查并设置默认关键词
      if (!accountInfo.value.settings.queue.keyword) {
        accountInfo.value.settings.queue.keyword = defaultKeyword.value
        // 同时保存一次设置以确保关键词生效
        await updateSettings()
      }
    } else {
      accountInfo.value.settings.enableFunctions = accountInfo.value.settings.enableFunctions.filter(
        f => f != FunctionTypes.Queue,
      )
    }

    try {
      const data = await SaveEnableFunctions(accountInfo.value?.settings.enableFunctions)
      if (data.code == 200) {
        message.success(`已${isEnabling ? '启用' : '禁用'}队列功能`)
      } else {
        // 回滚状态
        if (accountInfo.value.id) {
          accountInfo.value.settings.enableFunctions = oldValue
        }
        message.error(`队列功能${isEnabling ? '启用' : '禁用'}失败: ${data.message}`)
      }
    } catch (err: any) {
      // 回滚状态
      if (accountInfo.value.id) {
        accountInfo.value.settings.enableFunctions = oldValue
      }
      message.error(`队列功能${isEnabling ? '启用' : '禁用'}失败: ${err.message || err}`)
      console.error(`[OPEN-LIVE-QUEUE] 更新功能状态失败:`, err)
    }
  }
}

// 更新设置
async function updateSettings() {
  if (accountInfo.value.id) {
    isLoading.value = true
    try {
      const success = await SaveSetting('Queue', settings.value)
      if (success) {
        message.success('设置已保存')
      } else {
        message.error('设置保存失败') // API 应该返回更详细的信息，但这里简化处理
      }
    } catch (err: any) {
      message.error(`保存设置失败: ${err.message || err}`)
      console.error(`[OPEN-LIVE-QUEUE] 保存设置失败:`, err)
    } finally {
      isLoading.value = false
    }
  } else {
    message.success('本地设置已更新 (未登录)') // 对于未登录用户，设置是响应式的，无需显式保存
  }
}

// 删除队列记录
async function deleteQueue(values: ResponseQueueModel[]) {
  if (!values || values.length === 0) return

  if (accountInfo.value.id) { // 已登录，调用 API
    isLoading.value = true
    try {
      const idsToDelete = values.map(s => s.id)
      const data = await QueryPostAPI(`${QUEUE_API_URL}del`, idsToDelete)
      if (data.code == 200) {
        message.success(`成功删除 ${values.length} 条记录`)
        // 从原始数据中移除已删除项
        originQueue.value = originQueue.value.filter(s => !idsToDelete.includes(s.id))
      } else {
        message.error(`删除失败: ${data.message}`)
        console.error(`[OPEN-LIVE-QUEUE] 删除失败: ${data.message}`)
      }
    } catch (err: any) {
      message.error(`删除记录时出错: ${err.message || err}`)
      console.error('[OPEN-LIVE-QUEUE] 删除记录出错:', err)
    } finally {
      isLoading.value = false
    }
  } else { // 未登录，操作本地队列
    const idsToDelete = values.map(v => v.id)
    localQueues.value = localQueues.value.filter(q => !idsToDelete.includes(q.id))
    message.success(`成功删除 ${values.length} 条本地记录`)
  }
}

// 取消所有活动队列项
async function deactiveAllSongs() {
  if (accountInfo.value.id) { // 已登录，调用 API
    isLoading.value = true
    try {
      const data = await QueryGetAPI(`${QUEUE_API_URL}deactive`)
      if (data.code == 200) {
        message.success('已全部取消')
        // 更新本地状态
        originQueue.value.forEach((s) => {
          if (s.status <= QueueStatus.Progressing) {
            s.status = QueueStatus.Cancel
            s.finishAt = Date.now() // 标记完成时间
          }
        })
      } else {
        message.error(`全部取消失败: ${data.message}`)
      }
    } catch (err: any) {
      message.error(`全部取消时出错: ${err.message || err}`)
      console.error('[OPEN-LIVE-QUEUE] 全部取消出错:', err)
    } finally {
      isLoading.value = false
    }
  } else { // 未登录，操作本地队列
    localQueues.value.forEach((s) => {
      if (s.status <= QueueStatus.Progressing) {
        s.status = QueueStatus.Cancel
        s.finishAt = Date.now()
      }
    })
    message.success('已全部取消本地活动队列')
  }
}

// 状态筛选选项
const statusFilterOptions = computed(() => {
  return Object.values(QueueStatus)
    .filter((t): t is QueueStatus => typeof t === 'number') // 确保是数字枚举值
    .map((t) => {
      return {
        label: STATUS_MAP[t],
        value: t,
      }
    })
})

// 历史记录表格列定义
const columns = computed<DataTableColumns<ResponseQueueModel>>(() => [
  {
    title: '用户名',
    key: 'user.name',
    render: (data) => {
      return h(
        NTooltip,
        { trigger: 'hover' },
        {
          trigger: () => data.user?.name || '未知用户',
          default: () => (data.from == QueueFrom.Manual ? '主播手动添加' : `UID: ${data.user?.uid ?? 'N/A'}`),
        },
      )
    },
    filterOptionValue: null, // 用于触发筛选
    filter: (value, row) => { // 使用 NDataTable 内置筛选
      const name = row.user?.name?.toLowerCase() ?? ''
      const filterVal = filterName.value.toLowerCase()
      if (!filterVal) return true
      return filterNameContains.value ? name.includes(filterVal) : name === filterVal
    },
  },
  {
    title: '来源',
    key: 'from',
    width: 120,
    render(data) {
      let fromType: 'info' | 'success' | 'default' | 'error' = 'default'
      let text = ''
      switch (data.from) {
        case QueueFrom.Danmaku: {
          fromType = 'info'
          text = `弹幕${data.giftPrice ? ` | ¥${data.giftPrice.toFixed(1)}` : ''}`
          break
        }
        case QueueFrom.Gift: {
          fromType = 'error'
          text = `礼物 | ¥${data.giftPrice?.toFixed(1) ?? '0.0'}`
          break
        }
        case QueueFrom.Web: {
          fromType = 'success'
          text = '网页添加'
          break
        }
        case QueueFrom.Manual: {
          fromType = 'default'
          text = '手动添加'
          break
        }
        default: text = '未知'
      }
      return h(NTag, { size: 'small', type: fromType, bordered: false }, () => text)
    },
  },
  {
    title: '状态',
    key: 'status',
    filterMultiple: false, // 只允许单选
    filterOptions: statusFilterOptions.value, // 使用计算属性
    filter: (value, row) => {
      return row.status === value
    },
    render(data) {
      let statusType: 'info' | 'success' | 'warning' | 'error'
      switch (data.status) {
        case QueueStatus.Progressing: {
          statusType = 'success'
          break
        }
        case QueueStatus.Waiting: {
          statusType = 'warning'
          break
        }
        case QueueStatus.Finish: {
          statusType = 'info'
          break
        }
        case QueueStatus.Cancel: {
          statusType = 'error'
          break
        }
      }
      return h(
        NTag,
        {
          type: statusType,
          size: 'small',
          bordered: false,
        },
        () => STATUS_MAP[data.status] ?? '未知状态',
      )
    },
  },
  {
    title: '时间',
    key: 'createAt', // 使用 createAt 作为 key 以便排序
    sorter: true,
    render: (data) => {
      return h(NTime, { time: data.createAt, type: 'datetime' }) // 显示完整时间
    },
  },
  {
    title: '操作',
    key: 'manage',
    width: 120, // 稍微加宽以容纳按钮
    align: 'center',
    render(data) {
      const buttons: VNodeChild[] = []

      // 重新排队按钮 (仅对已完成或取消的显示)
      if (data.status == QueueStatus.Finish || data.status == QueueStatus.Cancel) {
        buttons.push(
          h(NTooltip, null, {
            trigger: () =>
              h(
                NButton,
                {
                  size: 'tiny', // 统一尺寸
                  type: 'info',
                  circle: true,
                  loading: isLoading.value && queueDataBeingManaged.value === data.id, // 仅当前操作项显示 loading
                  onClick: () => {
                    queueDataBeingManaged.value = data.id // 标记正在操作的项
                    updateStatus(data, QueueStatus.Waiting)
                  },
                  style: 'margin: 0 2px;',
                },
                {
                  icon: () => h(NIcon, { component: ReloadCircleSharp }),
                },
              ),
            default: () => '重新放回等待',
          }),
        )
      }

      // 删除按钮
      buttons.push(
        h(
          NPopconfirm,
          { onPositiveClick: () => deleteQueue([data]) },
          {
            trigger: () =>
              h(NTooltip, null, {
                trigger: () =>
                  h(
                    NButton,
                    {
                      size: 'tiny', // 统一尺寸
                      type: 'error',
                      circle: true,
                      loading: isLoading.value && queueDataBeingManaged.value === data.id,
                      onClick: () => queueDataBeingManaged.value = data.id, // 标记以便显示 loading
                      style: 'margin: 0 2px;',
                    },
                    {
                      icon: () => h(NIcon, { component: Delete24Filled }),
                    },
                  ),
                default: () => '删除记录',
              }),
            default: () => `确定删除 ${data.user?.name} 的记录吗?`,
          },
        ),
      )

      return h(NSpace, { justify: 'center', size: 4 }, () => buttons) // 减小间距
    },
  },
])

// 用于标记历史记录表格中正在操作的行，以显示 loading
const queueDataBeingManaged = ref<number | null>(null)

// 监听筛选条件变化，手动触发 NDataTable 筛选
watch([filterName, filterNameContains], () => {
  if (table.value) {
    // 更新第一列的 filterOptionValue 来触发筛选
    const cols = table.value.columns
    cols[0].filterOptionValue = filterName.value + filterNameContains.value.toString()
    table.value.filter(cols[0])
  }
})

// 获取舰长等级对应的颜色
function GetGuardColor(level: number | null | undefined): string {
  if (level) {
    switch (level) {
      case 1: return 'rgb(122, 4, 35)' // 总督
      case 2: return 'rgb(157, 155, 255)' // 提督 (颜色可能需要调整)
      case 3: return 'rgb(104, 136, 241)' // 舰长
    }
  }
  return 'var(--n-text-color-3)' // 默认颜色或无舰长
}

// 定时更新活动队列信息 (增量更新)
async function updateActive() {
  if (!accountInfo.value.id) return // 未登录则不执行
  try {
    const data = await QueryGetAPI<ResponseQueueModel[]>(`${QUEUE_API_URL}get-active`, {
      id: accountInfo.value?.id,
    })
    if (data.code == 200) {
      const activeItems = data.data ?? []
      activeItems.forEach((item) => {
        const queueDataIndex = originQueue.value.findIndex(s => s.id == item.id)
        if (queueDataIndex > -1) { // 更新现有项
          const queueData = originQueue.value[queueDataIndex]
          // 仅在状态或价格变化时更新，减少不必要的响应式触发
          if (queueData.status !== item.status) {
            queueData.status = item.status
          }
          if (queueData.giftPrice !== item.giftPrice) {
            const oldPrice = queueData.giftPrice ?? 0
            const newPrice = item.giftPrice ?? 0
            if (newPrice > oldPrice) { // 仅在价格增加时提示
              message.info(
                `${queueData.user?.name} 通过发送礼物再次付费: ¥ ${(newPrice - oldPrice).toFixed(1)}, 当前总计付费: ¥ ${newPrice.toFixed(1)}`,
              )
            }
            queueData.giftPrice = item.giftPrice
          }
          // 如果有其他需要同步的字段，在此处添加比较和更新
          // if (updated) {
          //   // 可以考虑是否需要强制更新整个对象以确保响应性，但通常直接修改属性即可
          //   // originQueue.value.splice(queueDataIndex, 1, { ...queueData });
          // }
        } else { // 添加新项
          originQueue.value.unshift(item) // 添加到开头，让排序处理
          if (item.from == QueueFrom.Web) {
            message.success(`[${item.user?.name}] 通过网页加入队列`)
          } else if (item.from == QueueFrom.Gift && settings.value.sendGiftDirectJoin) {
            message.success(`[${item.user?.name}] 通过礼物加入队列`)
          }
          // 其他来源的添加消息在 add 函数中处理
        }
      })
      // 可选：移除本地存在但远程 active 接口未返回的非终态项 (表示可能被后台清理)
      // const activeIds = new Set(activeItems.map(i => i.id));
      // originQueue.value = originQueue.value.filter(q => q.status >= QueueStatus.Finish || activeIds.has(q.id));
    } else {
      // message.error('无法获取活动队列: ' + data.message) // 频繁请求，失败时不提示用户
      console.warn(`[OPEN-LIVE-Queue] 无法获取活动队列: ${data.message}`)
    }
  } catch (err: any) {
    console.warn('[OPEN-LIVE-Queue] 更新活动队列失败:', err.message || err)
  }
}

// 拉黑用户 (仅限弹幕来源)
function blockUser(item: ResponseQueueModel) {
  if (item.from != QueueFrom.Danmaku && item.from != QueueFrom.Gift) { // 允许拉黑礼物用户
    message.error(`[${item.user?.name}] 不是来自弹幕或礼物的用户，无法拉黑`)
    return
  }
  if (item.user?.uid) { // 确保有 UID
    isLoading.value = true // 开始加载
    queueDataBeingManaged.value = item.id // 标记操作项
    AddBiliBlackList(item.user.uid, item.user.name)
      .then((data) => {
        if (data.code == 200) {
          message.success(`[${item.user?.name}] 已添加到 B站黑名单`)
          updateStatus(item, QueueStatus.Cancel) // 拉黑后自动取消排队
        } else {
          message.error(`拉黑失败: ${data.message}`)
        }
      })
      .catch((err: any) => {
        message.error(`拉黑时发生错误: ${err.message || err}`)
        console.error('[OPEN-LIVE-QUEUE] 拉黑用户出错:', err)
      })
      .finally(() => {
        isLoading.value = false
        queueDataBeingManaged.value = null
      })
  } else {
    message.error(`用户 [${item.user?.name}] 没有有效的 UID，无法拉黑`)
  }
}

let timer: any // 用于更新相对时间的计时器
let updateActiveTimer: any // 用于轮询活动队列的计时器
const updateKey = ref(0) // 用于强制更新 NTime 组件

// 初始化操作
async function init() {
  dispose() // 先清理旧的计时器
  // 如果登录了，获取一次全量数据
  if (accountInfo.value.id) {
    originQueue.value = await getAll()
  }
  // 设置定时器
  timer = setInterval(() => {
    updateKey.value++ // 每秒更新 key，强制 NTime 更新相对时间
  }, 1000)
  updateActiveTimer = setInterval(() => {
    updateActive() // 定期更新活动队列
  }, 5000) // 轮询间隔调整为 5 秒
}

// 清理操作
function dispose() {
  clearInterval(timer)
  clearInterval(updateActiveTimer)
  timer = null
  updateActiveTimer = null
}

// --- 生命周期钩子 ---
onMounted(async () => {
  // 挂载时初始化
  if (accountInfo.value.id) {
    // 如果已登录，同步一次设置到本地状态 (虽然 computed 会处理，但显式同步更清晰)
    settings.value = accountInfo.value.settings.queue
  }
  // 绑定弹幕和礼物事件监听器
  client.onEvent('danmaku', onGetDanmaku)
  client.onEvent('gift', onGetGift)
  await init() // 初始化数据和定时器
})

onActivated(async () => {
  // 组件被 keep-alive 激活时重新初始化
  await init()
})

onDeactivated(() => {
  // 组件被 keep-alive 停用时清理定时器
  dispose()
})

onUnmounted(() => {
  // 组件卸载时彻底清理
  client.offEvent('danmaku', onGetDanmaku)
  client.offEvent('gift', onGetGift)
  dispose()
})

// --- 辅助函数 ---
function getIndexStyle(status: QueueStatus): CSSProperties {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    width: '24px', // 确保宽高一致以形成完美圆形
    height: '24px', // 保持一致的宽高
    borderRadius: '50%', // 圆形
    color: '#fff',
    fontSize: '13px', // 适当调整字体大小
    transition: 'opacity 0.2s', // 仅保留简单的过渡效果
  }

  switch (status) {
    case QueueStatus.Progressing:
      return { ...style, backgroundColor: 'var(--n-success-color)' }
    case QueueStatus.Waiting:
      return { ...style, backgroundColor: 'var(--n-info-color)' }
    case QueueStatus.Finish:
      return {
        ...style,
        backgroundColor: 'var(--n-color-embedded)',
        color: 'var(--n-text-color)',
        border: '1px solid var(--n-border-color)',
      }
    case QueueStatus.Cancel:
      return { ...style, backgroundColor: 'var(--n-error-color)' }
    default:
      return { ...style, backgroundColor: 'var(--n-info-color)' }
  }
}
</script>

<template>
  <NFlex vertical :size="12">
    <NCard size="small" bordered>
      <OpenLivePageHeader
        title="弹幕排队"
        description="通过弹幕或礼物加入队列，支持过滤条件、排序策略与 OBS 展示"
      >
        <template v-if="accountInfo?.id" #actions>
          <NTooltip :disabled="configCanEdit">
            <template #trigger>
              <NButton
                type="primary"
                size="small"
                class="open-live-action-btn"
                :disabled="!configCanEdit"
                @click="showOBSModal = true"
              >
                OBS 组件
              </NButton>
            </template>
            登录后可使用 OBS 组件功能
          </NTooltip>
        </template>
      </OpenLivePageHeader>
    </NCard>

    <!-- 顶部功能开关与全局操作 -->
    <NCard v-if="accountInfo?.id" size="small" bordered>
      <template #header>
        <NSpace align="center">
          <NText>启用弹幕队列功能</NText>
          <NSwitch
            size="small"
            :value="accountInfo?.settings.enableFunctions.includes(FunctionTypes.Queue)"
            :loading="isLoading"
            @update:value="onUpdateFunctionEnable"
          />
        </NSpace>
      </template>
      <NAlert
        v-if="accountInfo.settings.enableFunctions.includes(FunctionTypes.Queue)"
        type="info"
        size="small"
        :bordered="false"
        closable
        style="margin-top: 10px"
      >
        如果没有部署
        <NButton
          text
          type="primary"
          tag="a"
          href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
          target="_blank"
        >
          VtsuruEventFetcher
        </NButton>
        则其需要保持此页面开启才能点播, 也不要同时开多个页面, 会导致点播重复 (部署了则不影响)
      </NAlert>
    </NCard>
  
    <!-- 未登录提示 -->
    <NAlert
      v-else
      type="warning"
      title="未登录"
      size="small"
      :bordered="false"
      closable
    >
      你尚未注册并登录 VTsuru.live，部分功能和设置将不可用。队列将在本地临时存储。
      <NButton
        tag="a"
        href="/manage"
        target="_blank"
        type="primary"
        size="small"
        style="margin-left: 10px;"
      >
        前往登录或注册
      </NButton>
    </NAlert>

    <NCard size="small" bordered>
      <!-- 主内容区域 -->
      <NTabs
        v-if="!accountInfo.id || accountInfo.settings.enableFunctions.includes(FunctionTypes.Queue)"
        type="line"
        animated
        size="small"
        display-directive="show:lazy"
        pane-style="padding-top: 10px;"
      >
        <!-- 队列列表 Tab -->
        <NTabPane
          name="list"
          tab="当前队列"
        >
          <NCard
            size="small"
            :bordered="false"
          >
            <NSpace
              align="center"
              justify="space-between"
              wrap
              :item-style="{ marginBottom: '8px' }"
            >
              <!-- 队列统计信息 -->
              <NSpace align="center">
                <NTag
                  type="info"
                  :bordered="false"
                  round
                >
                  <template #icon>
                    <NIcon :component="PeopleQueue24Filled" />
                  </template>
                  等待中: {{ queue.filter((s) => s.status === QueueStatus.Waiting).length }} 人
                </NTag>
                <NTag
                  type="success"
                  :bordered="false"
                  round
                >
                  <template #icon>
                    <NIcon :component="Checkmark12Regular" />
                  </template>
                  今日已处理:
                  {{ historySongs.filter((s) => s.status === QueueStatus.Finish && isSameDay(s.finishAt ?? 0, Date.now())).length }}
                  人
                </NTag>
              </NSpace>

              <!-- 手动添加 -->
              <NInputGroup style="max-width: 250px;">
                <NInput
                  v-model:value="newQueueName"
                  placeholder="手动添加用户"
                  clearable
                  @keyup.enter="addManual"
                />
                <NButton
                  type="primary"
                  ghost
                  :disabled="!newQueueName"
                  @click="addManual"
                >
                  添加
                </NButton>
              </NInputGroup>

              <!-- 排序和操作 -->
              <NSpace align="center">
                <NPopconfirm @positive-click="deactiveAllSongs">
                  <template #trigger>
                    <NButton
                      type="error"
                      size="small"
                      ghost
                    >
                      全部取消
                    </NButton>
                  </template>
                  确定要取消所有等待中和处理中的队列项吗?
                </NPopconfirm>
                <NRadioGroup
                  v-model:value="settings.sortType"
                  :disabled="!configCanEdit"
                  size="small"
                  @update:value="updateSettings"
                >
                  <NRadioButton :value="QueueSortType.TimeFirst">
                    时间
                  </NRadioButton>
                  <NRadioButton :value="QueueSortType.PaymentFist">
                    付费
                  </NRadioButton>
                  <NRadioButton :value="QueueSortType.GuardFirst">
                    舰长
                  </NRadioButton>
                  <NRadioButton :value="QueueSortType.FansMedalFirst">
                    粉丝牌
                  </NRadioButton>
                </NRadioGroup>
                <NCheckbox
                  v-if="configCanEdit"
                  v-model:checked="settings.isReverse"
                  size="small"
                  @update:checked="updateSettings"
                >
                  倒序
                </NCheckbox>
                <NCheckbox
                  v-else
                  v-model:checked="isReverse"
                  size="small"
                >
                  倒序
                </NCheckbox>
              </NSpace>
            </NSpace>
          </NCard>

          <NDivider style="margin: 10px 0;" />

          <!-- 队列列表 -->
          <NSpin :show="isLoading && originQueue.length === 0">
            <div
              v-if="queue.length > 0"
              class="queue-list-container"
            >
              <TransitionGroup name="list">
                <div
                  v-for="(queueData, index) in queue"
                  :key="queueData.id"
                  class="queue-item-wrapper"
                >
                  <NCard
                    embedded
                    size="small"
                    content-style="padding: 8px 12px;"
                    :bordered="queueData.status === QueueStatus.Progressing"
                    :style="queueData.status === QueueStatus.Progressing ? 'border-left: 4px solid var(--n-success-color);' : 'border-left: 4px solid transparent;'"
                  >
                    <NSpace
                      justify="space-between"
                      align="center"
                      :wrap="false"
                    >
                      <!-- 左侧信息 -->
                      <NSpace
                        align="center"
                        :size="8"
                        :wrap="false"
                      >
                        <span
                          :style="getIndexStyle(queueData.status)"
                          class="queue-index"
                          :class="{ 'queue-index-processing': queueData.status === QueueStatus.Progressing }"
                        >
                          {{ index + 1 }}
                        </span>
                        <NText
                          strong
                          style="font-size: 16px;"
                        >
                          <NTooltip>
                            <template #trigger>
                              {{ queueData.user?.name }}
                            </template>
                            {{ queueData.user?.uid ? `UID: ${queueData.user?.uid}` : `OpenID: ${queueData.user?.oid}` }}
                          </NTooltip>
                        </NText>
                        <!-- 粉丝牌 -->
                        <NTag
                          v-if="settings.showFanMadelInfo && queueData.user?.fans_medal_wearing_status"
                          size="tiny"
                          round
                          :bordered="false"
                          style="padding: 0 5px 0 0;"
                        >
                          <NTag
                            size="tiny"
                            round
                            :bordered="false"
                            type="info"
                            style="margin-right: 3px;"
                          >
                            {{ queueData.user?.fans_medal_level }}
                          </NTag>
                          {{ queueData.user?.fans_medal_name }}
                        </NTag>
                        <!-- 舰长 -->
                        <NTag
                          v-if="(queueData.user?.guard_level ?? 0) > 0"
                          size="small"
                          :bordered="false"
                          :color="{ textColor: 'white', color: GetGuardColor(queueData.user?.guard_level) }"
                        >
                          {{ queueData.user?.guard_level === 1 ? '总督' : queueData.user?.guard_level === 2 ? '提督' : '舰长' }}
                        </NTag>
                        <!-- 付费信息 -->
                        <NTag
                          v-if="settings.showPayment && (queueData.giftPrice ?? 0) > 0"
                          size="small"
                          :bordered="false"
                          type="error"
                        >
                          ¥ {{ queueData.giftPrice?.toFixed(1) }}
                        </NTag>
                        <!-- 附加内容提示 -->
                        <NTooltip
                          v-if="queueData.content"
                          placement="right"
                        >
                          <template #trigger>
                            <NIcon
                              :component="Info24Filled"
                              size="16"
                              style="cursor: help; color: var(--n-text-color-3);"
                            />
                          </template>
                          <NCard
                            size="small"
                            :bordered="false"
                            style="max-width: 300px;"
                          >
                            <template #header>
                              <span style="font-size: small; color: gray;">
                                {{ `来自${queueData?.from === QueueFrom.Gift ? '礼物' : '弹幕'}: ` }}
                              </span>
                            </template>
                            {{ queueData?.content }}
                          </NCard>
                        </NTooltip>
                        <!-- 时间 -->
                        <NTooltip placement="bottom">
                          <template #trigger>
                            <NText
                              depth="3"
                              style="font-size: 12px;"
                            >
                              <NTime
                                :key="updateKey"
                                :time="queueData.createAt"
                                type="relative"
                              />
                            </NText>
                          </template>
                          <NTime
                            :time="queueData.createAt"
                            format="yyyy-MM-dd HH:mm:ss"
                          />
                        </NTooltip>
                      </NSpace>

                      <!-- 右侧操作按钮 -->
                      <NSpace
                        justify="end"
                        align="center"
                        :size="6"
                        :wrap="false"
                        style="flex-shrink: 0;"
                      >
                        <!-- 开始/暂停处理 -->
                        <NTooltip>
                          <template #trigger>
                            <NButton
                              circle
                              size="small"
                              :type="queueData.status === QueueStatus.Progressing ? 'warning' : 'primary'"
                              :ghost="queueData.status === QueueStatus.Progressing"
                              :disabled="queue.some((s) => s.id !== queueData.id && s.status === QueueStatus.Progressing)"
                              :loading="isLoading && queueDataBeingManaged === queueData.id"
                              @click="
                                queueDataBeingManaged = queueData.id;
                                updateStatus(
                                  queueData,
                                  queueData.status === QueueStatus.Progressing ? QueueStatus.Waiting : QueueStatus.Progressing,
                                )
                              "
                            >
                              <template #icon>
                                <NIcon :component="ClipboardTextLtr24Filled" />
                              </template>
                            </NButton>
                          </template>
                          {{
                            queue.some((s) => s.id !== queueData.id && s.status === QueueStatus.Progressing)
                              ? '已有其他用户正在处理中'
                              : queueData.status === QueueStatus.Waiting
                                ? '开始处理'
                                : '暂停处理 (返回等待)'
                          }}
                        </NTooltip>
                        <!-- 完成 -->
                        <NTooltip>
                          <template #trigger>
                            <NButton
                              circle
                              size="small"
                              type="success"
                              :loading="isLoading && queueDataBeingManaged === queueData.id"
                              @click="queueDataBeingManaged = queueData.id; updateStatus(queueData, QueueStatus.Finish)"
                            >
                              <template #icon>
                                <NIcon :component="Checkmark12Regular" />
                              </template>
                            </NButton>
                          </template>
                          标记为已完成
                        </NTooltip>
                        <!-- 拉黑 -->
                        <NTooltip
                          v-if="configCanEdit && (queueData.from === QueueFrom.Danmaku || queueData.from === QueueFrom.Gift) && queueData.user?.uid"
                        >
                          <template #trigger>
                            <NPopconfirm @positive-click="blockUser(queueData)">
                              <template #trigger>
                                <NButton
                                  circle
                                  size="small"
                                  type="warning"
                                  :loading="isLoading && queueDataBeingManaged === queueData.id"
                                  @click="queueDataBeingManaged = queueData.id"
                                >
                                  <template #icon>
                                    <NIcon :component="PresenceBlocked16Regular" />
                                  </template>
                                </NButton>
                              </template>
                              确定要将 {{ queueData.user?.name }} 加入 黑名单并取消排队吗？
                            </NPopconfirm>
                          </template>
                          拉黑用户 (B站)
                        </NTooltip>
                        <!-- 移出/取消 -->
                        <NTooltip>
                          <template #trigger>
                            <NButton
                              circle
                              size="small"
                              type="error"
                              :loading="isLoading && queueDataBeingManaged === queueData.id"
                              @click="queueDataBeingManaged = queueData.id; updateStatus(queueData, QueueStatus.Cancel)"
                            >
                              <template #icon>
                                <NIcon :component="Dismiss16Filled" />
                              </template>
                            </NButton>
                          </template>
                          取消排队
                        </NTooltip>
                      </NSpace>
                    </NSpace>
                  </NCard>
                  <NDivider style="margin: 0" />
                </div>
              </TransitionGroup>
            </div>
            <NEmpty
              v-else
              description="当前队列为空"
              style="margin-top: 50px;"
            />
          </NSpin>
        </NTabPane>

        <!-- 历史记录 Tab -->
        <NTabPane
          name="history"
          tab="历史记录"
        >
          <NCard
            size="small"
            :bordered="false"
            style="margin-bottom: 10px;"
          >
            <NSpace
              align="center"
              justify="space-between"
            >
              <NSpace align="center">
                <NInputGroup style="width: 300px">
                  <NInputGroupLabel> 筛选用户 </NInputGroupLabel>
                  <NInput
                    v-model:value="filterName"
                    clearable
                    placeholder="输入用户名"
                  />
                </NInputGroup>
                <NCheckbox v-model:checked="filterNameContains">
                  模糊匹配
                </NCheckbox>
              </NSpace>
              <NButton
                size="small"
                type="error"
                ghost
                :disabled="historySongs.length === 0"
                @click="deleteQueue(historySongs)"
              >
                清空所有历史记录
              </NButton>
            </NSpace>
          </NCard>
          <NDataTable
            ref="table"
            size="small"
            :columns="columns"
            :data="historySongs"
            :pagination="{ pageSize: 20, showSizePicker: true, pageSizes: [20, 50, 100] }"
            :loading="isLoading"
            remote
            :row-key="(row) => row.id"
            striped
          />
        </NTabPane>

        <!-- 设置 Tab -->
        <NTabPane
          name="setting"
          tab="设置"
          :disabled="!configCanEdit"
        >
          <QueueSettingsTab
            :is-loading="isLoading"
            :settings="settings"
            @change="updateSettings"
          />
        </NTabPane>
      </NTabs>
      <!-- 未启用功能时的提示 -->
      <NAlert
        v-else
        title="功能未启用"
        type="info"
        size="small"
        :bordered="false"
      >
        请在页面顶部的开关处启用弹幕队列功能。
      </NAlert>
    </NCard>
  </NFlex>

  <QueueObsModal
    v-model:show="showOBSModal"
    v-model:speed="obsScrollSpeed"
    :user-id="accountInfo?.id"
  />
</template>

<style>
/* 优化 NDataTable 内容过长时的显示 */
.n-data-table-td {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 序号悬停效果 - 扁平化风格 */
.queue-index:hover {
  opacity: 0.85;
}

/* 处理中状态的序号动画 - 扁平化风格 */
.queue-index-processing {
  position: relative;
}

.queue-index-processing::after {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 50%;
  border: 2px solid var(--n-success-color);
  opacity: 0.35;
}
</style>
