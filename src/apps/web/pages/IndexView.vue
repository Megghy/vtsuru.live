<script setup lang="ts">
import {
  BookCoins20Filled,
  Chat24Filled,
  Info24Filled,
  Lottery24Filled,
  MoreHorizontal24Filled,
  PersonFeedback24Filled,
  TabletSpeaker24Filled,
  VehicleShip24Filled,
  VideoAdd20Filled,
} from '@vicons/fluent'
import { AnalyticsSharp, BrowsersOutline, Calendar, Chatbox, ListCircle, MusicalNote, OpenOutline } from '@vicons/ionicons5'
import { useWindowSize } from '@vueuse/core'
import type { IOptions, RecursivePartial } from '@tsparticles/engine'
import { NButton, NCard, NFlex, NGradientText, NIcon, NNumberAnimation, NSpace, NText, NTooltip, useThemeVars } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { QueryGetAPI } from '@/api/query'
import { VTSURU_API_URL } from '@/shared/config'
import { isDarkMode } from '@/shared/utils'
import vtb from '@/svgs/ic_vtuber.svg'

const { width } = useWindowSize()
const $router = useRouter()
const themeVars = useThemeVars()

const functions = [
  {
    name: '直播事件记录',
    desc: '能够记录并查询上舰和SC记录',
    icon: VehicleShip24Filled,
    route: 'manage-event',
  },
  {
    name: '积分兑换',
    desc: '通过上舰, Superchat, 赠送礼物等操作可以获取积分, 并通过积分兑换虚拟或者实体礼物',
    icon: BookCoins20Filled,
    route: 'manage-point',
  },
  {
    name: '弹幕机 (OBS',
    desc: '在OBS上显示直播间弹幕、礼物和互动内容，兼容blivechat样式 (开发中',
    icon: Chat24Filled,
    route: 'manage-danmuji',
  },
  {
    name: '日程表',
    desc: '提供多种样式的日程表',
    icon: Calendar,
    route: 'manage-schedule',
  },
  {
    name: '自定义页面',
    desc: '用区块编辑器搭建个人主页/投稿页/赞助页等，自定义布局与样式',
    icon: BrowsersOutline,
    route: 'manage-userPageBuilder',
    badge: 'NEW',
  },
  {
    name: '歌单',
    desc: '可以放自己的歌单或者能唱的歌, 支持多种样式',
    icon: MusicalNote,
    route: 'manage-songList',
  },
  {
    name: '棉花糖 (提问箱',
    desc: '一个简单易用的提问箱',
    icon: Chatbox,
    route: 'manage-questionBox',
  },
  {
    name: '动态抽奖',
    desc: '从动态评论区抽取评论或者转发的用户',
    icon: Lottery24Filled,
    route: 'manage-lottery',
  },
  {
    name: '直播抽奖',
    desc: '从直播间弹幕或礼物抽取用户',
    icon: Lottery24Filled,
    route: 'manage-liveLottery',
  },
  {
    name: '弹幕点歌 (歌势)',
    desc: '可以让弹幕进行点歌, 然后自己唱',
    icon: ListCircle,
    route: 'manage-musicRequest',
  },
  {
    name: '弹幕点歌 (点播)',
    desc: '可以让弹幕进行点歌, 进行搜索后直接播放',
    icon: ListCircle,
    route: 'manage-liveRequest',
  },
  {
    name: '弹幕排队',
    desc: '通过发送弹幕和礼物加入队列, 允许设置多种条件',
    icon: ListCircle,
    route: 'manage-liveQueue',
  },
  {
    name: '读弹幕',
    desc: '通过浏览器自带的tts服务念出弹幕 (此功能需要 Chrome, Edge 等现代浏览器!)',
    icon: TabletSpeaker24Filled,
    route: 'manage-speech',
  },
  {
    name: '视频征集',
    desc: '创建用来收集视频链接的页面, 可以从动态爬取(画饼), 也可以提前对视频进行筛选',
    icon: VideoAdd20Filled,
    route: 'manage-videoCollect',
  },
  {
    name: '直播场次记录',
    desc: '记录每场直播的数据以及弹幕等内容',
    icon: VehicleShip24Filled,
    route: 'manage-live',
  },
  {
    name: '数据跟踪',
    desc: '绑定账号后查看粉丝 舰长 观看数 等数据的历史记录',
    icon: AnalyticsSharp,
    route: 'manage-history',
  },
  {
    name: '还有更多',
    desc: '更多功能仍在开发中. 有其他合理需求或者建议, 或者有想要添加的样式? 向我提出!',
    icon: MoreHorizontal24Filled,
    route: 'manage-tools-dashboard',
  },
]
interface IndexDataType {
  userCount: number
  streamers: {
    name: string
    uname: string
    avatar: string
    uid: number
    roomId: number
    title: string
    cover: string
    isStreaming: boolean
    parentArea: string
    area: string
    liveStartedAt: number
  }[]
}

