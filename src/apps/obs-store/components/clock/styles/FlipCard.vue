<script setup lang="ts">
import {
  ref,
  watch,
} from 'vue'

const props = defineProps<{
  value: string | number
  label?: string
  width?: number
}>()

const frontVal = ref(String(props.value))
const backVal = ref(String(props.value))
const isFlipping = ref(false)
let flipTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.value,
  (newVal) => {
    const nextStr = String(newVal)
    if (nextStr === backVal.value && !isFlipping.value) return

    if (flipTimer) {
      clearTimeout(flipTimer)
      flipTimer = null
    }

    frontVal.value = backVal.value
    backVal.value = nextStr
    isFlipping.value = false

    // 双 requestAnimationFrame 确保 Vue 响应式状态与 CSS 动画重置生效
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isFlipping.value = true
        // 动画时长 520ms，结束后重置状态
        flipTimer = setTimeout(() => {
          isFlipping.value = false
          frontVal.value = backVal.value
          flipTimer = null
        }, 540)
      })
    })
  },
)
</script>

<template>
  <div class="flip-unit-root">
    <div
      class="flip-card-wrapper"
      :style="{ width: props.width ? `${props.width}px` : undefined }"
    >
      <!-- 1. 静态上底卡：展示新数字 (backVal) 的上半部（翻下时显现） -->
      <div class="card-half top static">
        <div class="card-text">
          {{ backVal }}
        </div>
      </div>

      <!-- 2. 静态下底卡：展示旧数字 (frontVal) 的下半部（等待新下半部盖下） -->
      <div class="card-half bottom static">
        <div class="card-text">
          {{ frontVal }}
        </div>
      </div>

      <!-- 3. 翻折上半叶：展示旧数字 (frontVal) 的上半部并向前折倒 -->
      <div
        class="card-half top flap"
        :class="{ 'flip-top': isFlipping }"
      >
        <div class="card-text">
          {{ frontVal }}
        </div>
        <div
          class="card-shadow top"
          :class="{ 'shadow-in': isFlipping }"
        />
      </div>

      <!-- 4. 翻落下半叶：展示新数字 (backVal) 的下半部并翻落下盖 -->
      <div
        class="card-half bottom flap"
        :class="{ 'flip-bottom': isFlipping }"
      >
        <div class="card-text">
          {{ backVal }}
        </div>
        <div
          class="card-shadow bottom"
          :class="{ 'shadow-out': isFlipping }"
        />
      </div>

      <!-- 中央物理分割细缝与两侧金属铰链合页扣 -->
      <div class="split-line" />
      <div class="card-hinge left" />
      <div class="card-hinge right" />
    </div>

    <!-- 底部微型单位标签 -->
    <div
      v-if="label"
      class="unit-label"
    >
      {{ label }}
    </div>
  </div>
</template>

<style scoped>
.flip-unit-root {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
}

.flip-card-wrapper {
  position: relative;
  width: 74px;
  height: 84px;
  perspective: 600px;
  border-radius: 8px;
  background: var(--user-bg, #141417);
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.6),
    0 2px 6px rgba(0, 0, 0, 0.4);
}

/* 半片卡片容器 */
.card-half {
  position: absolute;
  left: 0;
  right: 0;
  overflow: hidden;
  background: var(--user-bg, #141417);
  box-sizing: border-box;
}

.card-half.top {
  top: 0;
  height: 42px; /* 84px / 2 */
  border-radius: 8px 8px 0 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-bottom: none;
  transform-origin: center bottom;
}

.card-half.bottom {
  top: 42px; /* 84px / 2 */
  height: 42px; /* 84px / 2 */
  border-radius: 0 0 8px 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-top: none;
  transform-origin: center top;
}

/* 文字渲染与精准垂直分割对齐 */
.card-text {
  position: absolute;
  left: 0;
  right: 0;
  height: 84px;
  line-height: 84px;
  text-align: center;
  font-family: 'Bebas Neue', 'Oswald', sans-serif;
  font-size: 58px;
  font-weight: 400;
  color: var(--user-text, #ffffff);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.card-half.top .card-text {
  top: 0;
}

.card-half.bottom .card-text {
  top: -42px; /* 严格向上平移 42px，与上半部无缝拼接 */
}

/* 3D 翻页叶片层 */
.card-half.flap {
  backface-visibility: hidden;
  will-change: transform;
}

.card-half.top.flap {
  z-index: 3;
}

.card-half.bottom.flap {
  transform: rotateX(90deg);
  z-index: 2;
}

/* 翻折动画 */
.card-half.top.flap.flip-top {
  animation: flipTopAnim 0.26s cubic-bezier(0.4, 0, 0.6, 1) forwards;
}

.card-half.bottom.flap.flip-bottom {
  animation: flipBottomAnim 0.26s cubic-bezier(0.2, 0.8, 0.4, 1) 0.25s forwards;
}

@keyframes flipTopAnim {
  0% {
    transform: rotateX(0deg);
  }
  100% {
    transform: rotateX(-90deg);
  }
}

@keyframes flipBottomAnim {
  0% {
    transform: rotateX(90deg);
  }
  85% {
    transform: rotateX(-3deg);
  }
  100% {
    transform: rotateX(0deg);
  }
}

/* 动态明暗光影 */
.card-shadow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.card-shadow.top {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.85) 100%);
  opacity: 0;
}

.card-shadow.top.shadow-in {
  animation: shadowIn 0.26s ease-in forwards;
}

.card-shadow.bottom {
  background: linear-gradient(0deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.85) 100%);
  opacity: 1;
}

.card-shadow.bottom.shadow-out {
  animation: shadowOut 0.26s ease-out 0.25s forwards;
}

@keyframes shadowIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes shadowOut {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

/* 中央物理分割黑缝与金属合页 */
.split-line {
  position: absolute;
  top: 41.5px;
  left: 0;
  right: 0;
  height: 1.5px;
  background: #09090b;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08);
  z-index: 5;
  pointer-events: none;
}

.card-hinge {
  position: absolute;
  top: 38px;
  width: 3px;
  height: 8px;
  background: #3f3f46;
  border-radius: 1px;
  z-index: 6;
  pointer-events: none;
}
.card-hinge.left { left: 0; }
.card-hinge.right { right: 0; }

.unit-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #a1a1aa;
  margin-top: 6px;
  text-transform: uppercase;
}
</style>
