<script setup lang="ts">
import type {
  SelectOption,
} from 'naive-ui'
import type { DanmakuUserInfo, EventModel, OpenLiveInfo, SongsInfo } from '@/api/api-models'
import type { MusicRequestSettings } from '@/store/useMusicRequest'
import { List } from 'linqts'
import {
  NAlert, NButton, NCheckbox, NCollapse, NCollapseItem, NDivider, NEmpty, NInput, NInputGroup, NInputGroupLabel, NInputNumber, NLi, NList, NListItem, NModal, NPopconfirm, NRadioButton, NRadioGroup, NSelect, NFlex, NTabPane, NTabs, NTag, NText, NTooltip, NTransfer, NUl, NVirtualList, useMessage } from 'naive-ui';
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { clearInterval, setInterval } from 'worker-timers'
import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import { SongFrom } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { CURRENT_HOST, MUSIC_REQUEST_API_URL, SONG_API_URL } from '@/shared/config'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useMusicRequestProvider } from '@/store/useMusicRequest'
import MusicRequestOBS from '@/apps/obs/pages/request/MusicRequestOBS.vue'
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'
import { usePersistedStorage } from '@/shared/storage/persist'

interface Music {
  id: number
  title: string
  artist: string
  src: string
  pic: string
  lrc: string
}
interface WaitMusicInfo {
  from: DanmakuUserInfo
  music: SongsInfo
}

defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

const route = useRoute()

const settings = computed(() => {
  return musicRquestStore.settings
})
const cooldown = usePersistedStorage<{ [id: number]: number }>('Setting.MusicRequest.Cooldown', {})
const musicRquestStore = useMusicRequestProvider()
const client = await useDanmakuClient().initOpenlive()

const deviceList = ref<SelectOption[]>([])

const accountInfo = useAccount()
const message = useMessage()

const listening = ref(false)
const originMusics = computed(() => {
  return musicRquestStore.originMusics
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
  } catch { }
  try {
    return Number(neteaseIdInput.value)
  } catch { }
  return null
})
const neteaseSongs = ref<SongsInfo[]>([])
const neteaseSongsOptions = computed(() => {
  return neteaseSongs.value.map(s => ({
    label: `${s.name} - ${s.author.join('/')}`,
    value: s.key,
    disabled: originMusics.value.findIndex(exist => exist.id == s.id) > -1,
  }))
})
const selectedNeteaseSongs = ref<string[]>([])

