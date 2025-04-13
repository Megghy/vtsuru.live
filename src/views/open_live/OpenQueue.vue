<script setup lang="ts">
import { AddBiliBlackList, SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import {
  DanmakuUserInfo,
  EventDataTypes,
  EventModel,
  FunctionTypes,
  KeywordMatchType,
  OpenLiveInfo,
  QueueFrom,
  QueueGiftFilterType,
  QueueSortType,
  QueueStatus,
  ResponseQueueModel,
  Setting_Queue,
} from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI, QueryPostAPIWithParams } from '@/api/query'
import { CURRENT_HOST, QUEUE_API_URL } from '@/data/constants'
import { useDanmakuClient } from '@/store/useDanmakuClient'
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
  DataTableColumns,
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NCollapse,
  NCollapseItem,
  NDataTable,
  NDivider,
  NEmpty,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NLi,
  NList,
  NListItem,
  NModal,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTime,
  NTooltip,
  NUl,
  useMessage,
  useNotification,
} from 'naive-ui'
import { computed, h, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import QueueOBS from '../obs/QueueOBS.vue'

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
const STATUS_MAP = {
  [QueueStatus.Waiting]: '等待中',
  [QueueStatus.Progressing]: '处理中',
  [QueueStatus.Finish]: '已完成',
  [QueueStatus.Cancel]: '已取消',
}

const route = useRoute()
const accountInfo = useAccount()
const message = useMessage()
const notice = useNotification()
const client = await useDanmakuClient().initOpenlive()

const isWarnMessageAutoClose = useStorage('Queue.Settings.WarnMessageAutoClose', false)
const isReverse = useStorage('Queue.Settings.Reverse', false)
const volumn = useStorage('Settings.Volumn', 0.5)

const isLoading = ref(false)
const showOBSModal = ref(false)

const filterName = ref('')
const filterNameContains = ref(false)

const settings = computed({
  get: () => {
    if (accountInfo.value) {
      return accountInfo.value.settings.queue
    }
    return defaultSettings
  },
  set: (value) => {
    if (accountInfo.value) {
      accountInfo.value.settings.queue = value
    }
  },
})

const props = defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

const localQueues = useStorage('Local.Queue', [] as ResponseQueueModel[])
const originQueue = ref<ResponseQueueModel[]>(await getAll())
const queue = computed(() => {
  let list = new List(accountInfo ? originQueue.value : localQueues.value)
    .Where(
      (q) =>
        !filterName.value ||
        (filterNameContains.value
          ? q?.user?.name.toLowerCase().includes(filterName.value.toLowerCase()) == true
          : q?.user?.name.toLowerCase() == filterName.value.toLowerCase()),
    )
    .Where((q) => (q?.status ?? QueueStatus.Cancel) < QueueStatus.Finish)
  //.OrderByDescending((q) => q.from == QueueFrom.Manual)
  switch (settings.value.sortType) {
    case QueueSortType.TimeFirst: {
      list = list.OrderBy((q) => q.createAt)
      break
    }
    case QueueSortType.GuardFirst: {
      list = list
        .OrderBy((q) => (q.user?.guard_level == 0 || q.user?.guard_level == null ? 4 : q.user.guard_level))
        .ThenBy((q) => q.createAt)
      break
    }
    case QueueSortType.PaymentFist: {
      list = list.OrderByDescending((q) => q.giftPrice).ThenBy((q) => q.createAt)
      break
    }
    case QueueSortType.FansMedalFirst: {
      list = list
        .OrderByDescending((q) => (q.user?.fans_medal_wearing_status ? 1 : 0))
        .ThenByDescending((q) => q.user?.fans_medal_level ?? 0)
        .ThenBy((q) => q.createAt)
      break
    }
  }
  if (configCanEdit.value ? settings.value.isReverse : isReverse.value) {
    list = list.Reverse()
  }
  list = list.OrderByDescending((q) => (q.status == QueueStatus.Progressing ? 1 : 0))
  return list.ToArray()
})
const historySongs = computed(() => {
  return (accountInfo ? originQueue.value : localQueues.value)
    .sort((a, b) => a.status - b.status)
    .filter((song) => {
      return song.status == QueueStatus.Finish || song.status == QueueStatus.Cancel
    })
})

const newQueueName = ref('')

const defaultKeyword = useStorage('Settings.Queue.DefaultKeyword', '排队')
const configCanEdit = computed(() => {
  return accountInfo.value != null && accountInfo.value != undefined
})

const table = ref()

async function getAll() {
  if (accountInfo.value) {
    try {
      const data = await QueryGetAPI<ResponseQueueModel[]>(QUEUE_API_URL + 'get-all', {
        id: accountInfo.value.id,
      })
      if (data.code == 200) {
        console.log('[OPEN-LIVE-Queue] 已获取所有数据')
        return data.data
      } else {
        message.error('无法获取数据: ' + data.message)
        return []
      }
    } catch (err) {
      message.error('无法获取数据')
    }
    return []
  } else {
    return localQueues.value
  }
}
async function add(danmaku: EventModel) {
  if (!accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.Queue)) {
    return
  }
  if (!checkMessage(danmaku)) {
    return
  }
  console.log(`[OPEN-LIVE-QUEUE] 收到 [${danmaku.name}] 的排队请求`)
  if (settings.value.enableOnStreaming && accountInfo.value?.streamerInfo?.isStreaming != true) {
    message.info('当前未在直播中, 无法添加排队请求. 或者关闭设置中的仅允许直播时加入')
    return
  }
  if (accountInfo.value) {
    await QueryPostAPI<ResponseQueueModel>(QUEUE_API_URL + 'try-add', danmaku).then((data) => {
      if (data.code == 200) {
        if (data.message != 'EventFetcher') {
          //如果存在则替换, 否则插入最后
          const index = originQueue.value.findIndex((q) => q.id == data.data.id)
          if (index > -1) {
            message.info(
              `${data.data.user?.name} 通过发送礼物再次付费: ¥ ${((data.data?.giftPrice ?? 0) - (originQueue.value[index]?.giftPrice ?? 0)).toFixed(1)}, 当前总计付费: ¥ ${data.data.giftPrice}`,
            )
            originQueue.value.splice(index, 1, data.data)
          } else {
            originQueue.value.push(data.data)
            message.success(`[${danmaku.name}] 添加至队列`)
          }
        }
      } else {
        //message.error(`[${danmaku.name}] 添加曲目失败: ${data.message}`)
        const time = Date.now()
        notice.warning({
          title: danmaku.name + ' 排队失败',
          description: data.message,
          duration: isWarnMessageAutoClose.value ? 3000 : 0,
          meta: () => h(NTime, { type: 'relative', time: time, key: updateKey.value }),
        })
        console.log(`[OPEN-LIVE-QUEUE] [${danmaku.name}] 排队失败: ${data.message}`)
      }
    })
  } else {
    const songData = {
      status: QueueStatus.Waiting,
      from: danmaku.type == EventDataTypes.Message ? QueueFrom.Danmaku : QueueFrom.Gift,
      giftPrice: danmaku.type == EventDataTypes.SC ? danmaku.price : undefined,
      user: {
        name: danmaku.name,
        uid: danmaku.uid,
        oid: danmaku.open_id,
        fans_medal_level: danmaku.fans_medal_level,
        fans_medal_name: danmaku.fans_medal_name,
        fans_medal_wearing_status: danmaku.fans_medal_wearing_status,
        guard_level: danmaku.guard_level,
      } as DanmakuUserInfo,
      createAt: Date.now(),
      isInLocal: true,
      id: queue.value.length == 0 ? 1 : new List(queue.value).Max((s) => s.id) + 1,
    } as ResponseQueueModel
    localQueues.value.unshift(songData)
    message.success(`[${danmaku.name}] 添加至本地队列`)
  }
}
async function addManual() {
  if (!newQueueName.value) {
    message.error('请输入用户名')
    return
  }
  if (accountInfo.value) {
    await QueryPostAPIWithParams<ResponseQueueModel>(QUEUE_API_URL + 'add', {
      name: newQueueName.value,
    }).then((data) => {
      if (data.code == 200) {
        message.success(`已手动添加用户至队列: ${data.data.user?.name}`)
        originQueue.value.unshift(data.data)
        newQueueName.value = ''
        console.log(`[OPEN-LIVE-QUEUE] 已手动添加用户至队列: ${data.data.user?.name}`)
      } else {
        message.error(`手动添加失败: ${data.message}`)
      }
    })
  } else {
    const songData = {
      status: QueueStatus.Waiting,
      from: QueueFrom.Manual,
      scPrice: undefined,
      user: { name: newQueueName.value } as DanmakuUserInfo,
      createAt: Date.now(),
      isInLocal: true,
      id: queue.value.length == 0 ? 1 : new List(queue.value).Max((s) => s.id) + 1,
    } as ResponseQueueModel
    localQueues.value.unshift(songData)
    message.success(`已手动添加用户至队列: ${newQueueName.value}`)
    newQueueName.value = ''
  }
}
async function updateStatus(queueData: ResponseQueueModel, status: QueueStatus) {
  if (!configCanEdit.value) {
    queueData.status = status
    return
  }
  isLoading.value = true
  await QueryGetAPI(QUEUE_API_URL + 'set-status', {
    id: queueData.id,
    status: status,
  })
    .then((data) => {
      if (data.code == 200) {
        console.log(`[OPEN-LIVE-QUEUE] 更新队列状态: ${queueData.user?.name} -> ${STATUS_MAP[status]}`)
        queueData.status = status
        if (status > QueueStatus.Progressing) {
          queueData.finishAt = Date.now()
        }
        message.success(`已更新 [${queueData.user?.name}] 队列状态为: ${STATUS_MAP[status]}`)
      } else {
        console.log(`[OPEN-LIVE-QUEUE] 更新队列状态失败: ${data.message}`)
        message.error(`更新队列状态失败: ${data.message}`)
      }
    })
    .catch((err) => {
      message.error(`更新队列状态失败`)
    })
    .finally(() => {
      isLoading.value = false
    })
}

