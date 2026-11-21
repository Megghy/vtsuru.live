import { usePreferredReducedMotion } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Ref } from 'vue'

export function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val))
}

export function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t
}

export function easeOutCubic(t: number) {
  const c = clamp(t, 0, 1)
  return 1 - (1 - c) ** 3
}

// ---- 全局共享单一滚动调度器，所有组件在同一次 rAF 内批量采样，避免多监听器与布局抖动 ----
type ScrollSubscriber = () => void
const subscribers = new Set<ScrollSubscriber>()
let globalRafId = 0
let listening = false

function flushScrollSubscribers() {
  globalRafId = 0
  subscribers.forEach((cb) => cb())
}

function scheduleGlobalScroll() {
  if (globalRafId) return
  globalRafId = window.requestAnimationFrame(flushScrollSubscribers)
}

function addScrollSubscriber(cb: ScrollSubscriber) {
  subscribers.add(cb)
  if (!listening && typeof window !== 'undefined') {
    listening = true
    window.addEventListener('scroll', scheduleGlobalScroll, { passive: true })
    window.addEventListener('resize', scheduleGlobalScroll, { passive: true })
  }
  return () => {
    subscribers.delete(cb)
    if (subscribers.size === 0 && listening && typeof window !== 'undefined') {
      listening = false
      window.removeEventListener('scroll', scheduleGlobalScroll)
      window.removeEventListener('resize', scheduleGlobalScroll)
      if (globalRafId) {
        window.cancelAnimationFrame(globalRafId)
        globalRafId = 0
      }
    }
  }
}

export type IndexSectionId = '' | 'flagship' | 'obs-widgets' | 'features' | 'streamers'
const TRACKED_SECTIONS: readonly Exclude<IndexSectionId, ''>[] = [
  'flagship',
  'obs-widgets',
  'features',
  'streamers',
]

/**
 * 首页全局滚动状态、Hero 退场进度与章节 Scroll Spy（纯 GPU 友好，自动遵循 prefers-reduced-motion）。
 */
export function useIndexParallax() {
  const reducedMotion = usePreferredReducedMotion()
  const isReduced = computed(() => reducedMotion.value === 'reduce')

  const scrollY = ref(0)
  const scrollProgress = ref(0)
  const viewportHeight = ref(900)
  const isDesktop = ref(true)
  const activeSectionId = ref<IndexSectionId>('')
  const isScrolled = computed(() => scrollY.value > 24)

  // Hero 离开首屏的归一化进度 [0, 1]
  const heroExitProgress = computed(() => {
    if (isReduced.value) return 0
    return clamp(scrollY.value / Math.max(460, viewportHeight.value * 0.78), 0, 1)
  })

  function syncGlobal() {
    const y = window.scrollY || 0
    const vh = window.innerHeight || 900
    scrollY.value = y
    viewportHeight.value = vh
    isDesktop.value = window.innerWidth >= 1024
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh)
    scrollProgress.value = clamp(y / maxScroll, 0, 1)

    // Scroll Spy：取顶部越过视口 36% 线的最深章节
    const probeLine = vh * 0.36
    let current: IndexSectionId = ''
    for (const id of TRACKED_SECTIONS) {
      const el = document.getElementById(id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (rect.top <= probeLine) {
        current = id
      }
    }
    activeSectionId.value = current
  }

  let cleanup: (() => void) | null = null

  onMounted(() => {
    syncGlobal()
    cleanup = addScrollSubscriber(syncGlobal)
  })

  onBeforeUnmount(() => {
    cleanup?.()
    cleanup = null
  })

  return {
    isReduced,
    isDesktop,
    scrollY,
    scrollProgress,
    isScrolled,
    heroExitProgress,
    activeSectionId,
  }
}

export interface ElementScrollState {
  /** 元素从视口底部进入至中上区的线性进度 [0, 1] */
  enter: number
  /** easeOutCubic 缓动后的入场进度 [0, 1]，用于 3D 展开/缩放/归位 */
  easedEnter: number
  /** 元素中心相对视口中心的归一化偏移 [-1, 1]（下方 +1，居中 0，上方 -1） */
  center: number
  /** 元素完整穿越视口的进度 [0, 1] */
  pass: number
}

/**
 * 追踪单个 DOM 节点在视口中的连续滚动变换进度，挂接在全局单一 rAF 调度器上。
 */
