<script setup lang="ts">
import {
  ArrowUpRight,
  CheckCircle2,
  Clapperboard,
  Code2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Layers,
  LayoutGrid,
  Monitor,
  Play,
  Radio,
  Sparkles,
  Volume2,
} from 'lucide-vue-next'
import { onBeforeUnmount, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import { Button } from '@/shared/ui/button'
import { ImagePreview } from '@/shared/ui/image-preview'
import vtb from '@/svgs/ic_vtuber.svg'

import { CLIENT_CAPABILITIES, EXTERNAL_LINKS } from './indexData'
import { lerp, useElementScrollProgress, useMultiElementScrollProgress } from './useIndexMotion'

const props = defineProps<{
  isDesktop: boolean
  isReduced: boolean
}>()

const router = useRouter()

// ---- 标题与三组展区共享单一 rAF 滚动进度追踪 ----
type RowIndex = 0 | 1 | 2
const headingEl = useTemplateRef<HTMLElement>('headingEl')
const headingScroll = useElementScrollProgress(headingEl, {
  enterStartRatio: 0.96,
  enterEndRatio: 0.58,
})

const { setEl: setRowEl, states: rowStates } = useMultiElementScrollProgress(3, {
  enterStartRatio: 0.98,
  enterEndRatio: 0.45,
})

function headingStyle() {
  if (props.isReduced) return undefined
  const t = headingScroll.easedEnter
  const y = lerp(24, 0, t)
  return {
    transform: `translate3d(0, ${y.toFixed(1)}px, 0)`,
    opacity: lerp(0.15, 1, t).toFixed(3),
  }
}

/** 文字侧：随滚入从外侧水平轻滑归位 + 淡入 */
function copyStyle(index: RowIndex, side: 'left' | 'right') {
  if (props.isReduced) return undefined
  const st = rowStates.value[index]
  const t = st.easedEnter
  const dir = side === 'left' ? -1 : 1
  const x = props.isDesktop ? lerp(dir * 34, 0, t) : 0
  const y = lerp(22, 0, t) + st.center * (props.isDesktop ? -10 : -4)
  return {
    transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`,
    opacity: lerp(0.18, 1, t).toFixed(3),
  }
}

/** 交互舞台侧：随滚入从 3D 透视斜倾微缩态实时展开摊平到正视平面，叠加双向视差 */
function stageStyle(index: RowIndex, side: 'left' | 'right') {
  if (props.isReduced) return undefined
  const st = rowStates.value[index]
  const t = st.easedEnter
  const dir = side === 'left' ? -1 : 1
  const x = props.isDesktop ? lerp(dir * 38, 0, t) : 0
  const y = st.center * (props.isDesktop ? 32 : 14)
  const scale = lerp(props.isDesktop ? 0.92 : 0.96, 1, t)
  const rx = props.isDesktop ? lerp(9.5, 0, t) : lerp(4, 0, t)
  const ry = props.isDesktop ? lerp(-dir * 6.5, 0, t) : 0
  return {
    transform: `perspective(1350px) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)}) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`,
    opacity: lerp(0.25, 1, t).toFixed(3),
  }
}

/** 前景胶囊：与舞台做反向垂直 + 水平视差分离 */
function badgeStyle(index: RowIndex, side: 'left' | 'right') {
  if (props.isReduced) return undefined
  const st = rowStates.value[index]
  const t = st.easedEnter
  const dir = side === 'left' ? -1 : 1
  const x = props.isDesktop ? st.center * dir * 16 : 0
  const y = st.center * (props.isDesktop ? -36 : -14)
  const scale = lerp(0.88, 1, t)
  return {
    transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`,
    opacity: lerp(0, 1, t).toFixed(3),
  }
}

/** 展区 1 OBS 画布内各图层随滚动产生独立微景深错位，直观呈现多图层层次 */
function obsLayerParallax(factorX: number, factorY: number) {
  if (props.isReduced || !props.isDesktop) return undefined
  const c = rowStates.value[0].center
  return {
    transform: `translate3d(${(c * factorX).toFixed(1)}px, ${(c * factorY).toFixed(1)}px, 0)`,
  }
}

