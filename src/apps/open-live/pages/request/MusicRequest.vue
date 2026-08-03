<script setup lang="ts">
import { List } from 'linqts'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { clearInterval, setInterval } from 'worker-timers'

import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import type { EventModel, OpenLiveInfo, SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import MusicRequestOBS from '@/apps/obs/pages/request/MusicRequestOBS.vue'
import ObsConfigModal from '@/apps/open-live/components/ObsConfigModal.vue'
import OpenLivePageLayout from '@/apps/open-live/components/OpenLivePageLayout.vue'
import MusicRequestItem from '@/apps/open-live/components/request/MusicRequestItem.vue'
import { MUSIC_REQUEST_API_URL, SONG_API_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { copyToClipboard } from '@/shared/utils'
import { formatListForCopy } from '@/shared/utils/queue'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import type { Music, MusicRequestSettings, WaitMusicInfo } from '@/store/useMusicRequest'
import { useMusicRequestProvider } from '@/store/useMusicRequest'
import { useOBSNotification } from '@/store/useOBSNotification'

defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

const route = useRoute()

const musicRquestStore = useMusicRequestProvider()
const settings = computed(() => {
  return musicRquestStore.settings
})
const cooldown = usePersistedStorage<{ [id: number]: number }>('Setting.MusicRequest.Cooldown', {})
const client = await useDanmakuClient().initOpenlive()

const deviceList = ref<any[]>([])

const accountInfo = useAccount()
const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}
const obsNotification = useOBSNotification()

const listening = ref(false)
const originMusics = computed(() => {
  return musicRquestStore.originMusics
})

const isLoading = ref(false)

const showNeteaseModal = ref(false)
const showOBSModal = ref(false)
const obsScrollSpeed = ref(1.0)
const obsStyleType = ref<'classic' | 'fresh' | 'minimal'>('classic')
const neteaseIdInput = ref('')
const neteaseSongListId = computed(() => parseNeteaseSongListId(neteaseIdInput.value))
const neteaseSongs = ref<SongsInfo[]>([])
const neteaseSongsOptions = computed(() => {
  return neteaseSongs.value.map((s) => ({
    label: `${s.name} - ${s.author.join('/')}`,
    value: s.key,
    disabled: originMusics.value.findIndex((exist) => exist.id == s.id) > -1,
  }))
})
const selectedNeteaseSongs = ref<string[]>([])

// 当前点歌搜索过滤 (按歌名/点歌人)
const waitingFilter = ref('')

// 点歌冷却剩余可视化: 记录会话内 uid->name, 配合 nowTick 每秒刷新
const cooldownNames = ref<Record<number, string>>({})
const nowTick = ref(Date.now())
let cooldownTimer: number | undefined

const activeCooldowns = computed(() => {
  const cd = settings.value.orderCooldown
  if (!cd) {
    return []
  }
  const cooldownMs = cd * 1000
  return Object.entries(cooldown.value)
    .map(([uid, last]) => {
      const remain = Math.ceil((last + cooldownMs - nowTick.value) / 1000)
      return {
        uid: Number(uid),
        name: cooldownNames.value[Number(uid)] ?? `UID ${uid}`,
        remain,
        total: cd,
      }
    })
    .filter((c) => c.remain > 0)
    .toSorted((a, b) => a.remain - b.remain)
})
const filteredWaitingMusics = computed(() => {
  const keyword = waitingFilter.value.trim().toLowerCase()
  if (!keyword) {
    return musicRquestStore.waitingMusics
  }
  return musicRquestStore.waitingMusics.filter(
    (item) => item.music.name?.toLowerCase().includes(keyword) || item.from?.name?.toLowerCase().includes(keyword),
  )
})

function copyWaitingList() {
  const text = formatListForCopy(
    musicRquestStore.waitingMusics,
    (item) => item.music.name,
    (item) => item.from?.name,
  )
  if (!text) {
    return
  }
  copyToClipboard(text)
}

function formatHistoryTime(time: number) {
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function get() {
  try {
    const data = await QueryGetAPI<SongsInfo[]>(`${MUSIC_REQUEST_API_URL}get`)
    if (data.code == 200) {
      console.log('[OPEN-LIVE-Music-Request] 已获取所有数据')
      return new List(data.data).OrderByDescending((s) => s.createTime).ToArray()
    } else {
      feedback('error', `无法获取数据: ${data.message}`)
      return []
    }
  } catch (err) {
    console.error(err)
    feedback('error', '无法获取数据')
  }
  return []
}
async function searchMusic(keyword: string) {
  const inSongList = originMusics.value.find((m) => m.name.toLowerCase().trim() == keyword.toLowerCase().trim())
  if (inSongList) {
    return {
      song: inSongList,
      reason: undefined,
    }
  }
  try {
    const data = await QueryGetAPI<SongsInfo>(`${MUSIC_REQUEST_API_URL}search-${settings.value.platform}`, {
      keyword,
    })
    if (data.code == 200) {
      return {
        song: data.data,
        reason: undefined,
      }
    }

    const reason = data.code === 404 ? `未找到包含关键词“${keyword}”的歌曲` : `搜索失败: ${data.message}`
    feedback('error', reason)
    return {
      song: undefined,
      reason,
    }
  } catch (err) {
    console.error(err)
    const reason = '搜索歌曲失败'
    feedback('error', reason)
    return {
      song: undefined,
      reason,
    }
  }
}
function publishMusicRequestResult(success: boolean, userName: string, content: string) {
  if (!accountInfo.value.id) {
    return
  }
  void obsNotification
    .publish({
      Type: success ? 'success' : 'failed',
      Title: '点歌',
      Message: content,
      Source: 'music-request',
      UserName: userName,
    })
    .catch((err) => {
      console.warn('[OBS] 发布点歌通知失败', err)
    })
}
async function getNeteaseSongList() {
  isLoading.value = true
  await QueryGetAPI<SongsInfo[]>(`${SONG_API_URL}get-netease-list`, {
    id: neteaseSongListId.value,
  })
    .then((data) => {
      if (data.code == 200) {
        neteaseSongs.value = data.data
        feedback(
          'success',
          `成功获取歌曲信息, 共 ${data.data.length} 条, 歌单中已存在 ${neteaseSongsOptions.value.filter((s) => s.disabled).length} 首`,
        )
      } else {
        feedback('error', `获取歌单失败: ${data.message}`)
      }
    })
    .catch((err) => {
      feedback('error', `获取歌单失败: ${err}`)
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
        feedback('success', `已添加 ${data.data.length} 首歌曲`)
        originMusics.value.push(...data.data)
      } else {
        feedback('error', `添加失败: ${data.message}`)
      }
    })
    .catch((err) => {
      console.error(err)
      feedback('error', '添加失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}
async function addSongs(songsShoudAdd: SongsInfo[], from: SongFrom) {
  return QueryPostAPI<SongsInfo[]>(
    `${MUSIC_REQUEST_API_URL}add`,
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
  QueryPostAPI(`${MUSIC_REQUEST_API_URL}del`, [song.key])
    .then((data) => {
      if (data.code == 200) {
        feedback('success', '已删除')
        musicRquestStore.originMusics = originMusics.value.filter((s) => s.key != song.key)
      } else {
        feedback('error', `删除失败: ${data.message}`)
      }
    })
    .catch((err) => {
      feedback('error', `删除失败${err}`)
    })
}
function clearMusic() {
  QueryGetAPI(`${MUSIC_REQUEST_API_URL}clear`)
    .then((data) => {
      if (data.code == 200) {
        feedback('success', '已清空')
        musicRquestStore.originMusics = []
      } else {
        feedback('error', `清空失败: ${data.message}`)
      }
    })
    .catch((err) => {
      feedback('error', `清空失败${err}`)
    })
}
async function uploadConfig() {
  await UploadConfig('MusicRequest', settings.value)
    .then((data) => {
      if (data) {
        feedback('success', '已保存至服务器')
      } else {
        feedback('error', '保存失败')
      }
    })
    .catch((err) => {
      console.error(err)
      feedback('error', '保存失败')
    })
}
async function downloadConfig() {
  await DownloadConfig<MusicRequestSettings>('MusicRequest')
    .then((data) => {
      if (data.msg) {
        feedback('error', `获取失败: ${data.msg}`)
      } else {
        musicRquestStore.settings = data.data ?? ({} as MusicRequestSettings)
        feedback('success', '已获取配置文件')
      }
    })
    .catch((err) => {
      console.error(err)
      feedback('error', '获取失败')
    })
}
function startListen() {
  listening.value = true
  feedback('success', '开始监听')
}
function stopListen() {
  listening.value = false
  feedback('success', '已停止监听')
}
async function onGetEvent(data: EventModel) {
  if (!checkMessage(data.msg)) return
  if (!listening.value) {
    if (route.name == 'manage-musicRequest') feedback('warning', '(有人点歌, 不过你还没有开启监听)')
    return
  }
  if (settings.value.orderCooldown && cooldown.value[data.uid] && data.uid != (accountInfo.value?.biliId ?? -1)) {
    const lastRequest = cooldown.value[data.uid]
    if (Date.now() - lastRequest < settings.value.orderCooldown * 1000) {
      const remainSeconds = ((settings.value.orderCooldown * 1000 - (Date.now() - lastRequest)) / 1000).toFixed(1)
      const failureMessage = `冷却中，还需等待 ${remainSeconds} 秒`
      feedback('info', `[${data.uname}] ${failureMessage}`)
      publishMusicRequestResult(false, data.uname, failureMessage)
      return
    }
  }
  const name = data.msg.replace(new RegExp(settings.value.orderPrefix.trimStart()), '').trim()
  const { song, reason } = await searchMusic(name)
  if (!song) {
    publishMusicRequestResult(false, data.uname, reason ?? '点歌失败')
    return
  }
  if (settings.value.blacklist.includes(song.name)) {
    const failureMessage = `${song.name} 在黑名单中`
    feedback('warning', `[${data.uname}] 点歌失败，因为 ${failureMessage}`)
    publishMusicRequestResult(false, data.uname, failureMessage)
    return
  }
  cooldown.value[data.uid] = Date.now()
  cooldownNames.value[data.uid] = data.uname
  const music = {
    from: {
      name: data.uname,
      uid: data.uid,
      guard_level: data.guard_level,
      fans_medal_level: data.fans_medal_level,
      fans_medal_name: data.fans_medal_name,
      fans_medal_wearing_status: data.fans_medal_wearing_status,
    },
    music: song,
  } as WaitMusicInfo
  musicRquestStore.addWaitingMusic(music)
  publishMusicRequestResult(true, data.uname, `点歌成功: ${song.name}`)
}
function checkMessage(msg: string) {
  return msg.trim().toLowerCase().startsWith(settings.value.orderPrefix.trimStart())
}

/** 从网易云歌单链接或纯数字中解析歌单 ID, 解析不出返回 null */
function parseNeteaseSongListId(input: string): number | null {
  const fromUrl = /music\.163\.com.*?[?&]id=(\d+)/.exec(input)
  if (fromUrl) return Number(fromUrl[1])
  const asNumber = Number(input.trim())
  return Number.isNaN(asNumber) || !input.trim() ? null : asNumber
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
      .filter((device) => device.kind === 'audiooutput')
      .map((d) => ({ label: d.label, value: d.deviceId }))
  } catch (err) {
    console.error(err)
    feedback('error', `获取音频输出设备失败, 获取你需要授予网页读取麦克风权限: ${err}`)
  }
}
function blockMusic(song: SongsInfo) {
  settings.value.blacklist.push(song.name)
  musicRquestStore.waitingMusics.splice(
    musicRquestStore.waitingMusics.findIndex((m) => m.music == song),
    1,
  )
  feedback('success', `[${song.name}] 已添加到黑名单`)
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
    if (!deviceList.value.find((d) => d.value == settings.value.deviceId)) {
      settings.value.deviceId = undefined
    } else {
      musicRquestStore.setSinkId()
    }
  }
  timer = setInterval(updateWaiting, 2000)
  cooldownTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
})
onUnmounted(() => {
  client.offEvent('danmaku', onGetEvent)
  if (timer) {
    clearInterval(timer)
  }
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
  }
})
</script>

<template>
  <OpenLivePageLayout
    title="弹幕点歌"
    description="监听弹幕点歌、管理闲置歌单与黑名单。"
    :is-logged-in="true"
  >
    <template #footers>
      <UButton
        :color="listening ? 'error' : 'success'"
        data-umami-event="Use Music Request"
        :data-umami-event-uid="accountInfo?.biliId"
        size="small"
        @click="listening ? stopListen() : startListen()"
      >
        {{ listening ? '停止监听' : '开始监听' }}
      </UButton>
      <UTooltip>
        <UButton
          color="info"
          size="small"
          class="open-live-action-btn"
          @click="showOBSModal = true"
        >
          OBS 组件
        </UButton>
        <template #content> 配置 OBS 样式与滚动速度 </template>
      </UTooltip>
      <UButton
        color="primary"
        variant="soft"
        :disabled="!accountInfo"
        size="small"
        class="open-live-action-btn"
        @click="uploadConfig"
      >
        保存配置
      </UButton>
      <UPopover>
        <UButton
          color="primary"
          variant="soft"
          :disabled="!accountInfo"
          size="sm"
          class="open-live-action-btn"
        >
          获取配置
        </UButton>
        <template #content="{ close }">
          <div class="space-y-3 p-3">
            <div>这将覆盖当前设置，确定？</div>
            <div class="flex justify-end gap-2">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                @click="close"
                >取消</UButton
              >
              <UButton
                size="xs"
                color="primary"
                @click="(close(), downloadConfig)"
                >确认</UButton
              >
            </div>
          </div>
        </template>
      </UPopover>
    </template>

    <UAlert
      type="info"
      size="small"
      :bordered="false"
    >
      搜索时会优先选择非VIP歌曲，所以点到付费曲目时可能会是猴版或者各种奇怪的歌。
    </UAlert>

    <UCard
      size="small"
      bordered
    >
      <div
        type="line"
        animated
        size="small"
      >
        <section
          name="queue"
          tab="当前点歌"
        >
          <div
            v-if="musicRquestStore.waitingMusics.length > 0"
            align="center"
            justify="space-between"
            wrap
            :size="10"
            style="margin-bottom: 10px"
          >
            <div style="max-width: 260px">
              <UInput
                v-model="waitingFilter"
                placeholder="搜索歌名 / 点歌人"
                clearable
                size="small"
              >
                <template #leading>
                  <UIcon name="i-lucide-circle" />
                </template>
              </UInput>
            </div>
            <UTooltip>
              <UButton
                size="small"
                ghost
                @click="copyWaitingList"
              >
                <template #leading>
                  <UIcon name="i-lucide-circle" />
                </template>
                复制名单
              </UButton>
              <template #content> 复制当前点歌为文本名单 </template>
            </UTooltip>
          </div>

          <UCard
            v-if="activeCooldowns.length > 0"
            size="small"
            embedded
            :bordered="false"
            content-style="padding: 8px 12px;"
            style="margin-bottom: 10px"
          >
            <div
              align="center"
              :size="6"
              wrap
            >
              <span
                depth="3"
                style="font-size: 12px; margin-right: 4px"
              >
                冷却中:
              </span>
              <UTooltip
                v-for="c in activeCooldowns"
                :key="c.uid"
              >
                <UBadge
                  size="small"
                  type="warning"
                  :bordered="false"
                  round
                >
                  {{ c.name }} · {{ c.remain }}s
                </UBadge>
                <template #content> {{ c.name }} 冷却剩余 {{ c.remain }} 秒 (共 {{ c.total }} 秒) </template>
              </UTooltip>
            </div>
          </UCard>

          <UEmpty
            v-if="musicRquestStore.waitingMusics.length === 0"
            description="暂无点歌"
            style="margin-top: 40px"
          />
          <UEmpty
            v-else-if="filteredWaitingMusics.length === 0"
            description="没有匹配的点歌"
            style="margin-top: 40px"
          />
          <div
            v-else
            vertical
            :size="0"
          >
            <template
              v-for="item in filteredWaitingMusics"
              :key="item.music.name"
            >
              <MusicRequestItem
                :music="item.music"
                :from-name="item.from?.name ?? '主播添加'"
                :index="musicRquestStore.waitingMusics.indexOf(item) + 1"
                @play="musicRquestStore.playMusic(item.music)"
                @cancel="musicRquestStore.cancelWaiting(item)"
                @block="blockMusic(item.music)"
              />
              <USeparator style="margin: 0" />
            </template>
          </div>
        </section>

        <section
          name="history"
          tab="历史记录"
        >
          <div
            v-if="musicRquestStore.history.length > 0"
            align="center"
            justify="space-between"
            wrap
            :size="10"
            style="margin-bottom: 10px"
          >
            <span
              depth="3"
              style="font-size: 12px"
            >
              本地记录最近 {{ musicRquestStore.history.length }} 条 (已播放 / 已取消)
            </span>
            <UPopover>
              <UButton
                size="sm"
                ghost
                color="error"
              >
                清空历史
              </UButton>
              <template #content="{ close }">
                <div class="space-y-3 p-3">
                  <div>确定清空点歌历史吗?</div>
                  <div class="flex justify-end gap-2">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="close"
                      >取消</UButton
                    >
                    <UButton
                      size="xs"
                      color="error"
                      @click="(close(), musicRquestStore.clearHistory)"
                      >确认</UButton
                    >
                  </div>
                </div>
              </template>
            </UPopover>
          </div>

          <UEmpty
            v-if="musicRquestStore.history.length === 0"
            description="暂无点歌历史"
            style="margin-top: 40px"
          />
          <div
            v-else
            vertical
            :size="0"
          >
            <template
              v-for="(entry, index) in musicRquestStore.history"
              :key="`${entry.time}-${index}`"
            >
              <div
                align="center"
                justify="space-between"
                :wrap="false"
                style="padding: 6px 4px"
              >
                <div
                  align="center"
                  :size="8"
                  :wrap="false"
                  style="min-width: 0"
                >
                  <UBadge
                    size="tiny"
                    :type="entry.status === 'played' ? 'success' : 'error'"
                    :bordered="false"
                  >
                    {{ entry.status === 'played' ? '已播放' : '已取消' }}
                  </UBadge>
                  <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
                    {{ entry.music.name }}
                  </span>
                  <span
                    depth="3"
                    style="font-size: 12px; white-space: nowrap"
                  >
                    {{ entry.music.author?.join('/') }}
                  </span>
                  <span
                    depth="2"
                    style="font-size: 12px; white-space: nowrap"
                  >
                    点歌人: {{ entry.from?.name ?? '主播添加' }}
                  </span>
                </div>
                <span
                  depth="3"
                  style="font-size: 12px; white-space: nowrap; flex-shrink: 0"
                >
                  {{ formatHistoryTime(entry.time) }}
                </span>
              </div>
              <USeparator style="margin: 0" />
            </template>
          </div>
        </section>

        <section
          name="list"
          tab="闲置歌单"
        >
          <div
            align="center"
            :wrap="true"
            :size="10"
            class="music-request__tab-actions"
          >
            <UPopover>
              <UButton
                color="error"
                variant="soft"
                size="sm"
                class="open-live-action-btn"
              >
                清空
              </UButton>
              <template #content="{ close }">
                <div class="space-y-3 p-3">
                  <div>确定清空吗?</div>
                  <div class="flex justify-end gap-2">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="close"
                      >取消</UButton
                    >
                    <UButton
                      size="xs"
                      color="error"
                      @click="(close(), clearMusic)"
                      >确认</UButton
                    >
                  </div>
                </div>
              </template>
            </UPopover>
            <UButton
              size="small"
              class="open-live-action-btn"
              @click="showNeteaseModal = true"
            >
              从网易云歌单导入
            </UButton>
          </div>

          <UEmpty v-if="musicRquestStore.originMusics.length === 0"> 暂无 </UEmpty>
          <div
            v-else
            class="music-request__list"
          >
            <div
              v-for="item in originMusics"
              :key="item.id"
              class="music-request__list-row"
            >
              <div
                align="center"
                justify="space-between"
                style="width: 100%"
                :wrap="true"
                :size="10"
              >
                <UPopover>
                  <UButton
                    color="error"
                    variant="soft"
                    size="xs"
                  >
                    删除
                  </UButton>
                  <template #content="{ close }">
                    <div class="space-y-3 p-3">
                      <div>确定删除?</div>
                      <div class="flex justify-end gap-2">
                        <UButton
                          size="xs"
                          color="neutral"
                          variant="ghost"
                          @click="close"
                          >取消</UButton
                        >
                        <UButton
                          size="xs"
                          color="error"
                          @click="(close(), delMusic(item))"
                          >确认</UButton
                        >
                      </div>
                    </div>
                  </template>
                </UPopover>

                <UButton
                  color="info"
                  variant="soft"
                  size="tiny"
                  @click="musicRquestStore.playMusic(item)"
                >
                  播放
                </UButton>
                <span> {{ item.name }} - {{ item.author?.join('/') }} </span>
              </div>
            </div>
          </div>
        </section>

        <section
          name="blacklist"
          tab="黑名单"
        >
          <ul
            size="small"
            bordered
          >
            <li
              v-for="item in settings.blacklist"
              :key="item"
            >
              <div
                align="center"
                style="width: 100%"
              >
                <UButton
                  color="error"
                  variant="soft"
                  size="small"
                  @click="settings.blacklist.splice(settings.blacklist.indexOf(item), 1)"
                >
                  删除
                </UButton>
                <span> {{ item }} </span>
              </div>
            </li>
          </ul>
        </section>

        <section
          name="settings"
          tab="设置"
        >
          <div
            vertical
            :size="12"
          >
            <div
              align="center"
              :wrap="true"
              :size="12"
            >
              <URadioGroup
                v-model="settings.platform"
                :items="[
                  { label: '网易云', value: 'netease' },
                  { label: '酷狗', value: 'kugou' },
                ]"
                orientation="horizontal"
              />
              <div class="music-request__field--prefix">
                <span> 点歌弹幕前缀 </span>
                <UInput
                  v-model="settings.orderPrefix"
                  size="small"
                />
              </div>
              <UCheckbox
                :model-value="settings.orderCooldown != null"
                @update:model-value="
                  (checked: boolean) => {
                    settings.orderCooldown = checked ? 300 : undefined
                  }
                "
              >
                是否启用点歌冷却
              </UCheckbox>
              <div
                v-if="settings.orderCooldown"
                class="music-request__field--cooldown"
              >
                <span> 冷却时间 (秒) </span>
                <UInputNumber
                  v-model="settings.orderCooldown"
                  size="small"
                  @update:value="
                    (value) => {
                      if (!value || value <= 0) settings.orderCooldown = undefined
                    }
                  "
                />
              </div>
            </div>
            <div
              :wrap="true"
              :size="12"
            >
              <UCheckbox v-model="settings.playMusicWhenFree"> 空闲时播放空闲歌单 </UCheckbox>
              <UCheckbox v-model="settings.orderMusicFirst"> 优先播放点歌 </UCheckbox>
            </div>
            <div
              align="center"
              :wrap="true"
              :size="12"
            >
              <UTooltip>
                <UButton
                  color="info"
                  variant="soft"
                  size="small"
                  @click="getOutputDevice"
                >
                  获取输出设备
                </UButton>
                <template #content> 获取和修改输出设备需要打开麦克风权限 </template>
              </UTooltip>
              <USelectMenu
                v-model="settings.deviceId"
                :items="deviceList"
                :fallback-option="() => ({ label: '未选择', value: '' })"
                class="music-request__field--device"
                size="small"
                @update:value="musicRquestStore.setSinkId"
                value-key="value"
              />
            </div>
          </div>
        </section>
      </div>
    </UCard>
  </OpenLivePageLayout>

  <UModal
    v-model:open="showNeteaseModal"
    preset="card"
    title="获取歌单"
    style="width: 720px; max-width: 90vw"
  >
    <UInput
      v-model="neteaseIdInput"
      clearable
      style="width: 100%"
      autosize
      :status="neteaseSongListId ? 'success' : 'error'"
      placeholder="直接输入歌单Id或者网页链接"
      size="small"
    >
      <template #trailing>
        <UBadge
          v-if="neteaseSongListId"
          type="success"
          size="small"
        >
          歌单Id: {{ neteaseSongListId }}
        </UBadge>
      </template>
    </UInput>
    <USeparator style="margin: 10px 0" />
    <UButton
      color="primary"
      :disabled="!neteaseSongListId"
      :loading="isLoading"
      size="small"
      @click="getNeteaseSongList"
    >
      获取
    </UButton>
    <template v-if="neteaseSongsOptions.length > 0">
      <USeparator style="margin: 10px 0" />
      <UCheckboxGroup
        v-model="selectedNeteaseSongs"
        :items="neteaseSongsOptions"
        style="max-height: 420px; overflow: auto"
      />
      <USeparator style="margin: 10px 0" />
      <UButton
        color="primary"
        :loading="isLoading"
        size="small"
        @click="addNeteaseSongs"
      >
        添加到歌单 | {{ selectedNeteaseSongs.length }} 首
      </UButton>
    </template>
  </UModal>
  <ObsConfigModal
    v-model:show="showOBSModal"
    v-model:speed="obsScrollSpeed"
    v-model:style-type="obsStyleType"
    obs-path="obs/music-request"
    :user-id="accountInfo?.id"
    description="将点歌队列显示在 OBS 中，并可切换不同视觉风格与滚动速度。"
  >
    <template #preview="{ styleType, speed }">
      <MusicRequestOBS
        :id="accountInfo?.id"
        :key="`${accountInfo?.id}-${styleType}-${speed}`"
        :style="styleType"
        :speed-multiplier="speed"
      />
    </template>
  </ObsConfigModal>
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

.aplayer-list {
  max-height: 300px;
  overflow-y: auto;
}
</style>