const indexData = ref<IndexDataType>()

function formatDurationSeconds(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (hh > 0) return `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

function getRoomSubline(room: IndexDataType['streamers'][number]) {
  const area = [room.parentArea, room.area].filter(Boolean).join(' · ')
  if (!room.isStreaming || !room.liveStartedAt) return area
  const duration = formatDurationSeconds(Date.now() / 1000 - room.liveStartedAt)
  return area ? `${area} · ${duration}` : duration
}

function getRoomCoverSrc(room: IndexDataType['streamers'][number]) {
  return room.cover || room.avatar || ''
}

const roomsRowCapacity = computed(() => {
  const containerWidth = Math.min(width.value * 0.9, 1400)
  const gap = 12
  const cardWidth = width.value <= 480 ? 180 : (width.value <= 768 ? 200 : 220)
  return Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)))
})

const visibleRooms = computed(() => indexData.value?.streamers?.slice(0, roomsRowCapacity.value) ?? [])

const glassBg = computed(() => (isDarkMode.value ? 'rgba(9, 9, 11, 0.22)' : 'rgba(255, 255, 255, 0.42)'))
const glassBgSoft = computed(() => (isDarkMode.value ? 'rgba(9, 9, 11, 0.14)' : 'rgba(255, 255, 255, 0.30)'))
const indexGlassVars = computed(() => ({
  '--index-glass-bg': glassBg.value,
  '--index-glass-bg-soft': glassBgSoft.value,
  '--index-glass-border': isDarkMode.value ? 'rgba(255, 255, 255, 0.12)' : 'rgba(9, 9, 11, 0.08)',
}))

const textColor = computed(() => themeVars.value.textColor1)
const textColorSecondary = computed(() => themeVars.value.textColor2)

const featureIconColor = computed(() => (isDarkMode.value
  ? 'rgba(226, 232, 240, 0.9)'
  : 'rgba(15, 23, 42, 0.82)'))

const gradientColors = computed(() => ({
  from: themeVars.value.primaryColor,
  to: themeVars.value.infoColor,
}))

// 统一的圆角设计系统
const borderRadius = computed(() => ({
  small: themeVars.value.borderRadiusSmall,
  medium: themeVars.value.borderRadius,
  large: themeVars.value.borderRadius,
  xlarge: themeVars.value.borderRadius,
  round: '9999px',
}))

// 功能图标颜色映射 - 优化为统一的色系，与背景渐变协调
const iconColors = computed(() => {
  // 基于背景渐变色调的统一色板
  const baseColors = isDarkMode.value ? {
    // 暗色模式：更柔和的色调，降低饱和度
    teal: '#4ECDC4', // 青绿色 - 接近背景起始色
    purple: '#9B7EDE', // 紫色 - 接近背景结束色
    blue: '#6BB6FF', // 蓝色
    green: '#7ED321', // 绿色
    orange: '#F5A623', // 橙色
    pink: '#D63384', // 粉色
    indigo: '#6F42C1', // 靛蓝
    cyan: '#17A2B8', // 青色
    mint: '#20C997', // 薄荷绿
    lavender: '#B794F6', // 薰衣草紫
    coral: '#FF6B6B', // 珊瑚色
    sage: '#8FBC8F', // 鼠尾草绿
  } : {
    // 亮色模式：更鲜艳的色调，保持活力
    teal: '#2EBFA5', // 青绿色 - 与背景起始色呼应
    purple: '#8B5CF6', // 紫色 - 与背景结束色呼应
    blue: '#3B82F6', // 蓝色
    green: '#10B981', // 绿色
    orange: '#F59E0B', // 橙色
    pink: '#EC4899', // 粉色
    indigo: '#6366F1', // 靛蓝
    cyan: '#06B6D4', // 青色
    mint: '#14B8A6', // 薄荷绿
    lavender: '#A855F7', // 薰衣草紫
    coral: '#EF4444', // 珊瑚色
    sage: '#22C55E', // 鼠尾草绿
  }

  return {
    VehicleShip24Filled: baseColors.teal, // 直播事件记录 - 青绿色
    BookCoins20Filled: baseColors.orange, // 积分兑换 - 橙色
    Chat24Filled: baseColors.green, // 弹幕机 - 绿色
    Calendar: baseColors.pink, // 日程表 - 粉色
    MusicalNote: baseColors.purple, // 歌单 - 紫色
    Chatbox: baseColors.blue, // 棉花糖 - 蓝色
    Lottery24Filled: baseColors.coral, // 抽奖功能 - 珊瑚色
    ListCircle: baseColors.sage, // 点歌/排队功能 - 鼠尾草绿
    TabletSpeaker24Filled: baseColors.cyan, // 读弹幕 - 青色
    VideoAdd20Filled: baseColors.lavender, // 视频征集 - 薰衣草紫
    AnalyticsSharp: baseColors.mint, // 数据跟踪 - 薄荷绿
    MoreHorizontal24Filled: baseColors.indigo, // 更多功能 - 靛蓝
    PersonFeedback24Filled: baseColors.coral, // 自动操作 - 珊瑚色
  }
})

// 处理功能卡片点击
function handleFunctionClick(item: typeof functions[0]) {
  if (item.route) {
    // 跳转到对应的管理页面
    $router.push({ name: item.route })
  }
}

const particlesOptions = computed<RecursivePartial<IOptions>>(() => {
  const isDark = isDarkMode.value
  const dot = isDark ? 'rgba(255, 255, 255, 0.36)' : 'rgba(9, 9, 11, 0.22)'
  const link = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(9, 9, 11, 0.12)'
  const accents = isDark
    ? ['rgba(96, 165, 250, 0.22)', 'rgba(192, 132, 252, 0.18)', 'rgba(45, 212, 191, 0.18)']
    : ['rgba(59, 130, 246, 0.18)', 'rgba(168, 85, 247, 0.14)', 'rgba(20, 184, 166, 0.14)']

  return {
    background: { color: { value: 'transparent' } },
    fullScreen: { enable: false },
    fpsLimit: 60,
    detectRetina: true,
    particles: {
      number: { value: 42, density: { enable: true } },
      color: { value: [dot, ...accents] },
      shape: { type: 'circle' },
      opacity: { value: { min: 0.16, max: 0.36 } },
      size: { value: { min: 1, max: 2 } },
      links: { enable: true, distance: 140, color: link, opacity: 0.26, width: 1 },
      move: { enable: true, speed: 0.6, direction: 'none', outModes: { default: 'out' } },
    },
    interactivity: {
      events: {
        onHover: { enable: false, mode: [] },
        onClick: { enable: false, mode: [] },
        resize: { enable: true },
      },
    },
  }
})

onMounted(async () => {
  const data = await QueryGetAPI<IndexDataType>(`${VTSURU_API_URL}get-index-data`)
  if (data.code == 200) {
    indexData.value = data.data
  }
})
</script>

<template>
  <div class="index-background" :style="indexGlassVars">
    <vue-particles id="tsparticles" :key="isDarkMode ? 'dark' : 'light'" :options="particlesOptions" />
    <NSpace vertical justify="center" align="center" class="main-container">
      <!-- 顶部标题部分 -->
      <NCard
        :style="{
          width: '90vw',
          maxWidth: '1400px',
          borderRadius: borderRadius.xlarge,
        }" class="hero-card glass-card"
      >
        <NSpace justify="center" align="center" :size="width > 700 ? 50 : 0" :vertical="width <= 700">
          <vtb class="hero-icon" />
          <NSpace vertical justify="center" :align="width <= 700 ? 'center' : 'start'">
            <NGradientText
              :size="width > 700 ? '3rem' : '2.5rem'" :gradient="{
                deg: 180,
                ...gradientColors,
              }" style="font-weight: 700"
            >
              VTSURU.LIVE
            </NGradientText>
            <NText
              :style="{
                fontSize: width > 700 ? '1.5em' : '1.2em',
                fontWeight: 500,
                color: textColor,
                textAlign: width <= 700 ? 'center' : 'left',
              }"
            >
              一个给主播提供便利功能的网站 😊
            </NText>
            <!-- 主播 / 观众入口 -->
            <NFlex
              :wrap="width <= 700" justify="center" align="center"
              :style="{ gap: width > 700 ? '24px' : '16px', marginTop: '20px' }"
            >
              <!-- 主播入口 -->
              <NTooltip placement="bottom">
                <template #trigger>
                  <NCard
                    hoverable :style="{
                      width: width > 700 ? '240px' : '100%',
                      minWidth: '200px',
                      cursor: 'pointer',
                      borderRadius: borderRadius.large,
                    }" class="entry-card glass-card-soft" @click="$router.push({ name: 'manage-index' })"
                  >
                    <NFlex vertical align="center" justify="center" :size="8">
                      <NIcon :component="PersonFeedback24Filled" size="36" :color="textColor" />
                      <NText :style="{ fontSize: '1.2rem', fontWeight: 500, color: textColor }">
                        我是主播
                      </NText>
                      <NButton type="primary" secondary size="small" :style="{ borderRadius: borderRadius.medium }">
                        开始使用
                      </NButton>
                    </NFlex>
                  </NCard>
                </template>
                进入主播后台，管理直播相关工具与设置
              </NTooltip>

              <!-- 观众入口 -->
              <NTooltip placement="bottom">
                <template #trigger>
                  <NCard
                    hoverable :style="{
                      width: width > 700 ? '240px' : '100%',
                      minWidth: '200px',
                      cursor: 'pointer',
                      borderRadius: borderRadius.large,
                    }" class="entry-card glass-card-soft" @click="$router.push({ name: 'bili-user' })"
                  >
                    <NFlex vertical align="center" justify="center" :size="8">
                      <NIcon :component="Chat24Filled" size="36" :color="textColor" />
                      <NText :style="{ fontSize: '1.2rem', fontWeight: 500, color: textColor }">
                        我是观众
                      </NText>
                      <NButton type="info" secondary size="small" :style="{ borderRadius: borderRadius.medium }">
                        用户主页
                      </NButton>
                    </NFlex>
                  </NCard>
                </template>
                进入个人主页，查看积分与互动记录
              </NTooltip>
            </NFlex>

            <!-- 其他操作按钮 -->
            <NFlex justify="center" align="center" :wrap="width <= 700" :style="{ marginTop: '20px', gap: '12px' }">
              <NButton
                size="large" secondary :style="{ borderRadius: borderRadius.large }"
                @click="$router.push('/@Megghy')"
              >
                展示
              </NButton>
              <NButton
                size="large" tag="a" href="https://play-live.bilibili.com/details/1698742711771" target="_blank"
                color="#ff778f" :style="{ borderRadius: borderRadius.large }"
              >
                幻星平台
              </NButton>
              <NButton
                type="info" size="large" :style="{ borderRadius: borderRadius.large }"
                @click="$router.push({ name: 'about' })"
              >
                关于
              </NButton>
            </NFlex>
          </NSpace>
        </NSpace>
      </NCard>

      <!-- 用户统计部分 -->
      <NCard
        :style="{
          width: '90vw',
          maxWidth: '1400px',
          borderRadius: borderRadius.medium,
        }" size="small" class="glass-card-soft"
      >
        <NFlex justify="center" align="center">
          <div class="stats-item">
            <NText :style="{ fontSize: '0.8rem', color: textColorSecondary, display: 'block', textAlign: 'center' }">
              注册用户
            </NText>
            <NText
              :style="{ fontSize: '1.2rem', fontWeight: 600, color: textColor, display: 'block', textAlign: 'center' }"
            >
              <NNumberAnimation :from="0" :to="indexData?.userCount" show-separator />
            </NText>
          </div>
        </NFlex>
      </NCard>

      <!-- 功能列表部分 -->
      <NCard
        :style="{
          width: '90vw',
          maxWidth: '1400px',
          marginBottom: '20px',
          borderRadius: borderRadius.xlarge,
        }" class="glass-card"
      >
        <NFlex vertical>
          <NFlex justify="center" align="center" style="margin-bottom: 30px;">
            <div class="section-header">
              <NText class="section-title">
                🌟 网站功能
              </NText>
              <div class="section-subtitle">
                <NText :style="{ color: textColorSecondary, fontSize: '0.9rem' }">
                  为主播和观众提供丰富的互动工具
                </NText>
              </div>
            </div>
          </NFlex>

          <NFlex :wrap="true" justify="center" style="gap: 15px;">
            <NCard
              v-for="item in functions" :key="item.name" :style="{
                width: '300px',
                maxWidth: '100%',
                borderRadius: borderRadius.large,
                boxShadow: 'none',
                cursor: item.route ? 'pointer' : 'default',
              }" hoverable class="feature-card glass-card-soft" @click="handleFunctionClick(item)"
            >
              <NFlex vertical>
                <NFlex align="center" style="margin-bottom: 10px;">
                  <div class="icon-wrapper">
                    <NIcon
                      :component="item.icon" size="24"
                      :color="featureIconColor"
                    />
                  </div>
                  <NFlex align="center" :size="8" style="margin-left: 12px;">
                    <NText :style="{ fontSize: '1.1rem', fontWeight: 500, color: textColor }">
                      {{ item.name }}
                    </NText>
                    <span v-if="(item as any).badge" class="feature-badge-new">
                      {{ (item as any).badge }}
                    </span>
                  </NFlex>
                </NFlex>
                <NText :style="{ lineHeight: 1.6, color: textColorSecondary }">
                  {{ item.desc }}
                </NText>
              </NFlex>
            </NCard>
          </NFlex>
        </NFlex>
      </NCard>

      <!-- 自定义页面功能介绍 -->
      <NCard
        :style="{
          width: '90vw',
          maxWidth: '1400px',
          marginBottom: '20px',
          borderRadius: borderRadius.xlarge,
        }" class="glass-card"
      >
        <NFlex vertical>
          <NFlex justify="center" align="center" style="margin-bottom: 30px;">
            <div class="section-header">
              <NText class="section-title">
                自定义页面（区块编辑器）
              </NText>
              <div class="section-subtitle">
                <NText :style="{ color: textColorSecondary, fontSize: '0.9rem' }">
                  用区块搭建个人主页/投稿页/赞助页等，自定义布局与样式
                </NText>
              </div>
            </div>
          </NFlex>

          <div class="userpage-intro-layout">
            <div class="userpage-intro-copy">
              <NText :style="{ color: textColor, fontSize: '1rem', fontWeight: 500 }">
                像搭积木一样拼页面
              </NText>
              <div style="height: 8px;" />
              <NText :style="{ color: textColorSecondary, lineHeight: 1.7 }">
                支持分组与布局（横向/纵向/拉伸），并提供边框、背景、间距等常用样式开关；编辑区与预览区实时同步，方便调试。
              </NText>
              <div style="height: 12px;" />
              <div class="userpage-intro-list">
                <div class="userpage-intro-li">
                  - 包括但不仅限于: 个人主页 / 投稿页 / 赞助页 / 图集展示 / 视频展示...
                </div>
                <div class="userpage-intro-li">
                  - 支持：区块组合、拖拽排序、组件级样式与预览
                </div>
              </div>
              <div style="height: 14px;" />
              <NFlex :wrap="true" justify="start" style="gap: 10px;">
                <NButton type="primary" :style="{ borderRadius: borderRadius.medium }" @click="$router.push({ name: 'manage-userPageBuilder' })">
                  打开编辑器
                </NButton>
                <NButton secondary :style="{ borderRadius: borderRadius.medium }" @click="$router.push('/@Megghy')">
                  查看示例
                </NButton>
              </NFlex>
            </div>

            <div class="userpage-intro-media">
              <div class="userpage-intro-image">
                <img
                  src="https://files.vtsuru.suki.club/updatelog/屏幕截图 2026-01-16 213146.png"
                  referrerpolicy="no-referrer"
                  alt="自定义页面"
                >
              </div>
            </div>
          </div>
        </NFlex>
      </NCard>

      <!-- 客户端专属功能部分 -->
      <NCard
        :style="{
          width: '90vw',
          maxWidth: '1400px',
          marginBottom: '20px',
          borderRadius: borderRadius.xlarge,
        }" class="glass-card"
      >
        <NFlex vertical>
          <NFlex justify="center" align="center" style="margin-bottom: 30px;">
            <div class="section-header">
              <NText class="section-title">
                客户端功能
              </NText>
              <div class="section-subtitle">
                <NText :style="{ color: textColorSecondary, fontSize: '0.9rem' }">
                  本地运行的强大自动化工具
                </NText>
              </div>
            </div>
          </NFlex>

          <NFlex :wrap="true" justify="center" style="gap: 20px;">
            <NCard
              :style="{
                width: '380px',
                maxWidth: '100%',
                borderRadius: borderRadius.large,
                boxShadow: 'none',
              }" hoverable class="feature-card glass-card-soft"
            >
              <NFlex vertical>
                <NFlex align="center" style="margin-bottom: 10px;">
                  <div class="icon-wrapper">
                    <NIcon :component="PersonFeedback24Filled" size="24" :color="iconColors.PersonFeedback24Filled" />
                  </div>
                  <NText :style="{ fontSize: '1.1rem', fontWeight: 500, marginLeft: '12px', color: textColor }">
                    自动操作
                  </NText>
                </NFlex>
                <NText :style="{ lineHeight: 1.6, color: textColorSecondary }">
                  支持弹幕自动回复、礼物感谢、上舰私信、关注感谢、入场欢迎、定时发送和SC感谢等功能，使用模板系统和JS执行环境，可定制化程度挺高
                </NText>
              </NFlex>
            </NCard>

            <NCard
              :style="{
                width: '380px',
                maxWidth: '100%',
                borderRadius: borderRadius.large,
                boxShadow: 'none',
              }" hoverable class="feature-card glass-card-soft"
            >
              <NFlex vertical>
                <NFlex align="center" style="margin-bottom: 10px;">
                  <div class="icon-wrapper">
                    <NIcon :component="Chat24Filled" size="24" :color="iconColors.Chat24Filled" />
                  </div>
                  <NText :style="{ fontSize: '1.1rem', fontWeight: 500, marginLeft: '12px', color: textColor }">
                    弹幕机 (客户端)
                  </NText>
                </NFlex>
                <NText :style="{ lineHeight: 1.6, color: textColorSecondary }">
                  在自己电脑上显示直播间弹幕、礼物和互动内容
                </NText>
              </NFlex>
            </NCard>
          </NFlex>

          <NFlex justify="center" style="margin-top: 20px;">
            <NSpace>
              <NButton
                type="primary" tag="a" href="https://www.wolai.com/carN6qvUm3FErze9Xo53ii" target="_blank"
                :style="{ borderRadius: borderRadius.medium }"
              >
                <template #icon>
                  <NIcon :component="Info24Filled" />
                </template>
                客户端安装说明
              </NButton>
              <NButton
                ghost tag="a" href="https://github.com/Megghy/vtsuru-fetvher-client" target="_blank"
                color="white" :style="{ borderRadius: borderRadius.medium }"
              >
                客户端代码
              </NButton>
              <NButton
                ghost tag="a" href="https://github.com/Megghy/vtsuru.live/tree/master/src/client" target="_blank"
                color="white" :style="{ borderRadius: borderRadius.medium }"
              >
                逻辑代码
              </NButton>
            </NSpace>
          </NFlex>
        </NFlex>
      </NCard>

      <!-- 直播间列表 -->
      <NCard
        :style="{
          width: '90vw',
          maxWidth: '1400px',
          borderRadius: borderRadius.xlarge,
          boxShadow: 'none',
        }" class="glass-card"
      >
        <NFlex vertical>
          <NFlex justify="center" align="center" style="margin-bottom: 30px;">
            <div class="section-header">
              <NText class="section-title">
                正在使用本站的主播们
                <NTooltip>
                  <template #trigger>
                    <NIcon :component="Info24Filled" :color="textColor" size="16" style="margin-left: 8px;" />
                  </template>
                  随机展示不分先后, 仅粉丝数大于500的主播；展示其直播间信息与开播状态
                </NTooltip>
              </NText>
              <div class="section-subtitle">
                <NText :style="{ color: textColorSecondary, fontSize: '0.9rem' }">
                  感谢支持 🙂
                </NText>
              </div>
            </div>
          </NFlex>

          <div v-if="indexData" class="streamers-section">
            <!-- 直播间 mini 卡片 -->
            <div class="rooms-grid-mini">
              <div
                v-for="room in visibleRooms" :key="room.roomId" class="room-mini-card"
                :class="{ live: room.isStreaming }"
                @click="$router.push(`/@${room.name}`)"
              >
                <div class="room-mini-cover">
                  <img
                    v-if="getRoomCoverSrc(room)"
                    class="room-mini-cover-img"
                    :src="getRoomCoverSrc(room)"
                    referrerpolicy="no-referrer"
                    alt=""
                  >
                  <div class="room-mini-cover__mask" />
                  <div class="room-mini-content">
                    <div class="room-mini-top">
                      <div class="room-mini-header">
                        <img
                          class="room-mini-avatar"
                          :src="`${room.avatar}@96w`"
                          referrerpolicy="no-referrer"
                          alt="主播头像"
                        >
                        <div class="room-mini-meta">
                          <div class="room-mini-name" :title="room.uname || room.name">
                            {{ room.uname || room.name }}
                          </div>
                          <div class="room-mini-status" :class="{ live: room.isStreaming }">
                            {{ room.isStreaming ? 'LIVE' : 'OFFLINE' }}
                          </div>
                        </div>
                      </div>
                      <div class="room-mini-actions">
                        <a
                          class="room-mini-btn"
                          :href="`https://live.bilibili.com/${room.roomId}`"
                          target="_blank"
                          rel="noreferrer"
                          aria-label="打开直播间"
                          title="打开直播间"
                          @click.stop
                        >
                          <NIcon :component="OpenOutline" size="16" />
                        </a>
                      </div>
                    </div>
                    <div class="room-mini-spacer" />
                    <div class="room-mini-bottom">
                      <div class="room-mini-bottom__left">
                        <div class="room-mini-title" :title="room.title">
                          {{ room.title || '（暂无标题）' }}
                        </div>
                        <div class="room-mini-sub" :title="getRoomSubline(room)">
                          {{ getRoomSubline(room) }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部信息 -->
            <div class="streamers-footer">
              <NFlex vertical align="center" :size="16" style="margin-top: 32px;">
                <div class="more-indicator">
                  <div class="dots-container">
                    <div class="dot" />
                    <div class="dot" />
                    <div class="dot" />
                  </div>
                  <NText :style="{ color: textColor, fontSize: '0.9rem', fontWeight: 500 }">
                    还有更多...
                  </NText>
                </div>

                <NFlex align="center" justify="center" :size="8">
                  <NIcon :component="Info24Filled" size="14" :color="textColorSecondary" />
                  <NText :style="{ color: textColorSecondary, fontSize: '0.8rem', textAlign: 'center' }">
                    不想被展示？前往
                    <NButton
                      text size="tiny" :style="{
                        color: textColor,
                        fontSize: '0.8rem',
                        padding: '0 4px',
                        textDecoration: 'underline',
                      }" @click="$router.push({ name: 'manage-userPageBuilder', query: { mode: 'legacy' } })"
                    >
                      设置页面 (渲染模式-传统-允许展示在主页)
                    </NButton>
                    关闭展示
                  </NText>
                </NFlex>
              </NFlex>
            </div>
          </div>
        </NFlex>
      </NCard>
    </NSpace>
    <NFlex justify="center" class="footer">
      <span :style="{ color: textColor }">
        BY
        <NButton
          tag="a" href="https://space.bilibili.com/10021741" target="_blank" text :style="{
            color: isDarkMode ? 'rgb(200, 235, 220)' : 'rgb(215, 245, 230)',
            borderRadius: borderRadius.small,
          }"
        >
          Megghy
        </NButton>
      </span>
    </NFlex>
  </div>
