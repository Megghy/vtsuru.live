<script setup lang="ts">
import { ArrowUpRight } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import { Button } from '@/shared/ui/button'

import { OBS_WIDGETS } from './indexData'
import { clamp, easeOutCubic, lerp, useElementScrollProgress } from './useIndexMotion'

const props = defineProps<{
  scrollY: number
  isDesktop: boolean
  isReduced: boolean
}>()

const router = useRouter()
const sectionEl = useTemplateRef<HTMLElement>('sectionEl')
const scrollState = useElementScrollProgress(sectionEl, {
  enterStartRatio: 0.98,
  enterEndRatio: 0.36,
})

// 时钟挂件真实跳动时间
const nowText = ref('21:45:12')
const pressedKeyIndex = ref(0)
let clockTimer = 0

function syncClock() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  nowText.value = `${hh}:${mm}:${ss}`
  pressedKeyIndex.value = (pressedKeyIndex.value + 1) % 4
}

onMounted(() => {
  syncClock()
  if (props.isReduced) return
  clockTimer = window.setInterval(syncClock, 1000)
})

onBeforeUnmount(() => {
  if (clockTimer) window.clearInterval(clockTimer)
})

const accentClasses = computed<Record<'brand' | 'sakura' | 'amber' | 'emerald', string>>(() => ({
  brand: 'text-brand bg-brand/12 ring-brand/20',
  sakura: 'text-pink-500 bg-pink-500/12 ring-pink-500/20',
  amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/12 ring-amber-500/20',
  emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12 ring-emerald-500/20',
}))

const sampleKeys = ['W', 'A', 'S', 'D']

// ---- 滚动驱动挂件内部实时数值与变换 ----
const headerStyle = computed(() => {
  if (props.isReduced) return undefined
  const t = easeOutCubic(clamp(scrollState.enter * 1.45, 0, 1))
  return {
    transform: `translate3d(0, ${lerp(22, 0, t).toFixed(1)}px, 0)`,
    opacity: lerp(0.15, 1, t).toFixed(3),
  }
})

/** 大转盘圆盘随滚动实时旋转 */
const wheelAngle = computed(() => (props.isReduced ? 0 : (props.scrollY * 0.45) % 360))

/** 耐久目标条随滚入视口实时推进（26% → 78%） */
const goalPercent = computed(() => {
  if (props.isReduced) return 78
  return Math.round(lerp(26, 78, scrollState.easedEnter))
})

/** 受苦计数器数字随滚入实时递增（014 → 042） */
const deathCountText = computed(() => {
  const val = props.isReduced ? 42 : Math.round(lerp(14, 42, scrollState.easedEnter))
  return String(val).padStart(3, '0')
})

/** 手柄摇杆力度条随滚动左右微摆 */
const gamepadBarPercent = computed(() => {
  if (props.isReduced) return 66
  return Math.round(52 + Math.sin(scrollState.center * Math.PI) * 32)
})

const gamepadStickOffset = computed(() => {
  if (props.isReduced) return 0
  return Math.sin(scrollState.center * Math.PI) * 5
})

/** PNGtuber 双头像随滚动轻微反向弹跳 */
const pngAvatarOffset = computed(() => (props.isReduced ? 0 : Math.sin(scrollState.center * Math.PI * 1.2) * 5))

/** 两排卡片（4+4）随滚动反向水平错轨滑移 + 按列错峰落位 */
function getCardStyle(index: number) {
  if (props.isReduced) return undefined
  const row = index < 4 ? 0 : 1
  const col = index % 4
  const localEnter = easeOutCubic(clamp((scrollState.enter - col * 0.06 - row * 0.08) / 0.68, 0, 1))
  const rowShiftX = props.isDesktop ? scrollState.center * (row === 0 ? -18 : 18) : 0
  const enterY = lerp(28, 0, localEnter)
  const scale = lerp(0.95, 1, localEnter)
  return {
    transform: `translate3d(${rowShiftX.toFixed(1)}px, ${enterY.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`,
    opacity: lerp(0.18, 1, localEnter).toFixed(3),
  }
}
</script>

