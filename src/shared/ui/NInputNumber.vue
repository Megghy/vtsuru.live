<script setup lang="ts">
import { NInputNumber as RawInputNumber } from 'naive-ui'
import { computed, ref, useAttrs, useSlots } from 'vue'

defineOptions({ inheritAttrs: false, name: 'NInputNumber' })
// 加减只用 click。naive-ui 长按靠 mouseup 停止，事件丢失后会每 100ms 连加。

const model = defineModel<number | null>('value')
const attrs = useAttrs()
const slots = useSlots()
const inner = ref<{ focus: () => void; blur: () => void; select: () => void }>()

defineExpose({
  focus: () => inner.value?.focus(),
  blur: () => inner.value?.blur(),
  select: () => inner.value?.select(),
})

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const showButton = computed(() => attrs.showButton !== false && attrs['show-button'] !== false)
const placement = computed(() => String(attrs.buttonPlacement ?? attrs['button-placement'] ?? 'right'))
const isDisabled = computed(() => Boolean(attrs.disabled || attrs.readonly))
const step = computed(() => {
  const n = toNumber(attrs.step)
  return n && n !== 0 ? Math.abs(n) : 1
})

const forwarded = computed(() => {
  const rest = { ...attrs } as Record<string, unknown>
  delete rest.showButton
  delete rest['show-button']
  delete rest.buttonPlacement
  delete rest['button-placement']
  return rest
})

function change(dir: 1 | -1) {
  if (isDisabled.value) return
  const min = toNumber(attrs.min)
  const max = toNumber(attrs.max)
  let next: number
  if (model.value == null) {
    next = min != null ? Math.max(0, min) : 0
  } else {
    const precision = Number(attrs.precision)
    const digits = Number.isFinite(precision)
      ? precision
      : Math.max(String(step.value).split('.')[1]?.length ?? 0, String(model.value).split('.')[1]?.length ?? 0)
    next = Number((model.value + dir * step.value).toFixed(digits))
  }
  if (min != null) next = Math.max(min, next)
  if (max != null) next = Math.min(max, next)
  const validator = attrs.validator as ((value: number) => boolean) | undefined
  if (typeof validator === 'function' && !validator(next)) return
  model.value = next
}

const minusDisabled = computed(() => {
  if (isDisabled.value) return true
  const min = toNumber(attrs.min)
  return min != null && model.value != null && model.value <= min
})
const addDisabled = computed(() => {
  if (isDisabled.value) return true
  const max = toNumber(attrs.max)
  return max != null && model.value != null && model.value >= max
})
</script>

<template>
  <RawInputNumber
    ref="inner"
    v-bind="forwarded"
    v-model:value="model"
    :show-button="false"
  >
    <template
      v-if="slots.prefix || (showButton && placement === 'both')"
      #prefix
    >
      <button
        v-if="showButton && placement === 'both'"
        type="button"
        class="vts-ninput-btn"
        tabindex="-1"
        :disabled="minusDisabled"
        aria-label="减少"
        @mousedown.prevent
        @click="change(-1)"
      >
        −
      </button>
      <slot name="prefix" />
    </template>
    <template
      v-if="slots.suffix || showButton"
      #suffix
    >
      <slot name="suffix" />
      <template v-if="showButton">
        <button
          v-if="placement !== 'both'"
          type="button"
          class="vts-ninput-btn"
          tabindex="-1"
          :disabled="minusDisabled"
          aria-label="减少"
          @mousedown.prevent
          @click="change(-1)"
        >
          −
        </button>
        <button
          type="button"
          class="vts-ninput-btn"
          tabindex="-1"
          :disabled="addDisabled"
          aria-label="增加"
          @mousedown.prevent
          @click="change(1)"
        >
          +
        </button>
      </template>
    </template>
  </RawInputNumber>
</template>

<style scoped>
.vts-ninput-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--vtsuru-fg-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  user-select: none;
}
.vts-ninput-btn:hover:not(:disabled) {
  color: var(--vtsuru-fg);
}
.vts-ninput-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