</template>

<style lang="stylus" scoped>
.index-background
    position: relative;
    min-height: 100vh;
    background-color: var(--n-body-color);
    overflow-x: hidden;
    overflow-y: auto;
    padding-bottom: 60px;
    isolation: isolate;

:deep(#tsparticles)
    position: fixed;
    inset: 0;
    z-index: 1;
    pointer-events: none;

:deep(#tsparticles canvas)
    width: 100% !important;
    height: 100% !important;

:deep(.main-container .n-card)
    background-color: var(--index-glass-bg-soft) !important;
    border: 1px solid var(--index-glass-border) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);

:deep(.glass-card.n-card)
    background-color: var(--index-glass-bg) !important;
    border: 1px solid var(--index-glass-border) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);

:deep(.glass-card-soft.n-card)
    background-color: var(--index-glass-bg-soft) !important;
    border: 1px solid var(--index-glass-border) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);

.main-container
    position: relative;
    z-index: 2;
    padding-top: 30px;
    padding-bottom: 30px;

.hero-card
    position: relative;
    overflow: hidden;

.hero-icon
    animation: logo-float 6s ease-in-out infinite;
    will-change: transform;

@media (prefers-reduced-motion: reduce)
    .hero-icon
        animation: none;

@keyframes logo-float
    0%, 100%
        transform: translateY(0);
    50%
        transform: translateY(-8px);

