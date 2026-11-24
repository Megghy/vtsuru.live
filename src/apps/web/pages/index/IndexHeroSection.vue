<script setup lang="ts">
import {
  ArrowRight,
  Clapperboard,
  Coins,
  ExternalLink,
  Heart,
  Layers,
  LayoutGrid,
  Mic,
  Music2,
  Sparkles,
  Tv,
  Users,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import vtb from '@/svgs/ic_vtuber.svg'

import { EXTERNAL_LINKS } from './indexData'
import { useAnimatedNumber } from './useIndexMotion'

const props = defineProps<{
  userCount: number
  liveCount: number
  exitProgress: number
  isDesktop: boolean
  isReduced: boolean
}>()

// 随滚动离开首屏时的多层景深变换
const heroCopyStyle = computed(() => {
  if (props.isReduced) return undefined
  const p = props.exitProgress
  const y = -p * (props.isDesktop ? 28 : 14)
  const opacity = 1 - p * 0.35
  return {
    transform: `translate3d(0, ${y.toFixed(1)}px, 0)`,
    opacity: opacity.toFixed(3),
  }
})

const heroStageStyle = computed(() => {
  if (props.isReduced) return undefined
  const p = props.exitProgress
  const scale = 1 - p * (props.isDesktop ? 0.055 : 0.025)
  const y = p * (props.isDesktop ? 36 : 16)
  const scrollTiltX = props.isDesktop ? p * 8 : 0
  const scrollTiltY = props.isDesktop ? -p * 4 : 0
  const rx = tiltX.value + scrollTiltX
  const ry = tiltY.value + scrollTiltY
  return {
    transform: `perspective(1200px) translate3d(0, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)}) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`,
  }
})

const topBadgeStyle = computed(() => {
  if (props.isReduced) return undefined
  const p = props.exitProgress
  const x = p * (props.isDesktop ? 28 : 10)
  const y = -p * (props.isDesktop ? 64 : 28)
  const rot = p * 3.5
  return {
    transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`,
    opacity: (1 - p * 0.45).toFixed(3),
  }
})

const bottomBadgeStyle = computed(() => {
  if (props.isReduced) return undefined
  const p = props.exitProgress
  const x = -p * (props.isDesktop ? 26 : 10)
  const y = -p * (props.isDesktop ? 36 : 16)
  const rot = -p * 2.8
  return {
    transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`,
    opacity: (1 - p * 0.45).toFixed(3),
  }
})

const emit = defineEmits<{
  openAudience: []
}>()

const router = useRouter()
const animatedUsers = useAnimatedNumber(computed(() => props.userCount))

type HeroSceneId = 'chat' | 'sing' | 'game'

interface HeroScenePreset {
  id: HeroSceneId
  label: string
  badge: string
  title: string
  widgetTitle: string
  widgetValue: string
  widgetProgress: number
  danmaku: { user: string; role?: 'guard' | 'sc'; text: string }[]
}

const heroScenes: readonly HeroScenePreset[] = [
  {
    id: 'chat',
    label: '杂谈',
    badge: 'OBS 场景 · 杂谈间',
    title: '今晚来聊新衣服和下周歌回安排~',
    widgetTitle: '弹幕投票',
    widgetValue: '新歌试唱 64%',
    widgetProgress: 64,
    danmaku: [
      { user: '星屑砂糖', role: 'guard', text: '今天这个主页的 OC 色卡太好看了！' },
      { user: '晴空小雨', text: '投一票新歌试唱，想听抒情曲！' },
      { user: '夜航船长', role: 'sc', text: 'SC ￥30：祝开播顺利，已去约稿页填单啦' },
    ],
  },
  {
    id: 'sing',
    label: '歌回',
    badge: 'OBS 场景 · 歌回舞台',
    title: '正在演唱：星茶会 · 点歌队列 4 首',
    widgetTitle: '点歌进度',
    widgetValue: '02:14 / 04:08',
    widgetProgress: 54,
    danmaku: [
      { user: '风铃草', role: 'guard', text: '点歌 富士山下，终于抢到麦位了！' },
      { user: '柠檬气泡', text: 'OBS 歌词和歌单卡片联动好丝滑' },
      { user: '白昼梦', role: 'sc', text: 'SC ￥50：这首高音太稳了，再来一首！' },
    ],
  },
  {
    id: 'game',
    label: '游戏',
    badge: 'OBS 场景 · 耐久挑战',
    title: '无伤通关耐久 · 死亡计数 #14',
    widgetTitle: '耐久目标',
    widgetValue: '82 / 100 舰',
    widgetProgress: 82,
    danmaku: [
      { user: '手柄达人', text: '左下角手柄投屏能看到操作细节哈哈' },
      { user: '可可豆', role: 'guard', text: '刚用积分换了签名语音包！' },
      { user: '小橘猫', text: '加钟了加钟了，今晚不睡啦' },
    ],
  },
]

const activeSceneId = ref<HeroSceneId>('chat')
const activeScene = computed(() => heroScenes.find((s) => s.id === activeSceneId.value) ?? heroScenes[0])

// 轻度鼠标微倾角（仅桌面指针有效）
const tiltX = ref(0)
const tiltY = ref(0)

function handleStageMove(event: PointerEvent) {
  if (props.isReduced || event.pointerType !== 'mouse') return
  const el = event.currentTarget as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  const nx = (event.clientX - rect.left) / rect.width - 0.5
  const ny = (event.clientY - rect.top) / rect.height - 0.5
  tiltY.value = nx * 5
  tiltX.value = -ny * 4
}

function resetStageTilt() {
  tiltX.value = 0
  tiltY.value = 0
}

// 实时运行计时器，赋予舞台鲜活感
const elapsedSeconds = ref(5058)
let timerId = 0

onMounted(() => {
  if (props.isReduced) return
  timerId = window.setInterval(() => {
    elapsedSeconds.value += 1
  }, 1000)
})

onBeforeUnmount(() => {
  if (timerId) window.clearInterval(timerId)
})

const formattedElapsed = computed(() => {
  const s = elapsedSeconds.value
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
})
</script>

<template>
  <section class="relative overflow-x-clip pt-8 pb-16 sm:pt-12 sm:pb-24 lg:pt-16 lg:pb-28">
    <div class="mx-auto grid w-full max-w-[1320px] grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8">
      <!-- 左侧核心叙事与双角色入口 -->
      <div
        class="lg:col-span-6 flex flex-col items-start will-change-transform"
        :style="heroCopyStyle"
      >
        <div class="inline-flex flex-wrap items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
          <span class="relative flex size-2">
            <span
              class="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75"
              :class="{ 'animate-ping': !isReduced }"
            />
            <span class="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span class="tabular-nums">
            <template v-if="liveCount > 0">
              当前 <strong class="font-semibold text-foreground">{{ liveCount }}</strong> 位主播正在开播 ·
            </template>
            已服务 <strong class="font-semibold text-foreground">{{ animatedUsers.toLocaleString() }}</strong> 位创作者
          </span>
        </div>

        <h1 class="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-[48px] xl:text-[52px] lg:leading-[1.15]">
          B 站直播互动、<span class="inline-block">OBS 编排</span>与个人主页工作台
        </h1>

        <p class="mt-5 max-w-[54ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
          面向 B 站主播与虚拟主播的直播辅助平台：整合弹幕互动、单源 OBS 场景编排、积木式个人主页与桌面客户端，打开浏览器即可配置使用。
        </p>

        <!-- 双角色分流入口（原生语义按钮，图标比例完全自由不被 Button 基座压缩） -->
        <div class="mt-8 grid w-full max-w-[540px] grid-cols-1 gap-3 sm:grid-cols-2">
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button"
                class="group relative flex items-center gap-3.5 rounded-xl border border-brand/45 bg-gradient-to-br from-brand/14 via-card to-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                @click="router.push({ name: 'manage-index' })"
              >
                <span class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
                  <Sparkles class="size-5" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1.5 text-sm font-bold text-foreground">
                    我是主播
                    <ArrowRight class="size-3.5 text-brand transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                  <span class="mt-0.5 block text-xs text-muted-foreground">
                    {{ isLoggedIn ? '继续管理直播与主页' : '进入主播后台开始配置' }}
                  </span>
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">进入主播后台，管理直播互动、OBS 场景与个人主页</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button"
                class="group relative flex items-center gap-3.5 rounded-xl border border-border bg-card/95 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/70 hover:bg-card hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                @click="emit('openAudience')"
              >
                <span class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/14 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/25">
                  <Coins class="size-5" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1.5 text-sm font-bold text-foreground">
                    我是观众
                    <ArrowRight class="size-3.5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-amber-500" />
                  </span>
                  <span class="mt-0.5 block text-xs text-muted-foreground">B 站认证免注册查积分</span>
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">使用 Bilibili 认证查看积分余额与兑换订单，无需注册</TooltipContent>
          </Tooltip>
        </div>

        <!-- 次级快捷操作（保留幻星平台） -->
        <div class="mt-5 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            class="gap-1.5"
            @click="router.push('/@Megghy')"
          >
            <LayoutGrid class="size-3.5" />
            示范主页
          </Button>
          <Button
            variant="outline"
            class="gap-1.5"
            as-child
          >
            <a
              :href="EXTERNAL_LINKS.huanxing"
              target="_blank"
              rel="noreferrer"
            >
              <Tv class="size-3.5 text-brand" />
              幻星平台
              <ExternalLink class="size-3 opacity-60" />
            </a>
          </Button>
          <Button
            variant="ghost"
            class="text-muted-foreground hover:text-foreground"
            @click="router.push({ name: 'about' })"
          >
            关于本站
          </Button>
        </div>

        <!-- 紧凑能力数字条 -->
        <dl class="mt-8 grid w-full max-w-[540px] grid-cols-3 gap-4 border-t border-border/70 pt-5">
          <div>
            <dt class="text-[11px] text-muted-foreground">主页积木区块</dt>
            <dd class="mt-0.5 text-lg font-bold text-foreground tabular-nums">44 种</dd>
          </div>
          <div>
            <dt class="text-[11px] text-muted-foreground">OBS 独立挂件</dt>
            <dd class="mt-0.5 text-lg font-bold text-foreground tabular-nums">8 大类</dd>
          </div>
          <div>
            <dt class="text-[11px] text-muted-foreground">日程与歌单模板</dt>
            <dd class="mt-0.5 text-lg font-bold text-foreground tabular-nums">16 套</dd>
          </div>
        </dl>
      </div>

      <!-- 右侧：带 3 层视差与真实场景切换的 Live Studio 创作者舞台 -->
      <div
        class="lg:col-span-6 relative mx-auto w-full max-w-[580px] lg:max-w-none"
        @pointermove="handleStageMove"
        @pointerleave="resetStageTilt"
      >
        <!-- 前景浮动胶囊 1（右上角，随滚动向右上方飞离旋转） -->
        <div
          class="pointer-events-none hidden sm:flex items-center gap-2 rounded-full border border-border/80 bg-card/92 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md absolute -top-4 right-4 z-20 will-change-transform"
          :style="topBadgeStyle"
        >
          <span class="size-2 rounded-full bg-rose-500" />
          <span class="font-semibold text-foreground">ON AIR</span>
          <span class="font-mono text-[11px] text-muted-foreground tabular-nums">{{ formattedElapsed }}</span>
        </div>

        <!-- 主舞台卡（融合鼠标 3D 倾角与滚动后仰景深） -->
        <div
          class="relative z-10 overflow-hidden rounded-2xl border border-border bg-card/95 shadow-xl backdrop-blur-md transition-transform duration-150 ease-out will-change-transform"
          :style="heroStageStyle"
        >
          <!-- 窗口顶栏：场景切换器 -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-muted/55 px-4 py-2.5">
            <div class="flex items-center gap-2">
              <span class="size-2.5 rounded-full bg-rose-400/80" />
              <span class="size-2.5 rounded-full bg-amber-400/80" />
              <span class="size-2.5 rounded-full bg-emerald-400/80" />
              <span class="ml-1 text-[11px] font-medium text-muted-foreground">{{ activeScene.badge }}</span>
            </div>

            <div
              class="inline-flex items-center gap-1 rounded-lg bg-background/80 p-0.5 ring-1 ring-border/70"
              role="tablist"
              aria-label="预览直播场景"
            >
              <button
                v-for="scene in heroScenes"
                :key="scene.id"
                type="button"
                role="tab"
                :aria-selected="activeSceneId === scene.id"
                class="rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors duration-150"
                :class="
                  activeSceneId === scene.id
                    ? 'bg-brand text-brand-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="activeSceneId = scene.id"
              >
                {{ scene.label }}
              </button>
            </div>
          </div>

          <!-- 舞台内部画布 -->
          <div class="relative p-4 sm:p-5">
            <!-- 轻二次元取景角标装饰 -->
            <div
              class="pointer-events-none absolute inset-3 rounded-xl border border-dashed border-brand/20"
              aria-hidden="true"
            />

            <div class="relative grid grid-cols-1 gap-4 sm:grid-cols-12">
              <!-- 吉祥物形象卡 + 实时状态 -->
              <div class="sm:col-span-5 flex flex-col justify-between rounded-xl border border-border/75 bg-gradient-to-b from-brand/12 via-pink-400/8 to-inset/75 p-3.5">
                <div class="flex items-center justify-between">
                  <span class="inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium text-brand ring-1 ring-brand/25">
                    <Clapperboard class="size-3" />
                    单源同步中
                  </span>
                  <Heart class="size-3.5 text-pink-400" />
                </div>

                <div class="my-3 flex flex-col items-center">
                  <div class="relative flex size-24 items-center justify-center rounded-2xl bg-background/80 p-3 shadow-sm ring-1 ring-brand/20">
                    <vtb
                      class="size-full"
                      :class="{ 'hero-mascot-float': !isReduced }"
                    />
                  </div>
                  <div class="mt-2.5 text-center">
                    <div class="text-xs font-semibold text-foreground">VTsuru Studio</div>
                    <div class="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                      {{ activeScene.title }}
                    </div>
                  </div>
                </div>

                <!-- 动态挂件条 -->
                <div class="rounded-lg border border-border/70 bg-background/85 p-2.5">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="text-muted-foreground truncate">{{ activeScene.widgetTitle }}</span>
                    <span class="font-semibold text-foreground tabular-nums shrink-0 ml-1">{{ activeScene.widgetValue }}</span>
                  </div>
                  <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      class="h-full rounded-full bg-gradient-to-r from-brand to-pink-400 transition-all duration-300"
                      :style="{ width: `${activeScene.widgetProgress}%` }"
                    />
                  </div>
                </div>
              </div>

              <!-- 右侧实时弹幕与模块胶囊 -->
              <div class="sm:col-span-7 flex flex-col justify-between gap-3">
                <div class="rounded-xl border border-border/70 bg-inset/70 p-3">
                  <div class="mb-2.5 flex items-center justify-between">
                    <span class="text-[11px] font-semibold text-foreground">实时互动流</span>
                    <span class="text-[10px] text-muted-foreground">OBS 弹幕机 · 中控台同步</span>
                  </div>

                  <div class="space-y-2">
                    <div
                      v-for="(item, idx) in activeScene.danmaku"
                      :key="`${activeScene.id}-${idx}`"
                      class="rounded-lg border px-2.5 py-2 text-xs transition-colors"
                      :class="
                        item.role === 'sc'
                          ? 'border-amber-400/40 bg-amber-500/10'
                          : item.role === 'guard'
                            ? 'border-brand/30 bg-brand/8'
                            : 'border-border/75 bg-card/90'
                      "
                    >
                      <div class="flex items-center gap-1.5">
                        <span
                          class="text-[11px] font-semibold"
                          :class="
                            item.role === 'sc'
                              ? 'text-amber-600 dark:text-amber-400'
                              : item.role === 'guard'
                                ? 'text-brand'
                                : 'text-foreground'
                          "
                        >
                          {{ item.user }}
                        </span>
                        <span
                          v-if="item.role === 'guard'"
                          class="rounded bg-brand/15 px-1 py-0.2 text-[10px] font-medium text-brand"
                        >
                          舰长
                        </span>
                        <span
                          v-else-if="item.role === 'sc'"
                          class="rounded bg-amber-500/20 px-1 py-0.2 text-[10px] font-medium text-amber-700 dark:text-amber-300"
                        >
                          SC
                        </span>
                      </div>
                      <p class="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {{ item.text }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- 底部快捷模块指示条 -->
                <div class="flex flex-wrap items-center gap-1.5">
                  <div class="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/85 px-2.5 py-1.5 text-[11px] text-foreground whitespace-nowrap">
                    <Layers class="size-3.5 text-brand shrink-0" />
                    <span>图层编排</span>
                  </div>
                  <div class="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/85 px-2.5 py-1.5 text-[11px] text-foreground whitespace-nowrap">
                    <Mic class="size-3.5 text-pink-500 shrink-0" />
                    <span>MiMo TTS</span>
                  </div>
                  <div class="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/85 px-2.5 py-1.5 text-[11px] text-foreground whitespace-nowrap">
                    <Music2 class="size-3.5 text-amber-500 shrink-0" />
                    <span>歌单点歌</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 前景浮动胶囊 2（左下角，随滚动向左下方分离错位） -->
        <div
          class="pointer-events-none hidden sm:flex items-center gap-2.5 rounded-xl border border-border/80 bg-card/94 px-3.5 py-2 text-xs shadow-lg backdrop-blur-md absolute -bottom-11 left-4 z-20 will-change-transform"
          :style="bottomBadgeStyle"
        >
          <span class="flex size-7 items-center justify-center rounded-lg bg-pink-500/12 text-pink-500">
            <Users class="size-3.5" />
          </span>
          <div>
            <div class="text-[11px] font-semibold text-foreground">主页装修 · 实时联动</div>
            <div class="text-[10px] text-muted-foreground">开播态切换 · OC 设定 · 约稿表</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@keyframes hero-mascot-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

.hero-mascot-float {
  animation: hero-mascot-bob 4.8s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .hero-mascot-float {
    animation: none;
  }
}
</style>
