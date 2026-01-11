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
import { AnalyticsSharp, Calendar, Chatbox, ListCircle, MusicalNote } from '@vicons/ionicons5'
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
  streamers: { name: string, uname: string, avatar: string, uid: number, roomId: number }[]
}

const indexData = ref<IndexDataType>()

const glassBg = computed(() => (isDarkMode.value ? 'rgba(9, 9, 11, 0.45)' : 'rgba(255, 255, 255, 0.52)'))
const glassBgSoft = computed(() => (isDarkMode.value ? 'rgba(9, 9, 11, 0.34)' : 'rgba(255, 255, 255, 0.38)'))
const indexGlassVars = computed(() => ({
  '--index-glass-bg': glassBg.value,
  '--index-glass-bg-soft': glassBgSoft.value,
  '--index-glass-border': isDarkMode.value ? 'rgba(255, 255, 255, 0.12)' : 'rgba(9, 9, 11, 0.08)',
}))

const textColor = computed(() => themeVars.value.textColor1)
const textColorSecondary = computed(() => themeVars.value.textColor2)

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
  const dot = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(9, 9, 11, 0.14)'
  const link = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(9, 9, 11, 0.08)'
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
      opacity: { value: { min: 0.08, max: 0.22 } },
      size: { value: { min: 1, max: 2 } },
      links: { enable: true, distance: 140, color: link, opacity: 0.18, width: 1 },
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
                      :color="iconColors[item.icon.name as keyof typeof iconColors] || textColor"
                    />
                  </div>
                  <NText :style="{ fontSize: '1.1rem', fontWeight: 500, marginLeft: '12px', color: textColor }">
                    {{ item.name }}
                  </NText>
                </NFlex>
                <NText :style="{ lineHeight: 1.6, color: textColorSecondary }">
                  {{ item.desc }}
                </NText>
              </NFlex>
            </NCard>
          </NFlex>
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
                💻 客户端功能
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

      <!-- 使用本站的主播部分 -->
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
                👥 正在使用本站的主播们
                <NTooltip>
                  <template #trigger>
                    <NIcon :component="Info24Filled" :color="textColor" size="16" style="margin-left: 8px;" />
                  </template>
                  随机展示不分先后, 仅粉丝数大于500的主播
                </NTooltip>
              </NText>
              <div class="section-subtitle">
                <NText :style="{ color: textColorSecondary, fontSize: '0.9rem' }">
                  感谢信任与支持
                </NText>
              </div>
            </div>
          </NFlex>

          <div v-if="indexData" class="streamers-section">
            <!-- 主播卡片网格 -->
            <div class="streamers-grid-modern">
              <div
                v-for="streamer in indexData?.streamers" :key="streamer.name" class="streamer-card-modern"
                @click="$router.push(`/@${streamer.name}`)"
              >
                <div class="streamer-avatar-wrapper">
                  <img :src="`${streamer.avatar}@96w`" referrerpolicy="no-referrer" alt="主播头像">
                </div>
                <NTooltip :disabled="(streamer.uname || streamer.name).length <= 7">
                  <template #trigger>
                    <div class="streamer-name">
                      {{ streamer.uname || streamer.name }}
                    </div>
                  </template>
                  {{ streamer.uname || streamer.name }}
                </NTooltip>
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
                    还有更多主播正在使用
                  </NText>
                </div>

                <NCard
                  :style="{
                    borderRadius: borderRadius.medium,
                    padding: '12px 20px',
                    maxWidth: '400px',
                  }" size="small" class="glass-card-soft"
                >
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
                        设置页面
                      </NButton>
                      关闭展示
                    </NText>
                  </NFlex>
                </NCard>
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
    z-index: 0;
    pointer-events: none;

:deep(#tsparticles canvas)
    width: 100% !important;
    height: 100% !important;

:deep(.glass-card.n-card)
    background-color: var(--index-glass-bg) !important;
    border: 1px solid var(--index-glass-border) !important;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);

:deep(.glass-card-soft.n-card)
    background-color: var(--index-glass-bg-soft) !important;
    border: 1px solid var(--index-glass-border) !important;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);

.main-container
    position: relative;
    z-index: 1;
    padding-top: 30px;
    padding-bottom: 30px;

.hero-card
    position: relative;
    overflow: hidden;

.hero-icon

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

.stats-item
    padding: 8px 16px;

/* 现代化主播展示区域 */
.streamers-section
    width: 100%;
    margin: 0 auto;

.streamers-grid-modern
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    width: 100%;
    margin: 0 auto;
    padding: 0 4px;

.streamer-card-modern
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 10px 8px;
    border: 1px solid rgba(66, 66, 61, 0.5);
    border-radius: var(--n-border-radius);
    cursor: pointer;
    min-width: 85px;
    max-width: 95px;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);

:global(.dark) .streamer-card-modern
    background: rgba(9, 9, 11, 0.26);
    border: 1px solid rgba(255, 255, 255, 0.12);

.streamer-avatar-wrapper
    position: relative;
    width: 50px;
    height: 50px;
    flex-shrink: 0;

    img
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 1px solid var(--n-border-color);
        object-fit: cover;
        display: block;

.streamer-name
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--n-text-color);
    text-align: center;
    line-height: 1.3;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0 4px;

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
    .streamers-grid-modern
        gap: 8px;
        padding: 0 4px;

    .streamer-card-modern
        min-width: 80px;
        max-width: 90px;
        padding: 8px 6px;

@media (max-width: 480px)
    .streamers-grid-modern
        gap: 6px;
        padding: 0 4px;

    .streamer-card-modern
        min-width: 75px;
        max-width: 85px;
        padding: 8px 6px;

    .streamer-avatar-wrapper
        width: 45px;
        height: 45px;

    .streamer-name
        font-size: 0.8rem;

</style>