.section-title
    font-size: 1.2rem;
    font-weight: 500;
    color: var(--n-text-color);

.footer
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    margin: 0 auto;
    width: 100%;
    padding: 16px 0;

/* 响应式设计 */
@media (max-width: 700px)
    .main-container
        padding-top: 20px;
        padding-bottom: 20px;

    .section-title
        font-size: 1.1rem;

/* 新增样式 */
.section-header
    text-align: center;

.section-subtitle
    margin-top: 8px;

.userpage-intro-layout
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-start;
    gap: 18px;
    width: 100%;

.userpage-intro-copy
    flex: 1 1 360px;
    max-width: 640px;

.userpage-intro-list
    display: flex;
    flex-direction: column;
    gap: 6px;

.userpage-intro-li
    color: var(--n-text-color-2);
    font-size: 0.92rem;
    line-height: 1.5;

.userpage-intro-media
    flex: 0 1 520px;
    width: 100%;
    max-width: 460px;

.userpage-intro-image
    width: 100%;
    height: 220px;
    border-radius: 14px;
    border: 1px solid rgba(127, 127, 127, 0.45);
    background: rgba(127, 127, 127, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(127, 127, 127, 0.85);
    user-select: none;
    overflow: hidden;

.userpage-intro-image img
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;

:global(.dark) .userpage-intro-image
    border: 1px dashed rgba(200, 200, 200, 0.35);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(220, 220, 220, 0.75);

.icon-wrapper
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--n-border-radius);
    background: rgba(255, 255, 255, 0.34);
    border: 1px solid var(--n-border-color);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);

