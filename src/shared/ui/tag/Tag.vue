<script setup lang="ts">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    type?: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'
    size?: 'tiny' | 'small' | 'medium' | 'large'
    round?: boolean
    bordered?: boolean
    closable?: boolean
    disabled?: boolean
  }>(),
  {
    type: 'default',
    size: 'small',
    round: false,
    bordered: true,
    closable: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  close: [e: MouseEvent]
}>()

const typeClasses = computed(() => {
  switch (props.type) {
    case 'primary':
    case 'info':
      return props.bordered
        ? 'border-brand/40 bg-brand/10 text-brand'
        : 'bg-brand text-brand-foreground border-transparent'
    case 'success':
      return props.bordered
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        : 'bg-emerald-500 text-white border-transparent'
    case 'warning':
      return props.bordered
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'bg-amber-500 text-white border-transparent'
    case 'error':
      return props.bordered
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : 'bg-destructive text-destructive-foreground border-transparent'
    default:
      return props.bordered
        ? 'border-border bg-muted/50 text-foreground'
        : 'bg-muted text-muted-foreground border-transparent'
  }
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'tiny':
      return 'h-4.5 px-1.5 text-[10px]'
    case 'large':
      return 'h-7 px-3 text-xs'
    case 'medium':
      return 'h-6 px-2.5 text-xs'
    default:
      return 'h-5.5 px-2 text-[11px]'
  }
})
</script>

<template>
  <span
    class="inline-flex items-center justify-center font-medium transition-colors select-none"
    :class="[
      sizeClasses,
      typeClasses,
      round ? 'rounded-full' : 'rounded-md',
      bordered ? 'border' : 'border-0',
      disabled ? 'opacity-50 pointer-events-none' : '',
    ]"
  >
    <slot name="icon" />
    <slot />
    <button
      v-if="closable"
      type="button"
      class="ml-1 inline-flex items-center justify-center size-3 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
      @click.stop="emit('close', $event)"
    >
      <X class="size-2.5" />
    </button>
  </span>
</template>
