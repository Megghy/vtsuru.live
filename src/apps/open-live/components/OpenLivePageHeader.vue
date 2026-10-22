<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <div class="flex justify-between items-center flex-wrap gap-3">
    <div>
      <div class="[&_*]:text-lg [&_*]:leading-tight">
        <slot name="title">
          <span class="font-semibold text-foreground">
            {{ title }}
          </span>
        </slot>
      </div>
      <div
        v-if="$slots.description || description"
        class="mt-0.5 text-xs text-muted-foreground"
      >
        <slot name="description">
          {{ description }}
        </slot>
      </div>
    </div>
    <div class="flex gap-2 flex-wrap items-center justify-end">
      <slot name="actions" />
    </div>
  </div>
</template>