// ---- 舞台 1：OBS 场景编辑器交互状态 ----
type MockObsScene = 'talk' | 'sing' | 'brb'
const mockObsScene = ref<MockObsScene>('talk')
const obsLayers = ref([
  { id: 'danmu', name: 'OBS 弹幕机', visible: true, global: true },
  { id: 'vote', name: '弹幕投票条', visible: true, global: false },
  { id: 'frame', name: '立绘遮罩框', visible: true, global: false },
  { id: 'clock', name: '辉光管时钟', visible: true, global: true },
])

function toggleMockLayer(id: string) {
  const target = obsLayers.value.find((item) => item.id === id)
  if (target) target.visible = !target.visible
}

function isLayerVisible(id: string) {
  return obsLayers.value.find((item) => item.id === id)?.visible ?? true
}

// ---- 舞台 2：主页装修 2.0 交互状态 ----
const mockPageStreaming = ref(true)
const playingVoiceIndex = ref<number | null>(null)
let voiceTimer = 0

function playMockVoice(idx: number) {
  if (voiceTimer) window.clearTimeout(voiceTimer)
  playingVoiceIndex.value = idx
  voiceTimer = window.setTimeout(() => {
    playingVoiceIndex.value = null
  }, 1600)
}

const mockVoices = ['早安打招呼', '感谢上舰！', '晚安摇篮曲']
const ocSwatches = ['#23ADE5', '#F472B6', '#FDE68A', '#1E293B']

// ---- 舞台 3：客户端运行模拟视图 ----
type ClientPreviewTab = 'live' | 'auto' | 'subtitle'
const clientTab = ref<ClientPreviewTab>('live')

onBeforeUnmount(() => {
  if (voiceTimer) window.clearTimeout(voiceTimer)
})
</script>

