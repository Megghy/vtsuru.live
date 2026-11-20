import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { AddBiliBlackList, SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import type { EventModel, ResponseQueueModel } from '@/api/client-types'
import type { DanmakuUserInfo, ResponseQueueStatsModel, SettingQueue } from '@/api/generated/model'
import {
  EventDataTypes,
  FunctionTypes,
  KeywordMatchType,
  QueueFrom,
  QueueGiftFilterType,
  QueueSortType,
  QueueStatus,
} from '@/api/generated/model'
import {
  getApiQueueGetActive,
  getApiQueueGetAll,
  getApiQueueStats,
  postApiQueueAdd,
  postApiQueueBatchStatus,
  postApiQueueDeactivate,
  postApiQueueDelete,
  postApiQueueReorder,
  postApiQueueResetOrder,
  postApiQueueSetStatus,
  postApiQueueTryAdd,
} from '@/api/generated/queue/queue'
import { usePersistedStorage } from '@/shared/storage/persist'
import { GuidUtils } from '@/shared/utils'
import { formatDanmakuPrice, getGiftPaymentDisplayMeta } from '@/shared/utils/danmakuGiftDisplay'
import { matchKeyword, normalizeTimestampMs, sortByQueueType } from '@/shared/utils/queue'

export function createDefaultQueueSetting(): SettingQueue {
  return {
    keyword: '排队',
    matchType: KeywordMatchType.Contains,
    sortType: QueueSortType.TimeFirst,
    queueMaxSize: 10,
    enableOnStreaming: false,
    allowAllDanmaku: true,
    allowFromWeb: true,
    needJianzhang: false,
    needTidu: false,
    needZongdu: false,
    fanMedalMinLevel: 0,
    sendGiftDirectJoin: true,
    sendGiftIgnoreLimit: false,
    allowGift: true,
    giftNames: [],
    minGiftPrice: 0.1,
    giftFilterType: QueueGiftFilterType.Or,
    allowIncreasePaymentBySendGift: true,
    allowIncreaseByAnyPayment: true,
    enableCooldown: false,
    cooldownSecond: 86400,
    zongduCooldownSecond: 10800,
    tiduCooldownSecond: 21600,
    jianzhangCooldownSecond: 43200,
    showRequireInfo: true,
    showPayment: true,
    showFanMadelInfo: true,
    isReverse: false,
    enablePointJoin: false,
    pointJoinCost: 0,
    pointIgnoreLimit: false,
    allowPointPriority: false,
    pointPriorityKeyword: '插队',
    pointPriorityCost: 100,
  }
}

export const STATUS_MAP = {
  [QueueStatus.Waiting]: '等待中',
  [QueueStatus.Progressing]: '处理中',
  [QueueStatus.Finish]: '已完成',
  [QueueStatus.Cancel]: '已取消',
}

export function getQueuePaymentMeta(
  item: Pick<ResponseQueueModel, 'giftPrice' | 'mysteryBoxName' | 'mysteryBoxPrice'>,
) {
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
      return '网页排队'
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
  const defaultSettings = ref<SettingQueue>(createDefaultQueueSetting())

  const isBatchLoading = ref(false)
  const operatingIds = ref<number[]>([])
  const isLoading = computed({
    get: () => isBatchLoading.value || operatingIds.value.length > 0,
    set: (val: boolean) => {
      isBatchLoading.value = val
    },
  })

  const originQueue = ref<ResponseQueueModel[]>([])
  const newQueueName = ref('')
  const filterName = ref('')
  const filterNameContains = ref(true)
  const activeFilterName = ref('')
  const stats = ref<ResponseQueueStatsModel | null>(null)
  const isStatsLoading = ref(false)

  const isLoggedIn = computed(() => Boolean(accountInfo.value?.id && accountInfo.value.id > 0))
  const configCanEdit = computed(() => isLoggedIn.value)

  function isQueueOperating(id: number) {
    return operatingIds.value.includes(id)
  }

  function markOperating(id: number, active: boolean) {
    if (active) {
      if (!operatingIds.value.includes(id)) {
        operatingIds.value = [...operatingIds.value, id]
      }
    } else {
      operatingIds.value = operatingIds.value.filter((item) => item !== id)
    }
  }

  const settings = computed<SettingQueue>({
    get: () => (isLoggedIn.value ? accountInfo.value.settings.queue : defaultSettings.value),
    set: (value) => {
      if (isLoggedIn.value) {
        accountInfo.value.settings.queue = value
      } else {
        defaultSettings.value = value
      }
    },
  })

  const enabled = computed(() => accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.Queue) ?? false)

  const sourceList = computed(() => (isLoggedIn.value ? originQueue.value : localQueues.value))

  /** 未过滤的当前活跃队列（正在处理排最前） */
  const unfilteredQueue = computed(() => {
    const active = sourceList.value.filter((q) => (q?.status ?? QueueStatus.Cancel) < QueueStatus.Finish)
    const reverse = configCanEdit.value ? Boolean(settings.value.isReverse) : localIsReverse.value

    const sorted = sortByQueueType(active, settings.value.sortType, reverse, {
      createAt: (q) => q.createAt,
      guardLevel: (q) => q.user?.guard_level,
      price: (q) => q.giftPrice,
      fansMedalLevel: (q) => q.user?.fans_medal_level,
      fansMedalWearing: (q) => q.user?.fans_medal_wearing_status,
      priorityLevel: (q) => q.priorityLevel,
      sortOrder: (q) => q.sortOrder,
    })

    return sorted.toSorted((a, b) => {
      if (a.status === QueueStatus.Progressing && b.status !== QueueStatus.Progressing) return -1
      if (b.status === QueueStatus.Progressing && a.status !== QueueStatus.Progressing) return 1
      return 0
    })
  })

  const queue = computed(() => {
    const keyword = activeFilterName.value.trim().toLowerCase()
    if (!keyword) return unfilteredQueue.value
    return unfilteredQueue.value.filter(
      (q) => q?.user?.name?.toLowerCase().includes(keyword) || q?.content?.toLowerCase().includes(keyword),
    )
  })

  const hasCustomOrder = computed(() =>
    unfilteredQueue.value.some((q) => q.sortOrder !== null && q.sortOrder !== undefined),
  )

  const historySongs = computed(() => {
    return sourceList.value
      .filter((s) => s.status === QueueStatus.Finish || s.status === QueueStatus.Cancel)
      .toSorted(
        (a, b) =>
          (normalizeTimestampMs(b.finishAt) || normalizeTimestampMs(b.createAt)) -
          (normalizeTimestampMs(a.finishAt) || normalizeTimestampMs(a.createAt)),
      )
  })

  function nextLocalId() {
    return localQueues.value.length === 0 ? 1 : Math.max(...localQueues.value.map((s) => s.id)) + 1
  }

  function checkMatch(word: string) {
    return matchKeyword(word, settings.value.keyword ?? '', settings.value.matchType)
  }

  function checkMessage(eventData: EventModel): boolean {
    if (
      !isLoggedIn.value &&
      localQueues.value.some((q) => q.user?.uid === eventData.uid && q.status < QueueStatus.Finish)
    ) {
      return false
    }

    if (eventData.type === EventDataTypes.Message) {
      const priorityKeyword = settings.value.allowPointPriority ? settings.value.pointPriorityKeyword?.trim() : ''
      if (priorityKeyword && eventData.msg.trim().toLowerCase().startsWith(priorityKeyword.toLowerCase())) {
        return true
      }
      if (!settings.value.keyword) return false
      return checkMatch(eventData.msg)
    }

    if (eventData.type === EventDataTypes.Gift) {
      if (!settings.value.allowGift && !settings.value.allowIncreasePaymentBySendGift) {
        return false
      }
      if (settings.value.allowGift) {
        const nameMatch =
          (settings.value.giftNames?.length ?? 0) === 0 ||
          settings.value.giftNames?.some((n) => eventData.msg.toLowerCase() === n.toLowerCase()) === true
        const priceMatch = !settings.value.minGiftPrice || eventData.price >= settings.value.minGiftPrice

        if (settings.value.giftFilterType === QueueGiftFilterType.Or) {
          if (!nameMatch && !priceMatch) return false
        } else {
          if (!nameMatch || !priceMatch) return false
        }
        return settings.value.sendGiftDirectJoin
      }
      return (
        settings.value.allowIncreaseByAnyPayment ||
        settings.value.giftNames?.some((n) => eventData.msg.toLowerCase() === n.toLowerCase()) === true
      )
    }

    return true
  }

  async function getAll(showLoading = true): Promise<{ ok: boolean; data: ResponseQueueModel[] }> {
    if (!isLoggedIn.value) return { ok: true, data: localQueues.value }
    if (showLoading) {
      isBatchLoading.value = true
    }
    try {
      const data = await getApiQueueGetAll()
      if (data.code === 200) {
        return { ok: true, data: data.data ?? [] }
      }
      window.$message.error(`无法获取队列数据: ${data.message}`)
    } catch (err: any) {
      window.$message.error(`获取队列数据失败: ${err.message || err}`)
    } finally {
      if (showLoading) {
        isBatchLoading.value = false
      }
    }
    return { ok: false, data: [] }
  }

  async function fetchStats() {
    if (!isLoggedIn.value) return null
    isStatsLoading.value = true
    try {
      const res = await getApiQueueStats()
      if (res.code === 200) {
        stats.value = res.data
        return res.data
      }
    } catch (err) {
      console.error('[QUEUE] 获取统计失败', err)
    } finally {
      isStatsLoading.value = false
    }
    return null
  }

  async function add(danmaku: EventModel) {
    if (!checkMessage(danmaku)) return
    if (settings.value.enableOnStreaming && accountInfo.value?.streamerInfo?.isStreaming !== true) {
      window.$message.info('当前未在直播中，无法添加排队请求；或关闭设置中的「仅在直播时允许加入」。')
      return
    }

    if (isLoggedIn.value) {
      if (!enabled.value) return
      try {
        const data = await postApiQueueTryAdd(danmaku as any)
        if (data.code === 200) {
          if (data.message === 'EventFetcher') return
          const existingIndex = originQueue.value.findIndex((q) => q.id === data.data.id)
          if (existingIndex > -1) {
            const prev = originQueue.value[existingIndex]
            const oldPrice = prev?.giftPrice ?? 0
            const newPrice = data.data?.giftPrice ?? 0
            if (newPrice > oldPrice) {
              window.$message.info(
                buildPaymentIncreaseMessage(
                  data.data.user?.name,
                  {
                    giftPrice: newPrice - oldPrice,
                    mysteryBoxName: danmaku.mystery_box_name,
                    mysteryBoxPrice: danmaku.mystery_box_price,
                  },
                  newPrice,
                ),
              )
            } else if ((data.data?.priorityLevel ?? 0) > (prev?.priorityLevel ?? 0)) {
              window.$message.success(`[${danmaku.uname}] 使用积分插队成功`)
            }
            originQueue.value.splice(existingIndex, 1, data.data)
          } else {
            originQueue.value.push(data.data)
            window.$message.success(`[${danmaku.uname}] 添加至队列`)
          }
        } else {
          window.$notification.warning({
            title: `${danmaku.uname} 排队失败`,
            description: data.message,
            duration: isWarnMessageAutoClose.value ? 3000 : 0,
            meta: new Date().toLocaleTimeString(),
          })
        }
      } catch (err: any) {
        window.$message.error(`[${danmaku.uname}] 添加队列时出错: ${err.message || err}`)
      }
    } else {
      const entry = {
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
        priorityLevel: 0,
        requestBy: '',
        isInLocal: true,
        id: nextLocalId(),
      } as ResponseQueueModel
      localQueues.value.unshift(entry)
      window.$message.success(`[${danmaku.uname}] 添加至本地队列`)
    }
  }

  async function addManual(overrideName?: string) {
    const targetName = (overrideName ?? newQueueName.value).trim()
    if (!targetName) {
      window.$message.error('请输入用户名')
      return null
    }
    if (isLoggedIn.value) {
      try {
        const data = await postApiQueueAdd({ name: targetName })
        if (data.code === 200) {
          window.$message.success(`已手动添加用户至队列: ${data.data.user?.name}`)
          originQueue.value.unshift(data.data)
          if (!overrideName) newQueueName.value = ''
          return data.data
        }
        window.$message.error(`手动添加失败: ${data.message}`)
      } catch (err: any) {
        window.$message.error(`手动添加时出错: ${err.message || err}`)
      }
      return null
    }

    const entry = {
      status: QueueStatus.Waiting,
      from: QueueFrom.Manual,
      user: { name: targetName } as DanmakuUserInfo,
      createAt: Date.now(),
      priorityLevel: 0,
      requestBy: '',
      isInLocal: true,
      id: nextLocalId(),
    } as ResponseQueueModel
    localQueues.value.unshift(entry)
    window.$message.success(`已手动添加用户至队列: ${targetName}`)
    if (!overrideName) newQueueName.value = ''
    return entry
  }

  function applyQueueStatusUpdate(item: ResponseQueueModel, status: QueueStatus, refundPoint: boolean, now: number) {
    item.status = status
    if (status > QueueStatus.Progressing) {
      item.finishAt = now
    }
    if (status === QueueStatus.Cancel && refundPoint && item.pointCost && item.pointCost > 0) {
      item.pointRefunded = true
    }
  }

  async function updateStatus(queueData: ResponseQueueModel, status: QueueStatus, refundPoint = false) {
    if (!isLoggedIn.value) {
      const localItem = localQueues.value.find((q) => q.id === queueData.id)
      if (localItem) {
        applyQueueStatusUpdate(localItem, status, false, Date.now())
        window.$message.success(`已更新本地 [${queueData.user?.name}] 队列状态为: ${STATUS_MAP[status]}`)
      }
      return
    }

    markOperating(queueData.id, true)
    try {
      const data = await postApiQueueSetStatus({ id: queueData.id, status, refundPoint })
      if (data.code === 200) {
        const item = originQueue.value.find((q) => q.id === queueData.id)
        if (item) {
          applyQueueStatusUpdate(item, status, refundPoint, Date.now())
        }
        window.$message.success(
          status === QueueStatus.Cancel && refundPoint && queueData.pointCost
            ? `已取消 [${queueData.user?.name}] 排队并退回积分`
            : `已更新 [${queueData.user?.name}] 队列状态为: ${STATUS_MAP[status]}`,
        )
      } else {
        window.$message.error(`更新队列状态失败: ${data.message}`)
      }
    } catch (err: any) {
      window.$message.error(`更新队列状态时出错: ${err.message || err}`)
    } finally {
      markOperating(queueData.id, false)
    }
  }

  async function batchUpdateStatus(ids: number[], status: QueueStatus, refundPoint = false) {
    if (ids.length === 0) return false
    if (!isLoggedIn.value) {
      const idSet = new Set(ids)
      const now = Date.now()
      for (const q of localQueues.value) {
        if (idSet.has(q.id)) {
          applyQueueStatusUpdate(q, status, false, now)
        }
      }
      window.$message.success(`已批量更新 ${ids.length} 条记录`)
      return true
    }

    isBatchLoading.value = true
    try {
      const res = await postApiQueueBatchStatus({ ids, status, refundPoint })
      if (res.code === 200) {
        const updatedSet = new Set(res.data)
        const now = Date.now()
        for (const q of originQueue.value) {
          if (updatedSet.has(q.id)) {
            applyQueueStatusUpdate(q, status, refundPoint, now)
          }
        }
        window.$message.success(`已批量更新 ${res.data.length} 条排队状态为「${STATUS_MAP[status]}」`)
        return true
      }
      window.$message.error(`批量更新失败: ${res.message}`)
    } catch (err: any) {
      window.$message.error(`批量更新出错: ${err.message || err}`)
    } finally {
      isBatchLoading.value = false
    }
    return false
  }

  async function reorderQueue(orderedIds: number[]) {
    if (orderedIds.length === 0) return false
    if (isLoggedIn.value && isBatchLoading.value) return false

    const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]))
    const snapshots: Array<{ item: ResponseQueueModel; prevOrder: number | null | undefined }> = []
    for (const item of sourceList.value) {
      const idx = orderMap.get(item.id)
      if (idx !== undefined) {
        snapshots.push({ item, prevOrder: item.sortOrder })
        item.sortOrder = idx
      }
    }

    if (!isLoggedIn.value) return true

    isBatchLoading.value = true
    try {
      const res = await postApiQueueReorder(orderedIds)
      if (res.code !== 200) {
        for (const snapshot of snapshots) {
          snapshot.item.sortOrder = snapshot.prevOrder
        }
        window.$message.error(`保存排序失败: ${res.message}`)
        return false
      }
      return true
    } catch (err: any) {
      for (const snapshot of snapshots) {
        snapshot.item.sortOrder = snapshot.prevOrder
      }
      window.$message.error(`保存排序出错: ${err.message || err}`)
      return false
    } finally {
      isBatchLoading.value = false
    }
  }

  async function reorderWaitingQueue(
    targetId: number,
    buildReordered: (waiting: ResponseQueueModel[], idx: number) => ResponseQueueModel[] | null,
  ) {
    const waiting = unfilteredQueue.value.filter((q) => q.status === QueueStatus.Waiting)
    const idx = waiting.findIndex((q) => q.id === targetId)
    if (idx === -1) return false
    const reordered = buildReordered(waiting, idx)
    if (!reordered) return false
    const progressing = unfilteredQueue.value.filter((q) => q.status === QueueStatus.Progressing)
    return reorderQueue([...reordered.map((q) => q.id), ...progressing.map((q) => q.id)])
  }

  async function moveQueue(item: ResponseQueueModel, direction: 'up' | 'down') {
    await reorderWaitingQueue(item.id, (waiting, idx) => {
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= waiting.length) return null
      const reordered = [...waiting]
      const [moved] = reordered.splice(idx, 1)
      reordered.splice(targetIdx, 0, moved)
      return reordered
    })
  }

  async function pinQueue(item: ResponseQueueModel) {
    const ok = await reorderWaitingQueue(item.id, (waiting, idx) =>
      idx <= 0 ? null : [item, ...waiting.filter((q) => q.id !== item.id)],
    )
    if (ok) {
      window.$message.success(`已将「${item.user?.name || '该观众'}」置顶`)
    }
  }

  async function resetOrder() {
    if (isLoggedIn.value && isBatchLoading.value) return false
    const snapshots: Array<{ item: ResponseQueueModel; prevOrder: number | null | undefined }> = []
    for (const item of sourceList.value) {
      if (item.status <= QueueStatus.Progressing) {
        snapshots.push({ item, prevOrder: item.sortOrder })
        item.sortOrder = null
      }
    }
    if (!isLoggedIn.value) {
      window.$message.success('已恢复为规则排序')
      return true
    }

    isBatchLoading.value = true
    try {
      const res = await postApiQueueResetOrder()
      if (res.code === 200) {
        window.$message.success('已恢复为规则排序')
        return true
      }
      for (const snapshot of snapshots) {
        snapshot.item.sortOrder = snapshot.prevOrder
      }
      window.$message.error(`恢复排序失败: ${res.message}`)
    } catch (err: any) {
      for (const snapshot of snapshots) {
        snapshot.item.sortOrder = snapshot.prevOrder
      }
      window.$message.error(`恢复排序失败: ${err.message || err}`)
    } finally {
      isBatchLoading.value = false
    }
    return false
  }

  async function deleteQueue(values: ResponseQueueModel[]): Promise<boolean> {
    if (!values || values.length === 0) return false
    const idSet = new Set(values.map((s) => s.id))
    if (isLoggedIn.value) {
      isBatchLoading.value = true
      try {
        const data = await postApiQueueDelete(values.map((s) => s.id))
        if (data.code === 200) {
          window.$message.success(`成功删除 ${values.length} 条记录`)
          originQueue.value = originQueue.value.filter((s) => !idSet.has(s.id))
          return true
        }
        window.$message.error(`删除失败: ${data.message}`)
      } catch (err: any) {
        window.$message.error(`删除记录时出错: ${err.message || err}`)
      } finally {
        isBatchLoading.value = false
      }
      return false
    }

    localQueues.value = localQueues.value.filter((q) => !idSet.has(q.id))
    window.$message.success(`成功删除 ${values.length} 条本地记录`)
    return true
  }

  async function deactiveAllSongs(refundPoint = false) {
    const cancelLocal = (list: ResponseQueueModel[]) => {
      const now = Date.now()
      for (const s of list) {
        if (s.status <= QueueStatus.Progressing) {
          applyQueueStatusUpdate(s, QueueStatus.Cancel, refundPoint, now)
        }
      }
    }
    if (isLoggedIn.value) {
      isBatchLoading.value = true
      try {
        const data = await postApiQueueDeactivate({ refundPoint })
        if (data.code === 200) {
          cancelLocal(originQueue.value)
          window.$message.success(refundPoint ? '已全部取消并退回已消费积分' : '已全部取消当前排队')
        } else {
          window.$message.error(`全部取消失败: ${data.message}`)
        }
      } catch (err: any) {
        window.$message.error(`全部取消时出错: ${err.message || err}`)
      } finally {
        isBatchLoading.value = false
      }
    } else {
      cancelLocal(localQueues.value)
      window.$message.success('已全部取消本地活动队列')
    }
  }

  let updateActiveTimer: ReturnType<typeof setInterval> | null = null
  let lifecycleGen = 0
  let inFlightInit: { gen: number; promise: Promise<void> } | null = null
  let isPollingActive = false

  async function updateActive() {
    if (!isLoggedIn.value || isPollingActive || isBatchLoading.value) return
    const gen = lifecycleGen
    isPollingActive = true
    let needsFullRefresh = false

    try {
      const data = await getApiQueueGetActive({ id: accountInfo.value?.id })
      if (gen !== lifecycleGen || data.code !== 200) return

      const activeList = data.data ?? []
      const activeIdSet = new Set(activeList.map((item) => item.id))
      needsFullRefresh = originQueue.value.some(
        (q) => q.status <= QueueStatus.Progressing && !operatingIds.value.includes(q.id) && !activeIdSet.has(q.id),
      )

      for (const item of activeList) {
        if (operatingIds.value.includes(item.id)) continue
        const existing = originQueue.value.find((s) => s.id === item.id)
        if (existing) {
          if (existing.status !== item.status) existing.status = item.status
          if (existing.priorityLevel !== item.priorityLevel) existing.priorityLevel = item.priorityLevel
          if (existing.pointCost !== item.pointCost) existing.pointCost = item.pointCost
          if (existing.pointRefunded !== item.pointRefunded) existing.pointRefunded = item.pointRefunded
          if (existing.sortOrder !== item.sortOrder) existing.sortOrder = item.sortOrder
          const paymentChanged =
            existing.giftPrice !== item.giftPrice ||
            existing.mysteryBoxName !== item.mysteryBoxName ||
            existing.mysteryBoxPrice !== item.mysteryBoxPrice
          if (paymentChanged) {
            const oldPrice = existing.giftPrice ?? 0
            const newPrice = item.giftPrice ?? 0
            if (newPrice > oldPrice) {
              window.$message.info(
                buildPaymentIncreaseMessage(
                  existing.user?.name,
                  {
                    giftPrice: newPrice - oldPrice,
                    mysteryBoxName: item.mysteryBoxName,
                    mysteryBoxPrice: item.mysteryBoxPrice,
                  },
                  newPrice,
                ),
              )
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
      }
    } catch (err: any) {
      console.warn('[QUEUE] 更新活动队列失败:', err.message || err)
    } finally {
      isPollingActive = false
    }

    if (needsFullRefresh && gen === lifecycleGen && !isBatchLoading.value) {
      const result = await getAll(false)
      if (gen === lifecycleGen && result.ok) {
        originQueue.value = result.data
      }
    }
  }

  async function blockUser(item: ResponseQueueModel) {
    if (item.from !== QueueFrom.Danmaku && item.from !== QueueFrom.Gift) {
      window.$message.error(`[${item.user?.name}] 不是来自弹幕或礼物的用户，无法拉黑`)
      return
    }
    if (!item.user?.uid && !item.user?.oid) {
      window.$message.error(`用户 [${item.user?.name}] 没有有效的 UID，无法拉黑`)
      return
    }
    markOperating(item.id, true)
    try {
      const data = await AddBiliBlackList(GuidUtils.toOuid(item.user.uid, item.user.oid), item.user.name)
      if (data.code === 200) {
        window.$message.success(`[${item.user?.name}] 已添加到 B站黑名单`)
        await updateStatus(item, QueueStatus.Cancel)
      } else {
        window.$message.error(`拉黑失败: ${data.message}`)
      }
    } catch (err: any) {
      window.$message.error(`拉黑时发生错误: ${err.message || err}`)
    } finally {
      markOperating(item.id, false)
    }
  }

  async function toggleFunction() {
    if (!isLoggedIn.value) return
    const isEnabling = !enabled.value
    const old = [...accountInfo.value.settings.enableFunctions]

    if (isEnabling) {
      accountInfo.value.settings.enableFunctions.push(FunctionTypes.Queue)
      if (!accountInfo.value.settings.queue.keyword) {
        accountInfo.value.settings.queue.keyword = defaultKeyword.value
        await saveSettings()
      }
    } else {
      accountInfo.value.settings.enableFunctions = old.filter((f) => f !== FunctionTypes.Queue)
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

  async function saveSettings(nextSetting?: SettingQueue) {
    const prevSetting = {
      ...settings.value,
      giftNames: [...(settings.value.giftNames ?? [])],
    }
    if (nextSetting) {
      settings.value = nextSetting
    }
    if (!isLoggedIn.value) {
      window.$message.success('本地设置已更新 (未登录)')
      return true
    }
    isBatchLoading.value = true
    try {
      const success = await SaveSetting('Queue', settings.value)
      if (success) {
        window.$message.success('排队规则已保存')
        return true
      }
      settings.value = prevSetting
      window.$message.error('排队规则保存失败')
    } catch (err: any) {
      settings.value = prevSetting
      window.$message.error(`保存设置失败: ${err.message || err}`)
    } finally {
      isBatchLoading.value = false
    }
    return false
  }

  function onGetDanmaku(danmaku: EventModel) {
    void add(danmaku)
  }
  function onGetGift(danmaku: EventModel) {
    void add(danmaku)
  }

  function startUpdateTimer(gen = lifecycleGen) {
    if (gen !== lifecycleGen) return
    if (updateActiveTimer) {
      clearInterval(updateActiveTimer)
      updateActiveTimer = null
    }
    updateActiveTimer = setInterval(() => {
      void updateActive()
    }, 4000)
  }

  async function init() {
    const gen = lifecycleGen
    if (inFlightInit && inFlightInit.gen === gen) {
      return inFlightInit.promise
    }
    const run = (async () => {
      if (isLoggedIn.value) {
        const result = await getAll()
        if (gen !== lifecycleGen) return
        if (result.ok) {
          originQueue.value = result.data
        }
      }
      if (gen !== lifecycleGen) return
      startUpdateTimer(gen)
    })()
    const tracker = { gen, promise: run }
    inFlightInit = tracker
    try {
      await run
    } finally {
      if (inFlightInit === tracker) {
        inFlightInit = null
      }
    }
  }

  function dispose() {
    lifecycleGen++
    inFlightInit = null
    if (updateActiveTimer) {
      clearInterval(updateActiveTimer)
      updateActiveTimer = null
    }
  }

  return {
    isLoading,
    isBatchLoading,
    originQueue,
    localQueues,
    newQueueName,
    filterName,
    filterNameContains,
    activeFilterName,
    isWarnMessageAutoClose,
    localIsReverse,
    defaultKeyword,
    stats,
    isStatsLoading,
    STATUS_MAP,

    isLoggedIn,
    configCanEdit,
    enabled,
    settings,
    queue,
    unfilteredQueue,
    hasCustomOrder,
    historySongs,
    isQueueOperating,

    init,
    dispose,
    fetchStats,
    add,
    addManual,
    updateStatus,
    batchUpdateStatus,
    reorderQueue,
    moveQueue,
    pinQueue,
    resetOrder,
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
