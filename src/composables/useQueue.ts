import type {
  DanmakuUserInfo,
  EventModel,
  ResponseQueueModel,
  Setting_Queue,
} from '@/api/api-models'
import { List } from 'linqts'
import { NTime } from 'naive-ui';
import { computed, h, ref } from 'vue'
import { AddBiliBlackList, SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import {
  EventDataTypes,
  FunctionTypes,
  KeywordMatchType,
  QueueFrom,
  QueueGiftFilterType,
  QueueSortType,
  QueueStatus,
} from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI, QueryPostAPIWithParams } from '@/api/query'
import { QUEUE_API_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { formatDanmakuPrice, getGiftPaymentDisplayMeta } from '@/shared/utils/danmakuGiftDisplay'
import { matchKeyword, sortByQueueType } from '@/shared/utils/queue'
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

export const STATUS_MAP = {
  [QueueStatus.Waiting]: '等待中',
  [QueueStatus.Progressing]: '处理中',
  [QueueStatus.Finish]: '已完成',
  [QueueStatus.Cancel]: '已取消',
}

export function getQueuePaymentMeta(item: Pick<ResponseQueueModel, 'giftPrice' | 'mysteryBoxName' | 'mysteryBoxPrice'>) {
  return getGiftPaymentDisplayMeta({
    giftPrice: item.giftPrice,
    mysteryBoxName: item.mysteryBoxName,
    mysteryBoxPrice: item.mysteryBoxPrice,
  })
}

function buildPaymentIncreaseMessage(
  userName: string | undefined,
  payment: Pick<ResponseQueueModel, 'giftPrice' | 'mysteryBoxName' | 'mysteryBoxPrice'>,
  totalGiftPrice: number | null | undefined,
) {
  const meta = getQueuePaymentMeta(payment)
  const total = formatDanmakuPrice(totalGiftPrice) ?? '0'
  return `${userName ?? '用户'} 通过发送礼物再次付费: ${meta.detailText ?? meta.compactText}，当前累计开出价: ￥${total}`
}

export function getQueueSourceText(data: ResponseQueueModel) {
  const meta = getQueuePaymentMeta(data)
  switch (data.from) {
    case QueueFrom.Danmaku:
      return meta.hasPaidGift || meta.hasMysteryBoxPayment ? `弹幕 | ${meta.shortText}` : '弹幕'
    case QueueFrom.Gift:
      return meta.hasPaidGift || meta.hasMysteryBoxPayment ? `礼物 | ${meta.shortText}` : '礼物'
    case QueueFrom.Web:
      return '网页添加'
    case QueueFrom.Manual:
      return '手动添加'
    default:
      return '未知'
  }
}

export const useQueue = defineStore('queue', () => {
  const accountInfo = useAccount()

  const localQueues = usePersistedStorage('Local.Queue', [] as ResponseQueueModel[])
  const isWarnMessageAutoClose = usePersistedStorage('Queue.Settings.WarnMessageAutoClose', false)
  const localIsReverse = usePersistedStorage('Queue.Settings.Reverse', false)
  const defaultKeyword = usePersistedStorage('Settings.Queue.DefaultKeyword', '排队')

  const isLoading = ref(false)
  const originQueue = ref<ResponseQueueModel[]>([])
  const newQueueName = ref('')
  const filterName = ref('')
  const filterNameContains = ref(false)
  const activeFilterName = ref('')
  const updateKey = ref(0)
  const queueDataBeingManaged = ref<number | null>(null)

  const isLoggedIn = computed(() => accountInfo.value != null && accountInfo.value.id != null)
  const configCanEdit = computed(() => accountInfo.value != null)

  const settings = computed<Setting_Queue>({
    get: () => (accountInfo.value.id ? accountInfo.value.settings.queue : defaultSettings),
    set: (value) => {
      if (accountInfo.value.id) accountInfo.value.settings.queue = value
    },
  })

  const enabled = computed(() => accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.Queue) ?? false)

  const queue = computed(() => {
    const source = isLoggedIn.value ? originQueue.value : localQueues.value
    const keyword = activeFilterName.value.trim().toLowerCase()
    const filtered = source
      .filter(q => !keyword || q?.user?.name?.toLowerCase().includes(keyword) === true)
      .filter(q => (q?.status ?? QueueStatus.Cancel) < QueueStatus.Finish)

    const reverse = configCanEdit.value ? settings.value.isReverse : localIsReverse.value
    const sorted = sortByQueueType(filtered, settings.value.sortType, reverse, {
      createAt: q => q.createAt,
      guardLevel: q => q.user?.guard_level,
      price: q => q.giftPrice,
      fansMedalLevel: q => q.user?.fans_medal_level,
      fansMedalWearing: q => q.user?.fans_medal_wearing_status,
    })
    return new List(sorted).OrderByDescending(q => (q.status === QueueStatus.Progressing ? 1 : 0)).ToArray()
  })

  const historySongs = computed(() => {
    return (isLoggedIn.value ? originQueue.value : localQueues.value)
      .filter(s => s.status === QueueStatus.Finish || s.status === QueueStatus.Cancel)
      .sort((a, b) => (b.finishAt ?? b.createAt) - (a.finishAt ?? a.createAt))
  })

  function nextLocalId() {
    return localQueues.value.length === 0 ? 1 : (new List(localQueues.value).Max(s => s.id) ?? 0) + 1
  }

  function checkMatch(word: string) {
    return matchKeyword(word, settings.value.keyword ?? '', settings.value.matchType)
  }

  function checkMessage(eventData: EventModel): boolean {
    if (!isLoggedIn.value && localQueues.value.some(q => q.user?.uid === eventData.uid && q.status < QueueStatus.Finish)) {
      return false
    }

    if (eventData.type === EventDataTypes.Message) {
      if (!settings.value.keyword) return false
      return checkMatch(eventData.msg)
    }

    if (eventData.type === EventDataTypes.Gift) {
      if (!settings.value.allowGift && !settings.value.allowIncreasePaymentBySendGift) {
        return false
      }
      if (settings.value.allowGift) {
        const nameMatch = (settings.value.giftNames?.length ?? 0) === 0
          || settings.value.giftNames?.some(n => eventData.msg.toLowerCase() === n.toLowerCase()) === true
        const priceMatch = !settings.value.minGiftPrice || eventData.price >= settings.value.minGiftPrice

        if (settings.value.giftFilterType === QueueGiftFilterType.Or) {
          if (!nameMatch && !priceMatch) return false
        } else {
          if (!nameMatch || !priceMatch) return false
        }
        return settings.value.sendGiftDirectJoin
      }
      return settings.value.allowIncreaseByAnyPayment
        || settings.value.giftNames?.some(n => eventData.msg.toLowerCase() === n.toLowerCase()) === true
    }

    return true
  }

  async function getAll(): Promise<ResponseQueueModel[]> {
    if (!isLoggedIn.value) return localQueues.value
    try {
      isLoading.value = true
      const data = await QueryGetAPI<ResponseQueueModel[]>(`${QUEUE_API_URL}get-all`, { id: accountInfo.value.id })
      if (data.code === 200) {
        return data.data ?? []
      }
      window.$message.error(`无法获取队列数据: ${data.message}`)
      return []
    } catch (err: any) {
      window.$message.error(`获取队列数据失败: ${err.message || err}`)
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function add(danmaku: EventModel) {
    if (!checkMessage(danmaku)) return
    if (settings.value.enableOnStreaming && accountInfo.value?.streamerInfo?.isStreaming !== true) {
      window.$message.info('当前未在直播中, 无法添加排队请求. 或者关闭设置中的仅允许直播时加入')
      return
    }

    if (isLoggedIn.value) {
      if (!enabled.value) return
      try {
        const data = await QueryPostAPI<ResponseQueueModel>(`${QUEUE_API_URL}try-add`, danmaku)
        if (data.code === 200) {
          if (data.message === 'EventFetcher') return
          const existingIndex = originQueue.value.findIndex(q => q.id === data.data.id)
          if (existingIndex > -1) {
            const oldPrice = originQueue.value[existingIndex]?.giftPrice ?? 0
            const newPrice = data.data?.giftPrice ?? 0
            if (newPrice > oldPrice) {
              window.$message.info(buildPaymentIncreaseMessage(
                data.data.user?.name,
                { giftPrice: newPrice - oldPrice, mysteryBoxName: danmaku.mystery_box_name, mysteryBoxPrice: danmaku.mystery_box_price },
                newPrice,
              ))
            }
            originQueue.value.splice(existingIndex, 1, data.data)
          } else {
            originQueue.value.push(data.data)
            window.$message.success(`[${danmaku.uname}] 添加至队列`)
          }
        } else {
          const time = Date.now()
          window.$notification.warning({
            title: `${danmaku.uname} 排队失败`,
            description: data.message,
            duration: isWarnMessageAutoClose.value ? 3000 : 0,
            meta: () => h(NTime, { type: 'relative', time, key: updateKey.value }),
          })
        }
      } catch (err: any) {
        window.$message.error(`[${danmaku.uname}] 添加队列时出错: ${err.message || err}`)
      }
    } else {
      const songData = {
        status: QueueStatus.Waiting,
        from: danmaku.type === EventDataTypes.Message ? QueueFrom.Danmaku : QueueFrom.Gift,
        giftPrice: danmaku.type === EventDataTypes.Gift ? danmaku.price : undefined,
        mysteryBoxName: danmaku.type === EventDataTypes.Gift ? danmaku.mystery_box_name : undefined,
        mysteryBoxPrice: danmaku.type === EventDataTypes.Gift ? danmaku.mystery_box_price : undefined,
        content: danmaku.msg,
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
        id: nextLocalId(),
      } as ResponseQueueModel
      localQueues.value.unshift(songData)
      window.$message.success(`[${danmaku.uname}] 添加至本地队列`)
    }
  }

  async function addManual() {
    if (!newQueueName.value) {
      window.$message.error('请输入用户名')
      return
    }
    if (isLoggedIn.value) {
      try {
        const data = await QueryPostAPIWithParams<ResponseQueueModel>(`${QUEUE_API_URL}add`, { name: newQueueName.value })
        if (data.code === 200) {
          window.$message.success(`已手动添加用户至队列: ${data.data.user?.name}`)
          originQueue.value.unshift(data.data)
          newQueueName.value = ''
        } else {
          window.$message.error(`手动添加失败: ${data.message}`)
        }
      } catch (err: any) {
        window.$message.error(`手动添加时出错: ${err.message || err}`)
      }
    } else {
      const songData = {
        status: QueueStatus.Waiting,
        from: QueueFrom.Manual,
        user: { name: newQueueName.value } as DanmakuUserInfo,
        createAt: Date.now(),
        isInLocal: true,
        id: nextLocalId(),
      } as ResponseQueueModel
      localQueues.value.unshift(songData)
      window.$message.success(`已手动添加用户至队列: ${newQueueName.value}`)
      newQueueName.value = ''
    }
  }

  async function updateStatus(queueData: ResponseQueueModel, status: QueueStatus) {
    if (!configCanEdit.value) {
      const localItem = localQueues.value.find(q => q.id === queueData.id)
      if (localItem) {
        localItem.status = status
        if (status > QueueStatus.Progressing) localItem.finishAt = Date.now()
        window.$message.success(`已更新本地 [${queueData.user?.name}] 队列状态为: ${STATUS_MAP[status]}`)
      }
      return
    }
    isLoading.value = true
    try {
      const data = await QueryGetAPI(`${QUEUE_API_URL}set-status`, { id: queueData.id, status })
      if (data.code === 200) {
        const item = originQueue.value.find(q => q.id === queueData.id)
        if (item) {
          item.status = status
          if (status > QueueStatus.Progressing) item.finishAt = Date.now()
        }
        window.$message.success(`已更新 [${queueData.user?.name}] 队列状态为: ${STATUS_MAP[status]}`)
      } else {
        window.$message.error(`更新队列状态失败: ${data.message}`)
      }
    } catch (err: any) {
      window.$message.error(`更新队列状态时出错: ${err.message || err}`)
    } finally {
      isLoading.value = false
      queueDataBeingManaged.value = null
    }
  }

  async function deleteQueue(values: ResponseQueueModel[]) {
    if (!values || values.length === 0) return
    if (isLoggedIn.value) {
      isLoading.value = true
      try {
        const ids = values.map(s => s.id)
        const data = await QueryPostAPI(`${QUEUE_API_URL}del`, ids)
        if (data.code === 200) {
          window.$message.success(`成功删除 ${values.length} 条记录`)
          originQueue.value = originQueue.value.filter(s => !ids.includes(s.id))
        } else {
          window.$message.error(`删除失败: ${data.message}`)
        }
      } catch (err: any) {
        window.$message.error(`删除记录时出错: ${err.message || err}`)
      } finally {
        isLoading.value = false
      }
    } else {
      const ids = values.map(v => v.id)
      localQueues.value = localQueues.value.filter(q => !ids.includes(q.id))
      window.$message.success(`成功删除 ${values.length} 条本地记录`)
    }
  }

  async function deactiveAllSongs() {
    const cancelLocal = (list: ResponseQueueModel[]) => {
      list.forEach((s) => {
        if (s.status <= QueueStatus.Progressing) {
          s.status = QueueStatus.Cancel
          s.finishAt = Date.now()
        }
      })
    }
    if (isLoggedIn.value) {
      isLoading.value = true
      try {
        const data = await QueryGetAPI(`${QUEUE_API_URL}deactive`)
        if (data.code === 200) {
          window.$message.success('已全部取消')
          cancelLocal(originQueue.value)
        } else {
          window.$message.error(`全部取消失败: ${data.message}`)
        }
      } catch (err: any) {
        window.$message.error(`全部取消时出错: ${err.message || err}`)
      } finally {
        isLoading.value = false
      }
    } else {
      cancelLocal(localQueues.value)
      window.$message.success('已全部取消本地活动队列')
    }
  }

  async function updateActive() {
    if (!isLoggedIn.value) return
    try {
      const data = await QueryGetAPI<ResponseQueueModel[]>(`${QUEUE_API_URL}get-active`, { id: accountInfo.value?.id })
      if (data.code !== 200) {
        console.warn(`[QUEUE] 无法获取活动队列: ${data.message}`)
        return
      }
      ;(data.data ?? []).forEach((item) => {
        const existing = originQueue.value.find(s => s.id === item.id)
        if (existing) {
          if (existing.status !== item.status) existing.status = item.status
          const paymentChanged = existing.giftPrice !== item.giftPrice
            || existing.mysteryBoxName !== item.mysteryBoxName
            || existing.mysteryBoxPrice !== item.mysteryBoxPrice
          if (paymentChanged) {
            const oldPrice = existing.giftPrice ?? 0
            const newPrice = item.giftPrice ?? 0
            if (newPrice > oldPrice) {
              window.$message.info(buildPaymentIncreaseMessage(
                existing.user?.name,
                { giftPrice: newPrice - oldPrice, mysteryBoxName: item.mysteryBoxName, mysteryBoxPrice: item.mysteryBoxPrice },
                newPrice,
              ))
            }
            existing.giftPrice = item.giftPrice
            existing.mysteryBoxName = item.mysteryBoxName
            existing.mysteryBoxPrice = item.mysteryBoxPrice
          }
        } else {
          originQueue.value.unshift(item)
          if (item.from === QueueFrom.Web) {
            window.$message.success(`[${item.user?.name}] 通过网页加入队列`)
          } else if (item.from === QueueFrom.Gift && settings.value.sendGiftDirectJoin) {
            window.$message.success(`[${item.user?.name}] 通过礼物加入队列`)
          }
        }
      })
    } catch (err: any) {
      console.warn('[QUEUE] 更新活动队列失败:', err.message || err)
    }
  }

  async function blockUser(item: ResponseQueueModel) {
    if (item.from !== QueueFrom.Danmaku && item.from !== QueueFrom.Gift) {
      window.$message.error(`[${item.user?.name}] 不是来自弹幕或礼物的用户，无法拉黑`)
      return
    }
    if (!item.user?.uid) {
      window.$message.error(`用户 [${item.user?.name}] 没有有效的 UID，无法拉黑`)
      return
    }
    isLoading.value = true
    queueDataBeingManaged.value = item.id
    try {
      const data = await AddBiliBlackList(item.user.uid, item.user.name)
      if (data.code === 200) {
        window.$message.success(`[${item.user?.name}] 已添加到 B站黑名单`)
        await updateStatus(item, QueueStatus.Cancel)
      } else {
        window.$message.error(`拉黑失败: ${data.message}`)
      }
    } catch (err: any) {
      window.$message.error(`拉黑时发生错误: ${err.message || err}`)
    } finally {
      isLoading.value = false
      queueDataBeingManaged.value = null
    }
  }

  async function toggleFunction() {
    if (!accountInfo.value.id) return
    const isEnabling = !enabled.value
    const old = [...accountInfo.value.settings.enableFunctions]

    if (isEnabling) {
      accountInfo.value.settings.enableFunctions.push(FunctionTypes.Queue)
      if (!accountInfo.value.settings.queue.keyword) {
        accountInfo.value.settings.queue.keyword = defaultKeyword.value
        await saveSettings()
      }
    } else {
      accountInfo.value.settings.enableFunctions = old.filter(f => f !== FunctionTypes.Queue)
    }

    try {
      const data = await SaveEnableFunctions(accountInfo.value.settings.enableFunctions)
      if (data.code === 200) {
        window.$message.success(`已${isEnabling ? '启用' : '禁用'}队列功能`)
      } else {
        accountInfo.value.settings.enableFunctions = old
        window.$message.error(`队列功能${isEnabling ? '启用' : '禁用'}失败: ${data.message}`)
      }
    } catch (err: any) {
      accountInfo.value.settings.enableFunctions = old
      window.$message.error(`队列功能${isEnabling ? '启用' : '禁用'}失败: ${err.message || err}`)
    }
  }

  async function saveSettings() {
    if (!accountInfo.value.id) {
      window.$message.success('本地设置已更新 (未登录)')
      return
    }
    isLoading.value = true
    try {
      const success = await SaveSetting('Queue', settings.value)
      if (success) window.$message.success('设置已保存')
      else window.$message.error('设置保存失败')
    } catch (err: any) {
      window.$message.error(`保存设置失败: ${err.message || err}`)
    } finally {
      isLoading.value = false
    }
  }

  function onGetDanmaku(danmaku: EventModel) {
    add(danmaku)
  }
  function onGetGift(danmaku: EventModel) {
    add(danmaku)
  }

  let timer: any = null
  let updateActiveTimer: any = null

  async function init() {
    dispose()
    if (isLoggedIn.value) {
      originQueue.value = await getAll()
    }
    timer = setInterval(() => { updateKey.value++ }, 1000)
    updateActiveTimer = setInterval(() => { updateActive() }, 5000)
  }

  function dispose() {
    clearInterval(timer)
    clearInterval(updateActiveTimer)
    timer = null
    updateActiveTimer = null
  }

  return {
    isLoading,
    originQueue,
    localQueues,
    newQueueName,
    filterName,
    filterNameContains,
    activeFilterName,
    updateKey,
    queueDataBeingManaged,
    isWarnMessageAutoClose,
    localIsReverse,
    defaultKeyword,
    STATUS_MAP,

    isLoggedIn,
    configCanEdit,
    enabled,
    settings,
    queue,
    historySongs,

    init,
    dispose,
    add,
    addManual,
    updateStatus,
    deleteQueue,
    deactiveAllSongs,
    updateActive,
    blockUser,
    checkMessage,
    toggleFunction,
    saveSettings,
    onGetDanmaku,
    onGetGift,
  }
})