<template>
  <section
    id="obs-widgets"
    ref="sectionEl"
    class="relative overflow-x-clip border-y border-border/60 bg-inset/30 backdrop-blur-[2px] py-16 sm:py-22"
  >
    <div class="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8">
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between will-change-transform"
        :style="headerStyle"
      >
        <div class="max-w-2xl">
          <h2 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            OBS 组件库：8 大直播挂件即配即用
          </h2>
          <p class="mt-2 text-sm text-muted-foreground sm:text-base">
            免折腾 HTML/CSS，网页端所见即所得配好风格，一键复制链接贴入 OBS 或直接拖进场景编辑器。
          </p>
        </div>

        <Button
          variant="outline"
          class="self-start sm:self-auto gap-1.5"
          @click="router.push({ name: 'manage-obsStore' })"
        >
          进入 OBS 组件库
          <ArrowUpRight class="size-3.5" />
        </Button>
      </div>

      <div class="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="(widget, idx) in OBS_WIDGETS"
          :key="widget.id"
          class="will-change-transform"
          :style="getCardStyle(idx)"
        >
          <button
            type="button"
            class="group flex h-full w-full flex-col justify-between rounded-xl border border-border/80 bg-card/82 backdrop-blur-md p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/50 hover:bg-card/95 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="router.push({ name: 'manage-obsStore' })"
          >
            <div>
              <!-- 迷你动态预览槽（滚动实时驱动变换） -->
              <div class="mb-3.5 flex h-16 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-inset/75 px-3">
                <!-- 时钟 -->
                <div
                  v-if="widget.previewKind === 'clock'"
                  class="font-mono text-lg font-bold tracking-wider text-brand tabular-nums"
                >
                  {{ nowText }}
                </div>

                <!-- 耐久目标进度（随滚入推进） -->
                <div
                  v-else-if="widget.previewKind === 'goal'"
                  class="w-full"
                >
                  <div class="flex items-center justify-between text-[11px] font-semibold">
                    <span class="text-foreground">舰长耐久目标</span>
                    <span class="text-pink-500 tabular-nums">{{ goalPercent }} / 100</span>
                  </div>
                  <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      class="h-full rounded-full bg-gradient-to-r from-brand to-pink-400"
                      :style="{ width: `${goalPercent}%` }"
                    />
                  </div>
                </div>

                <!-- PNGtuber 联动（双头像反向轻跳） -->
                <div
                  v-else-if="widget.previewKind === 'pngtuber'"
                  class="flex items-center gap-2.5"
                >
                  <span
                    class="flex size-8 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand ring-2 ring-brand/40 will-change-transform"
                    :style="{ transform: `translate3d(0, ${pngAvatarOffset.toFixed(1)}px, 0)` }"
                  >
                    A
                  </span>
                  <span
                    class="flex size-8 items-center justify-center rounded-full bg-pink-500/15 text-xs font-bold text-pink-500 ring-2 ring-pink-400/40 will-change-transform"
                    :style="{ transform: `translate3d(0, ${(-pngAvatarOffset).toFixed(1)}px, 0)` }"
                  >
                    B
                  </span>
                  <span class="rounded-md bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-border">
                    #842910
                  </span>
                </div>

                <!-- 同传字幕 -->
                <div
                  v-else-if="widget.previewKind === 'subtitle'"
                  class="w-full rounded-md bg-slate-900/90 px-2.5 py-1.5 text-center text-[11px] text-white/95 truncate"
                >
                  “今晚我们挑战无伤通关！”
                </div>

                <!-- 大转盘（随滚动实时旋转） -->
                <div
                  v-else-if="widget.previewKind === 'wheel'"
                  class="flex items-center gap-3"
                >
                  <span
                    class="wheel-disc size-10 rounded-full ring-2 ring-border will-change-transform"
                    :style="{ transform: `rotate(${wheelAngle.toFixed(1)}deg)` }"
                  />
                  <span class="text-[11px] font-medium text-muted-foreground">权重抽奖 · 同步开奖</span>
                </div>

                <!-- 受苦计数器（随滚入跳涨） -->
                <div
                  v-else-if="widget.previewKind === 'counter'"
                  class="flex items-baseline gap-2"
                >
                  <span class="text-[11px] text-muted-foreground">DEATHS</span>
                  <span class="font-mono text-xl font-extrabold text-amber-500 tabular-nums">{{ deathCountText }}</span>
                </div>

                <!-- 手柄投屏（摇杆与力度条随滚动实时摆动） -->
                <div
                  v-else-if="widget.previewKind === 'gamepad'"
                  class="flex items-center gap-2"
                >
                  <span
                    class="flex size-6 items-center justify-center rounded-full border border-brand/50 bg-brand/12 text-[10px] font-bold text-brand will-change-transform"
                    :style="{ transform: `translate3d(${gamepadStickOffset.toFixed(1)}px, 0, 0)` }"
                  >
                    L
                  </span>
                  <span class="h-1.5 w-8 rounded-full bg-muted overflow-hidden">
                    <span
                      class="block h-full bg-brand rounded-full"
                      :style="{ width: `${gamepadBarPercent}%` }"
                    />
                  </span>
                  <span class="flex size-6 items-center justify-center rounded-full border border-pink-400/50 bg-pink-500/12 text-[10px] font-bold text-pink-500">
                    A
                  </span>
                </div>

                <!-- 键鼠投屏 -->
                <div
                  v-else
                  class="flex items-center gap-1.5"
                >
                  <span
                    v-for="(k, kIdx) in sampleKeys"
                    :key="k"
                    class="flex size-7 items-center justify-center rounded-md border font-mono text-xs font-bold transition-colors duration-150"
                    :class="
                      pressedKeyIndex === kIdx
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-border bg-background text-foreground'
                    "
                  >
                    {{ k }}
                  </span>
                </div>
              </div>

              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg ring-1"
                    :class="accentClasses[widget.accent]"
                  >
                    <component
                      :is="widget.icon"
                      class="size-4"
                    />
                  </span>
                  <div class="min-w-0">
                    <h3 class="truncate text-sm font-semibold text-foreground">{{ widget.name }}</h3>
                    <div class="text-[11px] text-muted-foreground">{{ widget.subtitle }}</div>
                  </div>
                </div>
                <ArrowUpRight class="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
              </div>

              <p class="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                {{ widget.desc }}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.wheel-disc {
  background: conic-gradient(
    #23ade5 0deg 90deg,
    #f472b6 90deg 180deg,
    #f59e0b 180deg 270deg,
    #10b981 270deg 360deg
  );
}
</style>
