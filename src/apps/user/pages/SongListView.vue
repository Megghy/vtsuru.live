<script lang="ts" setup>
import { addSeconds } from 'date-fns'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { DownloadConfig, useAccount } from '@/api/account'
import type { SongRequestInfo } from '@/api/client-types'
import {
  getApiLiveRequestGetActiveAndSettings,
  postApiLiveRequestAddFromWeb,
  postApiLiveRequestPriorityFromWeb,
} from '@/api/generated/live-request/live-request'
import type { ResponseSongModel, ResponseUserInfo, SettingSongRequest } from '@/api/generated/model'
import { SongRequestStatus } from '@/api/generated/model'
import { getApiSongListGet } from '@/api/generated/song-list/song-list'
import DynamicForm from '@/apps/manage/components/DynamicForm.vue'
import type { BiliProfile } from '@/apps/user-page/types'
import { SongListTemplateMap } from '@/shared/config/templates'
import { usePersistedStorage } from '@/shared/storage/persist'
import type { ConfigItemDefinition } from '@/shared/types/VTsuruConfigTypes'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Spin } from '@/shared/ui/spin'
import { useMessage } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

import { canRequestSong } from './songListTemplate/utils/songRequestUtils'

import './songListTemplate/songListTheme.css'

// 组件属性
const props = defineProps<{
  biliInfo: BiliProfile | undefined
  userInfo: ResponseUserInfo | undefined // 用户信息
  template?: string | undefined // 模板名称
  fakeData?: ResponseSongModel[] // 测试数据
}>()
// 用户账号信息
const accountInfo = useAccount()
// 下次点歌时间
const nextRequestTime = usePersistedStorage('SongList.NextRequestTime', new Date())
// 点歌冷却时间(秒)
const minRequestTime = 30
// 设置弹窗显示状态
const showSettingModal = ref(false)

// 计算当前使用的模板类型
const componentType = computed(() => {
  return props.template ?? props.userInfo?.extra?.templateTypes.songlist?.toLowerCase()
})

// 数据状态
const currentData = ref<ResponseSongModel[]>([]) // 歌单数据
const dynamicConfigRef = ref() // 动态配置引用
const songsActive = ref<SongRequestInfo[]>([]) // 当前点歌列表
const settings = ref<SettingSongRequest>({
  // 点歌设置
  allowFromWeb: false,
  allowAnonymousFromWeb: false,
  orderPrefix: '',
} as SettingSongRequest)

// 加载状态
const isDataLoading = ref(true)
const isConfigLoading = ref(true)
const isLoading = computed(() => isDataLoading.value || isConfigLoading.value)

// 计算属性
const selectedTemplateConfig = computed(() => {
  if (dynamicConfigRef.value?.Config) {
    return dynamicConfigRef.value?.Config as ConfigItemDefinition[]
  }
  return undefined
})

const selectedTemplate = computed(() => {
  const type = componentType.value
  if (type && SongListTemplateMap[type]) return SongListTemplateMap[type]
  return SongListTemplateMap.traditional
})

const currentConfig = ref({}) // 当前配置
const message = useMessage() // 消息提示
const biliAuth = useBiliAuth() // B站授权
const isLoggedIn = computed(() => !!accountInfo.value.id)

const userPoints = ref<number | null>(null)
const pendingSong = ref<ResponseSongModel | null>(null)
const usePriorityOnRequest = ref(false)
const isSubmittingRequest = ref(false)
const prioritizingId = ref<number | null>(null)

const hasPointFeatures = computed(
  () =>
    Boolean(settings.value.allowFromWeb) &&
    ((Boolean(settings.value.enablePointRequest) && (settings.value.pointRequestCost ?? 0) > 0) ||
      Boolean(settings.value.allowPointPriority)),
)

const basePointCost = computed(() =>
  settings.value.enablePointRequest ? Math.max(0, settings.value.pointRequestCost ?? 0) : 0,
)

const priorityPointCost = computed(() =>
  settings.value.allowPointPriority ? Math.max(0, settings.value.pointPriorityCost ?? 0) : 0,
)

const totalPendingPointCost = computed(
  () => basePointCost.value + (usePriorityOnRequest.value ? priorityPointCost.value : 0),
)