async function get() {
  try {
    const data = await QueryGetAPI<SongsInfo[]>(`${MUSIC_REQUEST_API_URL}get`)
    if (data.code == 200) {
      console.log('[OPEN-LIVE-Music-Request] 已获取所有数据')
      return new List(data.data).OrderByDescending(s => s.createTime).ToArray()
    } else {
      message.error(`无法获取数据: ${data.message}`)
      return []
    }
  } catch (err) {
    console.error(err)
    message.error('无法获取数据')
  }
  return []
}
async function searchMusic(keyword: string) {
  const inSongList = originMusics.value.find(m => m.name.toLowerCase().trim() == keyword.toLowerCase().trim())
  if (inSongList) {
    return inSongList
  }
  const data = await QueryGetAPI<SongsInfo>(`${MUSIC_REQUEST_API_URL}search-${settings.value.platform}`, {
    keyword,
  })
  if (data.code == 200) {
    return data.data
  } else if (data.code == 404) {
    message.error(`未找到包含关键词: ${keyword} 的歌曲`)
  }
  return undefined
}
async function getNeteaseSongList() {
  isLoading.value = true
  await QueryGetAPI<SongsInfo[]>(`${SONG_API_URL}get-netease-list`, {
    id: neteaseSongListId.value,
  })
    .then((data) => {
      if (data.code == 200) {
        neteaseSongs.value = data.data
        message.success(
          `成功获取歌曲信息, 共 ${data.data.length} 条, 歌单中已存在 ${neteaseSongsOptions.value.filter(s => s.disabled).length} 首`,
        )
      } else {
        message.error(`获取歌单失败: ${data.message}`)
      }
    })
    .catch((err) => {
      message.error(`获取歌单失败: ${err}`)
    })
    .finally(() => {
      isLoading.value = false
    })
}
async function addNeteaseSongs() {
  isLoading.value = true
  const selected = neteaseSongs.value.filter(s => selectedNeteaseSongs.value.find(select => s.key == select))
  await addSongs(selected, SongFrom.Netease)
    .then((data) => {
      if (data.code == 200) {
        message.success(`已添加 ${data.data.length} 首歌曲`)
        originMusics.value.push(...data.data)
      } else {
        message.error(`添加失败: ${data.message}`)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('添加失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}
async function addSongs(songsShoudAdd: SongsInfo[], from: SongFrom) {
  return QueryPostAPI<SongsInfo[]>(
    `${MUSIC_REQUEST_API_URL}add`,
    songsShoudAdd.map(s => ({
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
  QueryPostAPI(`${MUSIC_REQUEST_API_URL}del`, [song.key])
    .then((data) => {
      if (data.code == 200) {
        message.success('已删除')
        musicRquestStore.originMusics = originMusics.value.filter(s => s.key != song.key)
      } else {
        message.error(`删除失败: ${data.message}`)
      }
    })
    .catch((err) => {
      message.error(`删除失败${err}`)
    })
}
function clearMusic() {
  QueryGetAPI(`${MUSIC_REQUEST_API_URL}clear`)
    .then((data) => {
      if (data.code == 200) {
        message.success('已清空')
        musicRquestStore.originMusics = []
      } else {
        message.error(`清空失败: ${data.message}`)
      }
    })
    .catch((err) => {
      message.error(`清空失败${err}`)
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
      console.error(err)
      message.error('保存失败')
    })
}
async function downloadConfig() {
  await DownloadConfig<MusicRequestSettings>('MusicRequest')
    .then((data) => {
      if (data.msg) {
        message.error(`获取失败: ${data.msg}`)
      } else {
        musicRquestStore.settings = data.data ?? ({} as MusicRequestSettings)
        message.success('已获取配置文件')
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('获取失败')
    })
}
function startListen() {
  /* if (accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest)) {
    message.warning('使用这个点歌则需要先关闭歌势点歌 (SongRequest)')
    return
  } */
  listening.value = true
  message.success('开始监听')
}
function stopListen() {
  listening.value = false
  message.success('已停止监听')
}
async function onGetEvent(data: EventModel) {
  if (!checkMessage(data.msg)) return
  if (!listening.value) {
    if (route.name == 'manage-musicRequest') message.warning('(有人点歌, 不过你还没有开启监听)')
    return
  }
  if (settings.value.orderCooldown && cooldown.value[data.uid] && data.uid != (accountInfo.value?.biliId ?? -1)) {
    const lastRequest = cooldown.value[data.uid]
    if (Date.now() - lastRequest < settings.value.orderCooldown * 1000) {
      message.info(
        `[${data.uname}] 冷却中，距离下次点歌还有 ${((settings.value.orderCooldown * 1000 - (Date.now() - lastRequest)) / 1000).toFixed(1)} 秒`,
      )
      return
    }
  }
  const name = data.msg.replace(new RegExp(settings.value.orderPrefix.trimStart()), '').trim()
  const result = await searchMusic(name)
  if (result) {
    if (settings.value.blacklist.includes(result.name)) {
      message.warning(`[${data.uname}] 点歌失败，因为 ${result.name} 在黑名单中`)
      return
    }
    cooldown.value[data.uid] = Date.now()
    const music = {
      from: {
        name: data.uname,
        uid: data.uid,
        guard_level: data.guard_level,
        fans_medal_level: data.fans_medal_level,
        fans_medal_name: data.fans_medal_name,
        fans_medal_wearing_status: data.fans_medal_wearing_status,
      },
      music: result,
    } as WaitMusicInfo
    musicRquestStore.addWaitingMusic(music)
  }
}
function checkMessage(msg: string) {
  return msg.trim().toLowerCase().startsWith(settings.value.orderPrefix.trimStart())
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

    deviceList.value = list
      .filter(device => device.kind === 'audiooutput')
      .map(d => ({ label: d.label, value: d.deviceId }))
  } catch (err) {
    console.error(err)
    message.error(`获取音频输出设备失败, 获取你需要授予网页读取麦克风权限: ${err}`)
  }
}
function blockMusic(song: SongsInfo) {
  settings.value.blacklist.push(song.name)
  musicRquestStore.waitingMusics.splice(
    musicRquestStore.waitingMusics.findIndex(m => m.music == song),
    1,
  )
  message.success(`[${song.name}] 已添加到黑名单`)
}
function updateWaiting() {
  QueryPostAPI(`${MUSIC_REQUEST_API_URL}update-waiting`, {
    playing: musicRquestStore.currentOriginMusic,
    waiting: musicRquestStore.waitingMusics,
  })
}

let timer: number
onMounted(async () => {
  client.onEvent('danmaku', onGetEvent)
  if (musicRquestStore.originMusics.length == 0) {
    musicRquestStore.originMusics = await get()
  }
  if (originMusics.value.length > 0) {
    musicRquestStore.currentMusic = songToMusic(originMusics.value[0])
  }
  await getOutputDevice()
  if (deviceList.value.length > 0) {
    if (!deviceList.value.find(d => d.value == settings.value.deviceId)) {
      settings.value.deviceId = undefined
    } else {
      musicRquestStore.setSinkId()
    }
  }
  timer = setInterval(updateWaiting, 2000)
})
onUnmounted(() => {
  client.offEvent('danmaku', onGetEvent)
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<template>
  <NCard size="small" bordered :segmented="{ content: true }">
    <OpenLivePageHeader
      title="点歌"
      description="监听弹幕点歌、管理闲置歌单与黑名单。"
    >
      <template #actions>
        <NFlex align="center" :wrap="true" :size="10">
          <NButton
            :type="listening ? 'error' : 'success'"
            data-umami-event="Use Music Request"
            :data-umami-event-uid="accountInfo?.biliId"
            size="small"
            @click="listening ? stopListen() : startListen()"
          >
            {{ listening ? '停止监听' : '开始监听' }}
          </NButton>
          <NButton
            type="info"
            size="small"
            class="open-live-action-btn"
            @click="showOBSModal = true"
          >
            OBS组件
          </NButton>
          <NButton
            type="primary"
            secondary
            :disabled="!accountInfo"
            size="small"
            class="open-live-action-btn"
            @click="uploadConfig"
          >
            保存配置
          </NButton>
          <NPopconfirm @positive-click="downloadConfig">
            <template #trigger>
              <NButton
                type="primary"
                secondary
                :disabled="!accountInfo"
                size="small"
                class="open-live-action-btn"
              >
                获取配置
              </NButton>
            </template>
            这将覆盖当前设置，确定？
          </NPopconfirm>
        </NFlex>
      </template>
    </OpenLivePageHeader>

    <NAlert type="info" size="small" :bordered="false">
      搜索时会优先选择非VIP歌曲，所以点到付费曲目时可能会是猴版或者各种奇怪的歌。
    </NAlert>
  </NCard>

  <NCard size="small" bordered>
    <NTabs type="line" animated size="small">
      <NTabPane
        name="queue"
        tab="当前点歌"
      >
        <NEmpty v-if="musicRquestStore.waitingMusics.length === 0" description="暂无点歌" />
        <NList
          v-else
          size="small"
          bordered
        >
          <NListItem
            v-for="item in musicRquestStore.waitingMusics"
            :key="item.music.name"
          >
            <NFlex align="center" :wrap="true" :size="8">
              <NButton
                type="primary"
                secondary
                size="small"
                @click="musicRquestStore.playMusic(item.music)"
              >
                播放
              </NButton>
              <NButton
                type="error"
                secondary
                size="small"
                @click="musicRquestStore.waitingMusics.splice(musicRquestStore.waitingMusics.indexOf(item), 1)"
              >
                取消
              </NButton>
              <NButton
                type="warning"
                secondary
                size="small"
                @click="blockMusic(item.music)"
              >
                拉黑
              </NButton>
              <span>
                <NTag
                  v-if="item.music.from === SongFrom.Netease"
                  type="success"
                  size="small"
                > 网易</NTag>
                <NTag
                  v-else-if="item.music.from === SongFrom.Kugou"
                  type="success"
                  size="small"
                > 酷狗</NTag>
              </span>
              <NText>
                {{ item.from.name }}
              </NText>
              <NText depth="3">
                {{ item.music.name }} - {{ item.music.author?.join('/') }}
              </NText>
            </NFlex>
          </NListItem>
        </NList>
      </NTabPane>

      <NTabPane
        name="list"
        tab="闲置歌单"
      >
        <NFlex align="center" :wrap="true" :size="10" class="music-request__tab-actions">
          <NPopconfirm @positive-click="clearMusic">
            <template #trigger>
              <NButton type="error" secondary size="small" class="open-live-action-btn">
                清空
              </NButton>
            </template>
            确定清空吗?
          </NPopconfirm>
          <NButton size="small" class="open-live-action-btn" @click="showNeteaseModal = true">
            从网易云歌单导入
          </NButton>
        </NFlex>

        <NEmpty v-if="musicRquestStore.originMusics.length === 0">
          暂无
        </NEmpty>
        <NVirtualList
          v-else
          class="music-request__list"
          :item-size="36"
          :items="originMusics"
          item-resizable
        >
          <template #default="{ item }">
            <div class="music-request__list-row">
              <NFlex align="center" justify="space-between" style="width: 100%" :wrap="true" :size="10">
                <NPopconfirm @positive-click="delMusic(item)">
                  <template #trigger>
                    <NButton
                      type="error"
                      secondary
                      size="tiny"
                    >
                      删除
                    </NButton>
                  </template>
                  确定删除?
                </NPopconfirm>

                <NButton
                  type="info"
                  secondary
                  size="tiny"
                  @click="musicRquestStore.playMusic(item)"
                >
                  播放
                </NButton>
                <NText> {{ item.name }} - {{ item.author?.join('/') }} </NText>
              </NFlex>
            </div>
          </template>
        </NVirtualList>
      </NTabPane>

      <NTabPane
        name="blacklist"
        tab="黑名单"
      >
        <NList size="small" bordered>
          <NListItem
            v-for="item in settings.blacklist"
            :key="item"
          >
            <NFlex
              align="center"
              style="width: 100%"
            >
              <NButton
                type="error"
                secondary
                size="small"
                @click="settings.blacklist.splice(settings.blacklist.indexOf(item), 1)"
              >
                删除
              </NButton>
              <NText> {{ item }} </NText>
            </NFlex>
          </NListItem>
        </NList>
      </NTabPane>

      <NTabPane
        name="settings"
        tab="设置"
      >
        <NFlex vertical :size="12">
          <NFlex align="center" :wrap="true" :size="12">
            <NRadioGroup v-model:value="settings.platform" size="small">
              <NRadioButton value="netease">
                网易云
              </NRadioButton>
              <NRadioButton value="kugou">
                酷狗
              </NRadioButton>
            </NRadioGroup>
            <NInputGroup class="music-request__field--prefix">
              <NInputGroupLabel> 点歌弹幕前缀 </NInputGroupLabel>
              <NInput v-model:value="settings.orderPrefix" size="small" />
            </NInputGroup>
            <NCheckbox
              :checked="settings.orderCooldown !== undefined"
              @update:checked="(checked: boolean) => {
                settings.orderCooldown = checked ? 300 : undefined
              }"
            >
              是否启用点歌冷却
            </NCheckbox>
            <NInputGroup
              v-if="settings.orderCooldown"
              class="music-request__field--cooldown"
            >
              <NInputGroupLabel> 冷却时间 (秒) </NInputGroupLabel>
              <NInputNumber
                v-model:value="settings.orderCooldown"
                size="small"
                @update:value="(value) => {
                  if (!value || value <= 0) settings.orderCooldown = undefined
                }"
              />
            </NInputGroup>
          </NFlex>
          <NFlex :wrap="true" :size="12">
            <NCheckbox v-model:checked="settings.playMusicWhenFree">
              空闲时播放空闲歌单
            </NCheckbox>
            <NCheckbox v-model:checked="settings.orderMusicFirst">
              优先播放点歌
            </NCheckbox>
          </NFlex>
          <NFlex align="center" :wrap="true" :size="12">
            <NTooltip>
              <template #trigger>
                <NButton
                  type="info"
                  secondary
                  size="small"
                  @click="getOutputDevice"
                >
                  获取输出设备
                </NButton>
              </template>
              获取和修改输出设备需要打开麦克风权限
            </NTooltip>
            <NSelect
              v-model:value="settings.deviceId"
              :options="deviceList"
              :fallback-option="() => ({ label: '未选择', value: '' })"
              class="music-request__field--device"
              size="small"
              @update:value="musicRquestStore.setSinkId"
            />
          </NFlex>
        </NFlex>
      </NTabPane>
    </NTabs>
  </NCard>
  <NModal
    v-model:show="showNeteaseModal"
    preset="card"
    title="获取歌单"
    style="width: 720px; max-width: 90vw"
  >
    <NInput
      v-model:value="neteaseIdInput"
      clearable
      style="width: 100%"
      autosize
      :status="neteaseSongListId ? 'success' : 'error'"
      placeholder="直接输入歌单Id或者网页链接"
      size="small"
    >
      <template #suffix>
        <NTag
          v-if="neteaseSongListId"
          type="success"
          size="small"
        >
          歌单Id: {{ neteaseSongListId }}
        </NTag>
      </template>
    </NInput>
    <NDivider style="margin: 10px 0" />
    <NButton
      type="primary"
      :disabled="!neteaseSongListId"
      :loading="isLoading"
      size="small"
      @click="getNeteaseSongList"
    >
      获取
    </NButton>
    <template v-if="neteaseSongsOptions.length > 0">
      <NDivider style="margin: 10px 0" />
      <NTransfer
        v-model:value="selectedNeteaseSongs"
        style="height: 420px"
        :options="neteaseSongsOptions"
        source-filterable
      />
      <NDivider style="margin: 10px 0" />
      <NButton
        type="primary"
        :loading="isLoading"
        size="small"
        @click="addNeteaseSongs"
      >
        添加到歌单 | {{ selectedNeteaseSongs.length }} 首
      </NButton>
    </template>
  </NModal>
  <NModal
    v-model:show="showOBSModal"
    title="OBS组件"
    preset="card"
    style="width: 900px; max-width: 90vw"
  >
    <NFlex vertical :size="12">
      <NAlert title="这是什么？" type="info" size="small" :bordered="false">
        将等待队列以及结果显示在OBS中。
      </NAlert>
      <NDivider style="margin: 0">
        浏览
      </NDivider>
      <div class="music-request__obs-preview">
        <MusicRequestOBS :id="accountInfo?.id" />
      </div>
      <NInput
        :value="`${CURRENT_HOST}obs/music-request?id=${accountInfo?.id}`"
        size="small"
        readonly
      />
      <NCollapse>
        <NCollapseItem title="使用说明">
          <NUl>
            <NLi>在 OBS 来源中添加源，选择「浏览器」。</NLi>
            <NLi>在 URL 栏填入上方链接。</NLi>
            <NLi>根据自己的需要调整宽度和高度（这里是宽 280px 高 500px）。</NLi>
            <NLi>完成。</NLi>
          </NUl>
        </NCollapseItem>
      </NCollapse>
    </NFlex>
  </NModal>
</template>

<style>
.music-request__tab-actions {
  margin-bottom: 8px;
}

.music-request__list {
  max-height: 560px;
}

.music-request__list-row {
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 6px;
}

.music-request__field--prefix {
  width: 260px;
  max-width: 100%;
}

.music-request__field--cooldown {
  width: 240px;
  max-width: 100%;
}

.music-request__field--device {
  min-width: 220px;
  max-width: 360px;
}

.music-request__obs-preview {
  height: 500px;
  width: 280px;
  position: relative;
  margin: 0 auto;
}

.aplayer-list {
  max-height: 300px;
  overflow-y: auto;
}
</style>
