<script setup lang="ts">
import {
  Add24Regular,
  ArrowDownload24Regular,
  ArrowUpload24Regular,
  CheckmarkCircle24Regular,
  Clock24Regular,
  Color24Regular,
  Copy24Regular,
  Delete24Regular,
  Desktop24Regular,
  DismissCircle24Regular,
  Eye24Regular,
  History24Regular,
  MusicNote224Filled,
  MusicNote224Regular,
  Play24Regular,
  Search24Regular,
  Settings24Regular,
  ShieldCheckmark24Regular,
  ShieldDismiss24Regular,
  Timer24Regular,
} from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NEmpty,
  NFlex,
  NGi,
  NGrid,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NList,
  NListItem,
  NModal,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NSelect,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { clearInterval, setInterval } from 'worker-timers'

import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import type { OpenLiveInfo, SongsInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import MusicRequestOBS from '@/apps/obs/pages/request/MusicRequestOBS.vue'
import MusicRequestItem from '@/apps/open-live/components/request/MusicRequestItem.vue'
import { CURRENT_HOST, MUSIC_REQUEST_API_URL, SONG_API_URL } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { usePersistedStorage } from '@/shared/storage/persist'
import { copyToClipboard } from '@/shared/utils'
import { formatListForCopy } from '@/shared/utils/queue'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import type { WaitMusicInfo } from '@/store/useMusicRequest'
import { useMusicRequestProvider } from '@/store/useMusicRequest'

const props = defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

const route = useRoute()
const message = useMessage()
const accountInfo = useAccount()
await useDanmakuClient().initOpenlive()

const musicRquestStore = useMusicRequestProvider()
const settings = computed(() => musicRquestStore.settings)
const cooldown = usePersistedStorage<{ [id: number]: number }>('Setting.MusicRequest.Cooldown', {})

// 主 Tab
const activeMainTab = ref<'queue' | 'songlist' | 'history' | 'blacklist' | 'preview' | 'settings'>('queue')

// OBS 调试与样式
const obsStyleType = ref<'glass' | 'transparent' | 'classic' | 'fresh' | 'minimal'>('glass')
const obsScrollSpeed = ref(1.0)
const previewBg = ref<'checker' | 'dark' | 'light' | 'game'>('checker')

// 计算 OBS 链接
const obsUrl = computed(() => {
  const params: Record<string, string> = {
    style: obsStyleType.value,
  }
  if (obsScrollSpeed.value !== 1.0) {
    params.speed = obsScrollSpeed.value.toString()
  }
  return buildObsSourceUrl({
    path: 'obs/music-request',
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: accountInfo.value?.id,
    params,
  })
})

const originMusics = computed(() => musicRquestStore.originMusics)
const isLoadingSongs = ref(false)

// 歌曲搜索过滤
const songListFilter = ref('')
const waitingFilter = ref('')

const filteredOriginMusics = computed(() => {
  const kw = songListFilter.value.trim().toLowerCase()
  if (!kw) return originMusics.value
  return originMusics.value.filter(
    (m) => m.name.toLowerCase().includes(kw) || m.author.some((a) => a.toLowerCase().includes(kw)),
  )
})

const filteredWaitingMusics = computed(() => {
  const kw = waitingFilter.value.trim().toLowerCase()
  if (!kw) return musicRquestStore.waitingMusics
  return musicRquestStore.waitingMusics.filter(
    (item) => item.music.name.toLowerCase().includes(kw) || item.from.name.toLowerCase().includes(kw),
  )
})

// 点歌冷却剩余
const cooldownNames = ref<Record<number, string>>({})
const nowTick = ref(Date.now())
let cooldownTimer: any = null

const activeCooldowns = computed(() => {
  const cd = settings.value.orderCooldown
  if (!cd) return []
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
    .filter((i) => i.remain > 0)
    .sort((a, b) => b.remain - a.remain)
})

function cleanCooldown(uid: number) {
  const next = { ...cooldown.value }
  delete next[uid]
  cooldown.value = next
  message.success('已解除该用户冷却')
}

function cleanAllCooldowns() {
  cooldown.value = {}
  message.success('已清空全部点歌冷却')
}

function copyWaitingList() {
  const text = formatListForCopy(musicRquestStore.waitingMusics, (item) => `${item.music.name} - ${item.from?.name}`)
  if (!text) {
    message.warning('当前待播点歌清单为空')
    return
  }
  copyToClipboard(text)
  message.success('待播点歌清单已复制到剪贴板')
}

function copySongList() {
  const text = formatListForCopy(originMusics.value, (m) => `${m.name} - ${m.author.join('/')}`)
  if (!text) {
    message.warning('当前曲库为空')
    return
  }
  copyToClipboard(text)
  message.success('曲库清单已复制到剪贴板')
}

async function copyObsLink() {
  if (!obsUrl.value) {
    message.warning('尚未登录或未生成有效链接')
    return
  }
  await copyToClipboard(obsUrl.value)
  message.success('点歌机 OBS 源链接已复制 (已携带当前样式参数)')
}

// 曲库数据加载与操作
async function fetchOriginMusics() {
  isLoadingSongs.value = true
  try {
    const res = await QueryGetAPI<SongsInfo[]>(`${MUSIC_REQUEST_API_URL}get`)
    if (res.code === 200 && res.data) {
      musicRquestStore.originMusics = res.data
    }
  } catch (err: any) {
    message.error(`拉取曲库失败: ${err.message || '网络错误'}`)
  } finally {
    isLoadingSongs.value = false
  }
}

async function delMusic(song: SongsInfo) {
  try {
    const res = await QueryPostAPI<number>(`${MUSIC_REQUEST_API_URL}del`, [song.key])
    if (res.code === 200) {
      message.success(`已删除歌曲: ${song.name}`)
      await fetchOriginMusics()
    } else {
      message.error(res.message || '删除失败')
    }
  } catch (err: any) {
    message.error(`删除失败: ${err.message || '网络错误'}`)
  }
}

async function clearOriginMusics() {
  try {
    const res = await QueryGetAPI(`${MUSIC_REQUEST_API_URL}clear`)
    if (res.code === 200) {
      message.success('已清空闲置歌单')
      musicRquestStore.originMusics = []
    } else {
      message.error(res.message || '清空失败')
    }
  } catch (err: any) {
    message.error(`清空失败: ${err.message || '网络错误'}`)
  }
}

// 从主播自己网站上的【我的歌单】一键导入
const isSyncingMySongList = ref(false)
async function syncFromMySongList() {
  isSyncingMySongList.value = true
  try {
    const res = await QueryGetAPI<SongsInfo[]>(`${SONG_API_URL}get`)
    if (res.code === 200 && res.data && res.data.length > 0) {
      const addRes = await QueryPostAPI(`${MUSIC_REQUEST_API_URL}add`, res.data)
      if (addRes.code === 200) {
        message.success(`已成功从我的歌单同步 ${res.data.length} 首歌曲`)
        await fetchOriginMusics()
      } else {
        message.error(addRes.message || '导入失败')
      }
    } else {
      message.warning('我的歌单中暂无歌曲可同步')
    }
  } catch (err: any) {
    message.error(`同步失败: ${err.message || '网络错误'}`)
  } finally {
    isSyncingMySongList.value = false
  }
}

// 网易云歌单导入弹窗
const showNeteaseModal = ref(false)
const neteaseIdInput = ref('')
const neteaseSongListId = computed(() => {
  const raw = neteaseIdInput.value.trim()
  const match = raw.match(/[?&]id=(\d+)/) || raw.match(/^(\d+)$/)
  return match ? match[1] : raw
})
const isNeteaseLoading = ref(false)
const neteaseSongs = ref<SongsInfo[]>([])
const selectedNeteaseKeys = ref<string[]>([])

async function loadNeteasePlaylist() {
  if (!neteaseSongListId.value) {
    message.warning('请输入有效的网易云歌单链接或 ID')
    return
  }
  isNeteaseLoading.value = true
  try {
    const res = await QueryGetAPI<SongsInfo[]>(`${SONG_API_URL}netease/playlist?id=${neteaseSongListId.value}`)
    if (res.code === 200 && res.data) {
      neteaseSongs.value = res.data
      selectedNeteaseKeys.value = res.data
        .filter((s) => !originMusics.value.some((exist) => exist.id === s.id))
        .map((s) => s.key)
      message.success(`成功解析 ${res.data.length} 首歌曲`)
    } else {
      message.error(res.message || '获取网易云歌单失败')
    }
  } catch (err: any) {
    message.error(`拉取失败: ${err.message || '网络错误'}`)
  } finally {
    isNeteaseLoading.value = false
  }
}

function selectAllNetease() {
  selectedNeteaseKeys.value = neteaseSongs.value.map((s) => s.key)
}

function deselectAllNetease() {
  selectedNeteaseKeys.value = []
}

async function confirmImportNetease() {
  const toImport = neteaseSongs.value.filter((s) => selectedNeteaseKeys.value.includes(s.key))
  if (toImport.length === 0) {
    message.warning('请至少选择一首歌曲')
    return
  }
  isNeteaseLoading.value = true
  try {
    const res = await QueryPostAPI(`${MUSIC_REQUEST_API_URL}add`, toImport)
    if (res.code === 200) {
      message.success(`已成功导入 ${toImport.length} 首歌曲到曲库`)
      showNeteaseModal.value = false
      neteaseIdInput.value = ''
      neteaseSongs.value = []
      await fetchOriginMusics()
    } else {
      message.error(res.message || '导入失败')
    }
  } catch (err: any) {
    message.error(`导入失败: ${err.message || '网络错误'}`)
  } finally {
    isNeteaseLoading.value = false
  }
}

// 黑名单管理
const newBlacklistKeyword = ref('')
function addBlacklist() {
  const kw = newBlacklistKeyword.value.trim()
  if (!kw) return
  if (!settings.value.blacklist) {
    settings.value.blacklist = []
  }
  if (!settings.value.blacklist.includes(kw)) {
    settings.value.blacklist.push(kw)
    message.success(`已添加黑名单关键词: ${kw}`)
  } else {
    message.warning('该关键词已在黑名单中')
  }
  newBlacklistKeyword.value = ''
}

function removeBlacklist(item: string) {
  settings.value.blacklist = settings.value.blacklist.filter((k) => k !== item)
  message.success(`已移除黑名单关键词: ${item}`)
}

// 格式化历史时间
function formatHistoryTime(timestamp: number) {
  const d = new Date(timestamp)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

onMounted(() => {
  fetchOriginMusics()
  cooldownTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
  }
})
</script>

<template>
  <div class="music-request-manage-view">
    <ManagePageHeader
      title="点歌机系统"
      subtitle="观众通过发送点歌弹幕指令点播歌单曲目，支持闲置曲库管理、多平台导入、点歌冷却与 1080P OBS 动态呈现"
      :links="[
        {
          label: 'OBS 浏览器源地址',
          value: obsUrl,
          description: '将此链接作为 OBS 浏览器源添加，建议分辨率 400x600 或按需调整',
        },
      ]"
    >
      <template #action>
        <NFlex align="center" :size="8">
          <NButton size="small" secondary @click="copyWaitingList">
            <template #icon><NIcon :component="Copy24Regular" /></template>
            复制点歌单
          </NButton>
          <NButton size="small" secondary @click="copySongList">
            <template #icon><NIcon :component="MusicNote224Regular" /></template>
            复制曲库
          </NButton>
        </NFlex>
      </template>
    </ManagePageHeader>

    <NTabs
      v-model:value="activeMainTab"
      type="segment"
      animated
      class="main-nav-tabs"
      style="margin-top: 14px"
    >
      <!-- ================= Tab 1: 待播点歌清单 ================= -->
      <NTabPane name="queue">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="MusicNote224Filled" />
            <span>待播点歌</span>
          </NFlex>
        </template>
        <NFlex vertical :size="14" style="margin-top: 14px">
          <NCard size="small">
            <NFlex justify="space-between" align="center" :wrap="true" :size="10">
              <NFlex align="center" :size="8">
                <NTag type="info" :bordered="false" round>
                  待播歌曲: {{ musicRquestStore.waitingMusics.length }} 首
                </NTag>
                <NTag v-if="activeCooldowns.length > 0" type="warning" :bordered="false" round>
                  冷却中观众: {{ activeCooldowns.length }} 人
                </NTag>
              </NFlex>

              <NFlex align="center" :size="8">
                <NInputGroup style="width: 240px">
                  <NInput
                    v-model:value="waitingFilter"
                    size="small"
                    placeholder="搜索歌名或点歌人"
                    clearable
                  >
                    <template #prefix><NIcon :component="Search24Regular" /></template>
                  </NInput>
                </NInputGroup>
                <NPopconfirm @positive-click="musicRquestStore.waitingMusics = []">
                  <template #trigger>
                    <NButton size="small" type="error" ghost> 清空待播 </NButton>
                  </template>
                  确定要清空全部当前待播歌曲吗？
                </NPopconfirm>
              </NFlex>
            </NFlex>
          </NCard>

          <!-- 列表卡片 -->
          <NCard size="small" :bordered="false">
            <div v-if="filteredWaitingMusics.length > 0" class="music-list-container">
              <div
                v-for="(info, index) in filteredWaitingMusics"
                :key="`${info.music.id}-${index}`"
                class="music-item-wrapper"
              >
                <MusicRequestItem
                  :music="info.music"
                  :from-name="info.from.name"
                  :index="index + 1"
                  @play="musicRquestStore.playMusic(info.music)"
                  @cancel="musicRquestStore.cancelWaiting(info)"
                  @block="musicRquestStore.cancelWaiting(info)"
                />
              </div>
            </div>
            <NEmpty
              v-else
              :description="waitingFilter ? '没有匹配的待播歌曲' : '当前暂无观众点歌，等待弹幕发送中...'"
              style="padding: 48px 0"
            />
          </NCard>
        </NFlex>
      </NTabPane>

      <!-- ================= Tab 2: 闲置曲库与导入 ================= -->
      <NTabPane name="songlist">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="MusicNote224Regular" />
            <span>歌曲列表 (曲库)</span>
          </NFlex>
        </template>
        <NFlex vertical :size="14" style="margin-top: 14px">
          <NCard size="small">
            <NFlex justify="space-between" align="center" :wrap="true" :size="10">
              <NFlex align="center" :size="8">
                <NTag type="primary" :bordered="false" round>
                  闲置曲库: {{ originMusics.length }} 首
                </NTag>
                <NText depth="3" style="font-size: 12px">
                  观众点歌可命中此曲库，空闲时亦可轮播
                </NText>
              </NFlex>

              <NFlex align="center" :size="8">
                <NInputGroup style="width: 220px">
                  <NInput
                    v-model:value="songListFilter"
                    size="small"
                    placeholder="搜索曲库歌名或歌手"
                    clearable
                  >
                    <template #prefix><NIcon :component="Search24Regular" /></template>
                  </NInput>
                </NInputGroup>

                <NButton size="small" type="primary" secondary @click="showNeteaseModal = true">
                  <template #icon><NIcon :component="ArrowDownload24Regular" /></template>
                  从网易云导入
                </NButton>

                <NButton
                  size="small"
                  secondary
                  :loading="isSyncingMySongList"
                  @click="syncFromMySongList"
                >
                  <template #icon><NIcon :component="ArrowUpload24Regular" /></template>
                  从我的歌单同步
                </NButton>

                <NPopconfirm @positive-click="clearOriginMusics">
                  <template #trigger>
                    <NButton size="small" type="error" ghost> 清空曲库 </NButton>
                  </template>
                  确定要清空闲置曲库中的全部歌曲吗？
                </NPopconfirm>
              </NFlex>
            </NFlex>
          </NCard>

          <NCard size="small">
            <NSpin :show="isLoadingSongs">
              <div v-if="filteredOriginMusics.length > 0" class="song-table-container">
                <NScrollbar style="max-height: 520px">
                  <NList size="small" hoverable>
                    <NListItem v-for="(song, idx) in filteredOriginMusics" :key="song.key || song.id">
                      <NFlex align="center" justify="space-between" :wrap="false" style="width: 100%">
                        <NFlex align="center" :size="12" style="min-width: 0">
                          <NTag size="small" round :bordered="false" style="font-family: monospace">
                            {{ idx + 1 }}
                          </NTag>
                          <NText strong style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
                            {{ song.name }}
                          </NText>
                          <NText depth="3" style="font-size: 12px; white-space: nowrap">
                            {{ song.author.join('/') }}
                          </NText>
                        </NFlex>

                        <NFlex align="center" :size="8" style="flex-shrink: 0">
                          <NButton
                            size="tiny"
                            quaternary
                            type="primary"
                            @click="musicRquestStore.playMusic(song)"
                          >
                            <template #icon><NIcon :component="Play24Regular" /></template>
                            试听/播放
                          </NButton>
                          <NPopconfirm @positive-click="delMusic(song)">
                            <template #trigger>
                              <NButton size="tiny" quaternary type="error">
                                <template #icon><NIcon :component="Delete24Regular" /></template>
                                删除
                              </NButton>
                            </template>
                            确认从曲库删除这首歌吗？
                          </NPopconfirm>
                        </NFlex>
                      </NFlex>
                    </NListItem>
                  </NList>
                </NScrollbar>
              </div>
              <NEmpty
                v-else
                :description="songListFilter ? '没有匹配的曲目' : '闲置曲库暂无歌曲，点击上方「从网易云导入」或「从我的歌单同步」'"
                style="padding: 48px 0"
              />
            </NSpin>
          </NCard>
        </NFlex>
      </NTabPane>

      <!-- ================= Tab 3: 点歌历史 ================= -->
      <NTabPane name="history">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="History24Regular" />
            <span>点歌历史</span>
          </NFlex>
        </template>
        <NFlex vertical :size="14" style="margin-top: 14px">
          <NCard size="small">
            <NFlex justify="space-between" align="center">
              <NText depth="3" style="font-size: 12px">
                本地最近记录 {{ musicRquestStore.history.length }} 条点歌流水 (最多保留 200 条)
              </NText>
              <NPopconfirm @positive-click="musicRquestStore.clearHistory">
                <template #trigger>
                  <NButton size="small" type="error" ghost> 清空历史 </NButton>
                </template>
                确定清空所有点歌历史吗？
              </NPopconfirm>
            </NFlex>
          </NCard>

          <NCard size="small">
            <NScrollbar v-if="musicRquestStore.history.length > 0" style="max-height: 520px">
              <NList size="small">
                <NListItem v-for="(entry, index) in musicRquestStore.history" :key="`${entry.time}-${index}`">
                  <NFlex align="center" justify="space-between" :wrap="false" style="padding: 4px 0">
                    <NFlex align="center" :size="10" style="min-width: 0">
                      <NTag
                        size="tiny"
                        :type="entry.status === 'played' ? 'success' : 'error'"
                        :bordered="false"
                      >
                        {{ entry.status === 'played' ? '已播放' : '已取消' }}
                      </NTag>
                      <NText strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
                        {{ entry.music.name }}
                      </NText>
                      <NText depth="3" style="font-size: 12px; white-space: nowrap">
                        {{ entry.music.author?.join('/') }}
                      </NText>
                      <NText depth="2" style="font-size: 12px; white-space: nowrap">
                        点歌人: {{ entry.from?.name ?? '主播' }}
                      </NText>
                    </NFlex>
                    <NText depth="3" style="font-size: 12px; white-space: nowrap; flex-shrink: 0">
                      {{ formatHistoryTime(entry.time) }}
                    </NText>
                  </NFlex>
                </NListItem>
              </NList>
            </NScrollbar>
            <NEmpty v-else description="暂无点歌历史记录" style="padding: 48px 0" />
          </NCard>
        </NFlex>
      </NTabPane>

      <!-- ================= Tab 4: 黑名单 ================= -->
      <NTabPane name="blacklist">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="ShieldDismiss24Regular" />
            <span>点歌黑名单</span>
          </NFlex>
        </template>
        <NFlex vertical :size="14" style="margin-top: 14px">
          <NCard size="small">
            <NFlex justify="space-between" align="center" :wrap="true" :size="10">
              <NText depth="3" style="font-size: 12px">
                观众点歌时若匹配到黑名单关键词或歌名，系统将自动拦截并提示
              </NText>
              <NInputGroup style="width: 280px">
                <NInput
                  v-model:value="newBlacklistKeyword"
                  size="small"
                  placeholder="输入违规词或禁点歌名"
                  @keyup.enter="addBlacklist"
                />
                <NButton size="small" type="primary" @click="addBlacklist">
                  <template #icon><NIcon :component="Add24Regular" /></template>
                  添加
                </NButton>
              </NInputGroup>
            </NFlex>
          </NCard>

          <NCard size="small">
            <div v-if="settings.blacklist && settings.blacklist.length > 0">
              <NFlex :size="8" wrap>
                <NTag
                  v-for="kw in settings.blacklist"
                  :key="kw"
                  closable
                  type="error"
                  @close="removeBlacklist(kw)"
                >
                  {{ kw }}
                </NTag>
              </NFlex>
            </div>
            <NEmpty v-else description="黑名单当前为空，尚未添加任何拦截词" style="padding: 48px 0" />
          </NCard>
        </NFlex>
      </NTabPane>

      <!-- ================= Tab 5: OBS 预览 ================= -->
      <NTabPane name="preview">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="Desktop24Regular" />
            <span>OBS 舞台预览</span>
          </NFlex>
        </template>
        <NFlex vertical :size="14" style="margin-top: 14px">
          <NCard size="small">
            <NFlex justify="space-between" align="center" :wrap="true" :size="10">
              <NFlex align="center" :size="12">
                <NText depth="3" style="font-size: 12px">OBS 样式:</NText>
                <NRadioGroup v-model:value="obsStyleType" size="small">
                  <NRadioButton value="glass">毛玻璃</NRadioButton>
                  <NRadioButton value="transparent">纯透明</NRadioButton>
                  <NRadioButton value="classic">经典质感</NRadioButton>
                  <NRadioButton value="fresh">清新粉蓝</NRadioButton>
                  <NRadioButton value="minimal">极简透字</NRadioButton>
                </NRadioGroup>
              </NFlex>

              <NFlex align="center" :size="8">
                <NText depth="3" style="font-size: 12px">背景底色:</NText>
                <NRadioGroup v-model:value="previewBg" size="small">
                  <NRadioButton value="checker">棋盘格</NRadioButton>
                  <NRadioButton value="dark">纯暗黑</NRadioButton>
                  <NRadioButton value="light">浅色</NRadioButton>
                  <NRadioButton value="game">模拟游戏</NRadioButton>
                </NRadioGroup>
                <NButton size="small" type="primary" secondary @click="copyObsLink">
                  <template #icon><NIcon :component="Copy24Regular" /></template>
                  复制 OBS 源链接
                </NButton>
              </NFlex>
            </NFlex>
          </NCard>

          <NCard size="small" :bordered="false" class="preview-stage-wrapper">
            <div class="preview-stage-container" :class="`preview-stage-container--${previewBg}`">
              <div class="preview-canvas-box">
                <MusicRequestOBS />
              </div>
            </div>
          </NCard>
        </NFlex>
      </NTabPane>

      <!-- ================= Tab 6: 点歌规则与高级设置 ================= -->
      <NTabPane name="settings">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="Settings24Regular" />
            <span>点歌规则与配置</span>
          </NFlex>
        </template>
        <NFlex vertical :size="14" style="margin-top: 14px">
          <NGrid :cols="2" :x-gap="14" :y-gap="14">
            <NGi>
              <NCard size="small" title="点歌弹幕规则">
                <NFlex vertical :size="12">
                  <NFlex align="center" :size="8">
                    <NText style="width: 90px; flex-shrink: 0">点歌弹幕前缀:</NText>
                    <NInput v-model:value="settings.orderPrefix" size="small" style="max-width: 180px" />
                    <NText depth="3" style="font-size: 12px">如: 点歌 晴天</NText>
                  </NFlex>

                  <NFlex align="center" :size="8">
                    <NText style="width: 90px; flex-shrink: 0">音乐搜索平台:</NText>
                    <NRadioGroup v-model:value="settings.platform" size="small">
                      <NRadioButton value="netease">网易云音乐</NRadioButton>
                      <NRadioButton value="kugou">酷狗音乐</NRadioButton>
                    </NRadioGroup>
                  </NFlex>

                  <NDivider style="margin: 6px 0" />

                  <NFlex vertical :size="6">
                    <NCheckbox v-model:checked="settings.orderMusicFirst">
                      优先播放点歌（新点歌立即插队或优先播完）
                    </NCheckbox>
                    <NCheckbox v-model:checked="settings.playMusicWhenFree">
                      空闲时自动播放闲置歌单
                    </NCheckbox>
                  </NFlex>
                </NFlex>
              </NCard>
            </NGi>

            <NGi>
              <NCard size="small" title="冷却时间与防刷限制">
                <NFlex vertical :size="12">
                  <NFlex align="center" :size="8">
                    <NText style="width: 90px; flex-shrink: 0">个人点歌冷却:</NText>
                    <NInputNumber
                      v-model:value="settings.orderCooldown"
                      size="small"
                      :min="0"
                      :max="3600"
                      style="max-width: 140px"
                    >
                      <template #suffix>秒</template>
                    </NInputNumber>
                    <NText depth="3" style="font-size: 12px">设为 0 则不限频</NText>
                  </NFlex>

                  <NDivider style="margin: 6px 0" />

                  <NFlex justify="space-between" align="center">
                    <NText depth="3" style="font-size: 12px">
                      当前冷却中观众 ({{ activeCooldowns.length }} 人)
                    </NText>
                    <NButton
                      size="tiny"
                      type="warning"
                      ghost
                      :disabled="activeCooldowns.length === 0"
                      @click="cleanAllCooldowns"
                    >
                      解除全部冷却
                    </NButton>
                  </NFlex>

                  <div v-if="activeCooldowns.length > 0" class="cooldown-tags-wrap">
                    <NTag
                      v-for="cd in activeCooldowns"
                      :key="cd.uid"
                      size="small"
                      closable
                      type="warning"
                      @close="cleanCooldown(cd.uid)"
                    >
                      {{ cd.name }} (剩 {{ cd.remain }}s)
                    </NTag>
                  </div>
                  <NText v-else depth="3" style="font-size: 12px">暂无处于冷却中的观众</NText>
                </NFlex>
              </NCard>
            </NGi>
          </NGrid>
        </NFlex>
      </NTabPane>
    </NTabs>

    <!-- ================= 网易云歌单导入弹窗 ================= -->
    <NModal
      v-model:show="showNeteaseModal"
      preset="card"
      title="从网易云歌单导入曲目到闲置歌单"
      style="width: 640px; max-width: 95vw"
    >
      <NFlex vertical :size="14">
        <NAlert type="info" :bordered="false">
          输入网易云音乐歌单链接（例如
          <code>https://music.163.com/playlist?id=123456</code>）或纯歌单 ID，点击解析后批量导入。
        </NAlert>

        <NInputGroup>
          <NInput
            v-model:value="neteaseIdInput"
            placeholder="粘贴网易云歌单链接或歌单 ID"
            clearable
            @keyup.enter="loadNeteasePlaylist"
          />
          <NButton type="primary" :loading="isNeteaseLoading" @click="loadNeteasePlaylist">
            解析歌单
          </NButton>
        </NInputGroup>

        <div v-if="neteaseSongs.length > 0" class="netease-result-list">
          <NFlex justify="space-between" align="center" style="margin-bottom: 8px">
            <NText depth="3" style="font-size: 12px">
              共解析出 {{ neteaseSongs.length }} 首，已勾选 {{ selectedNeteaseKeys.length }} 首
            </NText>
            <NFlex :size="8">
              <NButton size="tiny" quaternary @click="selectAllNetease"> 全选 </NButton>
              <NButton size="tiny" quaternary @click="deselectAllNetease"> 取消全选 </NButton>
            </NFlex>
          </NFlex>

          <NScrollbar style="max-height: 320px; border: 1px solid var(--vtsuru-border); border-radius: 6px; padding: 6px">
            <NFlex vertical :size="4">
              <NCheckbox
                v-for="song in neteaseSongs"
                :key="song.key"
                :value="song.key"
                :checked="selectedNeteaseKeys.includes(song.key)"
                @update:checked="(val: boolean) => {
                  if (val) {
                    selectedNeteaseKeys.push(song.key)
                  } else {
                    selectedNeteaseKeys = selectedNeteaseKeys.filter((k) => k !== song.key)
                  }
                }"
              >
                <NText strong style="font-size: 13px">{{ song.name }}</NText>
                <NText depth="3" style="font-size: 12px; margin-left: 6px">
                  - {{ song.author.join('/') }}
                </NText>
              </NCheckbox>
            </NFlex>
          </NScrollbar>
        </div>
      </NFlex>

      <template #footer>
        <NFlex justify="end" :size="10">
          <NButton @click="showNeteaseModal = false">取消</NButton>
          <NButton
            type="primary"
            :loading="isNeteaseLoading"
            :disabled="selectedNeteaseKeys.length === 0"
            @click="confirmImportNetease"
          >
            确认导入 ({{ selectedNeteaseKeys.length }} 首)
          </NButton>
        </NFlex>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.music-request-manage-view {
  width: 100%;
}

.main-nav-tabs :deep(.n-tabs-rail) {
  width: fit-content;
  max-width: 100%;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-muted);
}

.main-nav-tabs :deep(.n-tabs-tab) {
  --n-tab-padding: 6px 16px !important;
  white-space: nowrap;
  font-weight: 500;
}

.music-list-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.music-item-wrapper {
  transition: transform 0.15s ease;
}

.cooldown-tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
}

.preview-stage-wrapper {
  background: var(--vtsuru-bg-muted);
  border-radius: 8px;
  padding: 16px;
}

.preview-stage-container {
  min-height: 480px;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
}

.preview-stage-container--checker {
  background-image: linear-gradient(45deg, #1f232b 25%, transparent 25%),
    linear-gradient(-45deg, #1f232b 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1f232b 75%),
    linear-gradient(-45deg, transparent 75%, #1f232b 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  background-color: #14171d;
}

.preview-stage-container--dark {
  background: #090a0f;
}

.preview-stage-container--light {
  background: #f4f4f5;
}

.preview-stage-container--game {
  background: linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d);
}

.preview-canvas-box {
  width: 400px;
  max-width: 100%;
}
</style>