const myWaitingSongs = computed(() => {
  const uid = biliAuth.biliAuth?.userId
  if (!uid) return []
  return songsActive.value.filter(
    (item) => item.status === SongRequestStatus.Waiting && item.user?.uid && item.user.uid === uid,
  )
})

async function refreshUserPoints() {
  if (!props.userInfo?.id || !biliAuth.isAuthed) {
    userPoints.value = null
    return
  }
  const pts = await biliAuth.GetSpecificPoint(props.userInfo.id)
  userPoints.value = typeof pts === 'number' ? pts : null
}

/**
 * 获取点歌设置和当前点歌列表
 */
async function getSongRequestInfo() {
  if (!props.userInfo?.id) return { songs: [], setting: settings.value }

  try {
    const data = (await getApiLiveRequestGetActiveAndSettings({
      id: props.userInfo.id,
    })) as unknown as {
      code: number
      data: { songs: SongRequestInfo[]; setting: SettingSongRequest }
      message?: string
    }

    if (data.code === 200) {
      return data.data
    } else {
      message.warning(`获取点歌设置失败: ${data.message}`)
    }
  } catch (err) {
    console.error('获取点歌设置出错:', err)
    message.error(`获取点歌设置出错: ${err instanceof Error ? err.message : String(err)}`)
  }

  return { songs: [], setting: settings.value }
}

/**
 * 获取歌单数据
 */
