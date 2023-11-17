<script setup lang="ts">
import { SaveAccountSettings, useAccount } from '@/api/account'
import { EventDataTypes, EventModel, FunctionTypes, OpenLiveInfo, Setting_SongRequest, SongRequestFrom, SongRequestInfo, SongRequestStatus, SongRequestUserInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI, QueryPostAPIWithParams } from '@/api/query'
import DanmakuClient, { AuthInfo, DanmakuInfo, RoomAuthInfo, SCInfo } from '@/data/DanmakuClient'
import { OPEN_LIVE_API_URL, SONG_REQUEST_API_URL } from '@/data/constants'
import { Mic24Filled, PeopleQueue24Filled } from '@vicons/fluent'
import { useStorage } from '@vueuse/core'
import { number } from 'echarts'
import { NAlert, NButton, NCard, NDivider, NIcon, NInput, NInputGroup, NList, NListItem, NSpace, NSwitch, NTabPane, NTabs, NTag, NText, NTooltip, useMessage } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const defaultSettings = {
  orderPrefix: '点歌',
  onlyAllowSongList: false,
  queueMaxSize: 10,
  allowAllDanmaku: false,
  allowFromWeb: true,
  needWearFanMedal: false,
  needJianzhang: false,
  needTidu: false,
  needZongdu: false,
  allowSC: true,
  sCIgnoreLimit: true,
  sCMinPrice: 30,
  fanMedalMinLevel: 0,
  allowReorderSong: false,
  cooldownSecond: 1200,
  zongduCooldownSecond: 300,
  tiduCooldownSecond: 600,
  jianzhangCooldownSecond: 900,
} as Setting_SongRequest

const route = useRoute()
const accountInfo = useAccount()
const message = useMessage()

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

const props = defineProps<{
  client: DanmakuClient
  roomInfo: RoomAuthInfo
  code: string | undefined
  isOpenLive?: boolean
}>()

const localActiveSongs = useStorage('SongRequest.ActiveSongs', [] as SongRequestInfo[])
const activeSongs = ref<SongRequestInfo[]>(await getActiveSong())

const newSongName = ref('')

const defaultPrefix = useStorage('Settings.SongRequest.DefaultPrefix', '点歌')

