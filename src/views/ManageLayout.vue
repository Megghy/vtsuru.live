<script setup lang="ts">
import {
  BookCoins20Filled,
  CalendarClock24Filled,
  Info24Filled,
  Live24Filled,
  Lottery24Filled,
  Mail24Filled,
  PeopleQueue24Filled,
  Person48Filled,
  PersonFeedback24Filled,
  TabletSpeaker24Filled,
  VehicleShip24Filled,
  VideoAdd20Filled,
} from '@vicons/fluent'
import { AnalyticsSharp, Bookmark, BookmarkOutline, BrowsersOutline, Chatbox, ChevronDown, ChevronUp, Eye, Moon, MusicalNote, Pause, Play, PlayBack, PlayForward, Sunny, TrashBin, VolumeHigh } from '@vicons/ionicons5'
import { useElementSize, useStorage } from '@vueuse/core'
import {
  NAlert,
  NBackTop,
  NButton,
  NCard,
  NCountdown,
  NDivider,
  NElement,
  NFlex,
  NIcon,
  NLayout,
  NLayoutContent,
  NLayoutFooter,
  NLayoutHeader,
  NLayoutSider,
  NMenu,
  NPageHeader,
  NPopconfirm,
  NScrollbar,
  NSelect,
  NSlider,
  NSpace,
  NSpin,
  NSwitch,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue'
// @ts-ignore
import APlayer from 'vue3-aplayer'
import { RouterLink, useRoute } from 'vue-router'
import { cookie, isLoadingAccount, useAccount } from '@/api/account'
import { ThemeType } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { ACCOUNT_API_URL, availableAPIs, selectedAPIKey } from '@/data/constants'
import { useBiliAuth } from '@/store/useBiliAuth'
import { useMusicRequestProvider } from '@/store/useMusicRequest'
import { isDarkMode, NavigateToNewTab } from '@/Utils'

// 全局状态和工具
const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()
const windowWidth = window.innerWidth
const themeType = useStorage('Settings.Theme', ThemeType.Auto)

// 收藏功能相关
const favoriteMenuItems = useStorage<string[]>('Settings.FavoriteMenuItems', [])
const isFavorite = (key: string) => favoriteMenuItems.value?.includes(key)
function toggleFavorite(key: string) {
  const list = favoriteMenuItems.value ?? []
  const idx = list.indexOf(key)
  if (idx === -1) list.unshift(key)
  else list.splice(idx, 1)
  favoriteMenuItems.value = [...list]
}
function renderFavoriteExtra(key: string) {
  return () => {
    // 侧边栏收起时不显示收藏按钮
    if (width.value < 150) {
      return null
    }
    return h(
      'span',
      { class: ['menu-fav', isFavorite(key) ? 'active' : ''] },
      [
        h(
          NTooltip,
          { placement: 'right' },
          {
            trigger: () =>
              h(
                NButton,
                {
                  text: true,
                  size: 'tiny',
                  circle: true,
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    toggleFavorite(key)
                  },
                  style: 'padding: 0; height: 18px; width: 18px;',
                },
                {
                  icon: () =>
                    h(NIcon, {
                      component: isFavorite(key) ? Bookmark : BookmarkOutline,
                      size: 16,
                      color: isFavorite(key) ? '#f5c451' : undefined,
                    }),
                },
              ),
            default: () => (isFavorite(key) ? '取消收藏' : '收藏'),
          },
        ),
      ],
    )
  }
}

// 侧边栏和布局相关
const sider = ref()
const { width } = useElementSize(sider)
const musicPlayerCardRef = ref(null)
const { height: musicPlayerCardHeight } = useElementSize(musicPlayerCardRef)

// 菜单组展开状态
const expandedKeys = useStorage<string[]>('Settings.MenuExpandedKeys', [
  'manage-danmaku',
])

// 页面类型计算
const type = computed(() => route.meta.danmaku ? 'danmaku' : '')

// 音乐请求服务相关
const musicRquestStore = useMusicRequestProvider()

// 优化音乐播放器高度计算逻辑
const aplayerHeight = computed(() => {
  if (!isPlayerVisible.value) {
    return '0'
  }
  // Add 16px for NCard's top/bottom margin.
  return `${musicPlayerCardHeight.value + 16}`
})

// 播放器是否可见
const isPlayerVisible = computed(
  () => musicRquestStore.originMusics.length > 0 || musicRquestStore.waitingMusics.length > 0,
)

// 音乐播放器相关状态
const isPlayerMinimized = useStorage('Settings.MusicPlayer.Minimized', false)
const playerVolume = computed({
  get: () => musicRquestStore.settings.volume,
  set: value => musicRquestStore.settings.volume = value,
})

const aplayer = ref()
watch(aplayer, () => {
  musicRquestStore.aplayerRef = aplayer.value
})

// 当前播放信息
const currentPlayingInfo = computed(() => {
  if (musicRquestStore.currentOriginMusic && musicRquestStore.isPlayingOrderMusic) {
    return {
      type: 'request',
      info: `正在播放 ${musicRquestStore.currentOriginMusic.from.name} 点的歌`,
    }
  } else if (musicRquestStore.currentMusic && musicRquestStore.currentMusic.title) {
    return {
      type: 'normal',
      info: '正在播放背景音乐',
    }
  }
  return null
})

