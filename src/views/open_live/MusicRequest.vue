<script setup lang="ts">
import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import { DanmakuUserInfo, EventModel, FunctionTypes, SongFrom, SongsInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import DanmakuClient, { RoomAuthInfo } from '@/data/DanmakuClient'
import { MUSIC_REQUEST_API_URL, SONG_API_URL } from '@/data/constants'
import { useStorage } from '@vueuse/core'
import { List } from 'linqts'
import {
  NAlert,
  NButton,
  NCheckbox,
  NCollapse,
  NCollapseItem,
  NDivider,
  NEmpty,
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
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTransfer,
  NUl,
  NVirtualList,
  SelectOption,
  useMessage,
} from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import APlayer from 'vue3-aplayer'
import { clearInterval, setInterval } from 'worker-timers'
import MusicRequestOBS from '../obs/MusicRequestOBS.vue'

type MusicRequestSettings = {
  playMusicWhenFree: boolean

  repeat: 'repeat-one' | 'repeat-all' | 'no-repeat'
  listMaxHeight: string
  shuffle: boolean
  volume: number

  orderPrefix: string
  orderCooldown?: number
  orderMusicFirst: boolean
  platform: 'netease' | 'kugou'
  deviceId?: string

  blacklist: string[]
}
type Music = {
  id: number
  title: string
  artist: string
  src: string
  pic: string
  lrc: string
}
type WaitMusicInfo = {
  from: DanmakuUserInfo
  music: SongsInfo
}

const settings = useStorage<MusicRequestSettings>('Setting.MusicRequest', {
  playMusicWhenFree: true,
  repeat: 'repeat-all',
  listMaxHeight: '300',
  shuffle: true,
  volume: 0.5,

  orderPrefix: '点歌',
  orderCooldown: 600,
  orderMusicFirst: true,
  platform: 'netease',

  blacklist: [],
})
const cooldown = useStorage<{ [id: number]: number }>('Setting.MusicRequest.Cooldown', {})

const props = defineProps<{
  client: DanmakuClient
  roomInfo: RoomAuthInfo
  code: string | undefined
  isOpenLive?: boolean
}>()

const deviceList = ref<SelectOption[]>([])

const accountInfo = useAccount()
const message = useMessage()

const aplayer = ref()

const listening = ref(false)

const originMusics = ref<SongsInfo[]>(await get())
const waitingMusics = useStorage<WaitMusicInfo[]>('Setting.MusicRequest.Waiting', [])
const musics = computed(() => {
  return originMusics.value.map((s) => songToMusic(s))
})
const currentMusic = ref<Music>({
  id: -1,
  title: '',
  artist: '',
  src: '',
  pic: '',
  lrc: '',
} as Music)
const currentOriginMusic = ref<WaitMusicInfo>()
watch(currentOriginMusic, (music) => {
  if (music) {
    currentMusic.value = songToMusic(music.music)
  }
})

const isLoading = ref(false)

const showNeteaseModal = ref(false)
const showOBSModal = ref(false)
const neteaseIdInput = ref('')
const neteaseSongListId = computed(() => {
  try {
    const url = new URL(neteaseIdInput.value)
    console.log(url)
    if (url.host == 'music.163.com') {
      const regex = /id=(\d+)/

      // 使用exec方法在链接中查找匹配项
      const match = regex.exec(neteaseIdInput.value)

      // 如果找到了匹配项，那么match[1]就是分组1的值，也就是id的值
      if (match) {
        return Number(match[1])
      }
    }
  } catch (err) {}
  try {
    return Number(neteaseIdInput.value)
  } catch {}
  return null
})
const neteaseSongs = ref<SongsInfo[]>([])
const neteaseSongsOptions = computed(() => {
  return neteaseSongs.value.map((s) => ({
    label: `${s.name} - ${s.author.join('/')}`,
    value: s.key,
    disabled: originMusics.value.findIndex((exist) => exist.id == s.id) > -1,
  }))
})
const selectedNeteaseSongs = ref<string[]>([])

async function get() {
  try {
    const data = await QueryGetAPI<SongsInfo[]>(MUSIC_REQUEST_API_URL + 'get')
    if (data.code == 200) {
      console.log('[OPEN-LIVE-Music-Request] 已获取所有数据')
      return new List(data.data).OrderByDescending((s) => s.createTime).ToArray()
    } else {
      message.error('无法获取数据: ' + data.message)
      return []
    }
  } catch (err) {
    message.error('无法获取数据')
  }
  return []
}
async function searchMusic(keyword: string) {
  const data = await QueryGetAPI<SongsInfo>(MUSIC_REQUEST_API_URL + 'search-' + settings.value.platform, {
    keyword: keyword,
  })
  if (data.code == 200) {
    return data.data
  }
  return undefined
}
function switchTo() {}
async function getNeteaseSongList() {
  isLoading.value = true
  await QueryGetAPI<SongsInfo[]>(SONG_API_URL + 'get-netease-list', {
    id: neteaseSongListId.value,
  })
    .then((data) => {
      if (data.code == 200) {
        neteaseSongs.value = data.data
        message.success(`成功获取歌曲信息, 共 ${data.data.length} 条, 歌单中已存在 ${neteaseSongsOptions.value.filter((s) => s.disabled).length} 首`)
      } else {
        message.error('获取歌单失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('获取歌单失败: ' + err)
    })
    .finally(() => {
      isLoading.value = false
    })
}
async function addNeteaseSongs() {
  isLoading.value = true
  const selected = neteaseSongs.value.filter((s) => selectedNeteaseSongs.value.find((select) => s.key == select))
  await addSongs(selected, SongFrom.Netease)
    .then((data) => {
      if (data.code == 200) {
        message.success(`已添加 ${data.data.length} 首歌曲`)
        originMusics.value.push(...data.data)
      } else {
        message.error('添加失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('添加失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}
async function addSongs(songsShoudAdd: SongsInfo[], from: SongFrom) {
  return QueryPostAPI<SongsInfo[]>(
    MUSIC_REQUEST_API_URL + 'add',
    songsShoudAdd.map((s) => ({
      Name: s.name,
      Id: from == SongFrom.Custom ? -1 : s.id,
      From: from,
      Author: s.author,
      Url: s.url,
      Description: s.description,
      Cover: s.cover,
    })),
  )
}
function delMusic(song: SongsInfo) {
  QueryPostAPI(MUSIC_REQUEST_API_URL + 'del', [song.key])
    .then((data) => {
      if (data.code == 200) {
        message.success('已删除')
        originMusics.value = originMusics.value.filter((s) => s.key != song.key)
      } else {
        message.error('删除失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('删除失败' + err)
    })
}
function clearMusic() {
  QueryGetAPI(MUSIC_REQUEST_API_URL + 'clear')
    .then((data) => {
      if (data.code == 200) {
        message.success('已清空')
        originMusics.value = []
      } else {
        message.error('清空失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('清空失败' + err)
    })
}
async function uploadConfig() {
  await UploadConfig('MusicRequest', settings.value)
    .then((data) => {
      if (data) {
        message.success('已保存至服务器')
      } else {
        message.error('保存失败')
      }
    })
    .catch((err) => {
      message.error('保存失败')
    })
}
async function downloadConfig() {
  await DownloadConfig<MusicRequestSettings>('MusicRequest')
    .then((data) => {
      if (data.msg) {
        message.error('获取失败: ' + data.msg)
      } else {
        settings.value = data.data
        message.success('已获取配置文件')
      }
    })
    .catch((err) => {
      message.error('获取失败')
    })
}
function startListen() {
  if (accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest)) {
    message.warning('使用这个点歌则需要先关闭歌势点歌 (SongRequest)')
    return
  }
  listening.value = true
  message.success('开始监听')
}
function stopListen() {
  listening.value = false
  message.success('已停止监听')
}
const isPlayingOrderMusic = ref(false)
async function onGetEvent(data: EventModel) {
  if (!listening.value || !checkMessage(data.msg)) return
  if (settings.value.orderCooldown && cooldown.value[data.uid]) {
    const lastRequest = cooldown.value[data.uid]
    if (Date.now() - lastRequest < settings.value.orderCooldown * 1000) {
      message.info(`[${data.name}] 冷却中，距离下次点歌还有 ${((settings.value.orderCooldown * 1000 - (Date.now() - lastRequest)) / 1000).toFixed(1)} 秒`)
      return
    }
  }
  const name = data.msg.replace(new RegExp(settings.value.orderPrefix.trimStart()), '').trim()
  const result = await searchMusic(name)
  if (result) {
    if (settings.value.blacklist.includes(result.name)) {
      message.warning(`[${data.name}] 点歌失败，因为 ${result.name} 在黑名单中`)
      return
    }
    cooldown.value[data.uid] = Date.now()
    const music = {
      from: {
        name: data.name,
        uid: data.uid,
        guard_level: data.guard_level,
        fans_medal_level: data.fans_medal_level,
        fans_medal_name: data.fans_medal_name,
        fans_medal_wearing_status: data.fans_medal_wearing_status,
      },
      music: result,
    } as WaitMusicInfo
    if ((settings.value.orderMusicFirst && !isPlayingOrderMusic.value) || originMusics.value.length == 0 || aplayer.value?.audio.paused) {
      playWaitingMusic(music)
      console.log(`正在播放 [${data.name}] 点的 ${result.name} - ${result.author?.join('/')}`)
    } else {
      waitingMusics.value.push(music)
      message.success(`[${data.name}] 点了一首 ${result.name} - ${result.author?.join('/')}`)
    }
  }
}
function checkMessage(msg: string) {
  return msg.trim().toLowerCase().startsWith(settings.value.orderPrefix.trimStart())
}
function onMusicEnd() {
  const data = waitingMusics.value.shift()
  if (data) {
    setTimeout(() => {
      playWaitingMusic(data)
      message.success(`正在播放 [${data.from.name}] 点的 ${data.music.name}`)
      console.log(`正在播放 [${data.from.name}] 点的 ${data.music.name}`)
    }, 10) //逆天
  } else {
    isPlayingOrderMusic.value = false
    currentOriginMusic.value = undefined
    setTimeout(() => {
      if (!settings.value.playMusicWhenFree) {
        message.info('根据配置，已暂停播放音乐')
        pauseMusic()
      }
    }, 10)
  }
}
function playWaitingMusic(music: WaitMusicInfo) {
  isPlayingOrderMusic.value = true
  const index = waitingMusics.value.indexOf(music)
  if (index > -1) {
    waitingMusics.value.splice(index, 1)
  }
  pauseMusic()
  currentOriginMusic.value = music
  nextTick(() => {
    aplayer.value?.play()
  })
}
function pauseMusic() {
  if (!aplayer.value?.audio.paused) {
    aplayer.value?.pause()
  }
}
function setSinkId() {
  try {
    aplayer.value?.audio.setSinkId(settings.value.deviceId ?? 'default')
    console.log('设置音频输出设备为 ' + (settings.value.deviceId ?? '默认'))
  } catch (err) {
    console.error(err)
    message.error('设置音频输出设备失败: ' + err)
  }
}
function songToMusic(s: SongsInfo) {
  return {
    id: s.id,
    title: s.name,
    artist: s.author?.join('/'),
    src: s.from == SongFrom.Netease ? `https://music.163.com/song/media/outer/url?id=${s.id}.mp3` : s.url,
    pic: s.cover ?? '',
    lrc: '',
  } as Music
}
async function getOutputDevice() {
  try {
    await navigator.mediaDevices.getUserMedia({
      // 请保留此代码以确保用户授权访问设备
      audio: true,
    })

    const list = await navigator.mediaDevices.enumerateDevices()

    deviceList.value = list.filter((device) => device.kind === 'audiooutput').map((d) => ({ label: d.label, value: d.deviceId }))
  } catch (err) {
    console.error(err)
    message.error('获取音频输出设备失败: ' + err)
  }
}
function blockMusic(song: SongsInfo) {
  settings.value.blacklist.push(song.name)
  waitingMusics.value.splice(
    waitingMusics.value.findIndex((m) => m.music == song),
    1,
  )
  message.success(`[${song.name}] 已添加到黑名单`)
}
function updateWaiting() {
  QueryPostAPI(MUSIC_REQUEST_API_URL + 'update-waiting', {
    playing: currentOriginMusic.value,
    waiting: waitingMusics.value,
  })
}

let timer: number
onMounted(async () => {
  props.client.onEvent('danmaku', onGetEvent)

  if (originMusics.value.length > 0) {
    currentMusic.value = songToMusic(originMusics.value[0])
  }
  await getOutputDevice()
  if (deviceList.value.length > 0) {
    if (!deviceList.value.find((d) => d.value == settings.value.deviceId)) {
      settings.value.deviceId = undefined
    } else {
      setSinkId()
    }
  }
  timer = setInterval(updateWaiting, 2000)
})
onUnmounted(() => {
  props.client.offEvent('danmaku', onGetEvent)
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<template>
  <NSpace>
    <NAlert type="info"> 搜索时会优先选择非VIP歌曲, 所以点到付费曲目时可能会是猴版或者各种奇怪的歌 </NAlert>
  </NSpace>
  <NDivider />
  <NSpace align="center">
    <NButton
      @click="listening ? stopListen() : startListen()"
      :type="listening ? 'error' : 'primary'"
      :style="{ animation: listening ? 'animated-border 2.5s infinite' : '' }"
      data-umami-event="Use Music Request"
      :data-umami-event-uid="accountInfo?.biliId"
      size="large"
    >
      {{ listening ? '停止监听' : '开始监听' }}
    </NButton>
    <NButton @click="showOBSModal = true" type="info" size="small"> OBS组件 </NButton>
    <NButton @click="showNeteaseModal = true" size="small"> 从网易云歌单导入空闲歌单 </NButton>

    <NButton @click="uploadConfig" type="primary" secondary :disabled="!accountInfo" size="small"> 保存配置到服务器 </NButton>
    <NPopconfirm @positive-click="downloadConfig">
      <template #trigger>
        <NButton type="primary" secondary :disabled="!accountInfo" size="small"> 从服务器获取配置 </NButton>
      </template>
      这将覆盖当前设置, 确定?
    </NPopconfirm>
  </NSpace>
  <NDivider />
  <APlayer
    v-if="musics.length > 0 || currentMusic.src"
    :list="musics"
    v-model:music="currentMusic"
    ref="aplayer"
    v-model:volume="settings.volume"
    v-model:shuffle="settings.shuffle"
    v-model:repeat="settings.repeat"
    :listMaxHeight="'200'"
    mutex
    @ended="onMusicEnd"
  />
  <NCollapse :default-expanded-names="['1']">
    <NCollapseItem title="队列" name="1">
      <NEmpty v-if="waitingMusics.length == 0"> 暂无 </NEmpty>
      <NList v-else size="small" bordered>
        <NListItem v-for="item in waitingMusics">
          <NSpace align="center">
            <NButton @click="playWaitingMusic(item)" type="primary" secondary size="small"> 播放 </NButton>
            <NButton @click="waitingMusics.splice(waitingMusics.indexOf(item), 1)" type="error" secondary size="small"> 取消 </NButton>
            <NButton @click="blockMusic(item.music)" type="warning" secondary size="small"> 拉黑 </NButton>
            <span>
              <NTag v-if="item.music.from == SongFrom.Netease" type="success" size="small"> 网易</NTag>
              <NTag v-else-if="item.music.from == SongFrom.Kugou" type="success" size="small"> 酷狗</NTag>
            </span>
            <NText>
              {{ item.from.name }}
            </NText>
            <NText depth="3"> {{ item.music.name }} - {{ item.music.author?.join('/') }} </NText>
          </NSpace>
        </NListItem>
      </NList>
    </NCollapseItem>
  </NCollapse>
  <NDivider />
  <NTabs>
    <NTabPane name="settings" tab="设置">
      <NSpace vertical>
        <NSpace align="center">
          <NRadioGroup v-model:value="settings.platform">
            <NRadioButton value="netease"> 网易云 </NRadioButton>
            <NRadioButton value="kugou"> 酷狗 </NRadioButton>
          </NRadioGroup>
          <NInputGroup style="width: 250px">
            <NInputGroupLabel> 点歌弹幕前缀 </NInputGroupLabel>
            <NInput v-model:value="settings.orderPrefix" />
          </NInputGroup>
          <NCheckbox
            :checked="settings.orderCooldown != undefined"
            @update:checked="
              (checked: boolean) => {
                settings.orderCooldown = checked ? 300 : undefined
              }
            "
          >
            是否启用点歌冷却
          </NCheckbox>
          <NInputGroup v-if="settings.orderCooldown" style="width: 200px">
            <NInputGroupLabel> 冷却时间 (秒) </NInputGroupLabel>
            <NInputNumber
              v-model:value="settings.orderCooldown"
              @update:value="
                (value) => {
                  if (!value || value <= 0) settings.orderCooldown = undefined
                }
              "
            />
          </NInputGroup>
        </NSpace>
        <NSpace>
          <NCheckbox v-model:checked="settings.playMusicWhenFree"> 空闲时播放空闲歌单 </NCheckbox>
          <NCheckbox v-model:checked="settings.orderMusicFirst"> 优先播放点歌 </NCheckbox>
        </NSpace>
        <NSpace>
          <NButton @click="getOutputDevice"> 获取输出设备 </NButton>
          <NSelect v-model:value="settings.deviceId" :options="deviceList" :fallback-option="() => ({ label: '未选择', value: '' })" style="min-width: 200px" @update:value="setSinkId" />
        </NSpace>
      </NSpace>
    </NTabPane>
    <NTabPane name="list" tab="闲置歌单">
      <NSpace>
        <NPopconfirm @positive-click="clearMusic">
          <template #trigger>
            <NButton type="error"> 清空 </NButton>
          </template>
          确定清空吗?
        </NPopconfirm>
        <NButton @click="showNeteaseModal = true"> 从网易云歌单导入 </NButton>
      </NSpace>
      <NDivider style="margin: 15px 0 10px 0" />
      <NEmpty v-if="musics.length == 0"> 暂无 </NEmpty>
      <NVirtualList v-else :style="`max-height: 1000px`" :item-size="30" :items="originMusics" item-resizable>
        <template #default="{ item, index }">
          <p :style="`min-height: ${30}px;width:97%;display:flex;align-items:center;`">
            <NSpace align="center" style="width: 100%">
              <NPopconfirm @positive-click="delMusic(item)">
                <template #trigger>
                  <NButton type="error" secondary size="small"> 删除 </NButton>
                </template>
                确定删除?
              </NPopconfirm>
              <NText> {{ item.name }} - {{ item.author?.join('/') }} </NText>
            </NSpace>
          </p>
        </template>
      </NVirtualList>
    </NTabPane>
    <NTabPane name="blacklist" tab="黑名单">
      <NList>
        <NListItem v-for="item in settings.blacklist">
          <NSpace align="center" style="width: 100%">
            <NButton @click="settings.blacklist.splice(settings.blacklist.indexOf(item), 1)" type="error" secondary size="small"> 删除 </NButton>
            <NText> {{ item }} </NText>
          </NSpace>
        </NListItem>
      </NList>
    </NTabPane>
  </NTabs>
  <NDivider style="height: 100px" />
  <NModal v-model:show="showNeteaseModal" preset="card" :title="`获取歌单`" style="max-width: 600px">
    <NInput clearable style="width: 100%" autosize :status="neteaseSongListId ? 'success' : 'error'" v-model:value="neteaseIdInput" placeholder="直接输入歌单Id或者网页链接">
      <template #suffix>
        <NTag v-if="neteaseSongListId" type="success" size="small"> 歌单Id: {{ neteaseSongListId }} </NTag>
      </template>
    </NInput>
    <NDivider style="margin: 10px" />
    <NButton type="primary" @click="getNeteaseSongList" :disabled="!neteaseSongListId" :loading="isLoading"> 获取 </NButton>
    <template v-if="neteaseSongsOptions.length > 0">
      <NDivider style="margin: 10px" />
      <NTransfer style="height: 500px" ref="transfer" v-model:value="selectedNeteaseSongs" :options="neteaseSongsOptions" source-filterable />
      <NDivider style="margin: 10px" />
      <NButton type="primary" @click="addNeteaseSongs" :loading="isLoading"> 添加到歌单 | {{ selectedNeteaseSongs.length }} 首 </NButton>
    </template>
  </NModal>
  <NModal v-model:show="showOBSModal" title="OBS组件" preset="card" style="width: 800px">
    <NAlert title="这是什么?  " type="info"> 将等待队列以及结果显示在OBS中 </NAlert>
    <NDivider> 浏览 </NDivider>
    <div style="height: 500px; width: 280px; position: relative; margin: 0 auto">
      <MusicRequestOBS :id="accountInfo?.id" />
    </div>
    <br />
    <NInput :value="'https://vtsuru.live/obs/music-request?id=' + accountInfo?.id" />
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
.aplayer-list {
  max-height: 300px;
  overflow-y: auto;
}
@keyframes animated-border {
  0% {
    box-shadow: 0 0 0px #589580;
  }

  100% {
    box-shadow: 0 0 0 8px rgba(255, 255, 255, 0);
  }
}
</style>