export function useElementScrollProgress(
  target: Ref<HTMLElement | null>,
  options: {
    /** 开始计入入场动画的视口比例（默认 0.98，即刚露头就开始） */
    enterStartRatio?: number
    /** 入场动画完全展开落位的视口比例（默认 0.42，略低于视口中线即完全展开） */
    enterEndRatio?: number
  } = {},
) {
  const reducedMotion = usePreferredReducedMotion()
  const enterStartRatio = options.enterStartRatio ?? 0.98
  const enterEndRatio = options.enterEndRatio ?? 0.42

  const state = reactive<ElementScrollState>({
    enter: 0,
    easedEnter: 0,
    center: 0,
    pass: 0,
  })

  function measure() {
    if (reducedMotion.value === 'reduce') {
      state.enter = 1
      state.easedEnter = 1
      state.center = 0
      state.pass = 0.5
      return
    }
    const el = target.value
    if (!el) return
    const vh = window.innerHeight || 900
    const rect = el.getBoundingClientRect()

    const startY = vh * enterStartRatio
    const endY = vh * enterEndRatio
    const enter = clamp((startY - rect.top) / Math.max(1, startY - endY), 0, 1)
    state.enter = enter
    state.easedEnter = easeOutCubic(enter)

    const elCenter = rect.top + rect.height * 0.5
    state.center = clamp((elCenter - vh * 0.5) / (vh * 0.72), -1, 1)

    state.pass = clamp((vh - rect.top) / Math.max(1, vh + rect.height), 0, 1)
  }

  let cleanup: (() => void) | null = null

  onMounted(() => {
    measure()
    cleanup = addScrollSubscriber(measure)
  })

  watch(reducedMotion, measure)

  onBeforeUnmount(() => {
    cleanup?.()
    cleanup = null
  })

  return state
}

/**
 * 追踪一组同级元素各自的连续滚动进度（如交错展区行、功能分组块），共享单 rAF。
 */
export function useMultiElementScrollProgress(
  count: number,
  options: { enterStartRatio?: number; enterEndRatio?: number } = {},
) {
  const reducedMotion = usePreferredReducedMotion()
  const enterStartRatio = options.enterStartRatio ?? 0.98
  const enterEndRatio = options.enterEndRatio ?? 0.44

  const elements: (HTMLElement | null)[] = Array.from({ length: count }, () => null)
  const states = ref<ElementScrollState[]>(
    Array.from({ length: count }, () => ({
      enter: 0,
      easedEnter: 0,
      center: 0,
      pass: 0,
    })),
  )

  function setEl(index: number, el: unknown) {
    elements[index] = el instanceof HTMLElement ? el : null
  }

  function measureAll() {
    const isReduced = reducedMotion.value === 'reduce'
    const vh = window.innerHeight || 900
    const startY = vh * enterStartRatio
    const endY = vh * enterEndRatio
    const next: ElementScrollState[] = []

    for (let i = 0; i < count; i += 1) {
      if (isReduced) {
        next.push({ enter: 1, easedEnter: 1, center: 0, pass: 0.5 })
        continue
      }
      const el = elements[i]
      if (!el) {
        next.push(states.value[i] ?? { enter: 0, easedEnter: 0, center: 0, pass: 0 })
        continue
      }
      const rect = el.getBoundingClientRect()
      const enter = clamp((startY - rect.top) / Math.max(1, startY - endY), 0, 1)
      const elCenter = rect.top + rect.height * 0.5
      next.push({
        enter,
        easedEnter: easeOutCubic(enter),
        center: clamp((elCenter - vh * 0.5) / (vh * 0.72), -1, 1),
        pass: clamp((vh - rect.top) / Math.max(1, vh + rect.height), 0, 1),
      })
    }
    states.value = next
  }

  let cleanup: (() => void) | null = null

  onMounted(() => {
    measureAll()
    cleanup = addScrollSubscriber(measureAll)
  })

  watch(reducedMotion, measureAll)

  onBeforeUnmount(() => {
    cleanup?.()
    cleanup = null
  })

  return {
    setEl,
    states,
    measureAll,
  }
}

/**
 * 数值平滑递增动画（用于注册用户数等核心指标）。
 */
export function useAnimatedNumber(source: Ref<number>, durationMs = 700) {
  const reducedMotion = usePreferredReducedMotion()
  const display = ref(source.value)
  let rafId = 0

  watch(
    source,
    (target) => {
      if (rafId) window.cancelAnimationFrame(rafId)
      if (reducedMotion.value === 'reduce' || target <= 0) {
        display.value = target
        return
      }
      const startVal = display.value
      const delta = target - startVal
      if (delta === 0) return
      const startTime = performance.now()

      const tick = (now: number) => {
        const progress = Math.min(1, (now - startTime) / durationMs)
        display.value = Math.round(startVal + delta * easeOutCubic(progress))
        if (progress < 1) {
          rafId = window.requestAnimationFrame(tick)
        } else {
          display.value = target
          rafId = 0
        }
      }
      rafId = window.requestAnimationFrame(tick)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (rafId) window.cancelAnimationFrame(rafId)
  })

  return display
}