// 邮箱验证相关
const canResendEmail = ref(false)
const isBiliVerified = computed(() => accountInfo.value?.isBiliVerified)

// 加载超时检测
const loadingTimeout = ref(false)
const showAPISwitchDialog = ref(false)
let loadingTimer: number | null = null

// 监听加载状态，设置3秒超时
watch(isLoadingAccount, (loading) => {
  if (loading) {
    loadingTimeout.value = false
    showAPISwitchDialog.value = false
    loadingTimer = window.setTimeout(() => {
      if (isLoadingAccount.value) {
        loadingTimeout.value = true
        // 如果当前使用主API，提示切换到备用API
        if (selectedAPIKey.value === 'main') {
          showAPISwitchDialog.value = true
        }
      }
    }, 3000)
  } else {
    if (loadingTimer) {
      clearTimeout(loadingTimer)
      loadingTimer = null
    }
    loadingTimeout.value = false
    showAPISwitchDialog.value = false
  }
}, { immediate: true })

// 切换API
function switchToBackupAPI() {
  selectedAPIKey.value = 'failover'
  message.info('已切换到备用API，正在重新加载...')
  showAPISwitchDialog.value = false
  setTimeout(() => {
    location.reload()
  }, 500)
}

// 图标渲染函数 - 用于菜单项
const renderIcon = (icon: any) => () => h(NIcon, null, { default: () => h(icon) })

