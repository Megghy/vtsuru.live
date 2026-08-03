<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import { QueryGetAPI } from '@/api/query'
import HomeEmojiBackdrop from '@/apps/web/components/HomeEmojiBackdrop.vue'
import { VTSURU_API_URL } from '@/shared/config'
import vtb from '@/svgs/ic_vtuber.svg'

const $router = useRouter()

const featureTones = ['tone-cyan', 'tone-yellow', 'tone-coral'] as const

const functions = [
  {
    name: '直播事件记录',
    desc: '能够记录并查询上舰和SC记录',
    icon: 'i-lucide-anchor',
    route: 'manage-event',
  },
  {
    name: '积分兑换',
    desc: '通过上舰, Superchat, 赠送礼物等操作可以获取积分, 并通过积分兑换虚拟或者实体礼物',
    icon: 'i-lucide-coins',
    route: 'manage-point',
  },
  {
    name: '弹幕机（OBS）',
    desc: '在 OBS 上显示直播间弹幕、礼物和互动内容，兼容 blivechat 样式（开发中）',
    icon: 'i-lucide-message-square',
    route: 'manage-danmuji',
  },
  {
    name: '日程表',
    desc: '提供多种样式的日程表',
    icon: 'i-lucide-calendar-days',
    route: 'manage-schedule',
  },
  {
    name: '自定义页面',
    desc: '用区块编辑器搭建个人主页/投稿页/赞助页等，自定义布局与样式',
    icon: 'i-lucide-panels-top-left',
    route: 'manage-userPageBuilder',
    badge: 'NEW',
  },
  {
    name: '歌单',
    desc: '可以放自己的歌单或者能唱的歌, 支持多种样式',
    icon: 'i-lucide-music',
    route: 'manage-songList',
  },
  {
    name: '棉花糖（提问箱）',
    desc: '一个简单易用的提问箱',
    icon: 'i-lucide-message-circle-question',
    route: 'manage-questionBox',
  },
  {
    name: '动态抽奖',
    desc: '从动态评论区抽取评论或者转发的用户',
    icon: 'i-lucide-dices',
    route: 'manage-lottery',
  },
  {
    name: '直播抽奖',
    desc: '从直播间弹幕或礼物抽取用户',
    icon: 'i-lucide-trophy',
    route: 'manage-liveLottery',
  },
  {
    name: '弹幕点歌（歌势）',
    desc: '可以让弹幕进行点歌, 然后自己唱',
    icon: 'i-lucide-list-music',
    route: 'manage-musicRequest',
  },
  {
    name: '弹幕点歌（点播）',
    desc: '可以让弹幕进行点歌, 进行搜索后直接播放',
    icon: 'i-lucide-list-video',
    route: 'manage-liveRequest',
  },
  {
    name: '弹幕排队',
    desc: '通过发送弹幕和礼物加入队列, 允许设置多种条件',
    icon: 'i-lucide-list-ordered',
    route: 'manage-liveQueue',
  },
  {
    name: '读弹幕',
    desc: '通过浏览器自带的tts服务念出弹幕 (此功能需要 Chrome, Edge 等现代浏览器!)',
    icon: 'i-lucide-volume-2',
    route: 'manage-speech',
  },
  {
    name: '视频征集',
    desc: '创建用来收集视频链接的页面, 可以从动态爬取(画饼), 也可以提前对视频进行筛选',
    icon: 'i-lucide-video',
    route: 'manage-videoCollect',
  },
  {
    name: '直播场次记录',
    desc: '记录每场直播的数据以及弹幕等内容',
    icon: 'i-lucide-radio',
    route: 'manage-live',
  },
  {
    name: '数据跟踪',
    desc: '绑定账号后查看粉丝 舰长 观看数 等数据的历史记录',
    icon: 'i-lucide-chart-no-axes-combined',
    route: 'manage-history',
  },
  {
    name: '还有更多',
    desc: '更多功能仍在开发中. 有其他合理需求或者建议, 或者有想要添加的样式? 向我提出!',
    icon: 'i-lucide-ellipsis',
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
const isRefreshingRooms = ref(false)
const canScrollRoomsLeft = ref(false)
const canScrollRoomsRight = ref(false)
const roomsScroller = useTemplateRef<HTMLElement>('roomsScroller')

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

function handleFunctionClick(item: (typeof functions)[0]) {
  $router.push({ name: item.route })
}

function getFeatureTone(index: number) {
  return featureTones[index % featureTones.length]
}

function updateRoomsScrollState() {
  const scroller = roomsScroller.value
  if (!scroller) return

  canScrollRoomsLeft.value = scroller.scrollLeft > 1
  canScrollRoomsRight.value = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1
}

function scrollRooms(direction: -1 | 1) {
  const scroller = roomsScroller.value
  if (!scroller) return

  scroller.scrollBy({ left: direction * scroller.clientWidth * 0.8, behavior: 'smooth' })
}

useResizeObserver(roomsScroller, updateRoomsScrollState)

async function loadIndexData() {
  isRefreshingRooms.value = true
  try {
    const data = await QueryGetAPI<IndexDataType>(`${VTSURU_API_URL}get-index-data`)
    if (data.code !== 200) throw new Error(`Failed to load index data: ${data.code}`)

    indexData.value = data.data
    await nextTick()
    roomsScroller.value?.scrollTo({ left: 0, behavior: 'smooth' })
    updateRoomsScrollState()
  } finally {
    isRefreshingRooms.value = false
  }
}

onMounted(() => {
  void loadIndexData()
})
</script>

<template>
  <div class="index-background">
    <HomeEmojiBackdrop />
    <main class="main-container">
      <section class="hero-section home-section">
        <div class="hero-layout">
          <vtb class="hero-icon" />
          <div class="hero-content">
            <h1 class="brand-title">VTSURU.LIVE</h1>
            <p class="hero-tagline">一个给主播提供便利功能的网站 😊</p>

            <div class="entry-grid">
              <UTooltip text="进入主播后台，管理直播相关工具与设置">
                  <button
                    type="button"
                    class="entry-card tone-cyan"
                    @click="$router.push({ name: 'manage-index' })"
                  >
                    <UIcon name="i-lucide-radio-tower" class="entry-card__icon" />
                    <strong>我是主播</strong>
                    <span>开始使用</span>
                  </button>
              </UTooltip>

              <UTooltip text="进入 Bilibili 账户中心，查看积分与互动记录">
                  <button
                    type="button"
                    class="entry-card tone-yellow"
                    @click="$router.push({ name: 'bili-user-points' })"
                  >
                    <UIcon name="i-lucide-circle-user-round" class="entry-card__icon" />
                    <strong>我是观众</strong>
                    <span>账户中心</span>
                  </button>
              </UTooltip>
            </div>

            <div class="hero-actions">
              <UButton
                color="neutral"
                variant="soft"
                @click="$router.push('/@Megghy')"
              >
                展示
              </UButton>
              <UButton
                color="primary"
                to="https://play-live.bilibili.com/details/1698742711771"
                target="_blank"
              >
                幻星平台
              </UButton>
              <UButton
                color="info"
                @click="$router.push({ name: 'about' })"
              >
                关于
              </UButton>
            </div>

            <div class="hero-stat">
              <span>注册用户</span>
              <strong>{{ (indexData?.userCount ?? 0).toLocaleString() }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="home-section">
        <header class="section-header">
          <h2 class="section-title">网站功能</h2>
          <p class="section-subtitle">为主播和观众提供丰富的互动工具</p>
        </header>
        <div class="feature-grid">
          <button
            v-for="(item, index) in functions"
            :key="item.name"
            type="button"
            class="feature-card"
            :class="getFeatureTone(index)"
            @click="handleFunctionClick(item)"
          >
            <span class="feature-card-header">
              <span class="icon-wrapper">
                <UIcon :name="item.icon" />
              </span>
              <span class="feature-card-title">{{ item.name }}</span>
              <span
                v-if="item.badge"
                class="feature-badge-new"
              >
                {{ item.badge }}
              </span>
            </span>
            <span class="feature-card-desc">{{ item.desc }}</span>
          </button>
        </div>
      </section>

      <section class="home-section userpage-section">
        <header class="section-header">
          <h2 class="section-title">自定义页面（区块编辑器）</h2>
          <p class="section-subtitle">用区块搭建个人主页、投稿页或赞助页</p>
        </header>
        <div class="userpage-intro-layout">
          <div class="userpage-intro-copy">
            <h3>像搭积木一样拼页面</h3>
            <p>
              支持分组与布局（横向、纵向、拉伸），并提供边框、背景、间距等常用样式开关；编辑区与预览区实时同步，方便调试。
            </p>
            <ul class="userpage-intro-list">
              <li>包括个人主页、投稿页、赞助页、图集展示和视频展示</li>
              <li>支持区块组合、拖拽排序、组件级样式与预览</li>
            </ul>
            <div class="section-actions">
              <UButton
                color="primary"
                icon="i-lucide-panels-top-left"
                @click="$router.push({ name: 'manage-userPageBuilder' })"
              >
                打开编辑器
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-external-link"
                @click="$router.push('/@Megghy')"
              >
                查看示例
              </UButton>
            </div>
          </div>
          <div class="userpage-intro-media">
            <div class="userpage-intro-image">
              <img
                src="https://files.vtsuru.suki.club/updatelog/屏幕截图 2026-01-16 213146.png"
                referrerpolicy="no-referrer"
                alt="自定义页面示例"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="home-section client-section">
        <header class="section-header">
          <h2 class="section-title">客户端功能</h2>
          <p class="section-subtitle">本地运行的强大自动化工具</p>
        </header>
        <div class="client-grid">
          <article class="feature-card tone-coral">
            <div class="feature-card-header">
              <span class="icon-wrapper">
                <UIcon name="i-lucide-bot" />
              </span>
              <span class="feature-card-title">自动操作</span>
            </div>
            <p class="feature-card-desc">
              支持弹幕自动回复、礼物感谢、上舰私信、关注感谢、入场欢迎、定时发送和 SC 感谢等功能，使用模板系统和 JS
              执行环境，可定制化程度较高。
            </p>
          </article>

          <article class="feature-card tone-cyan">
            <div class="feature-card-header">
              <span class="icon-wrapper">
                <UIcon name="i-lucide-message-square" />
              </span>
              <span class="feature-card-title">弹幕机（客户端）</span>
            </div>
            <p class="feature-card-desc">在自己电脑上显示直播间弹幕、礼物和互动内容。</p>
          </article>
        </div>
        <div class="section-actions centered-actions">
          <UButton
            color="primary"
            icon="i-lucide-info"
            to="https://www.wolai.com/carN6qvUm3FErze9Xo53ii"
            target="_blank"
          >
            客户端安装说明
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            to="https://github.com/Megghy/vtsuru-fetvher-client"
            target="_blank"
          >
            客户端代码
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            to="https://github.com/Megghy/vtsuru.live/tree/master/src/client"
            target="_blank"
          >
            逻辑代码
          </UButton>
        </div>
      </section>

      <!-- 直播间列表 -->
      <section class="home-section streamers-home-section">
        <header class="section-header streamers-section-header">
          <div class="streamers-heading">
            <h2 class="section-title">
              正在使用本站的主播们
              <UTooltip text="随机展示不分先后，仅粉丝数大于 500 的主播；展示其直播间信息与开播状态">
                <UIcon name="i-lucide-info" class="section-info-icon" />
              </UTooltip>
            </h2>
            <p class="section-subtitle">感谢支持</p>
          </div>

          <div class="streamers-controls">
            <UTooltip text="向左滚动">
                <UButton
                  icon="i-lucide-chevron-left"
                  color="neutral"
                  variant="ghost"
                  aria-label="向左滚动"
                  :disabled="!canScrollRoomsLeft"
                  @click="scrollRooms(-1)"
                />
            </UTooltip>
            <UTooltip text="向右滚动">
                <UButton
                  icon="i-lucide-chevron-right"
                  color="neutral"
                  variant="ghost"
                  aria-label="向右滚动"
                  :disabled="!canScrollRoomsRight"
                  @click="scrollRooms(1)"
                />
            </UTooltip>
            <UTooltip text="刷新主播列表">
                <UButton
                  icon="i-lucide-refresh-cw"
                  color="neutral"
                  variant="ghost"
                  aria-label="刷新主播列表"
                  :loading="isRefreshingRooms"
                  @click="loadIndexData"
                />
            </UTooltip>
          </div>
        </header>

        <div
          v-if="indexData"
          class="streamers-section"
        >
          <!-- 直播间 mini 卡片 -->
          <div
            ref="roomsScroller"
            class="rooms-grid-mini"
            :class="{
              'can-scroll-left': canScrollRoomsLeft,
              'can-scroll-right': canScrollRoomsRight,
            }"
            @scroll="updateRoomsScrollState"
          >
            <div
              v-for="room in indexData.streamers"
              :key="room.roomId"
              class="room-mini-card"
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
                />
                <div class="room-mini-cover__mask" />
                <div class="room-mini-content">
                  <div class="room-mini-top">
                    <div class="room-mini-header">
                      <img
                        class="room-mini-avatar"
                        :src="`${room.avatar}@96w`"
                        referrerpolicy="no-referrer"
                        alt="主播头像"
                      />
                      <div class="room-mini-meta">
                        <div
                          class="room-mini-name"
                          :title="room.uname || room.name"
                        >
                          {{ room.uname || room.name }}
                        </div>
                        <div
                          class="room-mini-status"
                          :class="{ live: room.isStreaming }"
                        >
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
                        <UIcon name="i-lucide-external-link" />
                      </a>
                    </div>
                  </div>
                  <div class="room-mini-spacer" />
                  <div class="room-mini-bottom">
                    <div class="room-mini-bottom__left">
                      <div
                        class="room-mini-title"
                        :title="room.title"
                      >
                        {{ room.title || '（暂无标题）' }}
                      </div>
                      <div
                        class="room-mini-sub"
                        :title="getRoomSubline(room)"
                      >
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
            <div class="streamers-note">
              <UIcon name="i-lucide-info" />
              <span>
                不想被展示？前往
                <UButton
                  variant="link"
                  size="xs"
                  @click="$router.push({ name: 'manage-userPageBuilder', query: { mode: 'legacy' } })"
                >
                  设置页面（渲染模式-传统-允许展示在主页）
                </UButton>
                关闭展示
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
    <footer class="footer">
      <span>
        BY
        <UButton
          to="https://space.bilibili.com/10021741"
          target="_blank"
          variant="link"
          size="xs"
        >
          Megghy
        </UButton>
      </span>
    </footer>
  </div>
</template>

<style lang="stylus" scoped>
.index-background
    position: relative;
    min-height: 100vh;
    box-sizing: border-box;
    background-color: var(--vtsuru-bg);
    color: var(--vtsuru-fg);
    isolation: isolate;
    overflow-x: hidden;

.main-container
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 52px;
    width: min(90vw, 1400px);
    margin: 0 auto;
    padding: 48px 0 72px;

.home-section
    position: relative;

.hero-section
    padding: 24px 0 36px;
    border-bottom: 1px solid var(--vtsuru-border);

.hero-layout
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 52px;

.hero-content
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    max-width: 720px;

.brand-title
    position: relative;
    margin: 0;
    color: var(--vtsuru-fg);
    font-size: clamp(2.5rem, 5vw, 4rem);
    font-weight: 800;
    letter-spacing: 0.02em;
    line-height: 1;

.brand-title::after
    content: '';
    display: block;
    width: 58px;
    height: 5px;
    margin-top: 14px;
    border-radius: 999px;
    background: #27abd9;

.hero-tagline
    margin: 18px 0 0;
    color: var(--vtsuru-fg);
    font-size: clamp(1.1rem, 2vw, 1.35rem);
    font-weight: 500;

.hero-icon
    width: clamp(210px, 24vw, 300px);
    height: auto;
    animation: logo-float 6s ease-in-out infinite;
    will-change: transform;

.entry-grid
    display: grid;
    grid-template-columns: repeat(2, minmax(190px, 240px));
    gap: 16px;
    width: 100%;
    margin-top: 28px;

.entry-card
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 9px;
    min-height: 152px;
    padding: 22px 16px;
    border: 1px solid var(--vtsuru-border);
    border-bottom: 3px solid var(--card-accent);
    border-radius: 8px;
    background: var(--vtsuru-bg-elevated);
    color: var(--vtsuru-fg);
    cursor: pointer;
    font: inherit;
    transition: transform 160ms var(--vtsuru-bezier), border-color 160ms var(--vtsuru-bezier), box-shadow 160ms var(--vtsuru-bezier);

.entry-card:hover
    transform: translateY(-3px);
    border-color: var(--card-accent);
    box-shadow: 0 10px 26px var(--card-shadow);

.entry-card__icon
    width: 36px;
    height: 36px;
    color: var(--card-accent);

.entry-card strong
    font-size: 1.15rem;
    font-weight: 600;

.entry-card span:last-child
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--card-soft);
    color: var(--card-accent);
    font-size: 0.82rem;

.tone-cyan
    --card-accent: #22a8d6;
    --card-soft: rgba(34, 168, 214, 0.14);
    --card-shadow: rgba(34, 168, 214, 0.14);

.tone-yellow
    --card-accent: #d89b26;
    --card-soft: rgba(216, 155, 38, 0.14);
    --card-shadow: rgba(216, 155, 38, 0.14);

.tone-coral
    --card-accent: #dc6473;
    --card-soft: rgba(220, 100, 115, 0.14);
    --card-shadow: rgba(220, 100, 115, 0.14);

.hero-actions,
.section-actions
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;

.hero-actions
    margin-top: 22px;

.hero-stat
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-top: 22px;
    color: var(--vtsuru-fg-muted);
    font-size: 0.85rem;

.hero-stat strong
    color: var(--vtsuru-fg);
    font-size: 1.2rem;

.section-header
    margin-bottom: 22px;
    text-align: center;

.section-title
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: var(--vtsuru-fg);
    font-size: 1.35rem;
    font-weight: 650;

.section-subtitle
    margin: 8px 0 0;
    color: var(--vtsuru-fg-muted);
    font-size: 0.92rem;

.section-info-icon
    color: var(--vtsuru-fg-muted);

.feature-grid,
.client-grid
    display: grid;
    gap: 14px;

.feature-grid
    grid-template-columns: repeat(4, minmax(0, 1fr));

.client-grid
    grid-template-columns: repeat(2, minmax(0, 1fr));

.feature-card
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    min-width: 0;
    padding: 18px;
    border: 1px solid var(--vtsuru-border);
    border-bottom: 3px solid var(--card-accent);
    border-radius: 8px;
    background: var(--vtsuru-bg-elevated);
    color: var(--vtsuru-fg);
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: transform 160ms var(--vtsuru-bezier), border-color 160ms var(--vtsuru-bezier), box-shadow 160ms var(--vtsuru-bezier);

article.feature-card
    cursor: default;

.feature-card:hover,
.feature-card:focus-visible
    transform: translateY(-2px);
    border-color: var(--card-accent);
    box-shadow: 0 8px 20px var(--card-shadow);
    outline: none;

.feature-card-header
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;

.icon-wrapper
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--vtsuru-border);
    border-radius: 8px;
    background: var(--card-soft);
    color: var(--card-accent);

