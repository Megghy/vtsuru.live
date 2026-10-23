<script lang="ts" setup>
withDefaults(
  defineProps<{
    label: string
    labelPlacement?: 'left' | 'top'
  }>(),
  {
    labelPlacement: 'left',
  },
)
</script>

<template>
  <span
    class="flex gap-3 py-1.5 min-w-0"
    :class="
      labelPlacement === 'top' ? 'flex-col items-stretch gap-1' : 'flex-row items-center justify-between flex-wrap'
    "
  >
    <span class="text-xs text-foreground">
      {{ label }}
    </span>
    <span
      class="inline-flex items-center min-w-0"
      :class="labelPlacement === 'left' ? 'justify-end' : ''"
    >
      <slot />
    </span>
  </span>
</template>
