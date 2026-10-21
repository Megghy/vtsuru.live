<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { useVModel } from "@vueuse/core"
import { cn } from '@/shared/utils/cn'

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes["class"]
}>()

const emits = defineEmits<{
  (e: "update:modelValue", payload: string | number): void
}>()

const modelValue = useVModel(props, "modelValue", emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <input v-model="modelValue" :class="cn('flex h-[var(--ui-height,2rem)] w-full rounded-md border-[length:var(--ui-border-width,1px)] [border-style:var(--ui-border-style,solid)] border-input bg-background px-2.5 py-1 text-xs text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-foreground file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:text-[var(--muted-foreground)] disabled:placeholder:text-[var(--vtsuru-page-placeholder-disabled,var(--muted-foreground))] transition-colors', props.class)">
</template>