.feature-card-title
    min-width: 0;
    overflow: hidden;
    color: var(--vtsuru-fg);
    font-size: 1.06rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;

.feature-card-desc
    margin: 0;
    color: var(--vtsuru-fg-muted);
    font-size: 0.9rem;
    line-height: 1.6;

.feature-badge-new
    display: inline-flex;
    align-items: center;
    height: 18px;
    padding: 0 7px;
    border: 1px solid var(--vtsuru-border);
    border-radius: 999px;
    background: var(--card-soft);
    color: var(--card-accent);
    font-size: 11px;
    font-weight: 700;

.userpage-intro-layout
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 460px);
    align-items: center;
    gap: 42px;

.userpage-intro-copy
    min-width: 0;

.userpage-intro-copy h3
    margin: 0;
    color: var(--vtsuru-fg);
    font-size: 1.18rem;

.userpage-intro-copy p
    margin: 12px 0 0;
    color: var(--vtsuru-fg-muted);
    line-height: 1.7;

.userpage-intro-list
    display: grid;
    gap: 7px;
    margin: 16px 0 20px;
    padding: 0;
    color: var(--vtsuru-fg);
    font-size: 0.92rem;
    line-height: 1.5;
    list-style: none;

.userpage-intro-list li::before
    content: '•';
    margin-right: 8px;
    color: #22a8d6;