async function getActiveSong() {
  if (accountInfo.value) {
    try {
      const data = await QueryGetAPI<SongRequestInfo[]>(SONG_REQUEST_API_URL + 'get-active', {
        id: accountInfo.value.id,
      })
      if (data.code == 200) {
        console.log('[OPEN-LIVE-Song-Request] 已获取点歌队列')
        return data.data
      } else {
        message.error('无法获取点歌队列: ' + data.message)
        return []
      }
    } catch (err) {
      console.error(err)
    }
    return []
  } else {
    return localActiveSongs.value
  }
}
async function addSong(danmaku: EventModel) {
  console.log(`[OPEN-LIVE-Song-Request] 收到 [${danmaku.name}] 的点歌${danmaku.type == EventDataTypes.SC ? 'SC' : '弹幕'}: ${danmaku.msg}`)
  if (accountInfo.value) {
    await QueryPostAPI<SongRequestInfo>(SONG_REQUEST_API_URL + 'try-add', danmaku)
      .then((data) => {
        if (data.code == 200) {
          message.success(`[${danmaku.name}] 添加曲目: ${data.data.songName}`)
        } else {
          message.error(`[${danmaku.name}] 添加曲目失败: ${data.message}`)
          console.log(`[OPEN-LIVE-Song-Request] [${danmaku.name}] 添加曲目失败: ${data.message}`)
        }
      })
      .catch((err) => {
        console.error(err)
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
        fans_medal_level: danmaku.fans_medal_level,
        fans_medal_name: danmaku.fans_medal_name,
        fans_medal_wearing_status: danmaku.fans_medal_wearing_status,
        guard_level: danmaku.guard_level,
      } as SongRequestUserInfo,
      createAt: Date.now(),
    } as SongRequestInfo
    localActiveSongs.value.push(songData)
    message.success(`[${danmaku.name}] 添加曲目: ${songData.songName}`)
  }
}
async function addSongManual() {
  if (!newSongName.value) {
    message.error('请输入曲目名')
    return
  }
  if (accountInfo.value) {
    await QueryPostAPIWithParams<SongRequestInfo>(SONG_REQUEST_API_URL + 'add', {
      name: newSongName.value,
    })
      .then((data) => {
        if (data.code == 200) {
          message.success(`已手动添加曲目: ${data.data.songName}`)
        } else {
          message.error(`手动添加曲目失败: ${data.message}`)
        }
      })
      .catch((err) => {
        console.error(err)
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
    } as SongRequestInfo
    localActiveSongs.value.push(songData)
    message.success(`已手动添加曲目: ${songData.songName}`)
  }
}

function onGetDanmaku(danmaku: DanmakuInfo) {
  if (checkMessage(danmaku.msg)) {
    addSong({
      msg: danmaku.msg,
      type: EventDataTypes.Message,
      time: danmaku.timestamp,
      uid: danmaku.uid,
      name: danmaku.uname,
      avatar: danmaku.uface,
      fans_medal_level: danmaku.fans_medal_level,
      fans_medal_name: danmaku.fans_medal_name,
      fans_medal_wearing_status: danmaku.fans_medal_wearing_status,
      guard_level: danmaku.guard_level,
      num: 1,
      price: 0,
    } as EventModel)
  }
}
function onGetSC(danmaku: SCInfo) {
  if (settings.value.allowSC && checkMessage(danmaku.message)) {
    addSong({
      msg: danmaku.message,
      type: EventDataTypes.SC,
      time: danmaku.timestamp,
      uid: danmaku.uid,
      name: danmaku.uname,
      fans_medal_level: danmaku.fans_medal_level,
      fans_medal_name: danmaku.fans_medal_name,
      fans_medal_wearing_status: danmaku.fans_medal_wearing_status,
      guard_level: danmaku.guard_level,
      avatar: danmaku.uface,
      num: 1,
      price: danmaku.rmb,
    } as EventModel)
  }
}
function checkMessage(msg: string) {
  return msg
    .trim()
    .toLowerCase()
    .startsWith(accountInfo.value ? settings.value.orderPrefix : defaultPrefix.value)
}
async function onUpdateFunctionEnable() {
  if (accountInfo.value) {
    const oldValue = JSON.parse(JSON.stringify(accountInfo.value.settings.enableFunctions))
    if (accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest)) {
      accountInfo.value.settings.enableFunctions = accountInfo.value.settings.enableFunctions.filter((f) => f != FunctionTypes.SongRequest)
    } else {
      accountInfo.value.settings.enableFunctions.push(FunctionTypes.SongRequest)
    }
    accountInfo.value.settings.enableFunctions.push
    await SaveAccountSettings()
      .then((data) => {
        if (data.code == 200) {
          message.success(`已${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest) ? '启用' : '禁用'}点歌功能`)
        } else {
          if (accountInfo.value) {
            accountInfo.value.settings.enableFunctions = oldValue
          }
          message.error(`点歌功能${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest) ? '启用' : '禁用'}失败: ${data.message}`)
        }
      })
      .catch((err) => {
        console.error(err)
        message.error(`点歌功能${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest) ? '启用' : '禁用'}失败: ${err}`)
      })
  }
}

let timer: any
onMounted(() => {
  if (accountInfo.value) {
    settings.value = accountInfo.value.settings.songRequest
  }
  props.client.on('danmaku', onGetDanmaku)
  props.client.on('sc', onGetSC)
  timer = setInterval(() => {})
})
onUnmounted(() => {
  props.client.off('danmaku', onGetDanmaku)
  props.client.off('sc', onGetSC)
  clearInterval(timer)
})
</script>

<template>
  开发中...
</template>