function onGetDanmaku(danmaku: EventModel) {
  add(danmaku)
}
function onGetGift(danmaku: EventModel) {
  add(danmaku)
}
function checkMessage(eventData: EventModel) {
  if (!configCanEdit.value && queue.value.find((q) => q.user?.uid == eventData.uid)) {
    return false
  }
  if (settings.value.keyword && eventData.type === EventDataTypes.Message && !checkMatch(eventData.msg)) {
    return false //非排队弹幕
  } else if (eventData.type === EventDataTypes.Gift) {
    if (!settings.value.allowGift && !settings.value.allowIncreasePaymentBySendGift) {
      return false // { success: false, message: '不允许通过礼物排队' }
    }
    const nameNotMatch =
      (settings.value.giftNames?.length ?? 0) > 0 &&
      settings.value.giftNames?.some((n) => eventData.msg.toLowerCase() === n.toLowerCase()) != true
    const priceNotMatch = settings.value.minGiftPrice && eventData.price < settings.value.minGiftPrice
    if (settings.value.giftFilterType === QueueGiftFilterType.Or && (!nameNotMatch || !priceNotMatch)) {
      return true // { success: true, message: '' }
    } else if (nameNotMatch) {
      return false // { success: false, message: `不是有效的排队礼物. 需要: [${settings.value.giftNames?.join(' 或 ')}], 当前: ${eventData.msg}` }
    } else if (priceNotMatch) {
      return false // { success: false, message: `不是有效的排队礼物. 需要: 最低 ${settings.value.minGiftPrice} 元, 当前: ${eventData.price}` }
    }
  }
  return true // { success: true, message: '' }

  function checkMatch(word: string) {
    switch (settings.value.matchType) {
      case KeywordMatchType.Full:
        return settings.value.keyword.trim() === word.trim()
      case KeywordMatchType.Contains:
        return word.trim().toLowerCase().includes(settings.value.keyword.trim().toLowerCase())
      case KeywordMatchType.Regex:
        return new RegExp(settings.value.keyword).test(word)
      default:
        return false
    }
  }
}
async function onUpdateFunctionEnable() {
  if (accountInfo.value) {
    const oldValue = JSON.parse(JSON.stringify(accountInfo.value.settings.enableFunctions))
    if (accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.Queue)) {
      accountInfo.value.settings.enableFunctions = accountInfo.value.settings.enableFunctions.filter(
        (f) => f != FunctionTypes.Queue,
      )
    } else {
      accountInfo.value.settings.enableFunctions.push(FunctionTypes.Queue)
    }
    if (!accountInfo.value.settings.queue.keyword) {
      accountInfo.value.settings.queue.keyword = defaultKeyword.value
    }
    await SaveEnableFunctions(accountInfo.value?.settings.enableFunctions)
      .then((data) => {
        if (data.code == 200) {
          message.success(
            `已${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest) ? '启用' : '禁用'}队列功能`,
          )
        } else {
          if (accountInfo.value) {
            accountInfo.value.settings.enableFunctions = oldValue
          }
          message.error(
            `队列功能${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest) ? '启用' : '禁用'}失败: ${data.message}`,
          )
        }
      })
      .catch((err) => {
        message.error(
          `队列功能${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest) ? '启用' : '禁用'}失败: ${err}`,
        )
      })
  }
}
async function updateSettings() {
  if (accountInfo.value) {
    isLoading.value = true
    await SaveSetting('Queue', settings.value)
      .then((msg) => {
        if (msg) {
          message.success('已保存')
          return true
        } else {
          message.error('保存失败: ' + msg)
        }
      })
      .finally(() => {
        isLoading.value = false
      })
  } else {
    message.success('完成')
  }
}
async function deleteQueue(values: ResponseQueueModel[]) {
  await QueryPostAPI(
    QUEUE_API_URL + 'del',
    values.map((s) => s.id),
  )
    .then((data) => {
      if (data.code == 200) {
        message.success('删除成功')
        originQueue.value = originQueue.value.filter((s) => !values.includes(s))
      } else {
        message.error('删除失败: ' + data.message)
        console.error('删除失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('删除失败')
    })
}
async function deactiveAllSongs() {
  await QueryGetAPI(QUEUE_API_URL + 'deactive')
    .then((data) => {
      if (data.code == 200) {
        message.success('已全部取消')
        queue.value.forEach((s) => {
          if (s.status <= QueueStatus.Progressing) {
            s.status = QueueStatus.Cancel
          }
        })
      } else {
        message.error('取消失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('取消失败')
    })
}
const statusFilterOptions = computed(() => {
  return Object.values(QueueStatus)
    .filter((t) => /^\d+$/.test(t.toString()))
    .map((t) => {
      return {
        label: STATUS_MAP[t as QueueStatus],
        value: t,
      }
    })
})
const columns = [
  {
    title: '用户名',
    key: 'user.name',
    render: (data) => {
      return h(
        NTooltip,
        { trigger: 'hover' },
        {
          trigger: () => data.user?.name,
          default: () => (data.from == QueueFrom.Manual ? '就是主播自己' : data.user?.uid),
        },
      )
    },
  },
  {
    title: '来自',
    key: 'from',
    render(data) {
      let fromType: 'info' | 'success' | 'default' | 'error'
      switch (data.from) {
        case QueueFrom.Danmaku: {
          fromType = 'info'
          break
        }
        case QueueFrom.Gift: {
          fromType = 'error'
          break
        }
        case QueueFrom.Web: {
          fromType = 'success'
          break
        }
        case QueueFrom.Manual: {
          fromType = 'default'
          break
        }
      }
      return h(NTag, { size: 'small', type: fromType }, () => {
        switch (data.from) {
          case QueueFrom.Danmaku: {
            return '弹幕' + (data.giftPrice ? ' | ' + data.giftPrice : '')
          }
          case QueueFrom.Gift: {
            return '礼物 | ' + data.giftPrice
          }
          case QueueFrom.Manual: {
            return '手动添加'
          }
          case QueueFrom.Web: {
            return '网页添加'
          }
        }
      })
    },
  },
  {
    title: '状态',
    key: 'status',
    filter(value, row) {
      return ~row.status == value
    },
    filterOptions: statusFilterOptions.value,
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
          style: data.status == QueueStatus.Progressing ? 'animation: animated-border 2.5s infinite;' : '',
        },
        () => STATUS_MAP[data.status],
      )
    },
  },
  {
    title: '时间',
    key: 'time',
    sorter: (a, b) => a.createAt - b.createAt,
    render: (data) => {
      return h(NTime, { time: data.createAt })
    },
  },
  {
    title: '操作',
    key: 'manage',
    width: 100,
    render(data) {
      return h(
        NSpace,
        {
          justify: 'center',
          size: 10,
        },
        () => [
          data.status == QueueStatus.Finish || data.status == QueueStatus.Cancel
            ? h(NTooltip, null, {
              trigger: () =>
                h(
                  NButton,
                  {
                    size: 'small',
                    type: 'info',
                    circle: true,
                    loading: isLoading.value,
                    onClick: () => {
                      updateStatus(data, QueueStatus.Waiting)
                    },
                  },
                  {
                    icon: () => h(NIcon, { component: ReloadCircleSharp }),
                  },
                ),
              default: () => '重新放回等待列表',
            })
            : undefined,
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
                        size: 'small',
                        type: 'error',
                        circle: true,
                        loading: isLoading.value,
                      },
                      {
                        icon: () => h(NIcon, { component: Delete24Filled }),
                      },
                    ),
                  default: () => '删除记录',
                }),
              default: () => '确定删除?',
            },
          ),
        ],
      )
    },
  },
] as DataTableColumns<ResponseQueueModel>
function GetGuardColor(level: number | null | undefined): string {
  if (level) {
    switch (level) {
      case 1: {
        return 'rgb(122, 4, 35)'
      }
      case 2: {
        return 'rgb(157, 155, 255)'
      }
      case 3: {
        return 'rgb(104, 136, 241)'
      }
    }
  }
  return ''
}
async function updateActive() {
  if (!accountInfo.value) return
  try {
    const data = await QueryGetAPI<ResponseQueueModel[]>(QUEUE_API_URL + 'get-active', {
      id: accountInfo.value?.id,
    })
    if (data.code == 200) {
      data.data.forEach((item) => {
        const queueData = originQueue.value.find((s) => s.id == item.id)
        if (queueData) {
          if (queueData.status != item.status) queueData.status = item.status
          if (queueData.giftPrice != item.giftPrice) {
            queueData.giftPrice = item.giftPrice
            message.info(
              `${queueData.user?.name} 通过发送礼物再次付费: ¥ ${(item?.giftPrice ?? 0) - (queueData?.giftPrice ?? 0)}, 当前总计付费: ¥ ${item.giftPrice}`,
            )
          }
        } else {
          originQueue.value.unshift(item)
          if (item.from == QueueFrom.Web) {
            message.success(`[${item.user?.name}] 直接从网页加入队列: ${item.user?.name}`)
          }
        }
      })
    } else {
      message.error('无法获取队列: ' + data.message)
      return []
    }
  } catch (err) { }
}
function blockUser(item: ResponseQueueModel) {
  if (item.from != QueueFrom.Danmaku) {
    message.error(`[${item.user?.name}] 不是来自弹幕的用户`)
    return
  }
  if (item.user) {
    AddBiliBlackList(item.user.uid, item.user.name)
      .then((data) => {
        if (data.code == 200) {
          message.success(`[${item.user?.name}] 已添加到黑名单`)
          updateStatus(item, QueueStatus.Cancel)
        } else {
          message.error(data.message)
        }
      })
      .catch((err) => {
        message.error(err)
      })
  }
}
let timer: any
let updateActiveTimer: any
const updateKey = ref(0)
onMounted(() => {
  if (accountInfo.value) {
    settings.value = accountInfo.value.settings.queue
  }
  client.onEvent('danmaku', onGetDanmaku)
  client.onEvent('gift', onGetGift)
  init()
})
onActivated(() => {
  init()
})
function init() {
  dispose()
  timer = setInterval(() => {
    updateKey.value++
  }, 1000)
  updateActiveTimer = setInterval(() => {
    updateActive()
  }, 2000)
}
function dispose() {
  clearInterval(timer)
  clearInterval(updateActiveTimer)
}
onDeactivated(() => {
  dispose()
})
onUnmounted(() => {
  client.offEvent('danmaku', onGetDanmaku)
  client.offEvent('gift', onGetGift)
  dispose()
})
</script>