.userpage-intro-media
    min-width: 0;

.userpage-intro-image
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border: 1px solid var(--vtsuru-border);
    border-radius: 8px;
    background: var(--vtsuru-bg-muted);

.userpage-intro-image img
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;

.centered-actions
    justify-content: center;
    margin-top: 22px;

.streamers-home-section
    padding-top: 6px;

.streamers-section
    width: 100%;
    margin: 0 auto;

.streamers-section-header
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    text-align: left;

.streamers-heading
    min-width: 0;

.streamers-controls
    display: flex;
    flex: 0 0 auto;
    gap: 4px;

.streamers-footer
    margin-top: 12px;

.streamers-note
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 16px;
    color: var(--vtsuru-fg-muted);
    font-size: 0.8rem;
    text-align: center;

.streamers-note :deep(a)
    padding: 0 4px;
    font-size: 0.8rem;
    text-decoration: underline;

.footer
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: center;
    padding: 0 0 24px;
    color: var(--vtsuru-fg-muted);

@media (prefers-reduced-motion: reduce)
    .hero-icon
        animation: none;

@keyframes logo-float
    0%, 100%
        transform: translateY(0);
    50%
        transform: translateY(-8px);

@media (max-width: 1100px)
    .feature-grid
        grid-template-columns: repeat(3, minmax(0, 1fr));