:global(.dark) .icon-wrapper
    background: rgba(9, 9, 11, 0.24);

.feature-badge-new
    display: inline-flex;
    align-items: center;
    height: 18px;
    padding: 0 8px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: 1px solid var(--index-glass-border);
    background: rgba(255, 255, 255, 0.26);
    color: rgba(9, 9, 11, 0.78);

:global(.dark) .feature-badge-new
    background: rgba(9, 9, 11, 0.35);
    color: rgba(255, 255, 255, 0.86);

.stats-item
    padding: 8px 16px;

/* 直播间展示区域 */
.streamers-section
    width: 100%;
    margin: 0 auto;

.rooms-grid-mini
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    gap: 12px;
    width: 100%;
    margin: 0 auto;
    padding: 0 6px;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%);
    mask-image: linear-gradient(90deg, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;

.room-mini-card
    width: 220px;
    flex: 0 0 auto;
    border-radius: 14px;
    border: 1px solid var(--index-glass-border);
    overflow: hidden;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.28);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 1px 2px rgba(9, 9, 11, 0.08);
    transition: transform 140ms var(--n-bezier), box-shadow 140ms var(--n-bezier), border-color 140ms var(--n-bezier);

:global(.dark) .room-mini-card
    background: rgba(9, 9, 11, 0.26);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);

