<script setup lang="ts">
import { AddBiliBlackList, SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import {
  DanmakuUserInfo,
  EventDataTypes,
  EventModel,
  FunctionTypes,
  OpenLiveInfo,
  QueueSortType,
  Setting_LiveRequest,
  SongRequestFrom,
  SongRequestInfo,
  SongRequestStatus,
  SongsInfo
} from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI, QueryPostAPIWithParams } from '@/api/query'
import SongPlayer from '@/components/SongPlayer.vue'
import { CURRENT_HOST, SONG_REQUEST_API_URL } from '@/data/constants'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import {
  Checkmark12Regular,
  Delete24Filled,
  Dismiss16Filled,
  Info24Filled,
  Mic24Filled,
  PeopleQueue24Filled,
  Play24Filled,
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
  useNotification
} from 'naive-ui'
import { computed, h, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import LiveRequestOBS from '../obs/LiveRequestOBS.vue'

const defaultSettings = {
  orderPrefix: '点播',
  onlyAllowSongList: false,
  queueMaxSize: 10,
  allowAllDanmaku: true,
  allowFromWeb: true,
  needWearFanMedal: false,
  needJianzhang: false,
  needTidu: false,
  needZongdu: false,
  allowSC: true,
  scIgnoreLimit: true,
  scMinPrice: 30,
  fanMedalMinLevel: 0,
  allowReorderSong: false,
  enableCooldown: false,
  cooldownSecond: 1200,
  zongduCooldownSecond: 300,
  tiduCooldownSecond: 600,
  jianzhangCooldownSecond: 900,
  isReverse: false,
} as Setting_LiveRequest
const STATUS_MAP = {
  [SongRequestStatus.Waiting]: '等待中',
  [SongRequestStatus.Singing]: '处理中',
  [SongRequestStatus.Finish]: '已处理',
  [SongRequestStatus.Cancel]: '已取消',
}

const route = useRoute()
const accountInfo = useAccount()
const message = useMessage()
const notice = useNotification()
const client = await useDanmakuClient().initOpenlive()

const isWarnMessageAutoClose = useStorage('SongRequest.Settings.WarnMessageAutoClose', false)
const volumn = useStorage('Settings.Volumn', 0.5)
const isReverse = useStorage('SongRequest.Settings.Reverse', false)

const isLoading = ref(false)
const showOBSModal = ref(false)

const settings = computed({
  get: () => {
    if (accountInfo.value) {
      return accountInfo.value.settings.songRequest
    }
    return defaultSettings
  },
  set: (value) => {
    if (accountInfo.value) {
      accountInfo.value.settings.songRequest = value
    }
  },
})
const selectedSong = ref<SongsInfo>()

const props = defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

const localActiveSongs = useStorage('SongRequest.ActiveSongs', [] as SongRequestInfo[])
const originSongs = ref<SongRequestInfo[]>(await getAllSong())
const songs = computed(() => {
  let result = new List(originSongs.value).Where((s) => {
    if (filterName.value) {
      if (filterNameContains.value) {
        if (!s?.user?.name.toLowerCase().includes(filterName.value.toLowerCase())) {
          return false
        }
      } else if (s?.user?.name.toLowerCase() !== filterName.value.toLowerCase()) {
        return false
      }
    } else if (filterSongName.value) {
      if (filterSongNameContains.value) {
        if (!s?.songName.toLowerCase().includes(filterSongName.value.toLowerCase())) {
          return false
        }
      } else if (s?.songName.toLowerCase() !== filterSongName.value.toLowerCase()) {
        return false
      }
    }
    return true
  })
  switch (settings.value.sortType) {
    case QueueSortType.TimeFirst: {
      result = result.ThenBy((q) => q.createAt)
      break
    }
    case QueueSortType.GuardFirst: {
      result = result
        .OrderBy((q) => (q.user?.guard_level == 0 || q.user?.guard_level == null ? 4 : q.user.guard_level))
        .ThenBy((q) => q.createAt)
      break
    }
    case QueueSortType.PaymentFist: {
      result = result.OrderByDescending((q) => q.price ?? 0).ThenBy((q) => q.createAt)
    }
    case QueueSortType.FansMedalFirst: {
      result = result.OrderByDescending((q) => q.user?.fans_medal_level ?? 0).ThenBy((q) => q.createAt)
    }
  }
  if (configCanEdit.value ? settings.value.isReverse : isReverse.value) {
    return result.Reverse().ToArray()
  } else {
    return result.ToArray()
  }
})
const activeSongs = computed(() => {
  return (accountInfo ? songs.value : localActiveSongs.value)
    .sort((a, b) => b.status - a.status)
    .filter((song) => {
      return song.status == SongRequestStatus.Waiting || song.status == SongRequestStatus.Singing
    })
})
const historySongs = computed(() => {
  return (accountInfo ? songs.value : localActiveSongs.value)
    .sort((a, b) => a.status - b.status)
    .filter((song) => {
      return song.status == SongRequestStatus.Finish || song.status == SongRequestStatus.Cancel
    })
})

function sortSongs(songs: SongRequestInfo[]) {
  let result = new List(songs)
  switch (settings.value.sortType) {
    case QueueSortType.TimeFirst: {
      result = result.ThenBy((q) => q.createAt)
      break
    }
    case QueueSortType.GuardFirst: {
      result = result.OrderBy((q) => q.user?.guard_level).ThenBy((q) => q.createAt)
      break
    }
    case QueueSortType.PaymentFist: {
      result = result.OrderByDescending((q) => q.price ?? 0).ThenBy((q) => q.createAt)
    }
  }
  if (configCanEdit.value ? settings.value.isReverse : isReverse.value) {
    return result.Reverse().ToArray()
  }
  return result.ToArray()
}

const newSongName = ref('')
const filterSongName = ref('')
const filterSongNameContains = ref(false)
const filterName = ref('')
const filterNameContains = ref(false)

const defaultPrefix = useStorage('Settings.SongRequest.DefaultPrefix', '点播')
const configCanEdit = computed(() => {
  return accountInfo.value != null && accountInfo.value != undefined
})

const table = ref()

async function getAllSong() {
  if (accountInfo.value) {
    try {
      const data = await QueryGetAPI<SongRequestInfo[]>(SONG_REQUEST_API_URL + 'get-all', {
        id: accountInfo.value.id,
      })
      if (data.code == 200) {
        console.log('[OPEN-LIVE-LIVE-REQUEST] 已获取所有数据')
        return new List(data.data).OrderByDescending((s) => s.createAt).ToArray()
      } else {
        message.error('无法获取数据: ' + data.message)
        return []
      }
    } catch (err) {
      message.error('无法获取数据')
    }
    return []
  } else {
    return localActiveSongs.value
  }
}
async function addSong(danmaku: EventModel) {
  console.log(
    `[OPEN-LIVE-LIVE-REQUEST] 收到 [${danmaku.name}] 的点播${danmaku.type == EventDataTypes.SC ? 'SC' : '弹幕'}: ${danmaku.msg}`,
  )
  if (settings.value.enableOnStreaming && accountInfo.value?.streamerInfo?.isStreaming != true) {
    notice.info({
      title: `${danmaku.name} 点播失败`,
      description: '当前未在直播中, 无法添加点播请求. 或者关闭设置中的仅允许直播时加入',
      meta: () => h(NTime, { type: 'relative', time: Date.now(), key: updateKey.value }),
    })
    return
  }
  if (accountInfo.value) {
    await QueryPostAPI<SongRequestInfo>(SONG_REQUEST_API_URL + 'try-add', danmaku).then((data) => {
      if (data.code == 200) {
        message.success(`[${danmaku.name}] 添加曲目: ${data.data.songName}`)
        if (data.message != 'EventFetcher') originSongs.value.unshift(data.data)
      } else {
        //message.error(`[${danmaku.name}] 添加曲目失败: ${data.message}`)
        const time = Date.now()
        notice.warning({
          title: danmaku.name + ' 点播失败',
          description: data.message,
          duration: isWarnMessageAutoClose.value ? 3000 : 0,
          meta: () => h(NTime, { type: 'relative', time: time, key: updateKey.value }),
        })
        console.log(`[OPEN-LIVE-LIVE-REQUEST] [${danmaku.name}] 添加曲目失败: ${data.message}`)
      }
    })
  } else {
    const songData = {
      songName: danmaku.msg.trim().substring(settings.value.orderPrefix.length),
      song: undefined,
      status: SongRequestStatus.Waiting,
      from: danmaku.type == EventDataTypes.Message ? SongRequestFrom.Danmaku : SongRequestFrom.SC,
      scPrice: danmaku.type == EventDataTypes.SC ? danmaku.price : 0,
      user: {
        name: danmaku.name,
        uid: danmaku.uid,
        oid: danmaku.open_id,
        face: danmaku.uface,
        fans_medal_level: danmaku.fans_medal_level,
        fans_medal_name: danmaku.fans_medal_name,
        fans_medal_wearing_status: danmaku.fans_medal_wearing_status,
        guard_level: danmaku.guard_level,
      } as DanmakuUserInfo,
      createAt: Date.now(),
      isInLocal: true,
      id: songs.value.length == 0 ? 1 : new List(songs.value).Max((s) => s.id) + 1,
    } as SongRequestInfo
    localActiveSongs.value.unshift(songData)
    message.success(`[${danmaku.name}] 添加: ${songData.songName}`)
  }
}
async function addSongManual() {
  if (!newSongName.value) {
    message.error('请输入名称')
    return
  }
  if (accountInfo.value) {
    await QueryPostAPIWithParams<SongRequestInfo>(SONG_REQUEST_API_URL + 'add', {
      name: newSongName.value,
    }).then((data) => {
      if (data.code == 200) {
        message.success(`已手动添加: ${data.data.songName}`)
        originSongs.value.unshift(data.data)
        newSongName.value = ''
        console.log(`[OPEN-LIVE-LIVE-REQUEST] 已手动添加: ${data.data.songName}`)
      } else {
        message.error(`手动添加失败: ${data.message}`)
      }
    })
  } else {
    const songData = {
      songName: newSongName.value,
      song: undefined,
      status: SongRequestStatus.Waiting,
      from: SongRequestFrom.Manual,
      scPrice: undefined,
      user: undefined,
      createAt: Date.now(),
      isInLocal: true,
      id: songs.value.length == 0 ? 1 : new List(songs.value).Max((s) => s.id) + 1,
    } as SongRequestInfo
    localActiveSongs.value.unshift(songData)
    message.success(`已手动添加: ${songData.songName}`)
  }
}
async function updateSongStatus(song: SongRequestInfo, status: SongRequestStatus) {
  if (!configCanEdit.value) {
    song.status = status
    return
  }
  isLoading.value = true
  let statusString = ''
  let statusString2 = ''
  switch (status) {
    case SongRequestStatus.Waiting:
      statusString = 'active'
      statusString2 = '等待中'
      break
    case SongRequestStatus.Cancel:
      statusString = 'cancel'
      statusString2 = '已取消'
      break
    case SongRequestStatus.Finish:
      statusString = 'finish'
      statusString2 = '已完成'
      break
    case SongRequestStatus.Singing:
      statusString = 'singing'
      statusString2 = '处理中'
      break
  }
  await QueryGetAPI(SONG_REQUEST_API_URL + statusString, {
    id: song.id,
  })
    .then((data) => {
      if (data.code == 200) {
        console.log(`[OPEN-LIVE-LIVE-REQUEST] 更新状态: ${song.songName} -> ${statusString}`)
        song.status = status
        if (status > SongRequestStatus.Singing) {
          song.finishAt = Date.now()
        }
        message.success(`已更新状态为: ${statusString2}`)
      } else {
        console.log(`[OPEN-LIVE-LIVE-REQUEST] 更新状态失败: ${data.message}`)
        message.error(`更新状态失败: ${data.message}`)
      }
    })
    .catch((err) => {
      message.error(`更新状态失败`)
    })
    .finally(() => {
      isLoading.value = false
    })
}

function onGetDanmaku(danmaku: EventModel) {
  if (checkMessage(danmaku.msg)) {
    addSong(danmaku)
  }
}
function onGetSC(danmaku: EventModel) {
  if (settings.value.allowSC && checkMessage(danmaku.msg)) {
    addSong(danmaku)
  }
}
function checkMessage(msg: string) {
  if (accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest) != true) {
    return false
  }
  return msg
    .trim()
    .toLowerCase()
    .startsWith(accountInfo.value ? settings.value.orderPrefix.toLowerCase() : defaultPrefix.value)
}
async function onUpdateFunctionEnable() {
  if (accountInfo.value) {
    const oldValue = JSON.parse(JSON.stringify(accountInfo.value.settings.enableFunctions))
    if (accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest)) {
      accountInfo.value.settings.enableFunctions = accountInfo.value.settings.enableFunctions.filter(
        (f) => f != FunctionTypes.SongRequest,
      )
    } else {
      accountInfo.value.settings.enableFunctions.push(FunctionTypes.SongRequest)
    }
    if (!accountInfo.value.settings.songRequest.orderPrefix) {
      accountInfo.value.settings.songRequest.orderPrefix = defaultPrefix.value
    }
    await SaveEnableFunctions(accountInfo.value?.settings.enableFunctions)
      .then((data) => {
        if (data.code == 200) {
          message.success(
            `已${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest) ? '启用' : '禁用'}点播功能`,
          )
        } else {
          if (accountInfo.value) {
            accountInfo.value.settings.enableFunctions = oldValue
          }
          message.error(
            `点播功能${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest) ? '启用' : '禁用'}失败: ${data.message}`,
          )
        }
      })
      .catch((err) => {
        message.error(
          `点播功能${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest) ? '启用' : '禁用'}失败: ${err}`,
        )
      })
  }
}
async function updateSettings() {
  if (accountInfo.value) {
    isLoading.value = true
    await SaveSetting('SongRequest', settings.value)
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
async function deleteSongs(values: SongRequestInfo[]) {
  await QueryPostAPI(
    SONG_REQUEST_API_URL + 'del',
    values.map((s) => s.id),
  )
    .then((data) => {
      if (data.code == 200) {
        message.success('删除成功')
        originSongs.value = originSongs.value.filter((s) => !values.includes(s))
      } else {
        message.error('删除失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('删除失败')
    })
}
async function deactiveAllSongs() {
  await QueryGetAPI(SONG_REQUEST_API_URL + 'deactive')
    .then((data) => {
      if (data.code == 200) {
        message.success('已全部取消')
        songs.value.forEach((s) => {
          if (s.status <= SongRequestStatus.Singing) {
            s.status = SongRequestStatus.Cancel
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
  return Object.values(SongRequestStatus)
    .filter((t) => /^\d+$/.test(t.toString()))
    .map((t) => {
      return {
        label: STATUS_MAP[t as SongRequestStatus],
        value: t,
      }
    })
})
const columns = [
  {
    title: '曲名',
    key: 'songName',
  },
  {
    title: '用户名',
    key: 'user.name',
    render: (data) => {
      return h(
        NTooltip,
        { trigger: 'hover' },
        {
          trigger: () =>
            h(
              NTag,
              { bordered: false, size: 'small' },
              data.from == SongRequestFrom.Manual
                ? () => h(NText, { italic: true }, () => '手动添加')
                : () => data.user?.name,
            ),
          default: () => (data.from == SongRequestFrom.Manual ? '就是主播自己' : data.user?.uid),
        },
      )
    },
  },
  {
    title: '来自',
    key: 'from',
    render(data) {
      let fromType: 'info' | 'success' | 'default' | 'error' = 'info'
      switch (data.from) {
        case SongRequestFrom.Danmaku: {
          fromType = 'info'
          break
        }
        case SongRequestFrom.SC: {
          fromType = 'error'
          break
        }
        case SongRequestFrom.Web: {
          fromType = 'success'
          break
        }
        case SongRequestFrom.Manual: {
          fromType = 'default'
          break
        }
      }
      return h(NTag, { size: 'small', type: fromType }, () => {
        switch (data.from) {
          case SongRequestFrom.Danmaku: {
            return '弹幕'
          }
          case SongRequestFrom.SC: {
            return 'SuperChat | ' + data.price
          }
          case SongRequestFrom.Gift: {
            return '礼物 | ' + data.price
          }
          case SongRequestFrom.Manual: {
            return '手动添加'
          }
          case SongRequestFrom.Web: {
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
        case SongRequestStatus.Singing: {
          statusType = 'success'
          break
        }
        case SongRequestStatus.Waiting: {
          statusType = 'warning'
          break
        }
        case SongRequestStatus.Finish: {
          statusType = 'info'
          break
        }
        case SongRequestStatus.Cancel: {
          statusType = 'error'
          break
        }
      }
      return h(
        NTag,
        {
          type: statusType,
          size: 'small',
          style: data.status == SongRequestStatus.Singing ? 'animation: animated-border 2.5s infinite;' : '',
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
          data.status == SongRequestStatus.Finish || data.status == SongRequestStatus.Cancel
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
                      updateSongStatus(data, SongRequestStatus.Waiting)
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
            { onPositiveClick: () => deleteSongs([data]) },
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
] as DataTableColumns<SongRequestInfo>

function GetSCColor(price: number): string {
  if (price === 0) return `#2a60b2`
  if (price > 0 && price < 30) return `#2a60b2`
  if (price >= 30 && price < 50) return `#2a60b2`
  if (price >= 50 && price < 100) return `#427d9e`
  if (price >= 100 && price < 500) return `#c99801`
  if (price >= 500 && price < 1000) return `#e09443`
  if (price >= 1000 && price < 2000) return `#e54d4d`
  if (price >= 2000) return `#ab1a32`
  return ''
}
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
    const data = await QueryGetAPI<SongRequestInfo[]>(SONG_REQUEST_API_URL + 'get-active', {
      id: accountInfo.value?.id,
    })
    if (data.code == 200) {
      data.data.forEach((item) => {
        const song = originSongs.value.find((s) => s.id == item.id)
        if (song) {
          if (song.status != item.status) song.status = item.status
        } else {
          originSongs.value.unshift(item)
          if (item.from == SongRequestFrom.Web) {
            message.success(`[${item.user?.name}] 直接从网页歌单点播: ${item.songName}`)
          }
        }
      })
    } else {
      message.error('无法获取点播队列: ' + data.message)
      return []
    }
  } catch (err) { }
}
function blockUser(item: SongRequestInfo) {
  if (item.from != SongRequestFrom.Danmaku) {
    message.error(`[${item.user?.name}] 不是来自弹幕的用户`)
    return
  }
  if (item.user) {
    AddBiliBlackList(item.user.uid, item.user.name)
      .then((data) => {
        if (data.code == 200) {
          message.success(`[${item.user?.name}] 已添加到黑名单`)
          updateSongStatus(item, SongRequestStatus.Cancel)
        } else {
          message.error(data.message)
        }
      })
      .catch((err) => {
        message.error(err)
      })
  }
}
const isLrcLoading = ref('')

let timer: any
let updateActiveTimer: any
const updateKey = ref(0)
onMounted(() => {
  if (accountInfo.value) {
    settings.value = accountInfo.value.settings.songRequest
  }
  client.onEvent('danmaku', onGetDanmaku)
  client.onEvent('sc', onGetSC)
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
  client.offEvent('sc', onGetSC)
  dispose()
})
</script>

<template>
  <NAlert
    v-if="accountInfo.id"
    :type="accountInfo.settings.enableFunctions.includes(FunctionTypes.SongRequest) ? 'success' : 'warning'"
  >
    启用弹幕点播功能
    <NSwitch
      :value="accountInfo?.settings.enableFunctions.includes(FunctionTypes.SongRequest)"
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
      则其需要保持此页面开启才能点播, 也不要同时开多个页面, 会导致点播重复 !(部署了则不影响)
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
      v-if="!accountInfo || accountInfo.settings.enableFunctions.includes(FunctionTypes.SongRequest)"
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
              队列 | {{ activeSongs.filter((s) => s.status == SongRequestStatus.Waiting).length }}
            </NTag>
            <NTag
              type="success"
              :bordered="false"
            >
              <template #icon>
                <NIcon :component="Checkmark12Regular" />
              </template>
              今日已处理 |
              {{
                songs.filter((s) => s.status != SongRequestStatus.Cancel && isSameDay(s.finishAt ?? 0, Date.now()))
                  .length
              }}
              个
            </NTag>
            <NInputGroup>
              <NInput
                v-model:value="newSongName"
                placeholder="手动添加"
              />
              <NButton
                type="primary"
                @click="addSongManual"
              >
                添加
              </NButton>
            </NInputGroup>
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
            <NPopconfirm @positive-click="deactiveAllSongs">
              <template #trigger>
                <NButton type="error">
                  全部取消
                </NButton>
              </template>
              确定全部取消吗?
            </NPopconfirm>
          </NSpace>
        </NCard>
        <NDivider> 共 {{ activeSongs.length }} 首 </NDivider>
        <Transition>
          <div
            v-if="selectedSong"
            class="song-list"
          >
            <SongPlayer
              v-model:is-lrc-loading="isLrcLoading"
              :song="selectedSong"
            />
            <NDivider style="margin: 15px 0 15px 0" />
          </div>
        </Transition>
        <NList
          v-if="activeSongs.length > 0"
          :show-divider="false"
          hoverable
        >
          <NListItem
            v-for="song in activeSongs"
            :key="song.id"
            style="padding: 5px"
          >
            <NCard
              embedded
              size="small"
              content-style="padding: 5px;"
              :style="`${song.status == SongRequestStatus.Singing ? 'animation: animated-border 2.5s infinite;' : ''};height: 100%;`"
            >
              <NSpace
                justify="space-between"
                align="center"
                style="height: 100%; margin: 0 5px 0 5px"
              >
                <NSpace align="center">
                  <div
                    :style="`border-radius: 4px; background-color: ${song.status == SongRequestStatus.Singing ? '#75c37f' : '#577fb8'}; width: 10px; height: 20px`"
                  />
                  <NText
                    strong
                    style="font-size: 18px"
                  >
                    {{ song.songName }}
                  </NText>
                  <template v-if="song.from == SongRequestFrom.Manual">
                    <NTag
                      size="small"
                      :bordered="false"
                    >
                      手动添加
                    </NTag>
                  </template>
                  <template v-else>
                    <NTooltip>
                      <template #trigger>
                        <NTag
                          size="small"
                          :bordered="false"
                          type="info"
                        >
                          <NText
                            italic
                            depth="3"
                          >
                            {{ song.user?.name }}
                          </NText>
                        </NTag>
                      </template>
                      {{ song.user?.uid }}
                    </NTooltip>
                  </template>
                  <NSpace
                    v-if="
                      (song.from == SongRequestFrom.Danmaku || song.from == SongRequestFrom.SC) &&
                        song.user?.fans_medal_wearing_status
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
                          {{ song.user?.fans_medal_level }}
                        </NText>
                      </NTag>
                      <span style="color: #577fb8">
                        {{ song.user?.fans_medal_name }}
                      </span>
                    </NTag>
                  </NSpace>
                  <NTag
                    v-if="(song.user?.guard_level ?? 0) > 0"
                    size="small"
                    :bordered="false"
                    :color="{ textColor: 'white', color: GetGuardColor(song.user?.guard_level) }"
                  >
                    {{ song.user?.guard_level == 1 ? '总督' : song.user?.guard_level == 2 ? '提督' : '舰长' }}
                  </NTag>
                  <NTag
                    v-if="song.from == SongRequestFrom.SC"
                    size="small"
                    :color="{ textColor: 'white', color: GetSCColor(song.price ?? 0) }"
                  >
                    SC | {{ song.price }}
                  </NTag>
                  <NTag
                    v-if="song.from == SongRequestFrom.Gift"
                    size="small"
                    :color="{ textColor: 'white', color: GetSCColor(song.price ?? 0) }"
                  >
                    Gift | {{ song.price }}
                  </NTag>
                  <NTooltip>
                    <template #trigger>
                      <NText style="font-size: small">
                        <NTime
                          :key="updateKey"
                          :time="song.createAt"
                          type="relative"
                        />
                      </NText>
                    </template>
                    <NTime :time="song.createAt" />
                  </NTooltip>
                </NSpace>
                <NSpace
                  justify="end"
                  align="center"
                >
                  <NTooltip v-if="song.song?.url">
                    <template #trigger>
                      <NButton
                        circle
                        type="success"
                        style="height: 30px; width: 30px"
                        :loading="isLrcLoading == song?.song?.key"
                        @click="selectedSong = song.song"
                      >
                        <template #icon>
                          <NIcon :component="Play24Filled" />
                        </template>
                      </NButton>
                    </template>
                    试听
                  </NTooltip>
                  <NTooltip>
                    <template #trigger>
                      <NButton
                        circle
                        type="primary"
                        style="height: 30px; width: 30px"
                        :disabled="songs.findIndex((s) => s.id != song.id && s.status == SongRequestStatus.Singing) > -1
                        "
                        :style="`animation: ${song.status == SongRequestStatus.Waiting ? '' : 'loading 5s linear infinite'}`"
                        :secondary="song.status == SongRequestStatus.Singing"
                        :loading="isLoading"
                        @click="
                          updateSongStatus(
                            song,
                            song.status == SongRequestStatus.Singing
                              ? SongRequestStatus.Waiting
                              : SongRequestStatus.Singing,
                          )
                        "
                      >
                        <template #icon>
                          <NIcon :component="Mic24Filled" />
                        </template>
                      </NButton>
                    </template>
                    {{
                      songs.findIndex((s) => s.id != song.id && s.status == SongRequestStatus.Singing) > -1
                        ? '还有其他正在演唱的歌曲'
                        : song.status == SongRequestStatus.Waiting && song.id
                          ? '开始演唱'
                          : '停止演唱'
                    }}
                  </NTooltip>
                  <NTooltip>
                    <template #trigger>
                      <NButton
                        circle
                        type="success"
                        style="height: 30px; width: 30px"
                        :loading="isLoading"
                        @click="updateSongStatus(song, SongRequestStatus.Finish)"
                      >
                        <template #icon>
                          <NIcon :component="Checkmark12Regular" />
                        </template>
                      </NButton>
                    </template>
                    已完成演唱
                  </NTooltip>
                  <NTooltip v-if="song.from == SongRequestFrom.Danmaku">
                    <template #trigger>
                      <NPopconfirm @positive-click="blockUser(song)">
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
                        确定拉黑 {{ song.user?.name }} 吗
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
                        @click="updateSongStatus(song, SongRequestStatus.Cancel)"
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
          description="暂无曲目"
        />
      </NTabPane>
      <NTabPane
        name="history"
        tab="历史"
      >
        <NCard size="small">
          <NSpace>
            <NInputGroup style="width: 300px">
              <NInputGroupLabel> 筛选曲名 </NInputGroupLabel>
              <NInput
                v-model:value="filterSongName"
                clearable
              >
                <template #suffix>
                  <NCheckbox v-model:checked="filterSongNameContains">
                    包含
                  </NCheckbox>
                </template>
              </NInput>
            </NInputGroup>
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
          :data="songs"
          :pagination="{
            itemCount: songs.length,
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
              <NInputGroup style="width: 250px">
                <NInputGroupLabel> 点播弹幕前缀 </NInputGroupLabel>
                <template v-if="configCanEdit">
                  <NInput v-model:value="settings.orderPrefix" />
                  <NButton
                    type="primary"
                    @click="updateSettings"
                  >
                    确定
                  </NButton>
                </template>
                <NInput
                  v-else
                  v-model:value="defaultPrefix"
                />
              </NInputGroup>
              <NAlert
                v-if="settings.orderPrefix.includes(' ')"
                type="info"
              >
                前缀包含空格
              </NAlert>
            </NSpace>
            <NInputGroup style="width: 250px">
              <NInputGroupLabel> 最大队列长度 </NInputGroupLabel>
              <NInputNumber
                v-model:value="settings.queueMaxSize"
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
                允许所有弹幕点播
              </NCheckbox>
              <template v-if="!settings.allowAllDanmaku">
                <NCheckbox
                  v-model:checked="settings.needWearFanMedal"
                  :disabled="!configCanEdit"
                  @update:checked="updateSettings"
                >
                  需要拥有粉丝牌
                </NCheckbox>
                <NInputGroup
                  v-if="settings.needWearFanMedal"
                  style="width: 250px"
                >
                  <NInputGroupLabel> 最低粉丝牌等级 </NInputGroupLabel>
                  <NInputNumber
                    v-model:value="settings.fanMedalMinLevel"
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
                <NCheckbox
                  v-if="!settings.allowAllDanmaku"
                  v-model:checked="settings.needJianzhang"
                  :disabled="!configCanEdit"
                  @update:checked="updateSettings"
                >
                  只允许舰长
                </NCheckbox>
                <NCheckbox
                  v-if="!settings.allowAllDanmaku"
                  v-model:checked="settings.needTidu"
                  :disabled="!configCanEdit"
                  @update:checked="updateSettings"
                >
                  只允许提督
                </NCheckbox>
                <NCheckbox
                  v-if="!settings.allowAllDanmaku"
                  v-model:checked="settings.needZongdu"
                  :disabled="!configCanEdit"
                  @update:checked="updateSettings"
                >
                  只允许总督
                </NCheckbox>
              </template>
            </NSpace>
            <NSpace align="center">
              <NCheckbox
                v-model:checked="settings.allowSC"
                :disabled="!configCanEdit"
                @update:checked="updateSettings"
              >
                允许通过 SuperChat 点播
              </NCheckbox>
              <span v-if="settings.allowSC">
                <NCheckbox
                  v-model:checked="settings.allowSC"
                  :disabled="!configCanEdit"
                  @update:checked="updateSettings"
                >
                  SC 点播无视限制
                </NCheckbox>
                <NTooltip>
                  <template #trigger>
                    <NIcon :component="Info24Filled" />
                  </template>
                  包含冷却时间, 队列长度, 重复点播等
                </NTooltip>
              </span>
              <NInputGroup
                v-if="settings.allowSC"
                style="width: 250px"
              >
                <NInputGroupLabel> 最低SC价格 </NInputGroupLabel>
                <NInputNumber
                  v-model:value="settings.scMinPrice"
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

            <!-- <NCheckbox v-model:checked="settings.allowGift" @update:checked="updateSettings" :disabled="!configCanEdit">
              允许通过发送礼物加入队列
            </NCheckbox>
            <NSpace>
              <template v-if="settings.allowGift">
                <NAlert type="warning"> 赠送礼物后需要再次发送点播弹幕才能够加入 </NAlert>
                <NInputGroup v-if="settings.allowGift" style="width: 250px">
                  <NInputGroupLabel> 最低价格 </NInputGroupLabel>
                  <NInputNumber v-model:value="settings.minGiftPrice" :disabled="!configCanEdit" />
                  <NButton @click="updateSettings" type="info" :disabled="!configCanEdit">确定</NButton>
                </NInputGroup>
                <NSpace align="center">
                  礼物名
                  <NSelect
                    style="width: 250px"
                    v-model:value="settings.giftNames"
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
                  v-model:checked="settings.sendGiftIgnoreLimit"
                  @update:checked="updateSettings"
                  :disabled="!configCanEdit"
                >
                  赠送礼物后无视用户等级限制
                </NCheckbox>
              </template>
              <NCheckbox
                v-model:checked="settings.allowIncreasePaymentBySendGift"
                @update:checked="updateSettings"
                :disabled="!configCanEdit"
              >
                在队列中时允许继续发送礼物累计付费量 (仅限上方设定的礼物)
              </NCheckbox>
              <NCheckbox
                v-if="settings.allowIncreasePaymentBySendGift"
                v-model:checked="settings.allowIncreaseByAnyPayment"
                @update:checked="updateSettings"
                :disabled="!configCanEdit"
              >
                允许发送任意礼物来叠加付费量
              </NCheckbox>
            </NSpace> -->
            <NDivider> 点歌 </NDivider>
            <NSpace>
              <NCheckbox
                v-model:checked="settings.onlyAllowSongList"
                :disabled="!configCanEdit"
                @update:checked="updateSettings"
              >
                仅允许点
                <NButton
                  text
                  tag="a"
                  href="/manage/song-list"
                  target="_blank"
                  type="info"
                >
                  歌单
                </NButton>
                内的歌曲
              </NCheckbox>
              <NCheckbox
                v-model:checked="settings.allowFromWeb"
                :disabled="!configCanEdit"
                @update:checked="updateSettings"
              >
                允许通过网页点歌
              </NCheckbox>
              <NCheckbox
                v-if="settings.allowFromWeb"
                v-model:checked="settings.allowAnonymousFromWeb"
                :disabled="!configCanEdit"
                @update:checked="updateSettings"
              >
                允许匿名通过网页点歌
              </NCheckbox>
            </NSpace>
            <NDivider> 冷却 (单位: 秒) </NDivider>
            <NCheckbox
              v-model:checked="settings.enableCooldown"
              :disabled="!configCanEdit"
              @update:checked="updateSettings"
            >
              启用点播冷却
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
            <NSpace align="center">
              <NInputGroup style="width: 220px">
                <NInputGroupLabel> 标题 </NInputGroupLabel>
                <template v-if="configCanEdit">
                  <NInput
                    v-model:value="settings.obsTitle"
                    placeholder="默认为 点播"
                  />
                  <NButton
                    type="primary"
                    @click="updateSettings"
                  >
                    确定
                  </NButton>
                </template>
              </NInputGroup>
              <NCheckbox
                v-model:checked="settings.showRequireInfo"
                :disabled="!configCanEdit"
                @update:checked="updateSettings"
              >
                显示底部的需求信息
              </NCheckbox>
              <NCheckbox
                v-model:checked="settings.showUserName"
                :disabled="!configCanEdit"
                @update:checked="updateSettings"
              >
                显示点播用户名
              </NCheckbox>
              <NCheckbox
                v-model:checked="settings.showFanMadelInfo"
                :disabled="!configCanEdit"
                @update:checked="updateSettings"
              >
                显示点播用户粉丝牌
              </NCheckbox>
            </NSpace>
            <NDivider> 其他 </NDivider>
            <NCheckbox v-model:checked="isWarnMessageAutoClose">
              自动关闭点播失败时的提示消息
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
        请先启用弹幕点播功能
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
      <LiveRequestOBS :id="accountInfo?.id" />
    </div>
    <br>
    <NInput :value="`${CURRENT_HOST}obs/live-request?id=` + accountInfo?.id" />
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
