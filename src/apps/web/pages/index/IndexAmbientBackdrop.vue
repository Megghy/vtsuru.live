<script setup lang="ts">
import {
  Clapperboard,
  Gamepad2,
  Heart,
  MessageSquareText,
  Mic,
  Music2,
  Radio,
  Sparkles,
  Star,
  Wand2,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import { computed } from 'vue'

const props = defineProps<{
  scrollY: number
  scrollProgress: number
  isReduced: boolean
}>()

interface FloatingGlyph {
  id: string
  icon: Component
  left: string
  top: string
  sizeClass: string
  rotate: number
  /** 随滚动的旋转角速度（deg / 100px），正反交错 */
  spinRate: number
  /** 随滚动的水平摆幅 */
  swayX: number
  /** 随滚动的垂直波幅与相位 */
  waveY: number
  phase: number
  tone: 'brand' | 'sakura' | 'amber'
  far?: boolean
  floatDuration: string
  floatDelay: string
}

// 避开中心正文区，分布在左右边缘与上下呼吸带，随滚动产生连续平滑的轨迹、角旋转与景深
const glyphs: readonly FloatingGlyph[] = [
  {
    id: 'spark-tl',
    icon: Sparkles,
    left: '5%',
    top: '13%',
    sizeClass: 'size-7',
    rotate: -14,
    spinRate: 4.5,
    swayX: 18,
    waveY: 64,
    phase: 0.2,
    tone: 'brand',
    floatDuration: '7.5s',
    floatDelay: '0s',
  },
  {
    id: 'music-tr',
    icon: Music2,
    left: '91%',
    top: '16%',
    sizeClass: 'size-8',
    rotate: 12,
    spinRate: -5.2,
    swayX: -22,
    waveY: 76,
    phase: 1.4,
    tone: 'sakura',
    floatDuration: '8.2s',
    floatDelay: '-2.1s',
  },
  {
    id: 'star-mid-l',
    icon: Star,
    left: '3.5%',
    top: '38%',
    sizeClass: 'size-6',
    rotate: 18,
    spinRate: 6.0,
    swayX: 14,
    waveY: 48,
    phase: 2.3,
    tone: 'amber',
    far: true,
    floatDuration: '9.4s',
    floatDelay: '-1.3s',
  },
  {
    id: 'danmu-mid-r',
    icon: MessageSquareText,
    left: '93%',
    top: '40%',
    sizeClass: 'size-7',
    rotate: -10,
    spinRate: -3.8,
    swayX: -20,
    waveY: 68,
    phase: 3.1,
    tone: 'brand',
    floatDuration: '7.8s',
    floatDelay: '-3.2s',
  },
  {
    id: 'mic-l',
    icon: Mic,
    left: '7%',
    top: '60%',
    sizeClass: 'size-7',
    rotate: -18,
    spinRate: 4.8,
    swayX: 24,
    waveY: 82,
    phase: 4.2,
    tone: 'sakura',
    floatDuration: '8.8s',
    floatDelay: '-0.8s',
  },
  {
    id: 'gamepad-r',
    icon: Gamepad2,
    left: '89%',
    top: '62%',
    sizeClass: 'size-8',
    rotate: 15,
    spinRate: -5.5,
    swayX: -16,
    waveY: 56,
    phase: 5.0,
    tone: 'amber',
    far: true,
    floatDuration: '9.6s',
    floatDelay: '-4.0s',
  },
  {
    id: 'heart-bl',
    icon: Heart,
    left: '4.5%',
    top: '82%',
    sizeClass: 'size-6',
    rotate: -12,
    spinRate: 5.0,
    swayX: 16,
    waveY: 72,
    phase: 0.9,
    tone: 'sakura',
    floatDuration: '7.2s',
    floatDelay: '-2.6s',
  },
  {
    id: 'clapper-br',
    icon: Clapperboard,
    left: '92%',
    top: '83%',
    sizeClass: 'size-7',
    rotate: 10,
    spinRate: -4.2,
    swayX: -18,
    waveY: 60,
    phase: 2.7,
    tone: 'brand',
    floatDuration: '8.5s',
    floatDelay: '-1.7s',
  },
  {
    id: 'radio-center-top',
    icon: Radio,
    left: '47%',
    top: '9%',
    sizeClass: 'size-6',
    rotate: 8,
    spinRate: 3.2,
    swayX: 12,
    waveY: 40,
    phase: 3.8,
    tone: 'brand',
    far: true,
    floatDuration: '10.2s',
    floatDelay: '-3.5s',
  },
  {
    id: 'wand-center-low',
    icon: Wand2,
    left: '51%',
    top: '76%',
    sizeClass: 'size-6',
    rotate: -16,
    spinRate: -4.6,
    swayX: -14,
    waveY: 46,
    phase: 1.9,
    tone: 'amber',
    far: true,
    floatDuration: '9.0s',
    floatDelay: '-0.5s',
  },
]

const gridOffset = computed(() => (props.isReduced ? 0 : Math.min(props.scrollY * 0.06, 220)))

// 四团星云光晕随整页 scrollProgress 做弧线流转 + 呼吸缩放，让不同章节拥有连贯流变的氛围色
const cyanOrbStyle = computed(() => {
  if (props.isReduced) return undefined
  const p = props.scrollProgress
  const x = Math.sin(p * Math.PI * 1.4) * 140
  const y = p * 260
  const scale = 1 + Math.sin(p * Math.PI) * 0.14
  return { transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})` }
})

const sakuraOrbStyle = computed(() => {
  if (props.isReduced) return undefined
  const p = props.scrollProgress
  const x = -Math.sin(p * Math.PI * 1.2) * 160
  const y = -p * 180 + Math.cos(p * Math.PI * 2) * 45
  const scale = 0.96 + Math.sin(p * Math.PI * 1.5) * 0.16
  return { transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})` }
})