.room-mini-card.live
    border-color: rgba(16, 185, 129, 0.32);
    box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.10), 0 1px 2px rgba(9, 9, 11, 0.08);
    animation: live-card-breathe 3.2s ease-in-out infinite;

:global(.dark) .room-mini-card.live
    border-color: rgba(16, 185, 129, 0.28);
    box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.10), 0 1px 2px rgba(0, 0, 0, 0.35);

.room-mini-card:hover
    transform: translateY(-1px);
    box-shadow: 0 6px 14px rgba(9, 9, 11, 0.12);
    border-color: rgba(255, 255, 255, 0.2);

:global(.dark) .room-mini-card:hover
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.46);

.room-mini-cover
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background-color: rgba(127, 127, 127, 0.10);

.room-mini-cover-img
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    filter: blur(2px) saturate(1.05);
    transform: scale(1.02);

.room-mini-cover__mask
    position: absolute;
    inset: 0;
    z-index: 0;
    background: linear-gradient(180deg, rgba(9, 9, 11, 0.28) 0%, rgba(9, 9, 11, 0.56) 62%, rgba(9, 9, 11, 0.76) 100%);

.room-mini-content
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    padding: 10px;

.room-mini-top
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;

.room-mini-header
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;

.room-mini-avatar
    width: 34px;
    height: 34px;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    object-fit: cover;
    background: rgba(255, 255, 255, 0.12);
    flex-shrink: 0;