@media (max-width: 860px)
    .feature-grid
        grid-template-columns: repeat(2, minmax(0, 1fr));

@media (max-width: 700px)
    .main-container
        gap: 42px;
        width: min(92vw, 560px);
        padding-top: 24px;

    .hero-section
        padding-top: 8px;

    .hero-layout
        flex-direction: column;
        gap: 22px;
        text-align: center;

    .hero-content
        align-items: center;
        width: 100%;

    .brand-title
        font-size: 2.5rem;

    .hero-tagline
        font-size: 1.08rem;

    .entry-grid
        grid-template-columns: 1fr;
        width: 100%;
        max-width: 340px;

    .entry-card
        min-height: 142px;

    .hero-actions
        justify-content: center;

    .hero-stat
        margin-top: 18px;

    .client-grid,
    .feature-grid,
    .userpage-intro-layout
        grid-template-columns: 1fr;

    .userpage-intro-media
        order: -1;

    .section-title
        font-size: 1.18rem;

    .streamers-note
        align-items: flex-start;

    .streamers-note span
        max-width: 310px;

/* 直播间展示区域 */
.rooms-grid-mini
    --rooms-edge-fade: 64px;
    --rooms-edge-mid: 40px;
    --rooms-edge-soft: 18px;
    display: flex;
    flex-wrap: nowrap;
    justify-content: flex-start;
    gap: 12px;
    width: 100%;
    margin: 0 auto;
    padding: 4px 28px 14px;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-inline: contain;
    scroll-snap-type: x proximity;
    scroll-padding-inline: 28px;
    scrollbar-width: thin;
    scrollbar-color: var(--vtsuru-border) transparent;
    -webkit-overflow-scrolling: touch;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;