async function getSongs() {
  if (!props.userInfo?.id) {
    isDataLoading.value = false
    return
  }

  isDataLoading.value = true

  try {
    const data = (await getApiSongListGet({
      id: String(props.userInfo.id),
    })) as unknown as {
      code: number
      data: ResponseSongModel[]
      message?: string
    }

    if (data.code === 200) {
      currentData.value = data.data || []
    } else {
      message.error(`加载歌单失败: ${data.message}`)
    }
  } catch (err) {
    console.error('加载歌单出错:', err)
    message.error(`加载歌单失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isDataLoading.value = false
  }
}

/**
 * 获取模板配置
 */
async function getConfig() {
  if (!selectedTemplate.value?.settingName) {
    isConfigLoading.value = false
    return
  }

  isConfigLoading.value = true

  try {
    const data = await DownloadConfig(selectedTemplate.value.settingName, props.userInfo?.id)

    if (data.msg) {
      currentConfig.value = dynamicConfigRef.value?.DefaultConfig ?? {}
    } else {
      currentConfig.value = data.data || {}
    }
  } catch (err) {
    console.error('加载配置出错:', err)
    message.error(`加载配置失败: ${err instanceof Error ? err.message : String(err)}`)
    currentConfig.value = dynamicConfigRef.value?.DefaultConfig ?? {}
  } finally {
    isConfigLoading.value = false
  }
}

/**
 * 复制文本到剪贴板
 */
function copyToClipboard(text: string, sendMessage: boolean = true) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      if (sendMessage) {
        message.success('复制成功')
      }
    })
    .catch((err) => {
      console.error('复制失败:', err)
      message.error('复制失败，请重试')
    })
}

/**
 * 点歌处理
 */
async function requestSong(song: ResponseSongModel) {
  const orderText = `${settings.value.orderPrefix || ''} ${song.name}`
  const check = canRequestSong(
    song,
    props.userInfo,
    settings.value,
    isLoggedIn.value,
    biliAuth.isAuthed,
    nextRequestTime.value,
  )

  if (check.shouldCopyOnly) {
    copyToClipboard(orderText, false)
    message.info(check.reason)
    return
  }

  if (!check.canRequest) {
    message.warning(check.reason)
    return
  }

  if (basePointCost.value > 0 || settings.value.allowPointPriority) {
    pendingSong.value = song
    usePriorityOnRequest.value = false
    void refreshUserPoints()
    return
  }

  await submitWebSongRequest(song, false)
}

async function submitWebSongRequest(song: ResponseSongModel, usePriority: boolean) {
  if (!props.userInfo?.id) return
  const needPoints = basePointCost.value + (usePriority ? priorityPointCost.value : 0)
  if (needPoints > 0 && !biliAuth.isAuthed) {
    message.warning('使用积分点歌或插队需要先绑定 B 站账号')
    return
  }

  isSubmittingRequest.value = true
  try {
    const params = {
      target: props.userInfo.id,
      song: song.key,
      usePriority,
    }
    const data = (await postApiLiveRequestAddFromWeb(
      params,
      biliAuth.isAuthed ? { headers: Object.fromEntries(await biliAuth.getBiliAuthHeaders()) } : undefined,
    )) as unknown as {
      code: number
      message?: string
    }

    if (data.code === 200) {
      message.success(usePriority ? '积分点歌并插队成功' : '点歌成功')
      pendingSong.value = null
      nextRequestTime.value = addSeconds(new Date(), minRequestTime)
      const songRequestInfo = await getSongRequestInfo()
      if (songRequestInfo) {
        songsActive.value = songRequestInfo.songs
      }
      await refreshUserPoints()
    } else {
      message.error(`点歌失败: ${data.message}`)
    }
  } catch (err) {
    console.error('点歌出错:', err)
    message.error(`点歌失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isSubmittingRequest.value = false
  }
}

async function priorityExistingSong(item: SongRequestInfo) {
  if (!props.userInfo?.id) return
  if (!biliAuth.isAuthed) {
    message.warning('积分插队需要先绑定 B 站账号')
    return
  }
  prioritizingId.value = item.id
  try {
    const data = (await postApiLiveRequestPriorityFromWeb(
      { target: props.userInfo.id, id: item.id },
      { headers: Object.fromEntries(await biliAuth.getBiliAuthHeaders()) },
    )) as unknown as { code: number; message?: string }
    if (data.code === 200) {
      message.success(`已为《${item.songName}》使用积分插队`)
      const songRequestInfo = await getSongRequestInfo()
      if (songRequestInfo) {
        songsActive.value = songRequestInfo.songs
      }
      await refreshUserPoints()
    } else {
      message.error(`插队失败: ${data.message}`)
    }
  } catch (err) {
    message.error(`插队失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    prioritizingId.value = null
  }
}

// 监听动态配置变化，重新获取配置
watch(
  () => dynamicConfigRef.value,
  (newValue) => {
    if (newValue?.Config) {
      getConfig()
    }
  },
  { immediate: false },
)

// 监听用户ID或B站认证变化，重新加载数据
watch(
  () => [props.userInfo?.id, biliAuth.isAuthed] as const,
  () => {
    if (!props.fakeData) {
      getSongs()
      getSongRequestInfo().then((info) => {
        if (info) {
          songsActive.value = info.songs || []
          settings.value = info.setting || settings.value
        }
      })
      void refreshUserPoints()
    }
  },
)

// 组件挂载时初始化
onMounted(async () => {
  if (!props.fakeData) {
    try {
      // 并行加载歌单和点歌设置
      await Promise.all([
        getSongs(),
        getSongRequestInfo().then((info) => {
          if (info) {
            songsActive.value = info.songs || []
            settings.value = info.setting || settings.value
          }
        }),
        refreshUserPoints(),
      ])
    } catch (err) {
      console.error('初始化失败:', err)
      message.error(`初始化失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      isDataLoading.value = false
    }
  } else {
    // 测试模式使用假数据
    currentData.value = props.fakeData || []
    isDataLoading.value = false
  }

  if (!selectedTemplate.value?.settingName) {
    isConfigLoading.value = false
  }
})
</script>