.room-mini-meta
    display: flex;
    flex-direction: column;
    min-width: 0;

.room-mini-name
    font-size: 0.92rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.92);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

.room-mini-status
    position: relative;
    margin-top: 4px;
    width: fit-content;
    padding: 1px 7px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.12);

.room-mini-status.live
    color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(16, 185, 129, 0.45);
    background: rgba(16, 185, 129, 0.22);
    padding-left: 16px;

.room-mini-status.live::before
    content: '';
    position: absolute;
    left: 6px;
    top: 50%;
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    transform: translateY(-50%);
    background: rgba(16, 185, 129, 0.95);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.0);
    animation: live-dot-pulse 1.6s ease-out infinite;

@media (prefers-reduced-motion: reduce)
    .room-mini-card.live
        animation: none;
    .room-mini-status.live::before
        animation: none;

@keyframes live-dot-pulse
    0%
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.0);
        opacity: 0.95;
    45%
        box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.20);
        opacity: 0.95;
    100%
        box-shadow: 0 0 0 12px rgba(16, 185, 129, 0.0);
        opacity: 0.75;

@keyframes live-card-breathe
    0%, 100%
        box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.10), 0 1px 2px rgba(9, 9, 11, 0.08);
    50%
        box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.16), 0 10px 24px rgba(16, 185, 129, 0.08);

