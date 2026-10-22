<script setup lang="ts">
import {
  Add24Regular,
  ArrowDownload24Regular,
  ArrowUpload24Regular,
  Copy24Regular,
  Delete24Regular,
  Desktop24Regular,
  History24Regular,
  MusicNote224Filled,
  MusicNote224Regular,
  Play24Regular,
  Search24Regular,
  Settings24Regular,
  ShieldDismiss24Regular,
} from '@vicons/fluent'
import { useMessage } from '@/shared/utils'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { clearInterval, setInterval } from 'worker-timers'

import { useAccount } from '@/api/account'
import type { OpenLiveInfo, SongsInfo } from '@/api/api-models'
import {
  getApiMusicRequestGet,
  postApiMusicRequestAdd,
  postApiMusicRequestClear,
  postApiMusicRequestDelete,
} from '@/api/generated/music-request/music-request'
import { getApiSongListGet, getApiSongListGetNeteaseList } from '@/api/generated/song-list/song-list'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import MusicRequestOBS from '@/apps/obs/pages/request/MusicRequestOBS.vue'
import MusicRequestItem from '@/apps/open-live/components/request/MusicRequestItem.vue'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { usePersistedStorage } from '@/shared/storage/persist'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { copyToClipboard } from '@/shared/utils'
import { formatListForCopy } from '@/shared/utils/queue'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useMusicRequestProvider } from '@/store/useMusicRequest'

defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

const message = useMessage()
const accountInfo = useAccount()
await useDanmakuClient().initOpenlive()

const musicRequestStore = useMusicRequestProvider()
const settings = computed(() => musicRequestStore.settings)
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

const originMusics = computed(() => musicRequestStore.originMusics)
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
  if (!kw) return musicRequestStore.waitingMusics
  return musicRequestStore.waitingMusics.filter(
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
  const text = formatListForCopy(musicRequestStore.waitingMusics, (item) => `${item.music.name} - ${item.from?.name}`)
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
    const res = (await getApiMusicRequestGet()) as unknown as {
      code: number
      data?: SongsInfo[]
    }
    if (res.code === 200 && res.data) {
      musicRequestStore.originMusics = res.data
    }
  } catch (err: any) {
    message.error(`拉取曲库失败: ${err.message || '网络错误'}`)
  } finally {
    isLoadingSongs.value = false
  }
}

async function delMusic(song: SongsInfo) {
  try {
    const res = (await postApiMusicRequestDelete([song.key])) as unknown as {
      code: number
      message?: string
    }
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
    const res = await postApiMusicRequestClear()
    if (res.code === 200) {
      message.success('已清空闲置歌单')
      musicRequestStore.originMusics = []
    } else {
      message.error(res.message || '清空失败')
    }
  } catch (err: any) {
    message.error(`清空失败: ${err.message || '网络错误'}`)
  }
}