const amberOrbStyle = computed(() => {
  if (props.isReduced) return undefined
  const p = props.scrollProgress
  const x = Math.sin(p * Math.PI * 1.8) * 180
  const y = -p * 200
  const scale = 0.92 + Math.cos(p * Math.PI) * 0.12
  return { transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})` }
})

const lowCyanOrbStyle = computed(() => {
  if (props.isReduced) return undefined
  const p = props.scrollProgress
  const x = -Math.cos(p * Math.PI * 1.3) * 130
  const y = (1 - p) * 140 - 70
  const scale = 0.94 + p * 0.18
  return { transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})` }
})

function getGlyphTransform(item: FloatingGlyph) {
  if (props.isReduced) return undefined
  const theta = props.scrollProgress * Math.PI * 2.2 + item.phase
  const y = Math.sin(theta) * item.waveY
  const x = Math.cos(theta * 0.85) * item.swayX
  const deg = (props.scrollY / 100) * item.spinRate
  return `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${deg.toFixed(1)}deg)`
}

const toneClasses: Record<FloatingGlyph['tone'], string> = {
  brand: 'text-sky-500/24 dark:text-sky-300/28',
  sakura: 'text-pink-500/22 dark:text-pink-300/25',
  amber: 'text-amber-500/22 dark:text-amber-300/24',
}
</script>

