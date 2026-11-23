<script setup lang="ts">
import { AlertTriangle, Info, Lightbulb, ShieldAlert } from 'lucide-vue-next'
import { computed } from 'vue'

import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'

const props = withDefaults(
  defineProps<{
    type?: 'info' | 'tip' | 'warning' | 'danger'
    title?: string
  }>(),
  {
    type: 'info',
    title: undefined,
  },
)

const variantMap = {
  info: 'info',
  tip: 'success',
  warning: 'warning',
  danger: 'destructive',
} as const

const iconMap = {
  info: Info,
  tip: Lightbulb,
  warning: AlertTriangle,
  danger: ShieldAlert,
} as const

const defaultTitleMap = {
  info: '说明',
  tip: '小技巧',
  warning: '注意',
  danger: '重要提醒',
} as const

const alertVariant = computed(() => variantMap[props.type])
const iconComp = computed(() => iconMap[props.type])
const heading = computed(() => props.title ?? defaultTitleMap[props.type])
</script>

<template>
  <Alert
    :variant="alertVariant"
    class="my-4"
  >
    <template #icon>
      <component
        :is="iconComp"
        class="size-4"
      />
    </template>
    <AlertTitle class="text-xs font-semibold tracking-wide">
      {{ heading }}
    </AlertTitle>
    <AlertDescription class="mt-1 text-[13px] leading-relaxed [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
      <slot />
    </AlertDescription>
  </Alert>
</template>