<template>
  <NAlert
    v-if="accountInfo.id"
    :type="accountInfo.settings.enableFunctions.includes(FunctionTypes.Queue) ? 'success' : 'warning'"
  >
    启用弹幕队列功能
    <NSwitch
      :value="accountInfo?.settings.enableFunctions.includes(FunctionTypes.Queue)"
      @update:value="onUpdateFunctionEnable"
    />

    <br>
    <NText depth="3">
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
      则其需要保持此页面开启才能使用, 也不要同时开多个页面, 会导致重复 !(部署了则不影响)
    </NText>
  </NAlert>
  <NAlert
    v-else
    type="warning"
    title="你尚未注册并登录 VTsuru.live, 大部分规则设置将不可用 (因为我懒得在前段重写一遍逻辑"
  >
    <NButton
      tag="a"
      href="/manage"
      target="_blank"
      type="primary"
    >
      前往登录或注册
    </NButton>
  </NAlert>
  <br>
  <NCard size="small">
    <NSpace align="center">
      <NTooltip>
        <template #trigger>
          <NButton
            type="primary"
            :disabled="!accountInfo"
            @click="showOBSModal = true"
          >
            OBS 组件
          </NButton>
        </template>
        {{ configCanEdit ? '' : '登陆后才可以使用此功能' }}
      </NTooltip>
    </NSpace>
  </NCard>
  <br>
  <NCard>
    <NTabs
      v-if="!accountInfo || accountInfo.settings.enableFunctions.includes(FunctionTypes.Queue)"
      animated
      display-directive="show:lazy"
    >
      <NTabPane
        name="list"
        tab="列表"
      >
        <NCard size="small">
          <NSpace align="center">
            <NTag
              type="success"
              :bordered="false"
            >
              <template #icon>
                <NIcon :component="PeopleQueue24Filled" />
              </template>
              队列 | {{ queue.filter((s) => s.status == QueueStatus.Waiting).length }}
            </NTag>
            <NTag
              type="success"
              :bordered="false"
            >
              <template #icon>
                <NIcon :component="Checkmark12Regular" />
              </template>
              今日已处理 |
              {{ queue.filter((s) => s.status == QueueStatus.Finish && isSameDay(s.finishAt ?? 0, Date.now())).length }}
              位
            </NTag>
            <NInputGroup>
              <NInput
                v-model:value="newQueueName"
                placeholder="手动添加"
              />
              <NButton
                type="primary"
                @click="addManual"
              >
                添加
              </NButton>
            </NInputGroup>
            <NPopconfirm @positive-click="deactiveAllSongs">
              <template #trigger>
                <NButton type="error">
                  全部取消
                </NButton>
              </template>
              确定全部取消吗?
            </NPopconfirm>
            <NRadioGroup
              v-model:value="settings.sortType"
              :disabled="!configCanEdit"
              type="button"
              @update:value="updateSettings"
            >
              <NRadioButton :value="QueueSortType.TimeFirst">
                加入时间优先
              </NRadioButton>
              <NRadioButton :value="QueueSortType.PaymentFist">
                付费价格优先
              </NRadioButton>
              <NRadioButton :value="QueueSortType.GuardFirst">
                舰长优先 (按等级)
              </NRadioButton>
              <NRadioButton :value="QueueSortType.FansMedalFirst">
                粉丝牌等级优先
              </NRadioButton>
            </NRadioGroup>
            <NCheckbox
              v-if="configCanEdit"
              v-model:checked="settings.isReverse"
              @update:checked="updateSettings"
            >
              倒序
            </NCheckbox>
            <NCheckbox
              v-else
              v-model:checked="isReverse"
            >
              倒序
            </NCheckbox>
          </NSpace>
        </NCard>
        <NDivider> 共 {{ queue.length }} 人 </NDivider>
        <NList
          v-if="queue.length > 0"
          :show-divider="false"
          hoverable
        >
          <NListItem
            v-for="(queueData, index) in queue"
            :key="queueData.id"
            style="padding: 5px"
          >
            <NCard
              embedded
              size="small"
              content-style="padding: 5px;"
              :style="`${queueData.status == QueueStatus.Progressing ? 'animation: animated-border 2.5s infinite;' : ''};height: 100%;`"
            >
              <NSpace
                justify="space-between"
                align="center"
                style="height: 100%; margin: 0 5px 0 5px"
              >
                <NSpace align="center">
                  <div
                    :style="`border-radius: 4px; background-color: ${queueData.status == QueueStatus.Progressing ? '#75c37f' : '#577fb8'}; width: 20px; height: 20px;text-align: center;color: white;`"
                  >
                    {{ index + 1 }}
                  </div>
                  <NText
                    strong
                    style="font-size: 18px"
                  >
                    <NTooltip>
                      <template #trigger>
                        {{ queueData.user?.name }}
                      </template>
                      {{ queueData.user?.uid }}
                    </NTooltip>
                  </NText>
                  <template v-if="queueData.from == QueueFrom.Manual">
                    <NTag
                      size="small"
                      :bordered="false"
                    >
                      手动添加
                    </NTag>
                  </template>
                  <NSpace
                    v-if="
                      (queueData.from == QueueFrom.Danmaku || queueData.from == QueueFrom.Gift) &&
                        queueData.user?.fans_medal_wearing_status
                    "
                  >
                    <NTag
                      size="tiny"
                      round
                    >
                      <NTag
                        size="tiny"
                        round
                        :bordered="false"
                      >
                        <NText depth="3">
                          {{ queueData.user?.fans_medal_level }}
                        </NText>
                      </NTag>
                      <span style="color: #577fb8">
                        {{ queueData.user?.fans_medal_name }}
                      </span>
                    </NTag>
                  </NSpace>
                  <NTag
                    v-if="(queueData.user?.guard_level ?? 0) > 0"
                    size="small"
                    :bordered="false"
                    :color="{ textColor: 'white', color: GetGuardColor(queueData.user?.guard_level) }"
                  >
                    {{ queueData.user?.guard_level == 1 ? '总督' : queueData.user?.guard_level == 2 ? '提督' : '舰长' }}
                  </NTag>
                  <NTag
                    v-if="(queueData.giftPrice ?? 0) > 0"
                    size="small"
                    :bordered="false"
                    type="error"
                  >
                    付费 | {{ queueData.giftPrice }}
                  </NTag>
                  <NTooltip>
                    <template #trigger>
                      <NText style="font-size: small">
                        <NTime
                          :key="updateKey"
                          :time="queueData.createAt"
                          type="relative"
                        />
                      </NText>
                    </template>
                    <NTime :time="queueData.createAt" />
                  </NTooltip>

                  <NTooltip
                    v-if="queueData.content"
                    content-style="margin: 0"
                  >
                    <template #trigger>
                      <NText
                        strong
                        style="font-size: 18px"
                      >
                        <NIcon :component="Info24Filled" />
                      </NText>
                    </template>
                    <NCard
                      size="small"
                      :bordered="false"
                    >
                      <template #header>
                        <span style="font-size: small; color: gray;">
                          {{ '来自' + (queueData?.from == QueueFrom.Gift ? '礼物' : '弹幕') + ': ' }}
                        </span>
                      </template>
                      {{ queueData?.content }}
                    </NCard>
                  </NTooltip>
                </NSpace>
                <NSpace
                  justify="end"
                  align="center"
                >
                  <NTooltip>
                    <template #trigger>
                      <NButton
                        circle
                        type="primary"
                        style="height: 30px; width: 30px"
                        :disabled="queue.findIndex((s) => s.id != queueData.id && s.status == QueueStatus.Progressing) > -1
                        "
                        :style="`animation: ${queueData.status == QueueStatus.Waiting ? '' : 'loading 5s linear infinite'}`"
                        :secondary="queueData.status == QueueStatus.Progressing"
                        :loading="isLoading"
                        @click="
                          updateStatus(
                            queueData,
                            queueData.status == QueueStatus.Progressing ? QueueStatus.Waiting : QueueStatus.Progressing,
                          )
                        "
                      >
                        <template #icon>
                          <NIcon :component="ClipboardTextLtr24Filled" />
                        </template>
                      </NButton>
                    </template>
                    {{
                      queue.findIndex((s) => s.id != queueData.id && s.status == QueueStatus.Progressing) > -1
                        ? '还有其他正在正在处理中的用户'
                        : queueData.status == QueueStatus.Waiting && queueData.id
                          ? '开始处理'
                          : '取消'
                    }}
                  </NTooltip>
                  <NTooltip>
                    <template #trigger>
                      <NButton
                        circle
                        type="success"
                        style="height: 30px; width: 30px"
                        :loading="isLoading"
                        @click="updateStatus(queueData, QueueStatus.Finish)"
                      >
                        <template #icon>
                          <NIcon :component="Checkmark12Regular" />
                        </template>
                      </NButton>
                    </template>
                    已完成
                  </NTooltip>
                  <NTooltip v-if="queueData.from == QueueFrom.Danmaku">
                    <template #trigger>
                      <NPopconfirm @positive-click="blockUser(queueData)">
                        <template #trigger>
                          <NButton
                            circle
                            type="warning"
                            style="height: 30px; width: 30px"
                            :loading="isLoading"
                          >
                            <template #icon>
                              <NIcon :component="PresenceBlocked16Regular" />
                            </template>
                          </NButton>
                        </template>
                        确定拉黑 {{ queueData.user?.name }} 吗
                      </NPopconfirm>
                    </template>
                    拉黑用户
                  </NTooltip>
                  <NTooltip>
                    <template #trigger>
                      <NButton
                        circle
                        type="error"
                        style="height: 30px; width: 30px"
                        :loading="isLoading"
                        @click="updateStatus(queueData, QueueStatus.Cancel)"
                      >
                        <template #icon>
                          <NIcon :component="Dismiss16Filled" />
                        </template>
                      </NButton>
                    </template>
                    移出队列
                  </NTooltip>
                </NSpace>
              </NSpace>
            </NCard>
          </NListItem>
        </NList>
        <NEmpty
          v-else
          description="暂无用户"
        />
      </NTabPane>
      <NTabPane
        name="history"
        tab="历史"
      >
        <NCard size="small">
          <NSpace>
            <NInputGroup style="width: 300px">
              <NInputGroupLabel> 筛选用户 </NInputGroupLabel>
              <NInput
                v-model:value="filterName"
                clearable
              >
                <template #suffix>
                  <NCheckbox v-model:checked="filterNameContains">
                    包含
                  </NCheckbox>
                </template>
              </NInput>
            </NInputGroup>
          </NSpace>
        </NCard>
        <NDataTable
          ref="table"
          size="small"
          :columns="columns"
          :data="originQueue"
          :pagination="{
            itemCount: originQueue.length,
            pageSizes: [20, 50, 100],
            showSizePicker: true,
            prefix({ itemCount }) {
              return `共 ${itemCount} 条记录`
            },
          }"
        />
      </NTabPane>
      <NTabPane
        name="setting"
        tab="设置"
      >
        <NSpin :show="isLoading">
          <NDivider> 规则 </NDivider>
          <NSpace vertical>
            <NSpace align="center">
              <NInputGroup style="width: 350px">
                <NInputGroupLabel> 加入队列关键词 </NInputGroupLabel>
                <template v-if="configCanEdit">
                  <NInput v-model:value="settings.keyword" />
                  <NButton
                    type="primary"
                    @click="updateSettings"
                  >
                    确定
                  </NButton>
                </template>
                <NInput
                  v-else
                  v-model:value="defaultKeyword"
                />
              </NInputGroup>
              <NRadioGroup
                v-model:value="settings.matchType"
                :disabled="!configCanEdit"
                type="button"
                @update:value="updateSettings"
              >
                <NRadioButton :value="KeywordMatchType.Full">
                  完全一致
                </NRadioButton>
                <NRadioButton :value="KeywordMatchType.Contains">
                  包含
                </NRadioButton>
                <NRadioButton :value="KeywordMatchType.Regex">
                  正则
                </NRadioButton>
              </NRadioGroup>
            </NSpace>
            <NInputGroup style="width: 250px">
              <NInputGroupLabel> 最大队列长度 </NInputGroupLabel>
              <NInputNumber
                v-model:value="settings.queueMaxSize"
                :disabled="!configCanEdit"
                min="0"
                max="1000"
              />
              <NButton
                type="info"
                :disabled="!configCanEdit"
                @click="updateSettings"
              >
                确定
              </NButton>
            </NInputGroup>
            <NSpace align="center">
              <NCheckbox
                v-model:checked="settings.enableOnStreaming"
                :disabled="!configCanEdit"
                @update:checked="updateSettings"
              >
                仅在直播时才允许加入
              </NCheckbox>
              <NCheckbox
                v-model:checked="settings.allowAllDanmaku"
                :disabled="!configCanEdit"
                @update:checked="updateSettings"
              >
                允许所有用户加入
              </NCheckbox>
              <template v-if="!settings.allowAllDanmaku">
                <NInputGroup style="width: 270px">
                  <NInputGroupLabel> 最低粉丝牌等级 </NInputGroupLabel>
                  <NInputNumber
                    v-model:value="settings.fanMedalMinLevel"
                    :disabled="!configCanEdit"
                    min="0"
                  />
                  <NButton
                    type="info"
                    :disabled="!configCanEdit"
                    @click="updateSettings"
                  >
                    确定
                  </NButton>
                </NInputGroup>
                <NCheckbox
                  v-if="!settings.allowAllDanmaku"
                  v-model:checked="settings.needJianzhang"
                  :disabled="!configCanEdit"
                  @update:checked="updateSettings"
                >
                  允许舰长
                </NCheckbox>
                <NCheckbox
                  v-if="!settings.allowAllDanmaku"
                  v-model:checked="settings.needTidu"
                  :disabled="!configCanEdit"
                  @update:checked="updateSettings"
                >
                  允许提督
                </NCheckbox>
                <NCheckbox
                  v-if="!settings.allowAllDanmaku"
                  v-model:checked="settings.needZongdu"
                  :disabled="!configCanEdit"
                  @update:checked="updateSettings"
                >
                  允许总督
                </NCheckbox>
              </template>
            </NSpace>
            <NSpace align="center">
              <NCheckbox
                v-model:checked="settings.allowGift"
                :disabled="!configCanEdit"
                @update:checked="updateSettings"
              >
                允许通过发送礼物加入队列
              </NCheckbox>
              <template v-if="settings.allowGift">
                <NInputGroup
                  v-if="settings.allowGift"
                  style="width: 250px"
                >
                  <NInputGroupLabel> 最低价格 </NInputGroupLabel>
                  <NInputNumber
                    v-model:value="settings.minGiftPrice"
                    :disabled="!configCanEdit"
                  />
                  <NButton
                    type="info"
                    :disabled="!configCanEdit"
                    @click="updateSettings"
                  >
                    确定
                  </NButton>
                </NInputGroup>
                <NSpace align="center">
                  礼物名
                  <NSelect
                    v-model:value="settings.giftNames"
                    style="width: 250px"
                    :disabled="!configCanEdit"
                    filterable
                    multiple
                    tag
                    placeholder="礼物名称，按回车确认"
                    :show-arrow="false"
                    :show="false"
                    @update:value="updateSettings"
                  />
                </NSpace>
                <span>
                  <NRadioGroup
                    v-model:value="settings.giftFilterType"
                    :disabled="!configCanEdit"
                    @update:value="updateSettings"
                  >
                    <NRadioButton :value="QueueGiftFilterType.And"> 需同时满足礼物名和价格 </NRadioButton>
                    <NRadioButton :value="QueueGiftFilterType.Or"> 礼物名/价格 二选一 </NRadioButton>
                  </NRadioGroup>
                </span>
                <NCheckbox
                  v-model:checked="settings.sendGiftDirectJoin"
                  :disabled="!configCanEdit"
                  @update:checked="updateSettings"
                >
                  赠送礼物后自动加入队列
                  <NTooltip>
                    <template #trigger>
                      <NIcon :component="Info24Filled" />
                    </template>
                    否则需要手动再发送一次排队的弹幕
                  </NTooltip>
                </NCheckbox>

                <NCheckbox
                  v-model:checked="settings.sendGiftIgnoreLimit"
                  :disabled="!configCanEdit"
                  @update:checked="updateSettings"
                >
                  赠送礼物后无视用户等级限制
                </NCheckbox>
              </template>
              <NCheckbox
                v-model:checked="settings.allowIncreasePaymentBySendGift"
                :disabled="!configCanEdit"
                @update:checked="updateSettings"
              >
                在队列中时允许继续发送礼物累计付费量 (仅限上方设定的礼物)
              </NCheckbox>
              <NCheckbox
                v-if="settings.allowIncreasePaymentBySendGift"
                v-model:checked="settings.allowIncreaseByAnyPayment"
                :disabled="!configCanEdit"
                @update:checked="updateSettings"
              >
                允许发送任意礼物来叠加付费量
              </NCheckbox>
            </NSpace>
            <NDivider> 冷却 (单位: 秒) </NDivider>
            <NCheckbox
              v-model:checked="settings.enableCooldown"
              :disabled="!configCanEdit"
              @update:checked="updateSettings"
            >
              启用排队冷却
            </NCheckbox>
            <NSpace v-if="settings.enableCooldown">
              <NInputGroup style="width: 250px">
                <NInputGroupLabel> 普通弹幕 </NInputGroupLabel>
                <NInputNumber
                  v-model:value="settings.cooldownSecond"
                  :disabled="!configCanEdit"
                />
                <NButton
                  type="info"
                  :disabled="!configCanEdit"
                  @click="updateSettings"
                >
                  确定
                </NButton>
              </NInputGroup>
              <NInputGroup style="width: 220px">
                <NInputGroupLabel> 舰长 </NInputGroupLabel>
                <NInputNumber
                  v-model:value="settings.jianzhangCooldownSecond"
                  :disabled="!configCanEdit"
                />
                <NButton
                  type="info"
                  :disabled="!configCanEdit"
                  @click="updateSettings"
                >
                  确定
                </NButton>
              </NInputGroup>
              <NInputGroup style="width: 220px">
                <NInputGroupLabel> 提督 </NInputGroupLabel>
                <NInputNumber
                  v-model:value="settings.tiduCooldownSecond"
                  :disabled="!configCanEdit"
                />
                <NButton
                  type="info"
                  :disabled="!configCanEdit"
                  @click="updateSettings"
                >
                  确定
                </NButton>
              </NInputGroup>
              <NInputGroup style="width: 220px">
                <NInputGroupLabel> 总督 </NInputGroupLabel>
                <NInputNumber
                  v-model:value="settings.zongduCooldownSecond"
                  :disabled="!configCanEdit"
                />
                <NButton
                  type="info"
                  :disabled="!configCanEdit"
                  @click="updateSettings"
                >
                  确定
                </NButton>
              </NInputGroup>
            </NSpace>
            <NDivider> OBS </NDivider>
            <NCheckbox
              v-model:checked="settings.showRequireInfo"
              :disabled="!configCanEdit"
              @update:checked="updateSettings"
            >
              显示底部的需求信息
            </NCheckbox>
            <NCheckbox
              v-model:checked="settings.showPayment"
              :disabled="!configCanEdit"
              @update:checked="updateSettings"
            >
              显示付费信息
            </NCheckbox>
            <NCheckbox
              v-model:checked="settings.showFanMadelInfo"
              :disabled="!configCanEdit"
              @update:checked="updateSettings"
            >
              显示用户粉丝牌
            </NCheckbox>
            <NDivider> 其他 </NDivider>
            <NCheckbox v-model:checked="isWarnMessageAutoClose">
              自动关闭加入队列失败时的提示消息
            </NCheckbox>
          </NSpace>
        </NSpin>
      </NTabPane>
    </NTabs>
    <template v-else>
      <NAlert
        title="未启用"
        type="error"
      >
        请先启用弹幕排队功能
      </NAlert>
    </template>
  </NCard>
  <NModal
    v-model:show="showOBSModal"
    title="OBS组件"
    preset="card"
    style="width: 800px"
  >
    <NAlert
      title="这是什么?  "
      type="info"
    >
      将等待队列以及结果显示在OBS中
    </NAlert>
    <NDivider> 浏览 </NDivider>
    <div style="height: 500px; width: 280px; position: relative; margin: 0 auto">
      <QueueOBS :id="accountInfo?.id" />
    </div>
    <br>
    <NInput :value="`${CURRENT_HOST}obs/queue?id=` + accountInfo?.id" />
    <NDivider />
    <NCollapse>
      <NCollapseItem title="使用说明">
        <NUl>
          <NLi>在 OBS 来源中添加源, 选择 浏览器</NLi>
          <NLi>在 URL 栏填入上方链接</NLi>
          <NLi>根据自己的需要调整宽度和高度 (这里是宽 280px 高 500px)</NLi>
          <NLi>完事</NLi>
        </NUl>
      </NCollapseItem>
    </NCollapse>
  </NModal>
</template>

<style>
@keyframes loading {

  /*以百分比来规定改变发生的时间 也可以通过"from"和"to",等价于0% 和 100%*/
  0% {
    /*rotate(2D旋转) scale(放大或者缩小) translate(移动) skew(翻转)*/
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

@keyframes animated-border {
  0% {
    box-shadow: 0 0 0px #589580;
  }

  100% {
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0);
  }
}

@keyframes animated-border-round {
  0% {
    box-shadow: 0 0 0px #589580;
    border-radius: 50%;
  }

  100% {
    box-shadow: 0 0 0 5px rgba(255, 255, 255, 0);
    border-radius: 50%;
  }
}
</style>