.rooms-grid-mini.can-scroll-left
    -webkit-mask-image: linear-gradient(90deg, transparent 0, rgba(0, 0, 0, 0.16) var(--rooms-edge-soft), rgba(0, 0, 0, 0.58) var(--rooms-edge-mid), #000 var(--rooms-edge-fade), #000 100%);
    mask-image: linear-gradient(90deg, transparent 0, rgba(0, 0, 0, 0.16) var(--rooms-edge-soft), rgba(0, 0, 0, 0.58) var(--rooms-edge-mid), #000 var(--rooms-edge-fade), #000 100%);

.rooms-grid-mini.can-scroll-right
    -webkit-mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - var(--rooms-edge-fade)), rgba(0, 0, 0, 0.58) calc(100% - var(--rooms-edge-mid)), rgba(0, 0, 0, 0.16) calc(100% - var(--rooms-edge-soft)), transparent 100%);
    mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - var(--rooms-edge-fade)), rgba(0, 0, 0, 0.58) calc(100% - var(--rooms-edge-mid)), rgba(0, 0, 0, 0.16) calc(100% - var(--rooms-edge-soft)), transparent 100%);

.rooms-grid-mini.can-scroll-left.can-scroll-right
    -webkit-mask-image: linear-gradient(90deg, transparent 0, rgba(0, 0, 0, 0.16) var(--rooms-edge-soft), rgba(0, 0, 0, 0.58) var(--rooms-edge-mid), #000 var(--rooms-edge-fade), #000 calc(100% - var(--rooms-edge-fade)), rgba(0, 0, 0, 0.58) calc(100% - var(--rooms-edge-mid)), rgba(0, 0, 0, 0.16) calc(100% - var(--rooms-edge-soft)), transparent 100%);
    mask-image: linear-gradient(90deg, transparent 0, rgba(0, 0, 0, 0.16) var(--rooms-edge-soft), rgba(0, 0, 0, 0.58) var(--rooms-edge-mid), #000 var(--rooms-edge-fade), #000 calc(100% - var(--rooms-edge-fade)), rgba(0, 0, 0, 0.58) calc(100% - var(--rooms-edge-mid)), rgba(0, 0, 0, 0.16) calc(100% - var(--rooms-edge-soft)), transparent 100%);

@media (min-width: 1200px)
    .rooms-grid-mini
        --rooms-edge-fade: 112px;
        --rooms-edge-mid: 70px;
        --rooms-edge-soft: 30px;

.room-mini-card
    width: 220px;
    flex: 0 0 auto;
    scroll-snap-align: start;
    border-radius: 8px;
    border: 1px solid var(--vtsuru-border);
    overflow: hidden;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.28);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 1px 2px rgba(9, 9, 11, 0.08);
    transition: transform 140ms var(--vtsuru-bezier), box-shadow 140ms var(--vtsuru-bezier), border-color 140ms var(--vtsuru-bezier);

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
    transition: background 140ms var(--vtsuru-bezier), border-color 140ms var(--vtsuru-bezier), transform 140ms var(--vtsuru-bezier);

.room-mini-btn:hover
    background: rgba(9, 9, 11, 0.32);
    border-color: rgba(255, 255, 255, 0.28);
    transform: translateY(-1px);

/* 响应式优化 */
@media (max-width: 768px)
    .rooms-grid-mini
        --rooms-edge-fade: 38px;
        --rooms-edge-mid: 24px;
        --rooms-edge-soft: 12px;
        gap: 10px;
        scroll-padding-inline: 22px;
    .room-mini-card
        width: 200px;

@media (max-width: 480px)
    .rooms-grid-mini
        --rooms-edge-fade: 32px;
        --rooms-edge-mid: 20px;
        --rooms-edge-soft: 10px;
        gap: 10px;
        scroll-padding-inline: 18px;
    .room-mini-card
        width: 180px;
</style>