.room-mini-spacer
    flex: 1 1 auto;
    min-height: 8px;

.room-mini-bottom
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;

.room-mini-bottom__left
    min-width: 0;
    flex: 1 1 auto;

.room-mini-title
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.86rem;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

.room-mini-sub
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.2;
    color: rgba(255, 255, 255, 0.78);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

.room-mini-actions
    display: flex;
    justify-content: flex-end;
    flex: 0 0 auto;

.room-mini-btn
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(9, 9, 11, 0.22);
    color: rgba(255, 255, 255, 0.92);
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    transition: background 140ms var(--n-bezier), border-color 140ms var(--n-bezier), transform 140ms var(--n-bezier);

.room-mini-btn:hover
    background: rgba(9, 9, 11, 0.32);
    border-color: rgba(255, 255, 255, 0.28);
    transform: translateY(-1px);

.streamers-footer
    margin-top: 24px;

.more-indicator
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;

.dots-container
    display: flex;
    gap: 5px;
    align-items: center;

.dot
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--n-text-color-3);

/* 响应式优化 */
@media (max-width: 768px)
    .rooms-grid-mini
        gap: 10px;
        -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%);
        mask-image: linear-gradient(90deg, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%);
    .room-mini-card
        width: 200px;

@media (max-width: 480px)
    .rooms-grid-mini
        gap: 10px;
        -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%);
        mask-image: linear-gradient(90deg, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%);
    .room-mini-card
        width: 180px;

</style>
