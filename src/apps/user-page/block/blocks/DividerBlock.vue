<script setup lang="ts">
import { computed } from 'vue'

import { isBlockPropertyAvailable } from '../propertyCapabilities'

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()
const propsObj = computed<Record<string, any>>(() => {
  if (!props.blockProps || typeof props.blockProps !== 'object' || Array.isArray(props.blockProps)) return {}
  return props.blockProps as any
})

const text = computed(() => (typeof propsObj.value.text === 'string' ? propsObj.value.text : ''))

const titlePlacement = computed<'left' | 'center' | 'right'>(() => {
  if (!isBlockPropertyAvailable('divider', propsObj.value, 'titlePlacement')) return 'center'
  const v = propsObj.value.titlePlacement
  if (v === 'left' || v === 'right' || v === 'center') return v
  return 'center'
})

function clampMargin(v: unknown): number | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n < 0) return 0
  if (n > 80) return 80
  return n
}

const dividerStyle = computed(() => {
  const mt = clampMargin(propsObj.value.marginTop)
  const mb = clampMargin(propsObj.value.marginBottom)
  return {
    marginTop: mt === null ? undefined : `${mt}px`,
    marginBottom: mb === null ? undefined : `${mb}px`,
  }
})
</script>

<template>
  <div
    v-if="text"
    class="flex items-center my-4"
    :style="dividerStyle"
  >
    <div
      class="h-px bg-border flex-1"
      :class="{ 'max-w-[40px]': titlePlacement === 'left', hidden: titlePlacement === 'left' && false }"
    />
    <span
      class="text-xs text-muted-foreground font-medium px-3 shrink-0"
      :class="{
        'pl-0 pr-3': titlePlacement === 'left',
        'pr-0 pl-3': titlePlacement === 'right',
      }"
    >
      {{ text }}
    </span>
    <div
      class="h-px bg-border flex-1"
      :class="{ 'max-w-[40px]': titlePlacement === 'right' }"
    />
  </div>
  <div
    v-else
    class="h-px bg-border my-4 w-full"
    :style="dividerStyle"
  />
</template>
