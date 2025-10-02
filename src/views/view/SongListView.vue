<script lang="ts" setup>
import type { Setting_LiveRequest, SongRequestInfo, SongsInfo, UserInfo } from '@/api/api-models'
import type { ConfigItemDefinition } from '@/data/VTsuruConfigTypes'
import { useStorage } from '@vueuse/core'
import { addSeconds } from 'date-fns'
import { NButton, NModal, NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { DownloadConfig, useAccount } from '@/api/account'
import { QueryGetAPI, QueryPostAPIWithParams } from '@/api/query'
import { SONG_API_URL, SONG_REQUEST_API_URL, SongListTemplateMap } from '@/data/constants'
import { useBiliAuth } from '@/store/useBiliAuth'

// 组件属性
const props = defineProps<{
  biliInfo: any | undefined // B站信息
  userInfo: UserInfo | undefined // 用户信息
  template?: string | undefined // 模板名称
  fakeData?: SongsInfo[] // 测试数据
}>()
// 用户账号信息
const accountInfo = useAccount()
// 下次点歌时间
const nextRequestTime = useStorage('SongList.NextRequestTime', new Date())
// 点歌冷却时间(秒)
const minRequestTime = 30
// 设置弹窗显示状态
const showSettingModal = ref(false)

// 计算当前使用的模板类型
const componentType = computed(() => {
  return props.template ?? props.userInfo?.extra?.templateTypes.songlist?.toLowerCase()
})

// 数据状态
const currentData = ref<SongsInfo[]>([]) // 歌单数据
const dynamicConfigRef = ref() // 动态配置引用
const songsActive = ref<SongRequestInfo[]>([]) // 当前点歌列表
const settings = ref<Setting_LiveRequest>({ // 点歌设置
  allowFromWeb: false,
  allowAnonymousFromWeb: false,
  orderPrefix: '',
} as Setting_LiveRequest)

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
  return type ? SongListTemplateMap[type] : SongListTemplateMap['']
})

const currentConfig = ref({}) // 当前配置
const message = useMessage() // 消息提示
const biliAuth = useBiliAuth() // B站授权

/**
 * 获取点歌设置和当前点歌列表
 */
async function getSongRequestInfo() {
  if (!props.userInfo?.id) return { songs: [], setting: settings.value }

  try {
    const data = await QueryGetAPI<{ songs: SongRequestInfo[], setting: Setting_LiveRequest }>(
      `${SONG_REQUEST_API_URL}get-active-and-settings`,
      {
        id: props.userInfo.id,
      },
    )

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
    const data = await QueryGetAPI<SongsInfo[]>(`${SONG_API_URL}get`, {
      id: props.userInfo.id,
    })

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

  if (!selectedTemplateConfig.value) {
    // 等待模板配置加载完成后再获取配置
    setTimeout(() => getConfig(), 100)
    return
  }

  isConfigLoading.value = true

  try {
    const data = await DownloadConfig(
      selectedTemplate.value.settingName,
      props.userInfo?.id,
    )

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
  navigator.clipboard.writeText(text)
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
async function requestSong(song: SongsInfo) {
  if (!song) return

  const orderText = `${settings.value.orderPrefix || ''} ${song.name}`

  // 检查是否需要复制到剪贴板而不是直接点歌
  const shouldCopyOnly = song.options
    || !settings.value.allowFromWeb
    || (settings.value.allowFromWeb && !settings.value.allowAnonymousFromWeb && !accountInfo.value.id && !biliAuth.isAuthed)

  if (shouldCopyOnly) {
    copyToClipboard(orderText, false)

    if (song.options) {
      message.info('此项目有特殊要求, 请在直播间内点歌, 点歌弹幕已复制到剪切板')
    } else if (!settings.value.allowAnonymousFromWeb && !accountInfo.value.id && !biliAuth.isAuthed) {
      message.info('主播不允许匿名点歌, 需要从网页点歌的话请注册登录, 点歌弹幕已复制到剪切板')
    } else if (!settings.value.allowFromWeb) {
      message.info('主播不允许从网页点歌, 点歌弹幕已复制到剪切板')
    }
    return
  }

  // 执行网页点歌
  if (!props.userInfo?.id) {
    message.error('无法获取主播信息，无法完成点歌')
    return
  }

  // 检查点歌冷却时间
  if (!accountInfo.value.id && nextRequestTime.value > new Date()) {
    const remainingSeconds = Math.ceil((nextRequestTime.value.getTime() - new Date().getTime()) / 1000)
    message.warning(`距离点歌冷却还有${remainingSeconds}秒`)
    return
  }

  try {
    const data = await QueryPostAPIWithParams(`${SONG_REQUEST_API_URL}add-from-web`, {
      target: props.userInfo.id,
      song: song.key,
    })

    if (data.code === 200) {
      message.success('点歌成功')
      nextRequestTime.value = addSeconds(new Date(), minRequestTime)
      // 重新获取当前点歌列表，更新界面
      const songRequestInfo = await getSongRequestInfo()
      if (songRequestInfo) {
        songsActive.value = songRequestInfo.songs
      }
    } else {
      message.error(`点歌失败: ${data.message}`)
    }
  } catch (err) {
    console.error('点歌出错:', err)
    message.error(`点歌失败: ${err instanceof Error ? err.message : String(err)}`)
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

// 监听用户ID变化，重新加载数据
watch(
  () => props.userInfo?.id,
  () => {
    if (!props.fakeData) {
      getSongs()
      getSongRequestInfo().then((info) => {
        if (info) {
          songsActive.value = info.songs || []
          settings.value = info.setting || settings.value
        }
      })
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
  <div>
    <!-- 加载中显示加载动画 -->
    <NSpin :show="isLoading">
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
    </NSpin>

    <!-- 主播自定义按钮 -->
    <NButton
      v-if="selectedTemplate?.settingName && userInfo?.id === accountInfo.id"
      type="info"
      size="small"
      style="position: absolute; right: 32px; top: 20px; z-index: 1000; border: solid 3px #dfdfdf;"
      @click="showSettingModal = true"
    >
      自定义
    </NButton>

    <!-- 设置弹窗 -->
    <NModal
      v-model:show="showSettingModal"
      style="max-width: 90vw; width: 800px;"
      preset="card"
      title="设置"
    >
      <DynamicForm
        :name="selectedTemplate?.settingName"
        :config-data="currentConfig"
        :config="selectedTemplateConfig"
      />
    </NModal>
  </div>
</template>