// 菜单配置（支持分组与收藏置顶）
const menuOptions = computed(() => {
  // 通用的菜单项工厂，自动挂载收藏按钮到叶子节点
  const withFavoriteExtra = (item: any): any => {
    if (item?.children?.length) {
      return {
        ...item,
        children: item.children.map(withFavoriteExtra),
      }
    }
    return {
      ...item,
      extra: width.value >= 180 ? renderFavoriteExtra(item.key) : undefined,
    }
  }

  // 定义基础菜单项 - 参照 Naive UI 官方格式
  const baseMenuItems = [
    {
      label: () => h(RouterLink, { to: { name: 'manage-history' } }, { default: () => '历史' }),
      key: 'manage-history',
      disabled: accountInfo.value?.isEmailVerified === false,
      icon: renderIcon(AnalyticsSharp),
      group: 'common',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-live' } }, { default: () => '直播记录' }),
      key: 'manage-live',
      disabled: accountInfo.value?.isEmailVerified === false,
      icon: renderIcon(Live24Filled),
      group: 'common',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-analyze' } }, { default: () => '直播数据' }),
      key: 'manage-analyze',
      disabled: accountInfo.value?.isEmailVerified === false,
      icon: renderIcon(Eye),
      group: 'common',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-event' } }, { default: () => '舰长和SC' }),
      key: 'manage-event',
      disabled: accountInfo.value?.isEmailVerified === false,
      icon: renderIcon(VehicleShip24Filled),
      group: 'data',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-point' } }, { default: () => '积分和礼物' }),
      key: 'manage-point',
      disabled: accountInfo.value?.isEmailVerified === false,
      icon: renderIcon(BookCoins20Filled),
      group: 'data',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-schedule' } }, { default: () => '日程' }),
      key: 'manage-schedule',
      icon: renderIcon(CalendarClock24Filled),
      disabled: accountInfo.value?.isEmailVerified === false,
      group: 'tools',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-songList' } }, { default: () => '歌单' }),
      key: 'manage-songList',
      icon: renderIcon(MusicalNote),
      disabled: accountInfo.value?.isEmailVerified === false,
      group: 'tools',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-questionBox' } }, { default: () => '棉花糖 (提问箱' }),
      key: 'manage-questionBox',
      icon: renderIcon(Chatbox),
      disabled: accountInfo.value?.isEmailVerified === false,
      group: 'tools',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-videoCollect' } }, { default: () => '视频征集' }),
      key: 'manage-videoCollect',
      icon: renderIcon(VideoAdd20Filled),
      disabled: accountInfo.value?.isEmailVerified === false,
      group: 'tools',
    },
    {
      label: () => h(RouterLink, { to: { name: 'manage-lottery' } }, { default: () => '动态抽奖' }),
      key: 'manage-lottery',
      icon: renderIcon(Lottery24Filled),
      group: 'tools',
    },
    {
      label: () => !isBiliVerified.value
        ? '弹幕机'
        : h(NTooltip, {}, {
            trigger: () => h(
              RouterLink,
              { to: { name: 'manage-danmuji' } },
              { default: () => '弹幕机' },
            ),
            default: () => '兼容 blivechat 样式 (其实就是直接用的 blivechat 组件',
          }),
      key: 'manage-danmuji',
      disabled: !isBiliVerified.value,
      icon: renderIcon(Lottery24Filled),
      group: 'danmaku',
    },
    {
      label: () => !isBiliVerified.value
        ? '点播'
        : h(
            NTooltip,
            {},
            {
              trigger: () => h(
                RouterLink,
                { to: { name: 'manage-liveRequest' } },
                { default: () => '点播' },
              ),
              default: () => '歌势之类用的, 可以用来点歌或者跳舞什么的',
            },
          ),
      key: 'manage-liveRequest',
      icon: renderIcon(MusicalNote),
      disabled: !isBiliVerified.value,
      group: 'danmaku',
    },
    {
      label: () => !isBiliVerified.value
        ? '抽奖'
        : h(
            RouterLink,
            { to: { name: 'manage-liveLottery' } },
            { default: () => '抽奖' },
          ),
      key: 'manage-liveLottery',
      icon: renderIcon(Lottery24Filled),
      disabled: !isBiliVerified.value,
      group: 'danmaku',
    },
    {
      label: () => !isBiliVerified.value
        ? '点歌'
        : h(
            NTooltip,
            {},
            {
              trigger: () => h(
                RouterLink,
                { to: { name: 'manage-musicRequest' } },
                { default: () => '点歌机' },
              ),
              default: () => '就是传统的点歌机, 发弹幕后播放指定的歌曲',
            },
          ),
      key: 'manage-musicRequest',
      icon: renderIcon(MusicalNote),
      disabled: !isBiliVerified.value,
      group: 'danmaku',
    },
    {
      label: () => !isBiliVerified.value
        ? '排队'
        : h(
            RouterLink,
            { to: { name: 'manage-liveQueue' } },
            { default: () => '排队' },
          ),
      key: 'manage-liveQueue',
      icon: renderIcon(PeopleQueue24Filled),
      disabled: !isBiliVerified.value,
      group: 'danmaku',
    },
    {
      label: () => !isBiliVerified.value
        ? '读弹幕'
        : h(
            RouterLink,
            { to: { name: 'manage-speech' } },
            { default: () => '读弹幕' },
          ),
      key: 'manage-speech',
      icon: renderIcon(TabletSpeaker24Filled),
      disabled: !isBiliVerified.value,
      group: 'danmaku',
    },
  ]

  // 应用收藏功能到所有菜单项
  const allMenuItems = baseMenuItems.map(withFavoriteExtra)
  const itemMap = new Map(allMenuItems.map(i => [i.key, i]))

  // 获取收藏列表
  const favorites = (favoriteMenuItems.value ?? [])
    .map(k => itemMap.get(k))
    .filter(Boolean) as any[]

  // 过滤掉已收藏的项
  const notFav = (i: any) => !isFavorite(i.key)

  // 构建分组
  const groups: any[] = []

  // 我的收藏分组
  if (favorites.length > 0) {
    groups.push({
      type: 'group',
      key: 'group-favorites',
      label: '我的收藏',
      children: favorites,
    })
  }

  // 常用分组
  const commonItems = allMenuItems.filter(i => i.group === 'common' && notFav(i))
  if (commonItems.length > 0) {
    groups.push({
      type: 'group',
      key: 'group-common',
      label: '常用',
      children: commonItems,
    })
  }

  // 数据分组
  const dataItems = allMenuItems.filter(i => i.group === 'data' && notFav(i))
  if (dataItems.length > 0) {
    groups.push({
      type: 'group',
      key: 'group-data',
      label: '数据',
      children: dataItems,
    })
  }

  // 互动与工具分组
  const toolsItems = allMenuItems.filter(i => i.group === 'tools' && notFav(i))
  if (toolsItems.length > 0) {
    groups.push({
      type: 'group',
      key: 'group-tools',
      label: '互动与工具',
      children: toolsItems,
    })
  }

  // 弹幕相关分组
  const danmakuItems = allMenuItems.filter(i => i.group === 'danmaku' && notFav(i))
  if (danmakuItems.length > 0) {
    groups.push({
      type: 'group',
      key: 'group-danmaku',
      label: () => h(
        NTooltip,
        {},
        {
          trigger: () => h(
            NText,
            () => [
              '弹幕相关',
              h(
                NTooltip,
                { style: 'padding: 0; margin-left: 4px;' },
                {
                  trigger: () => h(NIcon, { component: Info24Filled, size: 14 }),
                  default: () => h(
                    NAlert,
                    {
                      type: 'warning',
                      size: 'small',
                      title: '可用性警告',
                      style: 'max-width: 600px;',
                    },
                    () => h('div', {}, [
                      '    当浏览器在后台运行时, 定时器和 Websocket 连接将受到严格限制, 这会导致弹幕接收功能无法正常工作 (详见',
                      h(
                        NButton,
                        {
                          text: true,
                          tag: 'a',
                          href: 'https://developer.chrome.com/blog/background_tabs/',
                          target: '_blank',
                          type: 'info',
                        },
                        () => '此文章',
                      ),
                      '), 虽然本站已经针对此问题做出了处理, 一般情况下即使掉线了也会重连, 不过还是有可能会遗漏事件',
                      h('br'),
                      '为避免这种情况, 建议注册本站账后使用',
                      h(
                        NButton,
                        {
                          type: 'primary',
                          text: true,
                          size: 'small',
                          tag: 'a',
                          href: 'https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs',
                          target: '_blank',
                        },
                        () => 'VtsuruEventFetcher',
                      ),
                      ', 否则请在使用功能时尽量保持网页在前台运行, 同时关闭浏览器的 页面休眠/内存节省 功能',
                      h('br'),
                      'Chrome: ',
                      h(
                        NButton,
                        {
                          type: 'info',
                          text: true,
                          size: 'small',
                          tag: 'a',
                          href: 'https://support.google.com/chrome/answer/12929150?hl=zh-Hans#zippy=%2C%E5%BC%80%E5%90%AF%E6%88%96%E5%85%B3%E9%97%AD%E7%9C%81%E5%86%85%E5%AD%98%E6%A8%A1%E5%BC%8F%2C%E8%AE%A9%E7%89%B9%E5%AE%9A%E7%BD%91%E7%AB%99%E4%BF%9D%E6%8C%81%E6%B4%BB%E5%8A%A8%E7%8A%B6%E6%80%81',
                          target: '_blank',
                        },
                        () => '让特定网站保持活动状态',
                      ),
                      ', Edge: ',
                      h(
                        NButton,
                        {
                          type: 'info',
                          text: true,
                          size: 'small',
                          tag: 'a',
                          href: 'https://support.microsoft.com/zh-cn/topic/%E4%BA%86%E8%A7%A3-microsoft-edge-%E4%B8%AD%E7%9A%84%E6%80%A7%E8%83%BD%E5%8A%9F%E8%83%BD-7b36f363-2119-448a-8de6-375cfd88ab25',
                          target: '_blank',
                        },
                        () => '永远不想进入睡眠状态的网站',
                      ),
                    ]),
                  ),
                },
              ),
            ],
          ),
          default: () => (isBiliVerified.value
            ? '需要使用直播弹幕的功能'
            : '你尚未进行 Bilibili 认证, 请前往面板进行绑定'),
        },
      ),
      children: danmakuItems,
    })
  }

  return groups
})

// 重发验证邮件
async function resendEmail() {
  try {
    const data = await QueryGetAPI(`${ACCOUNT_API_URL}send-verify-email`)
    if (data.code === 200) {
      canResendEmail.value = false
      message.success('发送成功, 请检查你的邮箱. 如果没有收到, 请检查垃圾邮件')
      if (accountInfo.value && accountInfo.value.nextSendEmailTime) {
        accountInfo.value.nextSendEmailTime += 1000 * 60
      }
    } else {
      message.error(`发送失败: ${data.message}`)
    }
  } catch (err) {
    message.error('发送失败')
  }
}

// 登出操作
function logout() {
  cookie.value = undefined
  window.location.reload()
}

// 播放下一首音乐
function onNextMusic() {
  musicRquestStore.nextMusic()
}

// 音乐播放器控制功能
function togglePlay() {
  if (aplayer.value) {
    const audio = aplayer.value.audio
    if (audio.paused) {
      aplayer.value.play()
    } else {
      aplayer.value.pause()
    }
  }
}

function onPreviousMusic() {
  if (aplayer.value) {
    // 如果当前播放时间大于3秒，则重新开始播放当前歌曲
    if (aplayer.value.audio.currentTime > 3) {
      aplayer.value.audio.currentTime = 0
    } else {
      // 否则播放上一首
      const currentIndex = musicRquestStore.aplayerMusics.findIndex(
        music => music.id === musicRquestStore.currentMusic.id,
      )
      if (currentIndex > 0) {
        musicRquestStore.currentMusic = musicRquestStore.aplayerMusics[currentIndex - 1]
        aplayer.value.thenPlay()
      }
    }
  }
}

function clearWaitingQueue() {
  musicRquestStore.waitingMusics.splice(0)
  message.success('已清空等待队列')
}

function togglePlayerMinimize() {
  isPlayerMinimized.value = !isPlayerMinimized.value
}

// 跳转到认证页面
function gotoAuthPage() {
  if (!accountInfo.value?.biliUserAuthInfo) {
    message.error('你尚未进行 Bilibili 认证, 请前往面板进行认证和绑定')
    return
  }
  useBiliAuth()
    .setCurrentAuth(accountInfo.value?.biliUserAuthInfo.token)
    .then(() => {
      NavigateToNewTab('/bili-user')
    })
}

onMounted(() => {
  // 检查邮箱验证状态
  if (accountInfo.value?.isEmailVerified === false) {
    if ((accountInfo.value?.nextSendEmailTime ?? -1) <= 0) {
      canResendEmail.value = true
    }
  }

  if (selectedAPIKey.value != 'main') {
    message.warning('你当前使用的是备用API节点, 可能会速度比较慢')
  }
})

onUnmounted(() => {
  if (loadingTimer) {
    clearTimeout(loadingTimer)
    loadingTimer = null
  }
})
</script>

<template>
  <NLayout v-if="accountInfo.id" style="height: 100vh">
    <!-- 顶部导航栏 -->
    <NLayoutHeader bordered style="height: var(--vtsuru-header-height); padding: 10px 15px 5px 15px">
      <NPageHeader>
        <template #title>
          <NText strong style="font-size: 1.4rem; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)">
            VTSURU CENTER
          </NText>
        </template>
        <template #extra>
          <NSpace align="center" justify="center">
            <!-- 主题切换开关 -->
            <NSwitch
              :default-value="!isDarkMode"
              @update:value="(value) => (themeType = value ? ThemeType.Light : ThemeType.Dark)"
            >
              <template #checked>
                <NIcon :component="Sunny" />
              </template>
              <template #unchecked>
                <NIcon :component="Moon" />
              </template>
            </NSwitch>
            <NButton
              size="small" type="primary"
              @click="$router.push({ name: 'user-index', params: { id: accountInfo?.name } })"
            >
              回到展示页
            </NButton>
          </NSpace>
        </template>
      </NPageHeader>
    </NLayoutHeader>

    <!-- 主布局部分 -->
    <NLayout has-sider style="height: calc(100vh - 50px)">
      <!-- 侧边导航栏 -->
      <NLayoutSider
        v-if="accountInfo?.isEmailVerified" ref="sider" bordered show-trigger collapse-mode="width"
        :default-collapsed="windowWidth < 750" :collapsed-width="64" :width="180" :native-scrollbar="false"
        :scrollbar-props="{ trigger: 'none', style: {} }" :class="{ 'sider-collapsed': width < 150 }"
      >
        <!-- 顶部功能按钮区 -->
        <NSpace vertical style="margin-top: 16px" align="center">
          <NSpace justify="center">
            <NButton type="info" style="width: 100%" @click="$router.push({ name: 'manage-index' })">
              <template #icon>
                <NIcon :component="BrowsersOutline" />
              </template>
              <template v-if="width >= 180">
                面板
              </template>
            </NButton>
            <NTooltip v-if="width >= 180">
              <template #trigger>
                <NButton @click="$router.push({ name: 'manage-feedback' })">
                  <template #icon>
                    <NIcon :component="PersonFeedback24Filled" />
                  </template>
                </NButton>
              </template>
              反馈
            </NTooltip>
          </NSpace>
          <!-- B站认证用户入口 -->
          <NButton v-if="accountInfo.biliUserAuthInfo" type="info" secondary @click="gotoAuthPage()">
            <template #icon>
              <NIcon :component="Person48Filled" />
            </template>
            <template v-if="width >= 180">
              认证用户主页
            </template>
          </NButton>
        </NSpace>

        <!-- 主导航菜单 -->
        <NMenu
          v-model:expanded-keys="expandedKeys" class="manage-sider-menu" style="margin-top: 12px"
          :disabled="accountInfo?.isEmailVerified !== true"
          :default-value="($route.meta.parent as string) ?? $route.name?.toString()"
          :default-expanded-keys="['group-common', 'group-data', 'group-tools', 'group-danmaku', 'group-favorites']"
          :collapsed-width="64" :collapsed-icon-size="22" :icon-size="16" :root-indent="10" :indent="12"
          :options="menuOptions"
        />

        <!-- 底部信息区 -->
        <NSpace v-if="width > 150" justify="center" align="center" vertical>
          <NText depth="3">
            有更多功能建议请
            <NButton text type="info" @click="$router.push({ name: 'manage-feedback' })">
              反馈
            </NButton>
          </NText>
          <NText depth="3">
            <NButton text type="info" @click="$router.push({ name: 'about' })">
              关于本站
            </NButton>
          </NText>
        </NSpace>
        <NDivider style="margin-bottom: 8px;" />
        <NFlex justify="center" align="center">
          <NText
            :style="`font-size: 12px; text-align: center;color: ${isDarkMode ? '#555' : '#c0c0c0'};visibility: ${width < 180 ? 'hidden' : 'visible'}`"
          >
            By Megghy
          </NText>
        </NFlex>
      </NLayoutSider>

      <!-- 内容区域 -->
      <NLayout>
        <!-- 主内容区域 -->
        <NScrollbar :style="`height: calc(100vh - var(--vtsuru-header-height) - ${aplayerHeight}px)`" :x-scrollable="true">
          <NLayoutContent
            content-style="margin: var(--vtsuru-content-padding); margin-right: calc(var(--vtsuru-content-padding) + 4px); padding-bottom: 32px;min-width: 370px"
          >
            <NElement>
              <!-- 已验证邮箱的用户显示内容 -->
              <RouterView v-if="accountInfo?.isEmailVerified" v-slot="{ Component, route }">
                <template v-if="route.meta.keepAlive">
                  <Suspense>
                    <template #default>
                      <KeepAlive>
                        <component :is="Component" />
                      </KeepAlive>
                    </template>
                    <template #fallback>
                      <NSpin show />
                    </template>
                  </Suspense>
                </template>
                <template v-else>
                  <Suspense>
                    <template #default>
                      <component :is="Component" :key="route.fullPath" />
                    </template>
                    <template #fallback>
                      <NSpin show />
                    </template>
                  </Suspense>
                </template>
              </RouterView>
              <!-- 未验证邮箱的提示 -->
              <template v-else>
                <NCard>
                  <NSpace vertical size="large" align="center">
                    <NFlex justify="center" align="center" vertical>
                      <NIcon size="48" color="#2080f0">
                        <Mail24Filled />
                      </NIcon>
                      <NText style="font-size: 20px; margin-top: 16px; font-weight: 500;">
                        请验证您的邮箱
                      </NText>
                      <NText depth="3" style="text-align: center; margin-top: 8px;">
                        我们已向您的邮箱 <NText type="primary" strong>
                          {{ accountInfo?.bindEmail }}
                        </NText> 发送了验证链接，请查收并点击链接完成验证
                      </NText>
                    </NFlex>

                    <NAlert type="warning" style="max-width: 450px;">
                      <template #icon>
                        <NIcon>
                          <Info24Filled />
                        </NIcon>
                      </template>
                      如果长时间未收到邮件，请检查垃圾邮件文件夹，或点击下方按钮重新发送
                    </NAlert>

                    <NSpace>
                      <NButton
                        type="primary" :disabled="!canResendEmail" style="min-width: 140px;"
                        @click="resendEmail"
                      >
                        <template #icon>
                          <NIcon>
                            <Mail24Filled />
                          </NIcon>
                        </template>
                        重新发送验证邮件
                      </NButton>
                      <NTag v-if="!canResendEmail" type="warning" round>
                        <NCountdown
                          :duration="(accountInfo?.nextSendEmailTime ?? 0) - Date.now()"
                          @finish="canResendEmail = true"
                        />
                        后可重新发送
                      </NTag>
                    </NSpace>

                    <NDivider style="width: 80%; min-width: 250px;" />

                    <NPopconfirm @positive-click="logout">
                      <template #trigger>
                        <NButton secondary>
                          <template #icon>
                            <NIcon>
                              <PersonFeedback24Filled />
                            </NIcon>
                          </template>
                          切换账号
                        </NButton>
                      </template>
                      确定要登出当前账号吗？
                    </NPopconfirm>
                  </NSpace>
                </NCard>
              </template>
              <NBackTop />
            </NElement>
          </NLayoutContent>
        </NScrollbar>

        <!-- 音乐播放器区域 -->
        <NLayoutFooter
          v-if="isPlayerVisible"
          :style="`height: ${aplayerHeight}px; overflow: hidden; transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);`"
          class="music-player-footer"
        >
          <NCard
            ref="musicPlayerCardRef" :bordered="false" embedded
            :content-style="isPlayerMinimized ? 'padding: 0' : undefined" size="small" class="music-player-card" style="
              margin: 8px;
              border-radius: 12px;
              backdrop-filter: blur(10px);
            "
          >
            <!-- 播放器头部控制栏 -->
            <template #header>
              <NFlex justify="space-between" align="center" style="padding: 0;">
                <NFlex align="center" size="small">
                  <NIcon :component="MusicalNote" size="16" :style="`color: ${isDarkMode ? '#a8dadc' : '#457b9d'}`" />
                  <NText :depth="2" style="font-size: 13px; font-weight: 500;">
                    音乐播放器
                  </NText>
                  <NTag
                    v-if="currentPlayingInfo && !isPlayerMinimized"
                    :type="currentPlayingInfo.type === 'request' ? 'success' : 'info'" size="small" round
                    :bordered="false" style="font-size: 11px; padding: 2px 8px;"
                  >
                    {{ currentPlayingInfo.info }}
                  </NTag>

                  <template v-if="isPlayerMinimized">
                    <NText
                      v-if="musicRquestStore.currentMusic.title"
                      style="font-size: 13px; max-width: 250px; margin-left: 12px" :ellipsis="{ tooltip: true }"
                    >
                      {{ musicRquestStore.currentMusic.title }} - {{ musicRquestStore.currentMusic.artist }}
                    </NText>
                    <NText v-else depth="3" style="font-size: 13px; margin-left: 12px">
                      暂无播放
                    </NText>
                  </template>
                </NFlex>

                <NFlex align="center" size="small">
                  <template v-if="isPlayerMinimized">
                    <NTag
                      v-if="musicRquestStore.waitingMusics.length > 0" type="warning" size="small" round
                      :bordered="false"
                    >
                      {{ musicRquestStore.waitingMusics.length }}
                    </NTag>

                    <NButton
                      circle size="tiny" tertiary :disabled="musicRquestStore.aplayerMusics.length === 0"
                      @click.stop="togglePlay"
                    >
                      <template #icon>
                        <NIcon :component="aplayer?.audio?.paused !== false ? Play : Pause" size="14" />
                      </template>
                    </NButton>

                    <NButton
                      circle size="tiny" tertiary
                      :disabled="musicRquestStore.waitingMusics.length === 0 && musicRquestStore.aplayerMusics.length <= 1"
                      @click.stop="onNextMusic"
                    >
                      <template #icon>
                        <NIcon :component="PlayForward" size="14" />
                      </template>
                    </NButton>
                  </template>

                  <NTooltip>
                    <template #trigger>
                      <NButton
                        :type="isPlayerMinimized ? 'primary' : 'default'" tertiary size="small" circle
                        @click="togglePlayerMinimize"
                      >
                        <template #icon>
                          <NIcon :component="isPlayerMinimized ? ChevronUp : ChevronDown" />
                        </template>
                      </NButton>
                    </template>
                    {{ isPlayerMinimized ? '展开播放器' : '收起播放器' }}
                  </NTooltip>
                </NFlex>
              </NFlex>
            </template>

            <!-- 主播放器内容 -->
            <div v-show="!isPlayerMinimized">
              <NFlex align="center" :wrap="false" style="gap: 12px;">
                <!-- APlayer组件 -->
                <div style="flex: 1; min-width: 280px;">
                  <APlayer
                    ref="aplayer" v-model:music="musicRquestStore.currentMusic" v-model:volume="playerVolume"
                    v-model:shuffle="musicRquestStore.settings.shuffle"
                    v-model:repeat="musicRquestStore.settings.repeat" :list="musicRquestStore.aplayerMusics"
                    list-max-height="200" mutex list-folded style="border-radius: 8px;"
                    @ended="musicRquestStore.onMusicEnd" @play="musicRquestStore.onMusicPlay"
                  />
                </div>

                <!-- 右侧控制面板 -->
                <div class="music-control-panel">
                  <!-- 播放控制按钮 -->
                  <NFlex vertical size="small" align="center" style="min-width: 100px;">
                    <NText depth="3" style="font-size: 12px; margin-bottom: 4px;">
                      播放控制
                    </NText>
                    <NFlex size="small" justify="center">
                      <NTooltip>
                        <template #trigger>
                          <NButton
                            circle secondary size="small" :disabled="musicRquestStore.aplayerMusics.length === 0"
                            @click="onPreviousMusic"
                          >
                            <template #icon>
                              <NIcon :component="PlayBack" />
                            </template>
                          </NButton>
                        </template>
                        上一首 / 重播
                      </NTooltip>

                      <NTooltip>
                        <template #trigger>
                          <NButton
                            circle type="primary" size="small"
                            :disabled="musicRquestStore.aplayerMusics.length === 0" @click="togglePlay"
                          >
                            <template #icon>
                              <NIcon :component="aplayer?.audio?.paused !== false ? Play : Pause" />
                            </template>
                          </NButton>
                        </template>
                        {{ aplayer?.audio?.paused !== false ? '播放' : '暂停' }}
                      </NTooltip>

                      <NTooltip>
                        <template #trigger>
                          <NButton
                            circle secondary size="small"
                            :disabled="musicRquestStore.waitingMusics.length === 0 && musicRquestStore.aplayerMusics.length <= 1"
                            @click="onNextMusic"
                          >
                            <template #icon>
                              <NIcon :component="PlayForward" />
                            </template>
                          </NButton>
                        </template>
                        下一首
                      </NTooltip>
                    </NFlex>
                  </NFlex>

                  <!-- 队列信息和管理 -->
                  <NFlex vertical size="small" align="center" style="min-width: 100px;">
                    <NText depth="3" style="font-size: 12px; margin-bottom: 4px;">
                      队列管理
                    </NText>
                    <NFlex vertical size="small" align="center">
                      <NTag
                        :bordered="false" :type="musicRquestStore.waitingMusics.length > 0 ? 'warning' : 'info'"
                        size="small" round style="min-width: 80px; text-align: center;"
                      >
                        等待: {{ musicRquestStore.waitingMusics.length }}
                      </NTag>

                      <NTag
                        :bordered="false" type="success" size="small" round
                        style="min-width: 80px; text-align: center;"
                      >
                        歌单: {{ musicRquestStore.originMusics.length }}
                      </NTag>

                      <NTooltip v-if="musicRquestStore.waitingMusics.length > 0">
                        <template #trigger>
                          <NButton size="tiny" type="error" secondary @click="clearWaitingQueue">
                            <template #icon>
                              <NIcon :component="TrashBin" size="12" />
                            </template>
                            清空队列
                          </NButton>
                        </template>
                        清空所有等待中的点歌
                      </NTooltip>
                    </NFlex>
                  </NFlex>

                  <!-- 音量控制 -->
                  <NFlex vertical size="small" align="center" style="min-width: 100px;">
                    <NFlex align="center" size="small">
                      <NIcon :component="VolumeHigh" size="14" :depth="3" />
                      <NText depth="3" style="font-size: 12px;">
                        音量
                      </NText>
                    </NFlex>
                    <NSlider
                      v-model:value="playerVolume" :min="0" :max="1" :step="0.01" style="width: 80px;"
                      :tooltip="false" size="small"
                    />
                    <NText depth="3" style="font-size: 11px;">
                      {{ Math.round(playerVolume * 100) }}%
                    </NText>
                  </NFlex>
                </div>
              </NFlex>
            </div>

            <!-- 最小化状态显示 -->
            <template v-if="isPlayerMinimized">
              <!-- Content is moved to the header for minimized state -->
            </template>
          </NCard>
        </NLayoutFooter>
      </NLayout>
    </NLayout>
  </NLayout>

  <!-- 未登录时显示的登录/注册界面 -->
  <template v-else>
    <NLayoutContent
      style="
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        width: 100vw;
        background: linear-gradient(135deg, rgba(250,250,250,0.8) 0%, rgba(240,240,245,0.9) 100%);
        padding: 0;
        margin: 0;
        box-sizing: border-box;
        position: fixed;
        top: 0;
        left: 0;
        overflow: auto;
      " :class="isDarkMode ? 'login-dark-bg' : ''"
    >
      <template v-if="!isLoadingAccount">
        <NCard class="login-card" :bordered="false">
          <template #header>
            <NFlex justify="center" align="center" style="padding: 12px 0;">
              <NText
                strong
                style="font-size: 1.8rem; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); background-image: linear-gradient(to right, #36d1dc, #5b86e5); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"
              >
                VTSURU CENTER
              </NText>
            </NFlex>
          </template>

          <NSpace vertical size="large" style="padding: 8px 0;">
            <NFlex justify="center" align="center">
              <NText style="font-size: 16px; text-align: center;">
                请登录或注册后使用
              </NText>
            </NFlex>

            <NAlert type="info" style="border-radius: 8px;">
              <NFlex vertical align="center" size="small">
                <div style="text-align: center;">
                  如果你不是主播且不发送棉花糖(提问)的话则不需要注册登录, 直接访问认证完成后给出的链接即可
                </div>
                <NFlex justify="center" style="width: 100%; margin-top: 8px;">
                  <NButton type="primary" size="small" @click="$router.push({ name: 'bili-user' })">
                    <template #icon>
                      <NIcon :component="BrowsersOutline" />
                    </template>
                    前往 Bilibili 认证用户主页
                  </NButton>
                </NFlex>
              </NFlex>
            </NAlert>

            <NDivider style="margin: 8px 0;" />

            <RegisterAndLogin />

            <NFlex justify="center">
              <NButton secondary tag="a" href="/" style="min-width: 100px;">
                回到主页
              </NButton>
            </NFlex>
          </NSpace>
        </NCard>
      </template>
      <template v-else>
        <NCard class="loading-card" :bordered="false">
          <NFlex vertical justify="center" align="center" style="padding: 20px 10px;">
            <NSpin :loading="isLoadingAccount" size="large">
              <NText>正在请求账户数据...</NText>
            </NSpin>
            <NAlert
              v-if="showAPISwitchDialog"
              type="warning"
              style="margin-top: 20px; max-width: 400px;"
              title="加载时间较长"
            >
              <NSpace vertical>
                <NText>当前API响应较慢，是否切换到备用API？</NText>
                <NFlex justify="end" :size="8">
                  <NButton size="small" @click="showAPISwitchDialog = false">
                    继续等待
                  </NButton>
                  <NButton type="primary" size="small" @click="switchToBackupAPI">
                    切换到备用API
                  </NButton>
                </NFlex>
              </NSpace>
            </NAlert>
          </NFlex>
        </NCard>
      </template>
    </NLayoutContent>
  </template>
</template>

<style scoped>
  .login-dark-bg {
    background: linear-gradient(135deg, rgba(30, 30, 35, 0.9) 0%, rgba(20, 20, 25, 0.95) 100%) !important;
  }

  .login-card {
    max-width: 520px;
    width: 90%;
    min-width: 300px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    margin: 16px;
  }

  .loading-card {
    min-width: 280px;
    width: 90%;
    max-width: 400px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    margin: 16px;
  }

  /* 音乐播放器样式 */
  .music-player-footer {
    background: var(--body-color);
  }

  .music-player-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .music-player-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15) !important;
  }

  .music-control-panel {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    flex-wrap: wrap;
    min-width: 300px;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .music-control-panel {
      min-width: auto;
      flex-direction: row;
      justify-content: space-around;
      align-items: center;
      gap: 8px;
      width: 100%;
    }

    .music-control-panel>div {
      min-width: auto !important;
      flex: 1;
    }
  }

  @media (max-width: 480px) {

    .login-card,
    .loading-card {
      width: 95%;
      margin: 8px;
    }

    .music-player-card {
      margin: 4px !important;
    }

    .music-control-panel {
      flex-direction: column;
      align-items: center;
      gap: 6px;
      width: 100%;
    }

    .music-control-panel>div {
      width: 100% !important;
      min-width: auto !important;
    }
  }

  /* 播放器按钮悬停效果 */
  .music-player-card .n-button {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .music-player-card .n-button:hover {
    transform: translateY(-1px);
  }

  /* 音量滑块样式 */
  .music-player-card .n-slider {
    transition: all 0.2s ease;
  }

  .music-player-card .n-slider:hover {
    transform: scale(1.02);
  }

  /* 标签动画 */
  .music-player-card .n-tag {
    transition: all 0.2s ease;
  }

  .music-player-card .n-tag:hover {
    transform: scale(1.05);
  }

  /* 侧边栏菜单收藏按钮与紧凑样式 */
  :deep(.manage-sider-menu .menu-fav) {
    opacity: 0;
    width: 0;
    margin-left: 0;
    overflow: hidden;
    transition: opacity 0.15s ease, width 0.15s ease, margin-left 0.15s ease;
    pointer-events: none;
    /* 不阻挡文字区域点击 */
    display: inline-flex;
    align-items: center;
    justify-content: center;

  }

  :deep(.n-menu-item) {
    height: 36px;
  }

  :deep(.manage-sider-menu .n-menu-item:hover .menu-fav),
  :deep(.manage-sider-menu .menu-fav.active) {
    opacity: 1;
    width: 18px;
    margin-left: 6px;
    pointer-events: auto;
  }

  :deep(.manage-sider-menu .menu-fav .n-button) {
    padding: 0;
    height: 18px;
    width: 18px;
  }

  :deep(.sider-collapsed .manage-sider-menu .n-menu-item .n-menu-item-content) {
    display: flex;
    justify-content: center;
  }
  :deep(.n-menu-item) {
    margin-top: 3;
  }

  /* 侧边栏收起时隐藏group标题 */
  :deep(.sider-collapsed .n-menu-item-group-title) {
    display: none;
  }

  /* 侧边栏收起时禁用收藏按钮样式，避免元素偏移 */
  .sider-collapsed :deep(.manage-sider-menu .menu-fav) {
    display: none !important;
  }
</style>