// 从我的歌单同步
const isSyncingMySongList = ref(false)
async function syncFromMySongList() {
  isSyncingMySongList.value = true
  try {
    const res = (await getApiSongListGet()) as unknown as {
      code: number
      data?: SongsInfo[]
    }
    if (res.code === 200 && res.data && res.data.length > 0) {
      const addRes = await postApiMusicRequestAdd(res.data as any)
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
    const res = await getApiSongListGetNeteaseList({ id: Number(neteaseSongListId.value) })
    if (res.code === 200 && res.data) {
      neteaseSongs.value = res.data as unknown as SongsInfo[]
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
    const res = await postApiMusicRequestAdd(toImport as any)
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
  <div class="space-y-4 w-full">
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
        <div class="flex items-center gap-2">
          <Button variant="outline" @click="copyWaitingList">
            <component
              :is="Copy24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            复制点歌单
          </Button>
          <Button variant="outline" @click="copySongList">
            <component
              :is="MusicNote224Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            复制曲库
          </Button>
        </div>
      </template>
    </ManagePageHeader>

    <Tabs
      v-model="activeMainTab"
      class="w-full"
    >
      <TabsList class="grid w-full grid-cols-6 max-w-2xl">
        <TabsTrigger
          value="queue"
          class="gap-1.5"
        >
          <component
            :is="MusicNote224Filled"
            class="h-3.5 w-3.5"
          />
          待播点歌
        </TabsTrigger>
        <TabsTrigger
          value="songlist"
          class="gap-1.5"
        >
          <component
            :is="MusicNote224Regular"
            class="h-3.5 w-3.5"
          />
          闲置曲库
        </TabsTrigger>
        <TabsTrigger
          value="history"
          class="gap-1.5"
        >
          <component
            :is="History24Regular"
            class="h-3.5 w-3.5"
          />
          点歌历史
        </TabsTrigger>
        <TabsTrigger
          value="blacklist"
          class="gap-1.5"
        >
          <component
            :is="ShieldDismiss24Regular"
            class="h-3.5 w-3.5"
          />
          黑名单
        </TabsTrigger>
        <TabsTrigger
          value="preview"
          class="gap-1.5"
        >
          <component
            :is="Desktop24Regular"
            class="h-3.5 w-3.5"
          />
          OBS 预览
        </TabsTrigger>
        <TabsTrigger
          value="settings"
          class="gap-1.5"
        >
          <component
            :is="Settings24Regular"
            class="h-3.5 w-3.5"
          />
          点歌规则
        </TabsTrigger>
      </TabsList>

      <!-- Tab 1: 待播点歌清单 -->
      <TabsContent
        value="queue"
        class="mt-3 space-y-3"
      >
        <Card>
          <CardContent class="p-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <Badge
                variant="brand"
                size="sm"
              >
                待播歌曲: {{ musicRequestStore.waitingMusics.length }} 首
              </Badge>
              <Badge
                v-if="activeCooldowns.length > 0"
                variant="warning"
                size="sm"
              >
                冷却中观众: {{ activeCooldowns.length }} 人
              </Badge>
            </div>

            <div class="flex items-center gap-2">
              <div class="relative w-56">
                <component
                  :is="Search24Regular"
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                />
                <Input v-model="waitingFilter" placeholder="搜索歌名或点歌人" class="pl-8" />
              </div>

              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button size="xs" variant="ghost" class="text-destructive hover:bg-destructive/10" :disabled="musicRequestStore.waitingMusics.length === 0">
                    清空待播
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent class="sm:max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>清空当前待播点歌？</AlertDialogTitle>
                    <AlertDialogDescription class="text-xs">
                      此操作将清空当前全部已排队点歌歌曲。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      @click="musicRequestStore.waitingMusics = []"
                    >
                      确认清空
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="p-3">
            <div
              v-if="filteredWaitingMusics.length > 0"
              class="space-y-2"
            >
              <MusicRequestItem
                v-for="(info, index) in filteredWaitingMusics"
                :key="`${info.music.id}-${index}`"
                :music="info.music"
                :from-name="info.from.name"
                :index="index + 1"
                @play="musicRequestStore.playMusic(info.music)"
                @cancel="musicRequestStore.cancelWaiting(info)"
                @block="musicRequestStore.cancelWaiting(info)"
              />
            </div>
            <div
              v-else
              class="text-center py-12 text-xs text-muted-foreground"
            >
              {{ waitingFilter ? '没有匹配的待播歌曲' : '当前暂无观众点歌，等待弹幕发送中...' }}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Tab 2: 闲置曲库 -->
      <TabsContent
        value="songlist"
        class="mt-3 space-y-3"
      >
        <Card>
          <CardContent class="p-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <Badge
                variant="brand"
                size="sm"
              >
                闲置曲库: {{ originMusics.length }} 首
              </Badge>
              <span class="text-xs text-muted-foreground hidden sm:inline">观众点歌可命中此曲库，空闲时亦可轮播</span>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <div class="relative w-48">
                <component
                  :is="Search24Regular"
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                />
                <Input v-model="songListFilter" placeholder="搜索曲库歌名或歌手" class="pl-8" />
              </div>

              <Button size="xs" variant="outline" @click="showNeteaseModal = true">
                <component
                  :is="ArrowDownload24Regular"
                  class="h-3.5 w-3.5 mr-1"
                />
                网易云导入
              </Button>

              <Button size="xs" variant="outline" :loading="isSyncingMySongList" @click="syncFromMySongList">
                <component
                  :is="ArrowUpload24Regular"
                  class="h-3.5 w-3.5 mr-1"
                />
                我的歌单同步
              </Button>

              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button size="xs" variant="ghost" class="text-destructive hover:bg-destructive/10" :disabled="originMusics.length === 0">
                    清空曲库
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent class="sm:max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>清空全部闲置曲库？</AlertDialogTitle>
                    <AlertDialogDescription class="text-xs">
                      此操作将从闲置曲库中删除全部已导入歌曲。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      @click="clearOriginMusics"
                    >
                      确认清空
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="p-3">
            <ScrollArea
              v-if="filteredOriginMusics.length > 0"
              class="h-[520px]"
            >
              <div class="divide-y divide-border">
                <div
                  v-for="(song, idx) in filteredOriginMusics"
                  :key="song.key || song.id"
                  class="flex items-center justify-between py-2 px-2.5 hover:bg-muted/40 rounded transition-colors text-xs"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="font-mono text-muted-foreground w-6 text-right shrink-0">{{ idx + 1 }}</span>
                    <span class="font-medium text-foreground truncate max-w-[240px] sm:max-w-md">{{ song.name }}</span>
                    <span class="text-muted-foreground truncate">{{ song.author.join('/') }}</span>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0">
                    <Button size="icon-xs" variant="ghost" class="text-primary hover:bg-primary/10" title="试听/播放" @click="musicRequestStore.playMusic(song)">
                      <component
                        :is="Play24Regular"
                        class="h-3.5 w-3.5"
                      />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger as-child>
                        <Button size="icon-xs" variant="ghost" class="text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="删除">
                          <component
                            :is="Delete24Regular"
                            class="h-3.5 w-3.5"
                          />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent class="sm:max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle>删除歌曲？</AlertDialogTitle>
                          <AlertDialogDescription class="text-xs">
                            确定从曲库中删除《{{ song.name }}》吗？
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            @click="delMusic(song)"
                          >
                            确认删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <div
              v-else
              class="text-center py-12 text-xs text-muted-foreground"
            >
              {{ songListFilter ? '没有匹配的曲目' : '闲置曲库暂无歌曲，点击上方「网易云导入」或「我的歌单同步」' }}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Tab 3: 点歌历史 -->
      <TabsContent
        value="history"
        class="mt-3 space-y-3"
      >
        <Card>
          <CardContent class="p-3 flex items-center justify-between">
            <span class="text-xs text-muted-foreground">本地记录最近 {{ musicRequestStore.history.length }} 条点歌流水 (最多保留 200 条)</span>
            <AlertDialog>
              <AlertDialogTrigger as-child>
                <Button size="xs" variant="ghost" class="text-destructive hover:bg-destructive/10" :disabled="musicRequestStore.history.length === 0">
                  清空历史
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent class="sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>清空点歌历史？</AlertDialogTitle>
                  <AlertDialogDescription class="text-xs">
                    此操作将抹去本地点歌历史流水。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    @click="musicRequestStore.clearHistory"
                  >
                    确认清空
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="p-3">
            <ScrollArea
              v-if="musicRequestStore.history.length > 0"
              class="h-[520px]"
            >
              <div class="divide-y divide-border">
                <div
                  v-for="(entry, index) in musicRequestStore.history"
                  :key="`${entry.time}-${index}`"
                  class="flex items-center justify-between py-2 px-2 text-xs"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <Badge
                      :variant="entry.status === 'played' ? 'success' : 'destructive'"
                      class="text-[10px] px-1.5 py-0 h-4"
                    >
                      {{ entry.status === 'played' ? '已播' : '已取消' }}
                    </Badge>
                    <span class="font-medium text-foreground truncate max-w-[200px]">{{ entry.music.name }}</span>
                    <span class="text-muted-foreground truncate">{{ entry.music.author?.join('/') }}</span>
                    <span class="text-muted-foreground/80 shrink-0">点歌人: <span class="text-foreground">{{ entry.from?.name ?? '主播' }}</span></span>
                  </div>

                  <span class="font-mono text-muted-foreground text-[11px] shrink-0">{{ formatHistoryTime(entry.time) }}</span>
                </div>
              </div>
            </ScrollArea>
            <div
              v-else
              class="text-center py-12 text-xs text-muted-foreground"
            >
              暂无点歌历史记录
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Tab 4: 黑名单 -->
      <TabsContent
        value="blacklist"
        class="mt-3 space-y-3"
      >
        <Card>
          <CardContent class="p-3.5 flex items-center justify-between gap-3 flex-wrap">
            <span class="text-xs text-muted-foreground">观众点歌时若匹配到黑名单关键词或歌名，系统将自动拦截并提示</span>
            <div class="flex items-center gap-2 w-72">
              <Input v-model="newBlacklistKeyword" placeholder="输入违规词或禁点歌名" @keyup.enter="addBlacklist" />
              <Button size="xs" variant="brand" @click="addBlacklist">
                <component
                  :is="Add24Regular"
                  class="h-3.5 w-3.5 mr-1"
                />
                添加
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="p-4">
            <div
              v-if="settings.blacklist && settings.blacklist.length > 0"
              class="flex flex-wrap gap-2"
            >
              <Badge
                v-for="kw in settings.blacklist"
                :key="kw"
                variant="destructive"
                class="text-xs gap-1 py-1 px-2.5"
              >
                {{ kw }}
                <button
                  type="button"
                  class="hover:opacity-75 cursor-pointer ml-1 font-bold"
                  @click="removeBlacklist(kw)"
                >
                  &times;
                </button>
              </Badge>
            </div>
            <div
              v-else
              class="text-center py-12 text-xs text-muted-foreground"
            >
              黑名单当前为空，尚未添加任何拦截词
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Tab 5: OBS 预览 -->
      <TabsContent
        value="preview"
        class="mt-3 space-y-3"
      >
        <Card>
          <CardContent class="p-3 flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs text-muted-foreground">OBS 样式:</span>
              <ToggleGroup v-model="obsStyleType" type="single" size="xs">
                <ToggleGroupItem value="glass">毛玻璃</ToggleGroupItem>
                <ToggleGroupItem value="transparent">纯透明</ToggleGroupItem>
                <ToggleGroupItem value="classic">经典质感</ToggleGroupItem>
                <ToggleGroupItem value="fresh">清新粉蓝</ToggleGroupItem>
                <ToggleGroupItem value="minimal">极简透字</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs text-muted-foreground">背景底色:</span>
              <ToggleGroup v-model="previewBg" type="single" size="xs">
                <ToggleGroupItem value="checker">棋盘格</ToggleGroupItem>
                <ToggleGroupItem value="dark">纯暗黑</ToggleGroupItem>
                <ToggleGroupItem value="light">浅色</ToggleGroupItem>
                <ToggleGroupItem value="game">模拟游戏</ToggleGroupItem>
              </ToggleGroup>

              <Button size="xs" variant="brand" @click="copyObsLink">
                <component
                  :is="Copy24Regular"
                  class="h-3.5 w-3.5 mr-1"
                />
                复制 OBS 源链接
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card class="overflow-hidden">
          <div
            class="p-6 flex items-center justify-center min-h-[460px] transition-colors"
            :class="{
              'bg-[#121214]': previewBg === 'dark',
              'bg-[#f4f4f5]': previewBg === 'light',
              'bg-[#0b132b]': previewBg === 'game',
              'bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]': previewBg === 'checker',
            }"
          >
            <div class="w-[380px] max-w-full">
              <MusicRequestOBS />
            </div>
          </div>
        </Card>
      </TabsContent>

      <!-- Tab 6: 点歌规则配置 -->
      <TabsContent
        value="settings"
        class="mt-3"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- 点歌弹幕规则 -->
          <Card>
            <CardHeader class="p-3.5 pb-2">
              <CardTitle class="text-xs font-semibold uppercase tracking-wide">
                点歌弹幕规则
              </CardTitle>
            </CardHeader>
            <CardContent class="p-3.5 space-y-3.5">
              <div class="flex items-center justify-between gap-3">
                <span class="text-xs font-medium text-foreground">点歌弹幕前缀</span>
                <div class="flex items-center gap-2">
                  <Input v-model="settings.orderPrefix" placeholder="如: 点歌" class="w-32 font-mono" />
                  <span class="text-xs text-muted-foreground">如: 点歌 晴天</span>
                </div>
              </div>

              <div class="flex items-center justify-between gap-3">
                <span class="text-xs font-medium text-foreground">音乐搜索平台</span>
                <ToggleGroup v-model="settings.platform" type="single" size="xs">
                  <ToggleGroupItem value="netease">网易云音乐</ToggleGroupItem>
                  <ToggleGroupItem value="kugou">酷狗音乐</ToggleGroupItem>
                </ToggleGroup>
              </div>

              <Separator />

              <div class="space-y-2.5">
                <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
                  <Checkbox v-model="settings.orderMusicFirst" />
                  <span>优先播放点歌（新点歌立即插队或优先播完）</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
                  <Checkbox v-model="settings.playMusicWhenFree" />
                  <span>空闲时自动播放闲置歌单</span>
                </label>
              </div>
            </CardContent>
          </Card>

          <!-- 冷却时间与防刷限制 -->
          <Card>
            <CardHeader class="p-3.5 pb-2">
              <CardTitle class="text-xs font-semibold uppercase tracking-wide">
                冷却时间与防刷限制
              </CardTitle>
            </CardHeader>
            <CardContent class="p-3.5 space-y-3.5">
              <div class="flex items-center justify-between gap-3">
                <span class="text-xs font-medium text-foreground">个人点歌冷却</span>
                <div class="flex items-center gap-2">
                  <Input v-model.number="settings.orderCooldown" type="number" min="0" max="3600" class="w-24 font-mono" />
                  <span class="text-xs text-muted-foreground">秒 (设为 0 不限频)</span>
                </div>
              </div>

              <Separator />

              <div class="flex items-center justify-between">
                <span class="text-xs text-muted-foreground">当前冷却中观众 ({{ activeCooldowns.length }} 人)</span>
                <Button size="xs" variant="ghost" class="text-amber-500 hover:bg-amber-500/10" :disabled="activeCooldowns.length === 0" @click="cleanAllCooldowns">
                  解除全部冷却
                </Button>
              </div>

              <div
                v-if="activeCooldowns.length > 0"
                class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto"
              >
                <Badge
                  v-for="cd in activeCooldowns"
                  :key="cd.uid"
                  variant="warning"
                  class="text-[11px] gap-1"
                >
                  {{ cd.name }} (剩 {{ cd.remain }}s)
                  <button
                    type="button"
                    class="hover:opacity-75 cursor-pointer ml-1 font-bold"
                    @click="cleanCooldown(cd.uid)"
                  >
                    &times;
                  </button>
                </Badge>
              </div>
              <div
                v-else
                class="text-xs text-muted-foreground py-2"
              >
                暂无处于冷却中的观众
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>

    <!-- 网易云歌单导入弹窗 -->
    <Dialog v-model:open="showNeteaseModal">
      <DialogContent class="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle class="text-base">
            从网易云歌单导入曲目到闲置歌单
          </DialogTitle>
          <DialogDescription class="text-xs">
            粘贴网易云音乐歌单链接（例如 <code>https://music.163.com/playlist?id=123456</code>）或纯歌单 ID，点击解析后批量导入。
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <div class="flex gap-2">
            <Input v-model="neteaseIdInput" placeholder="粘贴网易云歌单链接或歌单 ID" class="flex-1" @keyup.enter="loadNeteasePlaylist" />
            <Button variant="brand" :loading="isNeteaseLoading" @click="loadNeteasePlaylist">
              解析歌单
            </Button>
          </div>

          <div
            v-if="neteaseSongs.length > 0"
            class="space-y-2 border border-border rounded-lg p-3 bg-muted/20"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted-foreground">共解析出 {{ neteaseSongs.length }} 首，已勾选 {{ selectedNeteaseKeys.length }} 首</span>
              <div class="flex items-center gap-2">
                <Button size="xs" variant="ghost" @click="selectAllNetease">
                  全选
                </Button>
                <Button size="xs" variant="ghost" @click="deselectAllNetease">
                  取消全选
                </Button>
              </div>
            </div>

            <ScrollArea class="h-64 rounded border border-border p-2 bg-background">
              <div class="space-y-1.5">
                <label
                  v-for="song in neteaseSongs"
                  :key="song.key"
                  class="flex items-center gap-2 p-1.5 hover:bg-muted/40 rounded cursor-pointer text-xs select-none"
                >
                  <Checkbox
                    :model-value="selectedNeteaseKeys.includes(song.key)"
                    @update:model-value="(val) => {
                      if (val) {
                        selectedNeteaseKeys.push(song.key)
                      } else {
                        selectedNeteaseKeys = selectedNeteaseKeys.filter((k) => k !== song.key)
                      }
                    }"
                  />
                  <span class="font-medium text-foreground truncate">{{ song.name }}</span>
                  <span class="text-muted-foreground truncate">- {{ song.author.join('/') }}</span>
                </label>
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showNeteaseModal = false">
            取消
          </Button>
          <Button variant="brand" :loading="isNeteaseLoading" :disabled="selectedNeteaseKeys.length === 0" @click="confirmImportNetease">
            确认导入 ({{ selectedNeteaseKeys.length }} 首)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