<template>
  <div class="song-list-surface relative">
    <!-- 积分点歌与插队状态栏 -->
    <div
      v-if="hasPointFeatures"
      class="max-w-[var(--vtsuru-page-max-width,1180px)] mx-auto px-[clamp(12px,2vw,24px)] pt-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card/80 px-3 py-2 text-xs">
        <div class="flex flex-wrap items-center gap-2">
          <Badge
            v-if="basePointCost > 0"
            variant="secondary"
          >
            网页点歌 {{ basePointCost }} 积分
          </Badge>
          <Badge
            v-if="settings.allowPointPriority"
            variant="outline"
          >
            积分插队 {{ priorityPointCost }} 积分
          </Badge>
          <span
            v-if="biliAuth.isAuthed"
            class="text-muted-foreground"
          >
            我的积分:
            <strong class="text-foreground font-mono">{{ userPoints ?? '...' }}</strong>
          </span>
          <RouterLink
            v-else
            to="/bili-auth"
            class="text-primary underline underline-offset-2"
          >
            绑定 B 站账号以查询并使用积分
          </RouterLink>
        </div>

        <div
          v-if="settings.allowPointPriority && myWaitingSongs.length > 0"
          class="flex flex-wrap items-center gap-1.5"
        >
          <span class="text-muted-foreground">我的排队:</span>
          <Button
            v-for="item in myWaitingSongs"
            :key="item.id"
            size="xs"
            variant="outline"
            :loading="prioritizingId === item.id"
            @click="priorityExistingSong(item)"
          >
            《{{ item.songName }}》插队 ({{ priorityPointCost }} 积分)
          </Button>
        </div>
      </div>
    </div>

    <!-- 加载中显示加载动画 -->
    <Spin :show="isLoading">
      <component
        :is="selectedTemplate?.component"
        ref="dynamicConfigRef"
        :config="selectedTemplate?.settingName ? currentConfig : undefined"
        :user-info="userInfo"
        :bili-info="biliInfo"
        :data="currentData"
        :live-request-settings="settings"
        :live-request-active="songsActive"
        v-bind="$attrs"
        @request-song="requestSong"
      />
    </Spin>

    <!-- 主播自定义按钮 -->
    <Button
      v-if="selectedTemplate?.settingName && userInfo?.id === accountInfo.id"
      variant="outline"
      class="absolute right-8 top-5 z-[1000]"
      @click="showSettingModal = true"
    >
      自定义
    </Button>

    <!-- 设置弹窗 -->
    <Dialog v-model:open="showSettingModal">
      <DialogContent class="max-w-[90vw] sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <DynamicForm
          :key="selectedTemplate?.settingName"
          :name="selectedTemplate?.settingName"
          :config-data="currentConfig"
          :config="selectedTemplateConfig"
        />
      </DialogContent>
    </Dialog>

    <!-- 积分点歌/插队确认弹窗 -->
    <Dialog
      :open="Boolean(pendingSong)"
      @update:open="(v) => !v && (pendingSong = null)"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>确认在线点歌</DialogTitle>
          <DialogDescription>
            即将点播歌曲《{{ pendingSong?.name }}》
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 text-xs">
          <div class="flex-between rounded-md border bg-muted/40 px-3 py-2">
            <span class="text-muted-foreground">基础点歌消耗</span>
            <span class="font-medium font-mono">
              {{ basePointCost > 0 ? `${basePointCost} 积分` : '免费' }}
            </span>
          </div>

          <label
            v-if="settings.allowPointPriority"
            class="flex-between rounded-md border px-3 py-2 cursor-pointer"
          >
            <span class="flex items-center gap-2">
              <Checkbox v-model:checked="usePriorityOnRequest" />
              <span>同时使用积分插队（置顶排在普通队伍前）</span>
            </span>
            <span class="font-medium font-mono">+{{ priorityPointCost }} 积分</span>
          </label>

          <div class="flex-between px-1 pt-1 border-t">
            <span class="text-muted-foreground">
              合计消耗：<strong class="text-foreground font-mono">{{ totalPendingPointCost }} 积分</strong>
            </span>
            <span
              v-if="biliAuth.isAuthed"
              class="text-muted-foreground"
            >
              当前余额：<strong class="text-foreground font-mono">{{ userPoints ?? '...' }}</strong>
            </span>
            <span
              v-else-if="totalPendingPointCost > 0"
              class="text-destructive"
            >
              需先绑定 B 站账号
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="pendingSong = null"
          >
            取消
          </Button>
          <Button
            :loading="isSubmittingRequest"
            :disabled="totalPendingPointCost > 0 && !biliAuth.isAuthed"
            @click="pendingSong && submitWebSongRequest(pendingSong, usePriorityOnRequest)"
          >
            {{ totalPendingPointCost > 0 ? `确认消耗 ${totalPendingPointCost} 积分点歌` : '确认点歌' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