<template>
  <div
    class="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    aria-hidden="true"
  >
    <!-- 1. 全屏微细点阵网格（随滚动慢速上移） -->
    <div
      class="ambient-dot-grid absolute -inset-y-56 inset-x-0"
      :style="{ transform: `translate3d(0, ${-gridOffset}px, 0)` }"
    />

    <!-- 2. 随滚动弧线流转的星云光晕层（明暗双主题清晰通透） -->
    <div
      class="ambient-orb ambient-orb--cyan absolute -top-28 -left-24 h-[520px] w-[620px] rounded-full"
      :style="cyanOrbStyle"
    />
    <div
      class="ambient-orb ambient-orb--sakura absolute top-[14%] -right-24 h-[480px] w-[560px] rounded-full"
      :style="sakuraOrbStyle"
    />
    <div
      class="ambient-orb ambient-orb--amber absolute top-[54%] left-[8%] h-[440px] w-[500px] rounded-full"
      :style="amberOrbStyle"
    />
    <div
      class="ambient-orb ambient-orb--cyan-low absolute -bottom-32 right-[10%] h-[500px] w-[580px] rounded-full"
      :style="lowCyanOrbStyle"
    />

    <!-- 3. 轻二次元创作者矢量轮廓漂浮层（随滚动波浪轨迹 + 角旋转） -->
    <div
      v-for="item in glyphs"
      :key="item.id"
      class="absolute hidden sm:block will-change-transform"
      :style="{
        left: item.left,
        top: item.top,
        transform: getGlyphTransform(item),
      }"
    >
      <div
        class="glyph-bob flex items-center justify-center rounded-2xl border border-current/15 dark:border-current/22 bg-current/[0.03] dark:bg-current/[0.05] p-2.5 backdrop-blur-[1px]"
        :class="[
          toneClasses[item.tone],
          item.far ? 'blur-[0.6px] opacity-75' : 'opacity-100',
          { 'glyph-bob--static': isReduced },
        ]"
        :style="{
          '--glyph-rotate': `${item.rotate}deg`,
          '--glyph-duration': item.floatDuration,
          '--glyph-delay': item.floatDelay,
        }"
      >
        <component
          :is="item.icon"
          :class="item.sizeClass"
          :stroke-width="1.6"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ambient-dot-grid {
  background-image: radial-gradient(color-mix(in srgb, var(--foreground) 13%, transparent) 1px, transparent 1px);
  background-size: 28px 28px;
  opacity: 0.72;
}

html.dark .ambient-dot-grid {
  background-image: radial-gradient(color-mix(in srgb, var(--foreground) 18%, transparent) 1px, transparent 1px);
  opacity: 0.68;
}

.ambient-orb {
  filter: blur(110px);
  will-change: transform;
}

html.dark .ambient-orb {
  filter: blur(100px);
}

.ambient-orb--cyan {
  background: radial-gradient(circle, rgba(35, 173, 229, 0.26) 0%, rgba(35, 173, 229, 0) 70%);
}

.ambient-orb--sakura {
  background: radial-gradient(circle, rgba(244, 114, 182, 0.22) 0%, rgba(244, 114, 182, 0) 70%);
}

.ambient-orb--amber {
  background: radial-gradient(circle, rgba(245, 158, 11, 0.16) 0%, rgba(245, 158, 11, 0) 70%);
}

.ambient-orb--cyan-low {
  background: radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, rgba(56, 189, 248, 0) 70%);
}

html.dark .ambient-orb--cyan {
  background: radial-gradient(circle, rgba(56, 189, 248, 0.3) 0%, rgba(56, 189, 248, 0) 70%);
}

html.dark .ambient-orb--sakura {
  background: radial-gradient(circle, rgba(244, 114, 182, 0.25) 0%, rgba(244, 114, 182, 0) 70%);
}

html.dark .ambient-orb--amber {
  background: radial-gradient(circle, rgba(251, 191, 36, 0.19) 0%, rgba(251, 191, 36, 0) 70%);
}

html.dark .ambient-orb--cyan-low {
  background: radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(56, 189, 248, 0) 70%);
}

@keyframes glyph-float {
  0%,
  100% {
    transform: rotate(var(--glyph-rotate, 0deg)) translateY(0);
  }
  50% {
    transform: rotate(calc(var(--glyph-rotate, 0deg) + 4deg)) translateY(-10px);
  }
}

.glyph-bob {
  animation: glyph-float var(--glyph-duration, 8s) ease-in-out var(--glyph-delay, 0s) infinite;
}

.glyph-bob--static {
  animation: none;
  transform: rotate(var(--glyph-rotate, 0deg));
}

@media (prefers-reduced-motion: reduce) {
  .glyph-bob {
    animation: none;
  }
}
</style>
