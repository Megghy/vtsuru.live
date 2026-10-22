<script setup lang="ts">
import { computed } from 'vue'

import BlockCard from '../BlockCard.vue'
import { normalizeTextAppearance, textAppearanceClass } from '../textAppearance'

import '../textAppearance.css'

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()
const propsObj = computed<Record<string, any>>(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as any)
      : {}
  return o
})
const text = computed(() => (typeof propsObj.value.text === 'string' ? propsObj.value.text : ''))
const framed = computed(() => (typeof propsObj.value.framed === 'boolean' ? propsObj.value.framed : true))
const backgrounded = computed(() =>
  typeof propsObj.value.backgrounded === 'boolean' ? propsObj.value.backgrounded : true,
)
const appearance = computed(() => normalizeTextAppearance(propsObj.value))
const fxClass = computed(() => textAppearanceClass(appearance.value))
</script>

<template>
  <BlockCard
    :framed="framed"
    :backgrounded="backgrounded"
  >
    <div
      class="block whitespace-pre-wrap leading-[1.8] text-sm text-foreground"
      :class="[fxClass, fxClass.includes('vtsuru-text-fx--typewriter') ? 'whitespace-nowrap' : '']"
    >
      {{ text }}
    </div>
  </BlockCard>
</template>