<template>
  <section
    id="flagship"
    class="relative py-16 sm:py-24"
  >
    <div class="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8">
      <div
        ref="headingEl"
        class="max-w-2xl will-change-transform"
        :style="headingStyle()"
      >
        <h2 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          从直播间画面到粉丝公开页，完整闭环
        </h2>
        <p class="mt-2.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
          三大核心能力彼此联通，无需来回切换零散插件。每个展区的演示面板都支持直接点击试玩。
        </p>
      </div>

      <div class="mt-14 space-y-20 lg:space-y-28">
        <!-- ==================== 展区 1：OBS 场景编辑器（左文右舞台） ==================== -->
        <div
          :ref="(el) => setRowEl(0, el)"
          class="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12"
        >
          <div
            class="lg:col-span-5 flex flex-col items-start will-change-transform"
            :style="copyStyle(0, 'left')"
          >
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
                <Clapperboard class="size-4" />
                OBS 场景编辑器
              </span>
              <span class="rounded-full bg-brand/12 px-2 py-0.5 text-[10px] font-semibold text-brand">
                2026.11 新上线
              </span>
            </div>

            <h3 class="mt-3 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              浏览器里编排多场景，OBS 只贴一个源
            </h3>
            <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
              像设计工具一样自由拖拽、分组嵌套、设置圆角与异形遮罩。把弹幕机、歌单、点播、投票与 8 大挂件直接嵌入画布，配合客户端或 OBS WebSocket 随场景自动丝滑转场。
            </p>

            <ul class="mt-5 space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li class="flex items-center gap-2">
                <CheckCircle2 class="size-4 text-brand shrink-0" />
                <span>全局常驻层 + 多场景淡入/滑动/缩放转场</span>
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle2 class="size-4 text-brand shrink-0" />
                <span>共享或独立实例配置，Alt+点击穿透选中底层图层</span>
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle2 class="size-4 text-brand shrink-0" />
                <span>一键写入本地 OBS 浏览器源，无需反复复制链接</span>
              </li>
            </ul>

            <div class="mt-6 flex flex-wrap items-center gap-2.5">
              <Button
                class="gap-1"
                @click="router.push({ name: 'manage-obsSceneEditor' })"
              >
                打开场景编辑器
                <ArrowUpRight class="size-3.5" />
              </Button>
              <Button
                variant="outline"
                @click="router.push({ name: 'manage-obsStore' })"
              >
                逛逛 OBS 组件库
              </Button>
            </div>
          </div>

          <div class="lg:col-span-7 relative">
            <div
              class="will-change-transform overflow-hidden rounded-2xl border border-border bg-card/94 shadow-xl backdrop-blur-md"
              :style="stageStyle(0, 'right')"
            >
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-muted/55 px-4 py-2.5">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-semibold text-foreground">切换场景转场：</span>
                  <button
                    v-for="sc in [
                      { id: 'talk', label: '杂谈间' },
                      { id: 'sing', label: '歌回舞台' },
                      { id: 'brb', label: '中场休息' },
                    ] as const"
                    :key="sc.id"
                    type="button"
                    class="rounded-md border px-2.5 py-1 text-xs transition-colors"
                    :class="
                      mockObsScene === sc.id
                        ? 'border-brand bg-brand/12 font-semibold text-brand'
                        : 'border-border bg-background/80 text-muted-foreground hover:text-foreground'
                    "
                    @click="mockObsScene = sc.id"
                  >
                    {{ sc.label }}
                  </button>
                </div>
                <span class="text-[11px] text-muted-foreground">点击切换图层</span>
              </div>

              <div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-12 sm:p-5">
                <div class="sm:col-span-8 relative aspect-video overflow-hidden rounded-xl border border-border dark:border-white/15 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3.5 text-white">
                  <div class="obs-grid-bg pointer-events-none absolute inset-0 opacity-30" />

                  <div
                    v-if="isLayerVisible('clock')"
                    class="absolute top-3 right-3 rounded-lg border border-sky-400/35 bg-black/50 px-2.5 py-1 font-mono text-xs text-sky-300 backdrop-blur-sm will-change-transform"
                    :style="obsLayerParallax(8, -10)"
                  >
                    21:30:48
                  </div>

                  <div
                    v-if="isLayerVisible('frame')"
                    class="absolute bottom-3 left-3 will-change-transform"
                    :style="obsLayerParallax(-6, 10)"
                  >
                    <div
                      class="flex items-center gap-2.5 rounded-2xl border border-brand/50 bg-brand/15 px-3 py-2 backdrop-blur-sm transition-transform duration-300"
                      :class="mockObsScene === 'sing' ? 'translate-x-8 -translate-y-3 scale-105' : ''"
                    >
                      <div class="flex size-11 items-center justify-center rounded-xl bg-white/10 p-1.5">
                        <vtb class="size-full" />
                      </div>
                      <div class="text-left">
                        <div class="text-[11px] font-semibold">
                          {{
                            mockObsScene === 'talk'
                              ? '杂谈主画面 · 1920×1080'
                              : mockObsScene === 'sing'
                                ? '歌回焦点 · 歌词同步'
                                : '马上回来 · 歌单循环中'
                          }}
                        </div>
                        <div class="text-[10px] text-sky-200/80">圆角遮罩 + 图层分组嵌套</div>
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="isLayerVisible('danmu')"
                    class="absolute top-3 left-3 w-[48%] space-y-1.5 rounded-lg border border-white/12 bg-black/45 p-2 text-[10px] backdrop-blur-sm will-change-transform"
                    :style="obsLayerParallax(-10, -8)"
                  >
                    <div class="truncate text-sky-300">星屑：场景转场好顺滑！</div>
                    <div class="truncate text-pink-300">砂糖：一个浏览器源太省心了</div>
                  </div>

                  <div
                    v-if="isLayerVisible('vote') && mockObsScene !== 'brb'"
                    class="absolute right-3 bottom-3 w-[44%] rounded-lg border border-pink-400/35 bg-black/55 p-2 text-[10px] backdrop-blur-sm will-change-transform"
                    :style="obsLayerParallax(10, 12)"
                  >
                    <div class="flex justify-between text-pink-200">
                      <span>{{ mockObsScene === 'sing' ? '下一首点歌' : '弹幕投票 #1' }}</span>
                      <span class="tabular-nums">{{ mockObsScene === 'sing' ? '3 首排队' : '68%' }}</span>
                    </div>
                    <div class="mt-1 h-1 rounded-full bg-white/15">
                      <div
                        class="h-full rounded-full bg-gradient-to-r from-brand to-pink-400 transition-all duration-300"
                        :style="{ width: mockObsScene === 'sing' ? '76%' : '68%' }"
                      />
                    </div>
                  </div>
                </div>

                <div class="sm:col-span-4 flex flex-col rounded-xl border border-border/80 bg-inset/60 p-3">
                  <div class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Layers class="size-3.5 text-brand" />
                    图层显隐控制
                  </div>
                  <div class="flex flex-1 flex-col gap-1.5">
                    <button
                      v-for="layer in obsLayers"
                      :key="layer.id"
                      type="button"
                      class="flex items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition-colors"
                      :class="
                        layer.visible
                          ? 'border-border bg-card text-foreground'
                          : 'border-transparent bg-muted/50 text-muted-foreground line-through'
                      "
                      @click="toggleMockLayer(layer.id)"
                    >
                      <span class="truncate">
                        {{ layer.name }}
                        <span
                          v-if="layer.global"
                          class="ml-1 inline-block rounded bg-brand/12 px-1 text-[9px] font-medium text-brand no-underline"
                        >
                          常驻
                        </span>
                      </span>
                      <Eye
                        v-if="layer.visible"
                        class="size-3.5 text-brand shrink-0"
                      />
                      <EyeOff
                        v-else
                        class="size-3.5 shrink-0"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 前景双向视差状态胶囊 -->
            <div
              class="pointer-events-none hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-card/95 px-3 py-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shadow-lg backdrop-blur-md absolute -bottom-4 right-5 will-change-transform"
              :style="badgeStyle(0, 'right')"
            >
              <span class="size-2 rounded-full bg-emerald-500" />
              OBS WebSocket 双向联动已就绪
            </div>
          </div>
        </div>

        <!-- ==================== 展区 2：可视化主页装修 2.0（左舞台右文，交替节奏） ==================== -->
        <div
          :ref="(el) => setRowEl(1, el)"
          class="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12"
        >
          <div class="lg:col-span-7 lg:order-1 order-2 relative">
            <div
              class="will-change-transform overflow-hidden rounded-2xl border border-border bg-card/94 shadow-xl backdrop-blur-md"
              :style="stageStyle(1, 'left')"
            >
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-muted/55 px-4 py-2.5">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-foreground">模拟开播显隐：</span>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors"
                    :class="
                      mockPageStreaming
                        ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                        : 'border-border bg-background/80 text-muted-foreground'
                    "
                    @click="mockPageStreaming = !mockPageStreaming"
                  >
                    <span
                      class="size-1.5 rounded-full"
                      :class="mockPageStreaming ? 'bg-emerald-500' : 'bg-muted-foreground/50'"
                    />
                    {{ mockPageStreaming ? '直播中' : '未开播预告' }}
                  </button>
                </div>

                <ImagePreview
                  :src="EXTERNAL_LINKS.userPagePreviewImg"
                  fallback-transform="preview"
                  alt="主页编辑器完整界面预览"
                >
                  <template #default="{ open }">
                    <Button
                      variant="outline"
                      size="xs"
                      @click="open()"
                    >
                      放大看编辑器原图
                    </Button>
                  </template>
                </ImagePreview>
              </div>

              <div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-12 sm:p-5">
                <div class="sm:col-span-7 rounded-xl border border-border/80 bg-inset/60 p-3.5">
                  <div class="flex items-center gap-3">
                    <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand/12 p-2 ring-1 ring-brand/25">
                      <vtb class="size-full" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-foreground">小鹤 VTsuru</span>
                        <span
                          class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          :class="
                            mockPageStreaming
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-pink-500/12 text-pink-600 dark:text-pink-400'
                          "
                        >
                          {{ mockPageStreaming ? 'LIVE 直播中' : '明晚 20:00 预告' }}
                        </span>
                      </div>
                      <p class="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {{
                          mockPageStreaming
                            ? '正在直播：周五晚间歌回 + 弹幕点歌'
                            : '下播休息中，欢迎先来歌单预点或投递棉花糖~'
                        }}
                      </p>
                    </div>
                  </div>

                  <div class="mt-3 flex items-center justify-between rounded-lg bg-card/85 px-3 py-2 border border-border/60">
                    <span class="text-[11px] font-medium text-muted-foreground">OC 设定集 · 角色配色</span>
                    <div class="flex items-center gap-1.5">
                      <span
                        v-for="hex in ocSwatches"
                        :key="hex"
                        class="size-4 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                        :style="{ backgroundColor: hex }"
                        :title="hex"
                      />
                    </div>
                  </div>
                </div>

                <div class="sm:col-span-5 flex flex-col justify-between rounded-xl border border-border/80 bg-inset/60 p-3.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-foreground">约稿与价目表</span>
                    <span class="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      接稿中
                    </span>
                  </div>
                  <div class="my-2.5 space-y-1.5 text-[11px]">
                    <div class="flex items-center justify-between rounded-md bg-card/85 px-2.5 py-1.5 border border-border/60">
                      <span class="text-foreground">Q 版头像 / 表情包</span>
                      <span class="font-semibold text-brand tabular-nums">￥120+</span>
                    </div>
                    <div class="flex items-center justify-between rounded-md bg-card/85 px-2.5 py-1.5 border border-border/60">
                      <span class="text-foreground">Live2D 拆分立绘</span>
                      <span class="font-semibold text-brand tabular-nums">￥1800+</span>
                    </div>
                  </div>
                  <div class="text-[10px] text-muted-foreground">排单档位与联系方式一键复制</div>
                </div>

                <div class="sm:col-span-12 rounded-xl border border-border/80 bg-inset/60 p-3.5">
                  <div class="mb-2 flex items-center justify-between">
                    <span class="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <Volume2 class="size-3.5 text-pink-500" />
                      语音包 / 声按钮（点一下试试）
                    </span>
                    <span class="text-[10px] text-muted-foreground">支持防重叠 / 混音模式</span>
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <button
                      v-for="(voice, idx) in mockVoices"
                      :key="voice"
                      type="button"
                      class="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-150"
                      :class="
                        playingVoiceIndex === idx
                          ? 'border-pink-400 bg-pink-500/12 text-pink-600 dark:text-pink-300 scale-[0.98]'
                          : 'border-border bg-card/90 text-foreground hover:border-pink-400/50'
                      "
                      @click="playMockVoice(idx)"
                    >
                      <Play
                        class="size-3 shrink-0"
                        :class="playingVoiceIndex === idx ? 'fill-current' : ''"
                      />
                      <span class="truncate">{{ playingVoiceIndex === idx ? '播放中...' : voice }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 前景双向视差状态胶囊 -->
            <div
              class="pointer-events-none hidden sm:inline-flex items-center gap-1.5 rounded-full border border-pink-400/35 bg-card/95 px-3 py-1.5 text-[11px] font-semibold text-pink-600 dark:text-pink-400 shadow-lg backdrop-blur-md absolute -bottom-4 left-5 will-change-transform"
              :style="badgeStyle(1, 'left')"
            >
              <Sparkles class="size-3.5" />
              支持 Google Fonts · 定时显隐 · JSON 模板
            </div>
          </div>

          <div
            class="lg:col-span-5 lg:order-2 order-1 flex flex-col items-start will-change-transform"
            :style="copyStyle(1, 'right')"
          >
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-500">
                <LayoutGrid class="size-4" />
                可视化个人主页装修
              </span>
              <span class="rounded-full bg-pink-500/12 px-2 py-0.5 text-[10px] font-semibold text-pink-600 dark:text-pink-400">
                44 种积木区块
              </span>
            </div>

            <h3 class="mt-3 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              专为 VTB 与创作者打造的 Bento 个人门户
            </h3>
            <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
              支持多子页面、Bento 跨列网格、开播/定时自动显隐与完整字体库。除常规链接与相册外，内置 OC 设定集、约稿价目表、声按钮语音板，甚至支持自定义 Vue 代码区块。
            </p>

            <ul class="mt-5 space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li class="flex items-center gap-2">
                <CheckCircle2 class="size-4 text-pink-500 shrink-0" />
                <span>OC 三视图色卡、约稿排单价目、可试听语音板开箱即用</span>
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle2 class="size-4 text-pink-500 shrink-0" />
                <span>直连直播状态、10 套日程表、6 套歌单、弹幕投票与排队</span>
              </li>
              <li class="flex items-center gap-2">
                <CheckCircle2 class="size-4 text-pink-500 shrink-0" />
                <span>支持 JSON 导入导出、个人模板保存与新标签草稿预览</span>
              </li>
            </ul>

            <div class="mt-6 flex flex-wrap items-center gap-2.5">
              <Button
                class="gap-1"
                @click="router.push({ name: 'manage-userPageBuilder' })"
              >
                打开主页编辑器
                <ArrowUpRight class="size-3.5" />
              </Button>
              <Button
                variant="outline"
                @click="router.push('/@Megghy')"
              >
                查看示例主页
              </Button>
            </div>
          </div>
        </div>

        <!-- ==================== 展区 3：VTsuru 桌面客户端全生态（左文右舞台） ==================== -->
        <div
          :ref="(el) => setRowEl(2, el)"
          class="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12"
        >
          <div
            class="lg:col-span-5 flex flex-col items-start will-change-transform"
            :style="copyStyle(2, 'left')"
          >
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Monitor class="size-4" />
                VTsuru 桌面客户端
              </span>
              <span class="rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                Tauri 本地轻量运行
              </span>
            </div>

            <h3 class="mt-3 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              接管开播推流、自动感谢、VTS 联动与语音同传
            </h3>
            <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
              不再只是本地弹幕机。一站覆盖开关播 OBS 推流、模板与 JS 脚本自动化、弹幕签到、透明桌面浮窗、VTube Studio 模型热键触发以及本地实时语音转写字幕。
            </p>

            <div class="mt-5 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              <div
                v-for="cap in CLIENT_CAPABILITIES"
                :key="cap.id"
                class="flex items-start gap-2 rounded-lg border border-border/80 bg-card/90 p-2.5 backdrop-blur-sm"
              >
                <component
                  :is="cap.icon"
                  class="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <div class="min-w-0">
                  <div class="text-xs font-semibold text-foreground">{{ cap.title }}</div>
                  <p class="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">{{ cap.desc }}</p>
                </div>
              </div>
            </div>

            <div class="mt-6 flex flex-wrap items-center gap-2.5">
              <Button
                class="gap-1.5"
                @click="router.push({ name: 'client-download' })"
              >
                <Download class="size-3.5" />
                下载桌面客户端
              </Button>
              <Button
                variant="outline"
                class="gap-1.5"
                @click="router.push({ name: 'docs-article', params: { slug: ['getting-started', 'client-guide'] } })"
              >
                <FileText class="size-3.5" />
                使用说明
              </Button>
              <Button
                variant="outline"
                class="gap-1.5"
                as-child
              >
                <a
                  :href="EXTERNAL_LINKS.clientRepo"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Code2 class="size-3.5" />
                  客户端代码
                </a>
              </Button>
              <Button
                variant="outline"
                class="gap-1.5"
                as-child
              >
                <a
                  :href="EXTERNAL_LINKS.clientWebLogic"
                  target="_blank"
                  rel="noreferrer"
                >
                  逻辑代码
                </a>
              </Button>
            </div>
          </div>

          <div class="lg:col-span-7 relative">
            <div
              class="will-change-transform overflow-hidden rounded-2xl border border-border bg-card/94 shadow-xl backdrop-blur-md"
              :style="stageStyle(2, 'right')"
            >
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-muted/55 px-4 py-2.5">
                <div class="flex flex-wrap items-center gap-1.5">
                  <button
                    v-for="tab in [
                      { id: 'live', label: '一键开播推流' },
                      { id: 'auto', label: '自动操作与脚本' },
                      { id: 'subtitle', label: '本地语音同传' },
                    ] as const"
                    :key="tab.id"
                    type="button"
                    class="rounded-md border px-2.5 py-1 text-xs transition-colors"
                    :class="
                      clientTab === tab.id
                        ? 'border-amber-500/60 bg-amber-500/12 font-semibold text-amber-700 dark:text-amber-300'
                        : 'border-border bg-background/80 text-muted-foreground hover:text-foreground'
                    "
                    @click="clientTab = tab.id"
                  >
                    {{ tab.label }}
                  </button>
                </div>
                <span class="text-[11px] text-muted-foreground">本地客户端运行态</span>
              </div>

              <div class="min-h-[248px] p-4 sm:p-5">
                <template v-if="clientTab === 'live'">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <Radio class="size-4 text-emerald-500" />
                      <span class="text-sm font-bold text-foreground">客户端直播管理 · 免直播姬推流</span>
                    </div>
                    <span class="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      OBS 已就绪
                    </span>
                  </div>
                  <div class="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
                    <div class="rounded-lg border border-border/80 bg-inset/60 p-3">
                      <div class="text-[11px] text-muted-foreground">直播间标题</div>
                      <div class="mt-1 font-medium text-foreground">周末歌回点歌台 · 新场景测试</div>
                    </div>
                    <div class="rounded-lg border border-border/80 bg-inset/60 p-3">
                      <div class="text-[11px] text-muted-foreground">分区与状态</div>
                      <div class="mt-1 font-medium text-foreground">虚拟主播 · 虚拟日常</div>
                    </div>
                    <div class="sm:col-span-2 flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-inset/60 p-3">
                      <div class="min-w-0">
                        <div class="text-[11px] text-muted-foreground">RTMP 推流地址与串流密钥</div>
                        <div class="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                          rtmp://live-push.bilivideo.com/live-bvc/ · ••••••••••••
                        </div>
                      </div>
                      <span class="shrink-0 rounded-md bg-brand/12 px-2.5 py-1 text-[11px] font-semibold text-brand">
                        已同步至 OBS
                      </span>
                    </div>
                  </div>
                </template>

                <template v-else-if="clientTab === 'auto'">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <Sparkles class="size-4 text-amber-500" />
                      <span class="text-sm font-bold text-foreground">自动化规则与 JS 执行流</span>
                    </div>
                    <span class="text-[11px] text-muted-foreground">EventFetcher 实时监听</span>
                  </div>
                  <div class="mt-4 space-y-2.5 text-xs">
                    <div class="rounded-lg border border-border/80 bg-inset/60 p-3">
                      <div class="flex items-center justify-between">
                        <span class="font-semibold text-foreground">弹幕签到 + 积分入账</span>
                        <span class="text-[10px] text-emerald-600 dark:text-emerald-400">已启用</span>
                      </div>
                      <p class="mt-1 font-mono text-[11px] text-muted-foreground">
                        触发词「签到」 → 发放每日积分 → 回复「已连续签到 {{ '{' }}days{{ '}' }} 天」
                      </p>
                    </div>
                    <div class="rounded-lg border border-border/80 bg-inset/60 p-3">
                      <div class="flex items-center justify-between">
                        <span class="font-semibold text-foreground">上舰私信感谢 + VTS 开心表情</span>
                        <span class="text-[10px] text-emerald-600 dark:text-emerald-400">已启用</span>
                      </div>
                      <p class="mt-1 font-mono text-[11px] text-muted-foreground">
                        onGuardBuy() → sendPM() &amp;&amp; vts.triggerHotkey('celebrate')
                      </p>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-bold text-foreground">本地语音转写 → OBS 字幕条</span>
                    <span class="rounded-full bg-brand/12 px-2 py-0.5 text-[10px] font-semibold text-brand">
                      低延迟直推
                    </span>
                  </div>
                  <div class="mt-4 space-y-3">
                    <div class="rounded-xl border border-transparent dark:border-white/15 bg-slate-900 px-4 py-4 text-center text-sm font-medium text-white shadow-inner">
                      “欢迎大家来到今晚的直播间，等会儿我们先把弹幕投票开起来！”
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>已自动归档至当前直播场次复盘文稿</span>
                      <span class="tabular-nums">延迟 ~320ms</span>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <!-- 前景双向视差状态胶囊 -->
            <div
              class="pointer-events-none hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-card/95 px-3 py-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 shadow-lg backdrop-blur-md absolute -bottom-4 right-5 will-change-transform"
              :style="badgeStyle(2, 'right')"
            >
              <Radio class="size-3.5" />
              本地 RPC · EventFetcher · VTS 联动
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.obs-grid-bg {
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 20px 20px;
}
</style>
